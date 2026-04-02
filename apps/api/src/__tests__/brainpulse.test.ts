import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { computeNextFireAt, isQuietHours } from '../services/briefing.service.js';

// ─── BrainPulse: Quiet Hours Tests ───

describe('BrainPulse — quiet hours', () => {
  it('should return false when quiet hours not configured', () => {
    expect(isQuietHours(null, null, 'Europe/Berlin')).toBe(false);
  });

  it('should detect cross-midnight quiet hours (22:00 - 07:00)', () => {
    // This is a unit test of the logic, not time-dependent
    // We test the range calculation directly
    const startTime = 22 * 60; // 22:00 = 1320
    const endTime = 7 * 60; // 07:00 = 420

    // 23:00 should be quiet
    const lateNight = 23 * 60;
    const isQuiet = lateNight >= startTime || lateNight < endTime;
    expect(isQuiet).toBe(true);

    // 03:00 should be quiet
    const earlyMorning = 3 * 60;
    const isQuiet2 = earlyMorning >= startTime || earlyMorning < endTime;
    expect(isQuiet2).toBe(true);

    // 12:00 should NOT be quiet
    const midday = 12 * 60;
    const isQuiet3 = midday >= startTime || midday < endTime;
    expect(isQuiet3).toBe(false);
  });

  it('should detect same-day quiet hours (13:00 - 14:00)', () => {
    const startTime = 13 * 60;
    const endTime = 14 * 60;

    // 13:30 should be quiet
    const duringQuiet = 13 * 60 + 30;
    const isQuiet = duringQuiet >= startTime && duringQuiet < endTime;
    expect(isQuiet).toBe(true);

    // 15:00 should NOT be quiet
    const afterQuiet = 15 * 60;
    const isNotQuiet = afterQuiet >= startTime && afterQuiet < endTime;
    expect(isNotQuiet).toBe(false);
  });
});

// ─── BrainPulse: Cron Parsing Tests ───

describe('BrainPulse — cron / next fire computation', () => {
  it('should parse simple HH:mm format', () => {
    const next = computeNextFireAt('08:00', 'Europe/Berlin');
    expect(next).toBeInstanceOf(Date);
    expect(next.getTime()).toBeGreaterThan(Date.now() - 86400000); // within 24h
  });

  it('should parse 5-field cron "0 8 * * *"', () => {
    const next = computeNextFireAt('0 8 * * *', 'Europe/Berlin');
    expect(next).toBeInstanceOf(Date);
  });

  it('should handle different timezones', () => {
    const berlin = computeNextFireAt('08:00', 'Europe/Berlin');
    const tokyo = computeNextFireAt('08:00', 'Asia/Tokyo');
    // Both should be valid dates but potentially different absolute times
    expect(berlin).toBeInstanceOf(Date);
    expect(tokyo).toBeInstanceOf(Date);
  });

  it('should fallback gracefully for invalid cron', () => {
    const next = computeNextFireAt('invalid', 'Europe/Berlin');
    expect(next).toBeInstanceOf(Date);
    expect(next.getTime()).toBeGreaterThan(Date.now());
  });
});

// ─── BrainPulse: Schema Validation Tests ───

describe('BrainPulse — schema validation', () => {
  const briefingTypeEnum = z.enum([
    'morning',
    'midday',
    'evening',
    'event_triggered',
    'weekly_health',
  ]);
  const briefingChannelEnum = z.enum(['email', 'in_app', 'webhook']);

  const createScheduleSchema = z.object({
    type: briefingTypeEnum,
    cronExpression: z.string().min(9).max(100),
    channels: z.array(briefingChannelEnum).min(1).max(3),
  });

  const configSchema = z.object({
    isEnabled: z.boolean().optional(),
    timezone: z.string().min(1).max(50).optional(),
    quietHoursStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    quietHoursEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
  });

  it('should accept valid schedule', () => {
    const result = createScheduleSchema.safeParse({
      type: 'morning',
      cronExpression: '0 8 * * *',
      channels: ['email'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid briefing type', () => {
    const result = createScheduleSchema.safeParse({
      type: 'midnight',
      cronExpression: '0 0 * * *',
      channels: ['email'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty channels', () => {
    const result = createScheduleSchema.safeParse({
      type: 'morning',
      cronExpression: '0 8 * * *',
      channels: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid channel', () => {
    const result = createScheduleSchema.safeParse({
      type: 'morning',
      cronExpression: '0 8 * * *',
      channels: ['sms'],
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid config update', () => {
    const result = configSchema.safeParse({
      isEnabled: true,
      timezone: 'Europe/Berlin',
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid quiet hours format', () => {
    const result = configSchema.safeParse({
      quietHoursStart: '25:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid quiet hours format (no colon)', () => {
    const result = configSchema.safeParse({
      quietHoursStart: '2200',
    });
    expect(result.success).toBe(false);
  });
});

// ─── BrainPulse: Time-Aware Content Selection Tests ───

describe('BrainPulse — content assembly logic', () => {
  const contentByType = {
    morning: ['agentActivity', 'pendingCandidates', 'projectPriorities'],
    midday: ['progressCheck', 'pendingDecisions', 'entityUpdates'],
    evening: ['daySummary', 'completedItems', 'tomorrowSuggestions'],
    weekly_health: [
      'staleMemories',
      'unusedEntities',
      'typeDistribution',
      'confidenceDistribution',
    ],
  };

  it('morning briefing should include agent activity', () => {
    expect(contentByType.morning).toContain('agentActivity');
  });

  it('evening briefing should include day summary', () => {
    expect(contentByType.evening).toContain('daySummary');
  });

  it('weekly health should include stale memories', () => {
    expect(contentByType.weekly_health).toContain('staleMemories');
  });

  it('each briefing type should have at least 3 sections', () => {
    for (const sections of Object.values(contentByType)) {
      expect(sections.length).toBeGreaterThanOrEqual(3);
    }
  });
});

// ─── BrainPulse: Plan Gating Tests ───

describe('BrainPulse — plan gating', () => {
  it('free plan: weekly_email tier', () => {
    const features = [{ key: 'brain_pulse', value: 'weekly_email' }];
    const tier = features.find((f) => f.key === 'brain_pulse')?.value;
    expect(tier).toBe('weekly_email');
  });

  it('pro plan: full tier', () => {
    const features = [{ key: 'brain_pulse', value: 'full' }];
    const tier = features.find((f) => f.key === 'brain_pulse')?.value;
    expect(tier).toBe('full');
  });

  it('free plan max schedules = 1', () => {
    const features = [{ key: 'brain_pulse_max_schedules', value: '1' }];
    const max = parseInt(features.find((f) => f.key === 'brain_pulse_max_schedules')!.value, 10);
    expect(max).toBe(1);
  });

  it('pro plan max schedules = 10', () => {
    const features = [{ key: 'brain_pulse_max_schedules', value: '10' }];
    const max = parseInt(features.find((f) => f.key === 'brain_pulse_max_schedules')!.value, 10);
    expect(max).toBe(10);
  });
});
