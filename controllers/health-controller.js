import mongoose from 'mongoose';

// Readiness checks connectivity; it does not certify payment providers or accounting.
export async function health(req, res) {
  res.set('Cache-Control', 'no-store');
  let ready = false;
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    let timer;
    try {
      await Promise.race([
        mongoose.connection.db.command({ ping: 1 }, { maxTimeMS: 2000 }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Database health timeout')), 2500);
          timer.unref?.();
        })
      ]);
      ready = mongoose.connection.readyState === 1;
    } catch {
      // Do not expose connection strings or database exception details publicly.
      ready = false;
    } finally {
      clearTimeout(timer);
    }
  }
  res.status(ready ? 200 : 503).json({
    status: ready ? 'success' : 'error',
    service: 'noghrex-backend',
    database: ready ? 'available' : 'unavailable'
  });
}
