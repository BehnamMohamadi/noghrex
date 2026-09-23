import { spawn } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import mongoose from 'mongoose';

export async function startIsolatedMongo() {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const directory = await mkdtemp(join(tmpdir(), 'noghrex-buyback-test-'));
  const windowsBinary = 'C:/Program Files/MongoDB/Server/8.0/bin/mongod.exe';
  const binary = process.env.MONGOD_BINARY || (existsSync(windowsBinary) ? windowsBinary : 'mongod');
  const child = spawn(binary, ['--dbpath', directory, '--port', String(port), '--bind_ip', '127.0.0.1',
    '--replSet', 'noghrexTest', '--oplogSize', '32', '--wiredTigerCacheSizeGB', '0.25'],
  { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', launchError;
  child.stdout.on('data', data => { output = (output + data).slice(-4000); });
  child.stderr.on('data', data => { output = (output + data).slice(-4000); });
  child.on('error', error => { launchError = error; });
  const closed = new Promise(resolve => child.once('close', resolve));
  const stop = async () => {
    if (child.exitCode === null) child.kill();
    await closed;
    const target = await realpath(directory), tempRoot = await realpath(tmpdir());
    if (dirname(target).toLowerCase() !== tempRoot.toLowerCase() || !basename(target).startsWith('noghrex-buyback-test-')) throw new Error('Refuse cleanup outside the generated temporary test directory');
    await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  const directUri = `mongodb://127.0.0.1:${port}/admin?directConnection=true`;
  let client;
  try {
    const deadline = Date.now() + 30000;
    while (!client && Date.now() < deadline) {
      if (launchError || child.exitCode !== null) throw launchError || new Error(output);
      const candidate = new mongoose.mongo.MongoClient(directUri, { serverSelectionTimeoutMS: 500 });
      try { await candidate.connect(); client = candidate; }
      catch { await candidate.close(); await delay(100); }
    }
    if (!client) throw new Error(`Test MongoDB did not start: ${output}`);
    await client.db('admin').command({ replSetInitiate: {
      _id: 'noghrexTest', members: [{ _id: 0, host: `127.0.0.1:${port}` }]
    } });
    let primary = false;
    while (Date.now() < deadline) {
      if ((await client.db('admin').command({ hello: 1 })).isWritablePrimary) { primary = true; break; }
      await delay(100);
    }
    if (!primary) throw new Error('Test MongoDB did not elect a primary');
    await client.close();
    return { uri: `mongodb://127.0.0.1:${port}/noghrex_test?replicaSet=noghrexTest`, stop };
  } catch (error) {
    await client?.close();
    await stop();
    throw error;
  }
}
