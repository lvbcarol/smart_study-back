import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 180000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      TEACHER_INVITE_CODE: 'invite-123',
      AI_MODE: 'mock',
      AI_RATE_LIMIT: '1000',
    },
  },
});
