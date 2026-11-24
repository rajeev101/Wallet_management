const { Expo } = require("expo-server-sdk");
const PushDevice = require("../models/pushDevice.model");
const PushDelivery = require("../models/pushDelivery.model");
const User = require("../models/user.model");

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
const receiptDelay = 15 * 60 * 1000;

async function deliver(job) {
  const owner = await User.findOne({ _id: job.recipient, accountType: { $in: ["student", "customer"] } }).select("_id");
  const devices = owner ? await PushDevice.find({ owner: job.recipient, expiresAt: { $gt: new Date() } }).lean() : [];
  const accepted = new Set(job.tickets.map(ticket => ticket.token));
  const messages = devices.filter(device => !accepted.has(device.token)).map(device => ({
    to: device.token, title: job.title, body: job.body, sound: "default", channelId: "transactions", priority: "high", ttl: 86400,
    data: { screen: "Notifications", transactionId: String(job.transactionId), recipientId: String(job.recipient) },
  }));
  let retry = false;
  for (const chunk of expo.chunkPushNotifications(messages)) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    for (const [index, ticket] of tickets.entries()) {
      const token = chunk[index].to;
      if (ticket.status === "ok") {
        await PushDelivery.updateOne({ _id: job._id }, { $push: { tickets: { token, receiptId: ticket.id } } });
      } else if (ticket.details?.error === "DeviceNotRegistered") {
        await PushDevice.deleteOne({ token, owner: job.recipient });
      } else {
        retry = true;
        console.error("Push ticket rejected:", ticket.details?.error || "UnknownError");
      }
    }
  }
  if (retry) throw new Error("Push delivery temporarily rejected");
  await PushDelivery.updateOne({ _id: job._id }, { $set: { status: "sent", completedAt: new Date(), nextAttemptAt: new Date(Date.now() + receiptDelay) }, $unset: { lockedUntil: 1 } });
}

async function checkReceipts() {
  const jobs = await PushDelivery.find({ status: { $in: ["sent", "failed"] }, "tickets.0": { $exists: true }, nextAttemptAt: { $lte: new Date() } }).limit(10);
  for (const job of jobs) {
    const resolved = [];
    for (const chunk of expo.chunkPushNotificationReceiptIds(job.tickets.map(ticket => ticket.receiptId))) {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const ticket of job.tickets) {
        const receipt = receipts[ticket.receiptId];
        if (!receipt) continue;
        resolved.push(ticket.receiptId);
        if (receipt.status === "error") {
          console.error("Push delivery receipt failed:", receipt.details?.error || "UnknownError");
          if (receipt.details?.error === "DeviceNotRegistered") {
            await PushDevice.deleteOne({ token: ticket.token, owner: job.recipient });
          }
        }
      }
    }
    const expired = Date.now() - new Date(job.completedAt).getTime() > 24 * 60 * 60 * 1000;
    await PushDelivery.updateOne({ _id: job._id }, {
      ...(expired ? { $set: { tickets: [] } } : { $pull: { tickets: { receiptId: { $in: resolved } } }, $set: { nextAttemptAt: new Date(Date.now() + receiptDelay) } }),
    });
  }
}

async function runPushWorkerOnce() {
  for (let count = 0; count < 20; count += 1) {
    const now = new Date();
    const job = await PushDelivery.findOneAndUpdate({ $or: [
      { status: "pending", nextAttemptAt: { $lte: now } },
      { status: "sending", lockedUntil: { $lte: now } },
    ] }, { $set: { status: "sending", lockedUntil: new Date(Date.now() + 120000) }, $inc: { attempts: 1 } }, { new: true, sort: { createdAt: 1 } });
    if (!job) break;
    if (Date.now() - new Date(job.createdAt).getTime() > 24 * 60 * 60 * 1000) {
      await PushDelivery.updateOne({ _id: job._id }, { $set: { status: "failed", completedAt: now }, $unset: { lockedUntil: 1 } });
      continue;
    }
    try { await deliver(job); }
    catch (error) {
      const exhausted = job.attempts >= 8;
      console.error("Push delivery attempt failed:", error.name);
      await PushDelivery.updateOne({ _id: job._id }, {
        $set: { status: exhausted ? "failed" : "pending", nextAttemptAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts)), ...(exhausted ? { completedAt: new Date() } : {}) },
        $unset: { lockedUntil: 1 },
      });
    }
  }
  await checkReceipts();
}

function startPushWorker() {
  if (process.env.PUSH_NOTIFICATIONS_ENABLED !== "true") return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runPushWorkerOnce(); }
    catch (error) { console.error("Push worker failed:", error.name); }
    finally { running = false; }
  };
  const timer = setInterval(() => { void tick(); }, 10000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}

module.exports = { startPushWorker, runPushWorkerOnce };