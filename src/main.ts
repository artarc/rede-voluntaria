import "dotenv/config";
import { prisma } from "./db.js";
import { buildServer } from "./server.js";

const port = Number(process.env.PORT ?? 3333);

const app = await buildServer(prisma);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}

process.on("SIGINT", async () => {
  await app.close();
  await prisma.$disconnect();
});

process.on("SIGTERM", async () => {
  await app.close();
  await prisma.$disconnect();
});
