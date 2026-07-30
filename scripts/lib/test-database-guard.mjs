import assert from "node:assert/strict";

const TEST_DATABASE_PATTERN = /(?:^|_)(?:e2e|test)(?:_|$)/i;

export function requireTestDatabaseUrls(env = process.env) {
  const databaseUrl = requireTestDatabaseUrl("DATABASE_URL", env.DATABASE_URL);
  const directUrl = requireTestDatabaseUrl("DIRECT_URL", env.DIRECT_URL);
  return { databaseUrl, directUrl };
}

function requireTestDatabaseUrl(name, value) {
  assert(value, `${name} must be explicitly set for E2E`);
  const databaseName = decodeURIComponent(new URL(value).pathname.slice(1));
  assert(TEST_DATABASE_PATTERN.test(databaseName), `Refusing E2E access through ${name} to non-test database: ${databaseName}`);
  return value;
}
