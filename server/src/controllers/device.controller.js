const User = require("../models/user.model");
const mongoose = require("mongoose");
const DeviceAttempt = require("../models/deviceAttempt.model");
const { DeviceError, resetDevice, publicDevice } = require("../services/deviceBinding.service");

const accountFields = "name email phone student_id samagra_id accountType authVersion deviceLockEnabled +deviceBinding";

function pagination(query) {
  const parse = (value, fallback, maximum) => {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^[1-9][0-9]{0,5}$/.test(value) || Number(value) > maximum) {
      throw new DeviceError("INVALID_QUERY", "Invalid pagination parameters.", 400);
    }
    return Number(value);
  };
  return { page: parse(query.page, 1, 100000), limit: parse(query.limit, 20, 100) };
}

function serializeUser(user) {
  return { _id: user._id, name: user.name, email: user.email, phone: user.phone, student_id: user.student_id, samagra_id: user.samagra_id,
    accountType: user.accountType, authVersion: user.authVersion || 0, deviceLockEnabled: true,
    lockStatus: user.deviceBinding ? "locked" : "unbound", device: publicDevice(user.deviceBinding) };
}

async function findUser(id, includeHistory = false) {
  if (typeof id !== "string" || !/^[0-9a-f]{24}$/i.test(id)) throw new DeviceError("INVALID_USER_ID", "Invalid user ID.", 400);
  const user = await User.findOne({ _id: id, accountType: { $in: ["student", "customer"] } })
    .select(`${accountFields}${includeHistory ? " +deviceResetHistory" : ""}`);
  if (!user) throw new DeviceError("USER_NOT_FOUND", "Student or Customer not found.", 404);
  return user;
}

function respondError(res, error) {
  return res.status(error instanceof DeviceError ? error.status : 503).json({ success: false,
    code: error instanceof DeviceError ? error.code : "DEVICE_MANAGEMENT_UNAVAILABLE",
    message: error instanceof DeviceError ? error.message : "Device management is temporarily unavailable. Please try again." });
}

exports.listDevices = async (req, res) => {
  try {
    const { page, limit } = pagination(req.query);
    const { role, status, search, sort = "name", direction = "asc" } = req.query;
    if ((role && !["student", "customer"].includes(role)) || (status && !["locked", "unbound"].includes(status))
      || !["name", "registeredAt", "lastLoginAt"].includes(sort) || !["asc", "desc"].includes(direction)
      || (search !== undefined && (typeof search !== "string" || search.length > 200))) {
      throw new DeviceError("INVALID_QUERY", "Invalid device filter or sorting parameters.", 400);
    }
    const query = { accountType: role || { $in: ["student", "customer"] } };
    if (status) query["deviceBinding.id"] = { $exists: status === "locked" };
    if (search?.trim()) {
      const pattern = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = ["name", "email", "phone", "student_id", "samagra_id"].map(field => ({ [field]: pattern }));
      if (/^[0-9a-f]{24}$/i.test(search.trim())) query.$or.push({ _id: search.trim() });
    }
    const sortField = sort === "name" ? "name" : `deviceBinding.${sort}`;
    const [users, total] = await Promise.all([
      User.find(query).select(accountFields).sort({ [sortField]: direction === "asc" ? 1 : -1, _id: 1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(query),
    ]);
    return res.json({ success: true, devices: users.map(serializeUser), page, limit, total, hasMore: page * limit < total });
  } catch (error) { return respondError(res, error); }
};

exports.getDevice = async (req, res) => {
  try { return res.json({ success: true, user: serializeUser(await findUser(req.params.id)) }); }
  catch (error) { return respondError(res, error); }
};

exports.resetUserDevice = async (req, res) => {
  try {
    const user = await findUser(req.params.id);
    if (!Number.isSafeInteger(req.body?.expectedVersion) || req.body.expectedVersion !== (user.authVersion || 0)) {
      throw new DeviceError("AUTH_STATE_CHANGED", "Device details changed. Reload before resetting.", 409);
    }
    const updated = await resetDevice(user, req.admin, req.body.reason);
    return res.json({ success: true, code: "DEVICE_RESET_SUCCESS", message: "Device reset. All existing sessions are revoked; the next mobile login will register a device.", user: serializeUser(updated) });
  } catch (error) { return respondError(res, error); }
};

exports.getResetHistory = async (req, res) => {
  try {
    const { page, limit } = pagination(req.query);
    const user = await findUser(req.params.id);
    const [result] = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(user._id) } },
      { $project: { history: { $slice: [{ $reverseArray: { $ifNull: ["$deviceResetHistory", []] } }, (page - 1) * limit, limit] }, total: { $size: { $ifNull: ["$deviceResetHistory", []] } } } },
    ]);
    return res.json({ success: true, history: result.history, total: result.total, page, limit, hasMore: page * limit < result.total });
  } catch (error) { return respondError(res, error); }
};

exports.getBlockedAttempts = async (req, res) => {
  try {
    const { page, limit } = pagination(req.query);
    const user = await findUser(req.params.id);
    const query = { user: user._id };
    const [attempts, total] = await Promise.all([
      DeviceAttempt.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), DeviceAttempt.countDocuments(query),
    ]);
    return res.json({ success: true, attempts, total, page, limit, hasMore: page * limit < total });
  } catch (error) { return respondError(res, error); }
};