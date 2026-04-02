import { describe, it, expect } from 'vitest';
import { success, error } from '../lib/response.js';

describe('response helpers', () => {
  describe('success', () => {
    it('should wrap data in ApiResponse envelope', () => {
      const result = success({ status: 'ok' });

      expect(result.data).toEqual({ status: 'ok' });
      expect(result.meta?.requestId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should use provided requestId', () => {
      const result = success({ value: 42 }, 'req-123');

      expect(result.meta?.requestId).toBe('req-123');
    });
  });

  describe('error', () => {
    it('should create error response with status code', () => {
      const result = error('VALIDATION_ERROR', 'Bad input', 400);

      expect(result.statusCode).toBe(400);
      expect(result.body.error?.code).toBe('VALIDATION_ERROR');
      expect(result.body.error?.message).toBe('Bad input');
      expect(result.body.data).toBeUndefined();
    });

    it('should include details when provided', () => {
      const details = [{ field: 'email', message: 'required' }];
      const result = error('VALIDATION_ERROR', 'Invalid', 400, undefined, details);

      expect(result.body.error?.details).toEqual(details);
    });

    it('should generate requestId when not provided', () => {
      const result = error('ERR', 'msg', 500);

      expect(result.body.meta?.requestId).toBeDefined();
    });
  });
});
