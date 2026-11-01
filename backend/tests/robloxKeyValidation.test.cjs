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
  const result = await validateRobloxKey('test-key', {}, mockResponse(200, {
    enabled: true, expired: false, scopes: [{ name: 'asset', operations: ['read', 'write'] }],
  }));
  assert.equal(result.status, 200);
  assert.equal(result.body.code, 'KEY_VALID');
});

test('explains rejected and expired keys without leaking the key', async () => {
  const rejected = await validateRobloxKey('test-key', {}, mockResponse(403, { message: 'User not authenticated: test-key' }));
  assert.equal(rejected.body.code, 'ROBLOX_KEY_REJECTED');
  assert.match(rejected.body.error, /server Disperser/);
  assert.equal(rejected.body.detail, 'User not authenticated: [redacted]');

  const expired = await validateRobloxKey('test-key', {}, mockResponse(200, {
    enabled: true, expired: true, scopes: [{ name: 'asset', operations: ['read', 'write'] }],
  }));
  assert.equal(expired.body.code, 'KEY_EXPIRED');
});

test('accepts a datastore-only key and explains the unavailable asset features', async () => {
  const result = await validateRobloxKey('test-key', { uploadTarget: 'group', groupId: '526640214' }, mockResponse(200, {
    enabled: true, expired: false, scopes: [
      { name: 'universe-datastores.objects', operations: ['read', 'update'], universeDatastores: [{ universeId: '10773757082' }] },
      { name: 'universe.ordered-data-store.scope.entry', operations: ['read', 'write'], universeIds: ['10773757082'] },
    ],
  }));
  assert.equal(result.status, 200);
  assert.equal(result.body.code, 'KEY_VALID_LIMITED');
  assert.match(result.body.message, /DataStore\/OrderedDataStore/);
  assert.match(result.body.message, /Assets API Read dan Write/);
});

test('reports asset access limited to another group without rejecting the valid key', async () => {
  const response = mockResponse(200, {
    enabled: true, expired: false,
    scopes: [{ name: 'asset', operations: ['read', 'write'], groupIds: ['123'] }],
  });
  const wrongGroup = await validateRobloxKey('test-key', { uploadTarget: 'group', groupId: '456' }, response);
  assert.equal(wrongGroup.status, 200);
  assert.equal(wrongGroup.body.code, 'KEY_VALID_LIMITED');
  assert.match(wrongGroup.body.message, /456/);

  const allowedGroup = await validateRobloxKey('test-key', { uploadTarget: 'group', groupId: '123' }, response);
  assert.equal(allowedGroup.body.code, 'KEY_VALID');
});
