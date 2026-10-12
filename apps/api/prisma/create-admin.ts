/**
 * Create (or reset) a platform super user — production-safe, no demo data.
 *   npm run create-admin -w apps/api -- admin@nubiannetworks.com 'StrongPassword' "Your Name"
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const [email, password, name = 'Platform Admin'] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -w apps/api -- <email> <password (8+ chars)> [name]');
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

prisma.user
  .upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash: bcrypt.hashSync(password, 11), role: 'SYSTEM_ADMIN', organizationId: null, isActive: true, emailVerifiedAt: new Date() },
    create: { email: email.toLowerCase(), name, role: 'SYSTEM_ADMIN', passwordHash: bcrypt.hashSync(password, 11), emailVerifiedAt: new Date() },
  })
  .then((u) => console.log(`Platform admin ready: ${u.email}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
