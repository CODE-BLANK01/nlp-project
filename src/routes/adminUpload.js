// src/routes/admin.js
import express from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middlewares/authRequired.js";
import { requireRole } from "../middlewares/requireRole.js";
import { processDocumentAsync } from "../utils/documentProcessor.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post(
  "/upload",
  requireAuth,
  requireRole("ADMIN"),
  upload.single("file"),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const isMultipart = Boolean(req.file);
      const body = req.body || {};

      let title = body.title?.trim();
      let visibility = (body.visibility || "EMPLOYEE").toUpperCase();
      let scope = (body.scope || "tenant").toLowerCase();
      let sourceUri = body.sourceUri || null;
      let mimeType = body.mimeType || "text/plain";
      let text = body.text;
      let buffer = null;

      if (isMultipart) {
        const { originalname, mimetype, buffer: fileBuffer, size } = req.file;
        console.log(`[upload] file=${originalname} type=${mimetype} size=${size}`);
        mimeType = mimetype || mimeType;
        if (!title) title = originalname.replace(/\.[^.]+$/, "");
        sourceUri = originalname;
        buffer = fileBuffer;
      } else if (text) {
        buffer = Buffer.from(text, "utf-8");
      }

      if (!title || !buffer) {
        return res
          .status(400)
          .json({ ok: false, error: "title_and_content_required" });
      }

      const ROLE_SET = new Set(["EMPLOYEE", "MANAGER", "HR", "ADMIN"]);
      if (!ROLE_SET.has(visibility)) visibility = "EMPLOYEE";

      // 🔑 tenant handling
      const tenantId = scope === "global" ? null : req.user.tenantId;

      // Save Document
      const doc = await prisma.document.create({
        data: {
          title,
          sourceUri,
          mimeType,
          visibility,
          tenant: tenantId ? { connect: { id: tenantId } } : undefined,
        },
        select: { id: true },
      });

      const responseTime = Date.now() - startTime;
      res.json({
        ok: true,
        documentId: doc.id,
        title,
        message: "✅ Document uploaded. Processing in background...",
        responseTime: `${responseTime}ms`,
        mode: isMultipart ? "multipart" : "json",
      });

      // 🔁 Async processing (now passes tenantId)
      setImmediate(async () => {
        try {
          await processDocumentAsync({
            documentId: doc.id,
            tenantId, // 👈 pass tenantId through
            buffer,
            mimeType,
            filename: sourceUri || title,
          });
        } catch (err) {
          console.error(`[Background] Processing failed for ${doc.id}:`, err);
        }
      });
    } catch (err) {
      console.error("[admin/upload error]", err);
      const responseTime = Date.now() - startTime;
      res.status(500).json({
        ok: false,
        error: "admin_upload_failed",
        details: err.message,
        responseTime: `${responseTime}ms`,
      });
    }
  }
);

export default router;