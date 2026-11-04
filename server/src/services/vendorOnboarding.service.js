const nodemailer = require("nodemailer");

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

exports.sendVendorOnboardingEmail = async ({ email, password }) => {
  const loginUrl = new URL("/vendor/login", process.env.CLIENT_URL || "http://localhost:3000");
  if (!["http:", "https:"].includes(loginUrl.protocol)) {
    throw new Error("CLIENT_URL must use HTTP or HTTPS");
  }
  const safeLoginUrl = escapeHtml(loginUrl.href);
  // Use the same email configuration as password-reset delivery. Never log credentials.
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
  });
  await transporter.sendMail({
    from: `Campus Wallet <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your vendor account - Campus Wallet",
    text: `An administrator has created your Campus Wallet vendor account.\n\nLogin: ${loginUrl.href}\nEmail: ${email}\nTemporary password: ${password}\n\nChange this password in Settings after signing in. Your administrator controls account activation. Never share these credentials.`,
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,sans-serif;color:#172033;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;">
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:24px;">Welcome to Campus Wallet</h1>
            <p style="line-height:1.6;">An administrator has created your Vendor account.</p>
            <p style="line-height:1.8;"><strong>Email:</strong> ${escapeHtml(email)}<br><strong>Temporary password:</strong> ${escapeHtml(password)}</p>
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
              <tr><td align="center" bgcolor="#5200c9" style="border-radius:8px;">
                <a href="${safeLoginUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:16px 24px;border:1px solid #5200c9;border-radius:8px;background:#5200c9;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;">Log in to Vendor Account</a>
              </td></tr>
            </table>
            <p style="font-size:13px;line-height:1.6;">If the button does not work, open <a href="${safeLoginUrl}" style="color:#5200c9;word-break:break-all;">${safeLoginUrl}</a>.</p>
            <p style="line-height:1.6;">Change your temporary password in Settings after signing in. Your administrator controls account activation.</p>
            <p style="font-size:13px;color:#667085;">Never share these credentials.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  });
};