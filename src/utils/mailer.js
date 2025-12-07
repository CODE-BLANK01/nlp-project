// src/utils/mailer.js
import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail", // or "hotmail", "yahoo"
  auth: {
    user: process.env.MAIL_USER, // your email
    pass: process.env.MAIL_PASS, // app password (not your real password)
  },
});

export async function sendOTPEmail(to, code, tenant) {
  const info = await transporter.sendMail({
    from: `"${tenant} Auth" <${process.env.MAIL_USER}>`,
    to,
    subject: "Your OTP Code",
    text: `Your login code is: ${code}\n\nThis code will expire in 10 minutes.`,
    html: `
      <p>Hello,</p>
      <p>Your login code for <b>${tenant}</b> is:</p>
      <h2>${code}</h2>
      <p>This code will expire in 10 minutes.</p>
    `,
  });
  console.log(`📧 OTP sent to ${to}: ${info.messageId}`);
}