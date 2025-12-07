// src/index.js
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import askRoutes from "./routes/ask.js";
import adminUploadRoutes from "./routes/adminUpload.js";
import statusRoutes from "./routes/status.js";
// import healthRoutes from "./routes/health.js";

import { tenantResolver } from "./middlewares/tenantResolver.js";
import { prisma } from "./prisma.js"; // ✅ import prisma

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// tenant resolution (all routes depend on this)
app.use(tenantResolver);

// routes
app.use("/status", statusRoutes);
app.use("/auth", authRoutes);
app.use("/ask", askRoutes);
app.use("/admin", adminUploadRoutes);
// app.use("/health", healthRoutes);

// DB Connection check before starting server
async function startServer() {
  try {
    console.log("🔌 Connecting to database...");
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 API listening on :${PORT}`));
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1); // exit if db not connected
  }
}

// Prisma disconnect on process kill
process.on("SIGINT", async () => {
  console.log("⏳ Closing database connection...");
  await prisma.$disconnect();
  console.log("🛑 Database disconnected. Exiting.");
  process.exit(0);
});

startServer();