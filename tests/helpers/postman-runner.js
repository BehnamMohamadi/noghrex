import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

// Executes this repository's generated Postman JSON against a real HTTP server.
// This intentionally implements only the pm APIs used by our checked-in scripts.
export async function runCollection(collection, environment) {
  const values = new Map(Object.entries(environment));
  const replace = text => String(text).replace(/\{\{([^}]+)\}\}/g, (_, name) => name === '$guid' ? crypto.randomUUID() : values.get(name) ?? '{{' + name + '}}');
  const env = { get: key => values.get(key), set: (key, value) => values.set(key, String(value)) };
  const expect = value => ({ to: { equal: expected => assert.equal(value, expected), be: { oneOf: expected => assert.ok(expected.includes(value), 'Unexpected HTTP status ' + value) } } });
  let assertions = 0, requests = 0;
  for (const item of collection.item) {
    const pm = { environment: env, variables: { replaceIn: replace }, expect, test(name, work) { work(); assertions++; } };
    for (const event of [...(collection.event || []), ...(item.event || [])].filter(e => e.listen === 'prerequest')) vm.runInNewContext(event.script.exec.join('\n'), { pm, Date }, { timeout: 1000 });
    const req = item.request;
    const headers = Object.fromEntries(req.header.map(h => [h.key, replace(h.value)]));
    if (req.auth?.type === 'bearer') headers.Authorization = 'Bearer ' + replace(req.auth.bearer.find(x => x.key === 'token').value);
    const url = replace(typeof req.url === 'string' ? req.url : req.url.raw);
    assert.ok(!url.includes('{{'), 'Unresolved URL in ' + item.name);
    const response = await fetch(url, { method: req.method, headers, ...(req.body ? { body: replace(req.body.raw) } : {}) });
    const body = await response.json();
    pm.response = { code: response.status, json: () => body, headers: { get: key => response.headers.get(key) } };
    try {
      for (const event of (item.event || []).filter(e => e.listen === 'test')) vm.runInNewContext(event.script.exec.join('\n'), { pm, decodeURIComponent, Boolean, String }, { timeout: 1000 });
    } catch (error) { throw new Error(item.name + ': ' + JSON.stringify(body), { cause: error }); }
    requests++;
  }
  return { requests, assertions, values };
}
