import { describe, it, expect } from 'vitest';
import {
  detectDuplicates,
  detectConflicts,
  buildMergeLog,
  type MergeCandidate,
} from '../services/merge.service.js';

function makeCandidate(overrides: Partial<MergeCandidate> = {}): MergeCandidate {
  return {
    id: 'candidate-1',
    userId: 'user-1',
    type: 'fact',
    title: 'Test Title',
    body: 'Test body content',
    sourceType: 'user_input',
    confidence: 1.0,
    status: 'candidate',
    metadata: null,
    ...overrides,
  };
}

describe('merge engine — multi-memory scenarios', () => {
  describe('merge of 2+ memories with overlapping content', () => {
    it('should detect multiple duplicates in a batch', () => {
      const existing = [
        makeCandidate({
          id: 'e1',
          title: 'Likes coffee',
          body: 'Enjoys coffee',
          type: 'preference',
          status: 'active',
        }),
        makeCandidate({
          id: 'e2',
          title: 'Works at Acme',
          body: 'Employed at Acme Corp',
          type: 'fact',
          status: 'active',
        }),
      ];
      const candidate = makeCandidate({
        id: 'c1',
        title: 'Likes coffee',
        body: 'Enjoys coffee',
        type: 'preference',
      });
      const results = detectDuplicates(candidate, existing);
      expect(results).toHaveLength(1);
      expect(results[0]!.existingId).toBe('e1');
    });

    it('should not cross-match different topics even within same type', () => {
      const existing = [
        makeCandidate({
          id: 'e1',
          title: 'Likes coffee',
          body: 'Coffee fan',
          type: 'preference',
          status: 'active',
        }),
        makeCandidate({
          id: 'e2',
          title: 'Likes tea',
          body: 'Tea fan',
          type: 'preference',
          status: 'active',
        }),
      ];
      const candidate = makeCandidate({
        id: 'c1',
        title: 'Prefers espresso',
        body: 'Espresso over drip',
        type: 'preference',
      });
      const results = detectDuplicates(candidate, existing);
      expect(results).toHaveLength(0);
    });
  });

  describe('conflict detection — same topic, different body', () => {
    it('should flag opposite preferences as conflicts', () => {
      const existing = [
        makeCandidate({
          id: 'e1',
          title: 'Prefers long answers',
          body: 'Always provide extensive and very detailed explanations',
          type: 'preference',
          status: 'active',
        }),
      ];
      const candidate = makeCandidate({
        id: 'c1',
        title: 'Prefers short answers',
        body: 'Keep replies minimal and concise at all times',
        type: 'preference',
      });
      const conflicts = detectConflicts(candidate, existing);
      expect(conflicts).toHaveLength(1);
    });

    it('should not flag same body as conflict', () => {
      const existing = [
        makeCandidate({
          id: 'e1',
          title: 'User prefers remote work',
          body: 'Wants to work from home',
          type: 'preference',
          status: 'active',
        }),
      ];
      const candidate = makeCandidate({
        id: 'c1',
        title: 'User prefers remote work',
        body: 'Wants to work from home',
        type: 'preference',
      });
      const conflicts = detectConflicts(candidate, existing);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('merge with different memory types', () => {
    it('should not detect duplicates across different types', () => {
      const existing = [
        makeCandidate({
          id: 'e1',
          title: 'Runs marathons',
          body: 'Completed a marathon',
          type: 'experience',
          status: 'active',
        }),
      ];
      const candidate = makeCandidate({
        id: 'c1',
        title: 'Runs marathons',
        body: 'Completed a marathon',
        type: 'fact',
      });
      expect(detectDuplicates(candidate, existing)).toHaveLength(0);
      expect(detectConflicts(candidate, existing)).toHaveLength(0);
    });

    it('should not detect conflicts across different types', () => {
      const existing = [
        makeCandidate({
          id: 'e1',
          title: 'Goal: run marathon',
          body: 'Wants to finish a race',
          type: 'goal',
          status: 'active',
        }),
      ];
      const candidate = makeCandidate({
        id: 'c1',
        title: 'Goal: run marathon',
        body: 'Decided not to run',
        type: 'fact',
      });
      expect(detectConflicts(candidate, existing)).toHaveLength(0);
    });
  });

  describe('buildMergeLog with mixed results', () => {
    it('should log both duplicates and conflicts', () => {
      const log = buildMergeLog(
        [{ existingId: 'e1', candidateId: 'c1', keepId: 'e1', archiveId: 'c1' }],
        [{ existingId: 'e2', candidateId: 'c2' }],
      );
      expect(log).toHaveLength(2);
      expect(log.some((l) => l.action === 'archive')).toBe(true);
      expect(log.some((l) => l.action === 'conflict')).toBe(true);
    });
  });
});
