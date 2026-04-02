import { getClient, disconnect } from './index.js';

async function seed() {
  const prisma = getClient();

  console.info('Seeding database...');

  const user = await prisma.user.upsert({
    where: { email: 'demo@onebrain.rocks' },
    update: {},
    create: {
      email: 'demo@onebrain.rocks',
      displayName: 'Demo User',
      region: 'EU',
      locale: 'en',
    },
  });

  console.info(`Created user: ${user.email} (${user.id})`);

  // Default plans — seed is the authoritative source for plan limits.
  // Clean up any migration-inserted limits that use different keys.
  const existingFree = await prisma.plan.findUnique({ where: { name: 'free' } });
  if (existingFree) {
    await prisma.planLimit.deleteMany({
      where: {
        planId: existingFree.id,
        key: { notIn: ['memories', 'entities', 'projects', 'api_keys'] },
      },
    });
  }

  const freePlan = await prisma.plan.upsert({
    where: { name: 'free' },
    update: {},
    create: {
      name: 'free',
      displayName: 'Free',
      description: 'Basic plan with essential features',
      isActive: true,
      priceMonthly: 0,
      priceYearly: 0,
    },
  });

  await prisma.planLimit.upsert({
    where: { planId_key: { planId: freePlan.id, key: 'memories' } },
    update: { value: 50 },
    create: { planId: freePlan.id, key: 'memories', value: 50, period: 'lifetime' },
  });
  await prisma.planLimit.upsert({
    where: { planId_key: { planId: freePlan.id, key: 'entities' } },
    update: { value: 10 },
    create: { planId: freePlan.id, key: 'entities', value: 10, period: 'lifetime' },
  });
  await prisma.planLimit.upsert({
    where: { planId_key: { planId: freePlan.id, key: 'projects' } },
    update: { value: 3 },
    create: { planId: freePlan.id, key: 'projects', value: 3, period: 'lifetime' },
  });
  await prisma.planLimit.upsert({
    where: { planId_key: { planId: freePlan.id, key: 'api_keys' } },
    update: { value: 1 },
    create: { planId: freePlan.id, key: 'api_keys', value: 1, period: 'lifetime' },
  });

  const proPlan = await prisma.plan.upsert({
    where: { name: 'pro' },
    update: {},
    create: {
      name: 'pro',
      displayName: 'Pro',
      description: 'Professional plan with higher limits',
      isActive: true,
      priceMonthly: 990,
      priceYearly: 9900,
    },
  });

  await prisma.planLimit.upsert({
    where: { planId_key: { planId: proPlan.id, key: 'memories' } },
    update: { value: 500 },
    create: { planId: proPlan.id, key: 'memories', value: 500, period: 'lifetime' },
  });
  await prisma.planLimit.upsert({
    where: { planId_key: { planId: proPlan.id, key: 'entities' } },
    update: { value: 100 },
    create: { planId: proPlan.id, key: 'entities', value: 100, period: 'lifetime' },
  });
  await prisma.planLimit.upsert({
    where: { planId_key: { planId: proPlan.id, key: 'projects' } },
    update: { value: 20 },
    create: { planId: proPlan.id, key: 'projects', value: 20, period: 'lifetime' },
  });
  await prisma.planLimit.upsert({
    where: { planId_key: { planId: proPlan.id, key: 'api_keys' } },
    update: { value: 10 },
    create: { planId: proPlan.id, key: 'api_keys', value: 10, period: 'lifetime' },
  });

  const teamPlan = await prisma.plan.upsert({
    where: { name: 'team' },
    update: {},
    create: {
      name: 'team',
      displayName: 'Team',
      description: 'Team plan with generous limits',
      isActive: true,
      priceMonthly: 2990,
      priceYearly: 29900,
    },
  });

  await prisma.planLimit.upsert({
    where: { planId_key: { planId: teamPlan.id, key: 'memories' } },
    update: { value: 5000 },
    create: { planId: teamPlan.id, key: 'memories', value: 5000, period: 'lifetime' },
  });
  await prisma.planLimit.upsert({
    where: { planId_key: { planId: teamPlan.id, key: 'entities' } },
    update: { value: 1000 },
    create: { planId: teamPlan.id, key: 'entities', value: 1000, period: 'lifetime' },
  });
  await prisma.planLimit.upsert({
    where: { planId_key: { planId: teamPlan.id, key: 'projects' } },
    update: { value: 100 },
    create: { planId: teamPlan.id, key: 'projects', value: 100, period: 'lifetime' },
  });
  await prisma.planLimit.upsert({
    where: { planId_key: { planId: teamPlan.id, key: 'api_keys' } },
    update: { value: 50 },
    create: { planId: teamPlan.id, key: 'api_keys', value: 50, period: 'lifetime' },
  });

  // ─── DeepRecall feature flags ───
  await prisma.planFeature.upsert({
    where: { planId_key: { planId: freePlan.id, key: 'deep_recall' } },
    update: { value: 'false' },
    create: { planId: freePlan.id, key: 'deep_recall', value: 'false' },
  });
  await prisma.planFeature.upsert({
    where: { planId_key: { planId: proPlan.id, key: 'deep_recall' } },
    update: { value: 'true' },
    create: { planId: proPlan.id, key: 'deep_recall', value: 'true' },
  });
  await prisma.planFeature.upsert({
    where: { planId_key: { planId: teamPlan.id, key: 'deep_recall' } },
    update: { value: 'true' },
    create: { planId: teamPlan.id, key: 'deep_recall', value: 'true' },
  });

  // ─── SkillForge feature flags ───
  await prisma.planFeature.upsert({
    where: { planId_key: { planId: freePlan.id, key: 'skill_forge' } },
    update: { value: 'false' },
    create: { planId: freePlan.id, key: 'skill_forge', value: 'false' },
  });
  await prisma.planFeature.upsert({
    where: { planId_key: { planId: proPlan.id, key: 'skill_forge' } },
    update: { value: 'true' },
    create: { planId: proPlan.id, key: 'skill_forge', value: 'true' },
  });
  await prisma.planFeature.upsert({
    where: { planId_key: { planId: teamPlan.id, key: 'skill_forge' } },
    update: { value: 'true' },
    create: { planId: teamPlan.id, key: 'skill_forge', value: 'true' },
  });

  // ─── BrainPulse feature flags ───
  await prisma.planFeature.upsert({
    where: { planId_key: { planId: freePlan.id, key: 'brain_pulse' } },
    update: { value: 'weekly_email' },
    create: { planId: freePlan.id, key: 'brain_pulse', value: 'weekly_email' },
  });
  await prisma.planFeature.upsert({
    where: { planId_key: { planId: proPlan.id, key: 'brain_pulse' } },
    update: { value: 'full' },
    create: { planId: proPlan.id, key: 'brain_pulse', value: 'full' },
  });
  await prisma.planFeature.upsert({
    where: { planId_key: { planId: teamPlan.id, key: 'brain_pulse' } },
    update: { value: 'full' },
    create: { planId: teamPlan.id, key: 'brain_pulse', value: 'full' },
  });
  await prisma.planFeature.upsert({
    where: { planId_key: { planId: freePlan.id, key: 'brain_pulse_max_schedules' } },
    update: { value: '1' },
    create: { planId: freePlan.id, key: 'brain_pulse_max_schedules', value: '1' },
  });
  await prisma.planFeature.upsert({
    where: { planId_key: { planId: proPlan.id, key: 'brain_pulse_max_schedules' } },
    update: { value: '10' },
    create: { planId: proPlan.id, key: 'brain_pulse_max_schedules', value: '10' },
  });
  await prisma.planFeature.upsert({
    where: { planId_key: { planId: teamPlan.id, key: 'brain_pulse_max_schedules' } },
    update: { value: '25' },
    create: { planId: teamPlan.id, key: 'brain_pulse_max_schedules', value: '25' },
  });

  console.info(`Created plans: ${freePlan.name}, ${proPlan.name}, ${teamPlan.name}`);

  await prisma.brainProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      summary: 'Demo brain profile',
      traits: { curiosity: 'high', communication_style: 'direct' },
      preferences: { language: 'en', response_length: 'concise' },
    },
  });

  console.info('Created brain profile');

  await prisma.memoryItem.createMany({
    data: [
      {
        userId: user.id,
        type: 'fact',
        title: 'Location',
        body: 'Lives in Berlin, Germany',
        sourceType: 'user_input',
        confidence: 1.0,
        status: 'active',
      },
      {
        userId: user.id,
        type: 'preference',
        title: 'Communication style',
        body: 'Prefers concise, direct answers',
        sourceType: 'user_input',
        confidence: 1.0,
        status: 'active',
      },
      {
        userId: user.id,
        type: 'skill',
        title: 'TypeScript',
        body: 'Experienced TypeScript developer',
        sourceType: 'ai_extraction',
        confidence: 0.8,
        status: 'active',
      },
    ],
    skipDuplicates: true,
  });

  console.info('Created memory items');

  await prisma.entity.upsert({
    where: {
      userId_name_type: {
        userId: user.id,
        name: 'OneBrain',
        type: 'project',
      },
    },
    update: {},
    create: {
      userId: user.id,
      name: 'OneBrain',
      type: 'project',
      description: 'Personal AI memory layer project',
    },
  });

  console.info('Created entity');

  await prisma.project.create({
    data: {
      userId: user.id,
      name: 'OneBrain MVP',
      description: 'Building the first version of OneBrain',
      status: 'active',
    },
  });

  console.info('Created project');

  console.info('Seed completed successfully');

  await disconnect();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
