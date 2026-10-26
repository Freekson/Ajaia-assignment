import { PrismaClient } from "@prisma/client";
import { DEMO_USERS } from "../lib/constants";

const prisma = new PrismaClient();

async function main() {
  for (const user of DEMO_USERS) {
    await prisma.user.upsert({ where: { id: user.id }, update: user, create: user });
  }
}

main()
  .then(() => console.log("Seeded Alice and Bob."))
  .finally(() => prisma.$disconnect());
