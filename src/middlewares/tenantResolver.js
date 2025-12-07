import { prisma } from "../prisma.js";

// export async function tenantResolver(req, res, next) {
//   try {
//     // 1. Try explicit header first
//     let hint = req.header("x-tenant");

//     // 2. If no header, fall back to subdomain
//     if (!hint) {
//       const host = req.headers.host || "";
//       const parts = host.split(".");
//       // only treat as subdomain if it's not just "localhost:3000"
//       if (parts.length > 2 || (parts.length === 2 && !host.includes("localhost"))) {
//         hint = parts[0]; // first part before the main domain
//       }
//     }

//     // 3. If no tenant hint found
//     if (!hint) {
//       return res.status(400).json({ error: "tenant_missing" });
//     }

//     // 4. Lookup tenant by name OR id
//     const tenant =
//       (await prisma.tenant.findUnique({ where: { name: hint } })) ||
//       (await prisma.tenant.findUnique({ where: { id: hint } }));

//     if (!tenant) {
//       return res.status(404).json({ error: "tenant_not_found" });
//     }

//     // 5. Attach to request
//     req.tenant = { id: tenant.id, name: tenant.name };
//     next();
//   } catch (err) {
//     console.error("[tenantResolver] error:", err);
//     res.status(500).json({ error: "tenant_resolver_failed", details: err.message });
//   }
// }

export async function tenantResolver(req, res, next) {
  try {
    let hint = req.session?.tenantId || req.header("x-tenant");
    if (!hint) return next(); // allow public routes

    const tenant =
      (await prisma.tenant.findUnique({ where: { id: hint } })) ||
      (await prisma.tenant.findUnique({ where: { name: hint } }));

    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });

    req.tenant = { id: tenant.id, name: tenant.name };
    next();
  } catch (err) {
    console.error("[tenantResolver] error:", err);
    res.status(500).json({ error: "tenant_resolver_failed" });
  }
}