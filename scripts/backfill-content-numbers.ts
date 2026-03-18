import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const articles = await prisma.generatedArticle.findMany({
    where: { contentNumber: 0 },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true },
  });

  if (articles.length === 0) {
    console.log("Alle Artikel haben bereits eine Content-Nummer.");
    return;
  }

  const lastNumbered = await prisma.generatedArticle.findFirst({
    where: { contentNumber: { gt: 0 } },
    orderBy: { contentNumber: "desc" },
    select: { contentNumber: true },
  });

  let nextNumber = (lastNumbered?.contentNumber ?? 0) + 1;

  for (const article of articles) {
    await prisma.generatedArticle.update({
      where: { id: article.id },
      data: { contentNumber: nextNumber },
    });
    console.log(`#${nextNumber} → ${article.title}`);
    nextNumber++;
  }

  console.log(`\n${articles.length} Artikel nummeriert.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
