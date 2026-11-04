const WALLET_PAYER_ROLES = ["student", "customer"];

// Preserve legacy Student response fields; never label a Customer as a Student.
const formatTransaction = (transaction) => {
  const result = transaction.toObject();
  const holder = result.type === "payment" ? result.fromWallet?.owner : result.toWallet?.owner;
  result.accountHolder = holder;
  if (holder?.accountType === "customer") result.customer = holder;
  else result.student = holder;
  if (result.type === "payment") result.vendor = result.toWallet?.owner;
  if (result.type === "refund") result.vendor = result.fromWallet?.owner;
  return result;
};

module.exports = { WALLET_PAYER_ROLES, formatTransaction };