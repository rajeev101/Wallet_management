const User = require("../models/user.model");
const Notification = require("../models/notification.model");
const PushDelivery = require("../models/pushDelivery.model");

const messages = {
  payment: { title: "Payment completed", body: "Your wallet payment was completed. Open Campus Wallet to view the transaction.", type: "payment" },
  requested: { title: "Funding request submitted", body: "Your wallet funding request is pending review.", type: "wallet_request" },
  credited: { title: "Wallet credited", body: "Money has been added to your wallet. Open Campus Wallet to view the transaction.", type: "wallet_status" },
  approved: { title: "Funding request approved", body: "Your funding request was approved and your wallet was credited.", type: "wallet_status" },
  rejected: { title: "Funding request rejected", body: "Your funding request was rejected. Open Campus Wallet for details.", type: "wallet_status" },
};

async function notifyTransaction(recipient, transaction, event, { createInbox = true } = {}) {
  try {
    const message = messages[event];
    if (!message) return;
    const owner = await User.findOne({ _id: recipient, accountType: { $in: ["student", "customer"] } }).select("_id");
    if (!owner) return;
    await PushDelivery.updateOne({ eventKey: `${transaction._id}:${event}:${owner._id}` }, {
      $setOnInsert: { recipient: owner._id, transactionId: transaction._id, title: message.title, body: message.body },
    }, { upsert: true });
    if (createInbox) await Notification.create({ recipient: owner._id, type: message.type, text: `${message.title}: ${message.body}` });
  } catch (error) {
    console.error("Could not queue transaction notification:", error.name);
  }
}

module.exports = { notifyTransaction };