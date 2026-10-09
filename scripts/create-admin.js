import 'dotenv/config';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { createInitialAdmin } from './admin-bootstrap.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('npm run admin:create -- --phone 09123456789\nبدون شماره، دستور آن را می‌پرسد. رمز تصادفی ساخته می‌شود؛ یا ADMIN_PASSWORD را در محیط تنظیم کنید.');
    return;
  }
  if (args.length && (args.length !== 2 || args[0] !== '--phone')) throw new Error('دستور معتبر: npm run admin:create -- --phone 09123456789');
  let phoneNumber = args[1];
  if (!phoneNumber) {
    if (!process.stdin.isTTY) throw new Error('شماره همراه را با --phone وارد کنید.');
    const input = createInterface({ input: process.stdin, output: process.stdout });
    try { phoneNumber = await input.question('شماره همراه مدیر: '); } finally { input.close(); }
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI در .env تنظیم نشده است.');
  const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString('base64url');
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    for (const model of Object.values(mongoose.models)) await model.init();
  } catch { throw new Error('اتصال به دیتابیس انجام نشد؛ .env و اجرای MongoDB را بررسی کنید.'); }
  let result;
  try { result = await createInitialAdmin({ phoneNumber, password }); }
  catch (error) {
    if (error.code === 11000) throw new Error('این شماره هم‌زمان ثبت شده است؛ دستور را دوباره اجرا کنید.');
    if (error.name === 'MongoServerError') throw new Error('ساخت ادمین انجام نشد؛ دیتابیس باید از تراکنش پشتیبانی کند.');
    throw error;
  }
  if (!result.created) { console.log('ادمین فعال از قبل وجود دارد؛ رمز و دسترسی‌هایش تغییر نکرد.'); return; }
  console.log('ادمین ساخته شد. شماره همراه: ' + result.phoneNumber);
  if (!process.env.ADMIN_PASSWORD) console.log('رمز ورود (همین حالا ذخیره کنید): ' + password);
  console.log('مسیر ورود: /admin/');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
