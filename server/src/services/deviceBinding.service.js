const crypto = require("crypto");
const User = require("../models/user.model");
const DeviceAttempt = require("../models/deviceAttempt.model");

class DeviceError extends Error {
  constructor(code, message, status = 403) { super(message); this.code = code; this.status = status; }
}

const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const versionFilter = version => version === 0 ? { $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }] } : { authVersion: version };

function validateDevice(body) {
  if (body.clientType === undefined && body.device === undefined) return null;
  const device = body.device;
  if (body.clientType !== "mobile" || !device || typeof device !== "object" || Array.isArray(device)
    || typeof device.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(device.id)
    || typeof device.credential !== "string" || !/^[0-9a-f]{64}$/.test(device.credential)
    || !["android", "ios"].includes(device.platform)) {
    throw new DeviceError("INVALID_DEVICE_INFORMATION", "Valid mobile device information is required.", 400);
  }
  const result = { id: device.id.toLowerCase(), credentialHash: digest(device.credential), platform: device.platform };
  for (const field of ["name", "osVersion", "appVersion"]) {
    if (device[field] !== undefined && (typeof device[field] !== "string" || device[field].length > 120)) {
      throw new DeviceError("INVALID_DEVICE_INFORMATION", "Device information is invalid.", 400);
    }
    result[field] = device[field]?.trim() || "Unknown";
  }
  return result;
}

function publicDevice(binding) {
  if (!binding) return null;
  const { id, name, platform, osVersion, appVersion, registeredAt, lastLoginAt } = binding;
  return { id, name, platform, osVersion, appVersion, registeredAt, lastLoginAt };
}

async function rejectDevice(user, device) {
  await DeviceAttempt.create({ user: user._id, device: publicDevice(device), code: "DEVICE_ALREADY_REGISTERED" });
  throw new DeviceError("DEVICE_ALREADY_REGISTERED", "Your account is already registered on another device. Please contact admin.");
}

async function authorizeDeviceLogin(user, body) {
  if (!["student", "customer"].includes(user.accountType)) return { authVersion: user.authVersion || 0 };
  const device = validateDevice(body);
  if (!device) {
    if (user.deviceBinding || user.authVersion > 0) {
      if (user.deviceBinding) return rejectDevice(user, null);
      throw new DeviceError("MOBILE_DEVICE_REQUIRED", "Please sign in using the mobile app to register your device.");
    }
    return { authVersion: 0 };
  }
  let current = user;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const version = current.authVersion || 0;
    const binding = current.deviceBinding;
    if (binding && (binding.id !== device.id || !crypto.timingSafeEqual(Buffer.from(binding.credentialHash, "hex"), Buffer.from(device.credentialHash, "hex")))) {
      return rejectDevice(current, device);
    }
    const now = new Date();
    const filter = { _id: current._id, ...versionFilter(version), "deviceBinding.id": binding ? binding.id : { $exists: false } };
    const update = binding
      ? { $set: { "deviceBinding.lastLoginAt": now, "deviceBinding.name": device.name, "deviceBinding.osVersion": device.osVersion, "deviceBinding.appVersion": device.appVersion } }
      : { $set: { deviceBinding: { ...device, registeredAt: now, lastLoginAt: now }, deviceLockEnabled: true }, $inc: { authVersion: 1 } };
    const updated = await User.findOneAndUpdate(filter, update, { returnDocument: "after", runValidators: true }).select("+deviceBinding");
    if (updated) return { authVersion: updated.authVersion, deviceIdHash: digest(device.id) };
    current = await User.findById(user._id).select("+deviceBinding");
    if (!current || (!current.deviceBinding && current.authVersion !== version)) break;
  }
  throw new DeviceError("AUTH_STATE_CHANGED", "Account security settings changed. Please sign in again.", 409);
}

async function resetDevice(user, admin, reason) {
  if (admin?.accountType !== "admin") throw new DeviceError("ACCESS_DENIED", "Only an administrator can reset a device.");
  if (typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 500) {
    throw new DeviceError("INVALID_RESET_REASON", "Enter a reset reason between 10 and 500 characters.", 400);
  }
  reason = reason.trim();
  const history = { performedBy: admin._id, adminName: admin.name, reason, resetAt: new Date(), previousDevice: publicDevice(user.deviceBinding) };
  const updated = await User.findOneAndUpdate({ _id: user._id, accountType: { $in: ["student", "customer"] }, ...versionFilter(user.authVersion || 0) }, {
    $set: { deviceBinding: null, deviceLockEnabled: true }, $inc: { authVersion: 1 }, $push: { deviceResetHistory: history },
  }, { returnDocument: "after", runValidators: true });
  if (!updated) throw new DeviceError("AUTH_STATE_CHANGED", "The device changed during this operation. Reload and try again.", 409);
  return updated;
}

module.exports = { DeviceError, authorizeDeviceLogin, resetDevice, publicDevice, digest, validateDevice };