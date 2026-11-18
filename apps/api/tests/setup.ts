// set testing values for test on pull requests.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-jwt-secret-must-be-at-least-64-bytes-long-for-hs512-testing-1234567890';
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.CORS_ORIGIN ??= 'http://localhost:3000';
