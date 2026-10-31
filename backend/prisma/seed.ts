import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL!;
  await prisma.user.upsert({
    where: { email }, update: {},
    create: { email, name: "Admin", role: "ADMIN", passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD!, 10) },
  });
  console.log("Seeded admin:", email);
  // TODO(all): add sample products/plans/taxes for demos
}
main().finally(() => prisma.$disconnect());
