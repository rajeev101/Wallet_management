const nodemailer = require("nodemailer");

exports.sendVendorOnboardingEmail = async ({ email, password }) => {
  // Use the same email configuration as password-reset delivery. Never log credentials.
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
  });
  await transporter.sendMail({
    from: `Campus Wallet <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your vendor account - Campus Wallet",
    text: `An administrator has created your Campus Wallet vendor account.\n\nLogin: ${process.env.CLIENT_URL || "http://localhost:3000"}/login\nEmail: ${email}\nTemporary password: ${password}\n\nChange this password in Settings after signing in. Your administrator controls account activation. Never share these credentials.`,
  });
};