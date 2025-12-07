// src/middlewares/requireRole.js
const RANK = { EMPLOYEE: 0, MANAGER: 1, HR: 2, ADMIN: 3 };

export function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if ((RANK[req.user.role] ?? 0) >= RANK[minRole]) {
      return next();
    }
    return res.status(403).json({ error: 'forbidden' });
  };
}