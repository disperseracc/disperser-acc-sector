const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRobloxKey } = require('../dist/robloxKeyValidation');

function mockResponse(status, body) {
  return async (_url, options) => {
    assert.equal(_url, 'https://apis.roblox.com/api-keys/v1/introspect');
    assert.equal(options.method, 'POST');
    assert.equal(JSON.parse(options.body).apiKey, 'test-key');
    return Response.json(body, { status });
  };
}

test('reports a valid key with asset read and write permissions', async () => {
  const result = await validateRobloxKey('test-key', mockResponse(200, {
    enabled: true, expired: false, scopes: [{ name: 'asset', operations: ['read', 'write'] }],
  }));
  assert.equal(result.status, 200);
  assert.equal(result.body.code, 'KEY_VALID');
});

test('explains rejected and expired keys without leaking the key', async () => {
  const rejected = await validateRobloxKey('test-key', mockResponse(403, { message: 'User not authenticated: test-key' }));
  assert.equal(rejected.body.code, 'ROBLOX_KEY_REJECTED');
  assert.match(rejected.body.error, /server Disperser/);
  assert.equal(rejected.body.detail, 'User not authenticated: [redacted]');

  const expired = await validateRobloxKey('test-key', mockResponse(200, {
    enabled: true, expired: true, scopes: [{ name: 'asset', operations: ['read', 'write'] }],
  }));
  assert.equal(expired.body.code, 'KEY_EXPIRED');
});

test('identifies missing asset permissions separately from authentication', async () => {
  const result = await validateRobloxKey('test-key', mockResponse(200, {
    enabled: true, expired: false, scopes: [{ name: 'asset', operations: ['read'] }],
  }));
  assert.equal(result.status, 403);
  assert.equal(result.body.code, 'ASSET_SCOPE_MISSING');
});
