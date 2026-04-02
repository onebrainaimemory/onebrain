import { describe, it, expect, beforeEach } from 'vitest';
import { audit, getAuditLog, clearAuditLog } from '../lib/audit.js';

describe('audit', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  it('should record an audit entry', () => {
    audit('user-1', 'create', 'memory_item', 'item-1');

    const log = getAuditLog('user-1');
    expect(log).toHaveLength(1);
    expect(log[0]!.userId).toBe('user-1');
    expect(log[0]!.action).toBe('create');
    expect(log[0]!.resource).toBe('memory_item');
    expect(log[0]!.resourceId).toBe('item-1');
    expect(log[0]!.timestamp).toBeDefined();
  });

  it('should filter by userId', () => {
    audit('user-1', 'read', 'brain_profile');
    audit('user-2', 'read', 'brain_profile');
    audit('user-1', 'update', 'brain_profile');

    const user1Log = getAuditLog('user-1');
    expect(user1Log).toHaveLength(2);

    const user2Log = getAuditLog('user-2');
    expect(user2Log).toHaveLength(1);
  });

  it('should include optional details', () => {
    audit('user-1', 'list', 'entities', undefined, { count: 5 });

    const log = getAuditLog('user-1');
    expect(log[0]!.details).toEqual({ count: 5 });
  });

  it('should respect limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      audit('user-1', 'read', 'memory_item', `item-${i}`);
    }

    const limited = getAuditLog('user-1', 3);
    expect(limited).toHaveLength(3);
  });
});
