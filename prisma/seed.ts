import { prisma } from "../lib/prisma";

async function main() {
  console.log("Seeding plans...");

  await prisma.plan.upsert({
    where: { id: "free" },
    update: {},
    create: {
      id: "free",
      name: "Free",
      priceMonthly: 0,
      priceYearly: 0,
      maxWorkspaces: 1,
      maxProjects: 3,
      maxMembers: 1,
      features: {
        time_tracking: true,
        billable_hours: false,
        reports_days: 7,
        exports: false,
        integrations: false,
        team_management: false,
      },
    },
  });

  await prisma.plan.upsert({
    where: { id: "solo" },
    update: {},
    create: {
      id: "solo",
      name: "Solo",
      priceMonthly: 9,
      priceYearly: 89,
      maxWorkspaces: 1,
      maxProjects: -1,
      maxMembers: 1,
      features: {
        time_tracking: true,
        billable_hours: true,
        reports_days: -1,
        exports: true,
        integrations: true,
        team_management: false,
      },
    },
  });

  await prisma.plan.upsert({
    where: { id: "team" },
    update: {},
    create: {
      id: "team",
      name: "Team",
      priceMonthly: 19,
      priceYearly: 189,
      maxWorkspaces: -1,
      maxProjects: -1,
      maxMembers: -1,
      features: {
        time_tracking: true,
        billable_hours: true,
        reports_days: -1,
        exports: true,
        integrations: true,
        team_management: true,
        admin_panel: true,
      },
    },
  });

  console.log("Plans seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
