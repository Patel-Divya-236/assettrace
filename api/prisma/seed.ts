import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile();
} catch {
  // no .env file (e.g. seeding production with DATABASE_URL set in the shell)
}

const prisma = new PrismaClient();
const password = process.env.SEED_PASSWORD || "demo1234";

const users: { name: string; email: string; role: Role }[] = [
  { name: "Admin User", email: "admin@demo.in", role: Role.ADMIN },
  { name: "Field Officer", email: "officer@demo.in", role: Role.FIELD_OFFICER },
  { name: "Viewer", email: "viewer@demo.in", role: Role.VIEWER },
];

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);

  // upsert makes the seed safe to run more than once
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash },
      create: { ...user, passwordHash },
    });
  }
  console.log(`Seeded ${users.length} users.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
