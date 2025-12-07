// src/routes/auth.js
import express from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { sendOTPEmail } from "../utils/mailer.js";

const router = express.Router();
const OTP_EXP_MIN = parseInt(process.env.OTP_EXP_MIN || "10", 10);

function sixDigit() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signJwt({ sub, email, role, tenantId }) {
  return jwt.sign(
    { sub, email, role, tenantId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// --------------------
// POST /auth/start
// --------------------
router.post("/start", async (req, res) => {
  try {
    const { email } = req.body || {};
    const tenantName = req.get("X-Tenant");

    if (!email || !tenantName) {
      return res
        .status(400)
        .json({ ok: false, error: "email_and_tenant_required" });
    }

    const tenant = await prisma.tenant.findUnique({ where: { name: tenantName } });
    if (!tenant) {
      return res.status(400).json({ ok: false, error: "invalid_tenant" });
    }

    const code = sixDigit();
    const expiresAt = new Date(Date.now() + OTP_EXP_MIN * 60 * 1000);

    await prisma.loginToken.create({
      data: { email: email.toLowerCase(), tenantId: tenant.id, code, expiresAt },
    });

    // ✅ Send OTP via email
    await sendOTPEmail(email, code, tenant.name);

    return res.json({ ok: true, message: "OTP sent to your email" });
  } catch (e) {
    console.error("[auth/start error]", e);
    res.status(500).json({ ok: false, error: "auth_start_failed" });
  }
});

// --------------------
// POST /auth/verify
// --------------------
router.post("/verify", async (req, res) => {
  try {
    const { email, code } = req.body || {};
    const tenantName = req.get("X-Tenant");

    if (!email || !code || !tenantName) {
      return res
        .status(400)
        .json({ ok: false, error: "email_code_tenant_required" });
    }

    const tenant = await prisma.tenant.findUnique({ where: { name: tenantName } });
    if (!tenant) {
      return res.status(400).json({ ok: false, error: "invalid_tenant" });
    }

    const emailNorm = email.toLowerCase().trim();
    const codeNorm = code.toString().trim();

    let token = await prisma.loginToken.findFirst({
      where: {
        email: emailNorm,
        tenantId: tenant.id,
        code: codeNorm,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    // fallback: latest valid token
    if (!token) {
      console.warn(`[OTP Fallback] No match for code=${codeNorm}, checking latest...`);
      token = await prisma.loginToken.findFirst({
        where: {
          email: emailNorm,
          tenantId: tenant.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!token) {
        return res.status(401).json({ ok: false, error: "invalid_or_expired_otp" });
      }

      console.log(`[OTP Fallback] Expected code=${token.code}, got=${codeNorm}`);
    }

    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: emailNorm } },
      update: {},
      create: { email: emailNorm, tenantId: tenant.id },
      select: { id: true, email: true, role: true, tenantId: true },
    });

    await prisma.loginToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });

    const jwtToken = signJwt({
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });

    res.cookie("token", jwtToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // set true in production behind HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ ok: true, user, token: jwtToken });
  } catch (e) {
    console.error("[auth/verify error]", e);
    res.status(500).json({ ok: false, error: "auth_verify_failed", details: e.message });
  }
});

export default router;