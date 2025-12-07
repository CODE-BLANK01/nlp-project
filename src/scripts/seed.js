// scripts/seed.js
import { prisma } from '../src/prisma.js';

const TENANT_NAME = 'smartech';
const ADMIN_EMAIL = 'admin@smartech.test';

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { name: TENANT_NAME },
    update: {},
    create: { name: TENANT_NAME },
  });

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: ADMIN_EMAIL } },
    update: { role: 'ADMIN' },
    create: { email: ADMIN_EMAIL, tenantId: tenant.id, role: 'ADMIN' },
  });

  console.log({ tenant, admin });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });