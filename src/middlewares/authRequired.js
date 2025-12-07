// src/middlewares/authRequired.js
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  try {
    const raw = req.cookies?.token || req.headers.authorization?.replace(/^Bearer /, '');
    if (!raw) return res.status(401).json({ error: 'unauthorized' });

    const claims = jwt.verify(raw, process.env.JWT_SECRET);
    if (!claims?.tenantId || claims.tenantId !== req.tenant?.id) {
      return res.status(403).json({ error: 'wrong_tenant' });
    }
    req.user = { id: claims.sub, email: claims.email, role: claims.role, tenantId: claims.tenantId };
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}


