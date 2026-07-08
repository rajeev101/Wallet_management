const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const sendOTPEmail = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: `Campus Wallet <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Password Reset OTP - Campus Wallet",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(145deg, #5200c9 0%, #3d66c5 45%, #08b4c9 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Campus Wallet</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Secure Campus Payments</p>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #e8eef8; border-radius: 0 0 10px 10px;">
            <h2 style="color: #070d2e; font-size: 24px; margin: 0 0 20px 0;">Password Reset Request</h2>
            
            <p style="color: #657398; font-size: 16px; margin: 0 0 20px 0;">
              We received a request to reset your Campus Wallet password. Use the OTP below to proceed with your password reset.
            </p>
            
            <div style="background: #f5f7fc; border: 2px solid #cbd6ea; border-radius: 10px; padding: 20px; text-align: center; margin: 30px 0;">
              <p style="color: #657398; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
              <p style="color: #070d2e; font-size: 36px; font-weight: bold; margin: 0; letter-spacing: 5px;">${otp}</p>
            </div>
            
            <p style="color: #657398; font-size: 14px; margin: 20px 0;">
              This OTP will expire in <strong>5 minutes</strong>. If you didn't request this, you can safely ignore this email.
            </p>
            
            <div style="background: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>⚠️ Security Tip:</strong> Never share your OTP with anyone, including Campus Wallet staff.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e8eef8; margin: 30px 0;">
            
            <p style="color: #657398; font-size: 12px; margin: 0; text-align: center;">
              If you need further assistance, contact our support team.
            </p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};

const sendPasswordResetSuccessEmail = async (email, name) => {
  try {
    await transporter.sendMail({
      from: `Campus Wallet <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Successful - Campus Wallet",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(145deg, #5200c9 0%, #3d66c5 45%, #08b4c9 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Campus Wallet</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Secure Campus Payments</p>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #e8eef8; border-radius: 0 0 10px 10px;">
            <h2 style="color: #070d2e; font-size: 24px; margin: 0 0 20px 0;">✓ Password Reset Successful</h2>
            
            <p style="color: #657398; font-size: 16px; margin: 0 0 20px 0;">
              Hi ${name || "User"},
            </p>
            
            <p style="color: #657398; font-size: 16px; margin: 0 0 20px 0;">
              Your password has been successfully reset. You can now sign in to your Campus Wallet account with your new password.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://campuswallet.com'}/login" style="background: #5200c9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Sign In Now</a>
            </div>
            
            <p style="color: #657398; font-size: 14px; margin: 20px 0;">
              If you didn't perform this action, please secure your account immediately by contacting our support team.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e8eef8; margin: 30px 0;">
            
            <p style="color: #657398; font-size: 12px; margin: 0; text-align: center;">
              Campus Wallet Security Team
            </p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Error sending password reset success email:", error);
    throw new Error("Failed to send confirmation email");
  }
};

module.exports = {
  sendOTPEmail,
  sendPasswordResetSuccessEmail,
};
