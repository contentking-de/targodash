import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addUser(email: string, name?: string) {
  try {
    // Prüfe, ob User bereits existiert
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(`✅ User mit E-Mail ${email} existiert bereits:`);
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Name: ${existingUser.name || "Nicht gesetzt"}`);
      console.log(`   Erstellt: ${existingUser.createdAt}`);
      return;
    }

    // Erstelle neuen User
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
      },
    });

    console.log(`✅ User erfolgreich erstellt:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   E-Mail: ${user.email}`);
    console.log(`   Name: ${user.name || "Nicht gesetzt"}`);
    console.log(`   Erstellt: ${user.createdAt}`);
    console.log(`\n💡 Der User kann sich jetzt mit Magic Link anmelden: ${email}`);
  } catch (error) {
    console.error("❌ Fehler beim Erstellen des Users:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Hole E-Mail aus Kommandozeilen-Argumenten
const email = process.argv[2];
const name = process.argv[3];

if (!email) {
  console.error("❌ Bitte gib eine E-Mail-Adresse an:");
  console.error("   npm run add-user <email> [name]");
  console.error("   Beispiel: npm run add-user max.mustermann@targobank.de \"Max Mustermann\"");
  process.exit(1);
}

addUser(email, name);

