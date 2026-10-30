const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAssetSharingRouter } = require('../dist/assetSharing');

test('grants only Audio owned by the selected source community and reports partial errors', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/101')) return Response.json({ assetType: 'Audio', creationContext: { creator: { groupId: 11 } } });
    if (url.endsWith('/102')) return Response.json({ assetType: 'Model', creationContext: { creator: { groupId: 11 } } });
    if (url.endsWith('/103')) return Response.json({ assetType: 'Audio', creationContext: { creator: { groupId: 99 } } });
    if (url.endsWith('/permissions')) return Response.json({ successAssetIds: [101], errors: [] });
    throw new Error(`Unexpected URL ${url}`);
  };
  const app = express();
  app.use(express.json());
  app.use('/api/asset-sharing', createAssetSharingRouter());
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await originalFetch(`http://127.0.0.1:${port}/api/asset-sharing/grant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'test-key', sourceGroupId: '11', targetType: 'Group', targetId: '22', assetIds: ['101', '102', '103'] }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.granted, 1);
    assert.deepEqual(body.results.map(item => [item.assetId, item.status]), [['102', 'error'], ['103', 'error'], ['101', 'success']]);
    const grant = calls.find(call => call.url.endsWith('/permissions'));
    assert.deepEqual(JSON.parse(grant.options.body), {
      subjectType: 'Group', subjectId: '22', action: 'Use', requests: [{ assetId: 101 }],
    });
    assert.equal(grant.options.headers['x-api-key'], 'test-key');
  } finally {
    server.close();
    global.fetch = originalFetch;
  }
});

test('grants personal Audio only when the creator User ID matches', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/201')) return Response.json({ assetType: 'ASSET_TYPE_AUDIO', creationContext: { creator: { userId: '123' } } });
    if (url.endsWith('/202')) return Response.json({ assetType: 'Audio', creationContext: { creator: { groupId: '123' } } });
    if (url.endsWith('/203')) return Response.json({ assetType: 'Audio', creationContext: { creator: { userId: '999' } } });
    if (url.endsWith('/permissions')) return Response.json({ successAssetIds: [201], errors: [] });
    throw new Error(`Unexpected URL ${url}`);
  };
  const app = express();
  app.use(express.json());
  app.use('/api/asset-sharing', createAssetSharingRouter());
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await originalFetch(`http://127.0.0.1:${port}/api/asset-sharing/grant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'test-key', sourceType: 'User', sourceId: '123', targetType: 'Universe', targetId: '44', assetIds: ['201', '202', '203'] }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.granted, 1);
    assert.deepEqual(body.results.map(item => [item.assetId, item.status]), [['202', 'error'], ['203', 'error'], ['201', 'success']]);
    const grant = calls.find(call => call.url.endsWith('/permissions'));
    assert.deepEqual(JSON.parse(grant.options.body), {
      subjectType: 'Universe', subjectId: '44', action: 'Use', requests: [{ assetId: 201 }],
    });
  } finally {
    server.close();
    global.fetch = originalFetch;
  }
});
