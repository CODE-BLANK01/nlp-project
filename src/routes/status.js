// import express from "express";
// import { prisma } from "../prisma.js";
// import { requireAuth } from "../middlewares/authRequired.js";

// const router = express.Router();

// router.get("/:docId", requireAuth, async (req, res) => {
//   try {
//     const doc = await prisma.document.findFirst({
//       where: { id: req.params.docId },
//       select: {
//         id: true,
//         title: true,
//         status: true,
//         errorMessage: true,
//         processedAt: true,
//         processingTimeMs: true,
//         chunksCount: true,
//         textLength: true,
//         createdAt: true,
//       },
//     });

//     if (!doc) return res.status(404).json({ error: "not_found" });
//     res.json({ ok: true, doc });
//   } catch (err) {
//     console.error("[status error]", err);
//     res.status(500).json({ error: "status_failed", details: err.message });
//   }
// });

// export default router;

import express from "express";
import { requireAuth } from "../middlewares/authRequired.js";
import { renderPage } from "../middlewares/renderHelper.js";

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  renderPage(res, "status", { user: req.session.user });
});

router.post("/", requireAuth, async (req, res) => {
  const { docId } = req.body;
  // lookup doc status from DB
  const doc = { id: docId, status: "Processing" };
  renderPage(res, "status", { user: req.session.user, doc });
});

export default router;