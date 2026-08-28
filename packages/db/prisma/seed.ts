import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "you@example.de" },
    update: {},
    create: { email: "you@example.de", name: "Du" },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "studio" },
    update: {},
    create: { name: "Studio", slug: "studio", plan: "free" },
  });

  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: "owner" },
  });

  const existing = await prisma.project.findFirst({
    where: { workspaceId: workspace.id, primaryDomain: "example.de" },
  });

  const project =
    existing ??
    (await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: "Example",
        primaryDomain: "example.de",
        homepageUrl: "https://example.de",
        defaultLocale: "de-DE",
        defaultCountry: "DE",
        settings: { create: {} },
      },
    }));

  console.log("Seed ok");
  console.log("Project ID:", project.id);
}

main().finally(() => prisma.$disconnect());
