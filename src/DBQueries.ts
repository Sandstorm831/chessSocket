import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ log: ["query", "info"] });

export async function saveGame(
  black: string,
  white: string,
  RoomID: string,
  PGN: string,
  result: string
) {
  await prisma.game
    .create({
      data: {
        RoomID,
        white,
        black,
        PGN,
        result,
      },
    })
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.log("Some error occured while saving game");
      console.log(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
