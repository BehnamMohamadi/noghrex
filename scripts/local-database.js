import { spawn } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import mongoose from 'mongoose';
export const LOCAL_URI = 'mongodb://127.0.0.1:27031/noghrex_local?replicaSet=noghrexLocal';
export async function startLocalDatabase() {
  const directory = path.resolve('.local/mongodb'); await mkdir(directory, { recursive: true });
  const direct = 'mongodb://127.0.0.1:27031/admin?directConnection=true';
  async function connect() { const client = new mongoose.mongo.MongoClient(direct, { serverSelectionTimeoutMS: 600 }); try { await client.connect(); return client; } catch { await client.close(); return null; } }
  let client = await connect();
  if (!client) {
    const defaultBinary = 'C:/Program Files/MongoDB/Server/8.0/bin/mongod.exe';
    const binary = process.env.MONGOD_BINARY || (existsSync(defaultBinary) ? defaultBinary : 'mongod');
    const log = await open(path.resolve('.local/mongod-start.log'), 'a');
    const child = spawn(binary, ['--dbpath', directory, '--port', '27031', '--bind_ip', '127.0.0.1', '--replSet', 'noghrexLocal', '--oplogSize', '64', '--wiredTigerCacheSizeGB', '0.25'],
      { detached: true, windowsHide: true, stdio: ['ignore', log.fd, log.fd] });
    let spawnError; child.on('error', error => { spawnError = error; }); child.unref(); await log.close();
    for (let attempt = 0; attempt < 30 && !client; attempt++) { if (spawnError) throw spawnError; await delay(300); client = await connect(); }
  }
  if (!client) throw new Error('MongoDB local startup failed; inspect .local/mongod-start.log');
  try {
    const hello = await client.db('admin').command({ hello: 1 });
    if (!hello.setName) {
      // Refuse to reconfigure another running instance on this port.
      const options = await client.db('admin').command({ getCmdLineOpts: 1 });
      if (path.resolve(options.parsed.storage.dbPath).toLowerCase() !== directory.toLowerCase() || (options.parsed.replication?.replSetName || options.parsed.replication?.replSet) !== 'noghrexLocal') throw new Error('Port 27031 belongs to another MongoDB instance');
      await client.db('admin').command({ replSetInitiate: { _id: 'noghrexLocal', members: [{ _id: 0, host: '127.0.0.1:27031' }] } });
    } else if (hello.setName !== 'noghrexLocal') throw new Error('Unexpected replica set on port 27031');
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await client.db('admin').command({ hello: 1 })).isWritablePrimary) return LOCAL_URI;
      await delay(200);
    }
    throw new Error('MongoDB primary election timed out');
  } finally { await client.close(); }
}
