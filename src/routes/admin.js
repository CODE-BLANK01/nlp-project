import express from "express";
import { requireAuth } from "../middlewares/authRequired.js";
import { requireRole } from "../middlewares/requireRole.js";
import { renderPage } from "../middlewares/renderHelper.js";

const router = express.Router();

router.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  // fetch users for this tenant
  const users = [
    { email: "emp@tenant.com", role: "EMPLOYEE" },
    { email: "hr@tenant.com", role: "HR" },
    { email: "admin@tenant.com", role: "ADMIN" },
  ];
  renderPage(res, "admin", { user: req.session.user, users });
});

export default router;