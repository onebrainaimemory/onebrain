// Set required env vars for testing
process.env['DATABASE_URL'] =
  process.env['DATABASE_URL'] || 'postgresql://test:test@localhost:5432/test';
process.env['JWT_SECRET'] =
  process.env['JWT_SECRET'] || 'test-secret-key-at-least-32-chars-long-for-testing!!';
process.env['REDIS_URL'] = process.env['REDIS_URL'] || 'redis://localhost:6379';
