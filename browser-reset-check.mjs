import puppeteer from 'puppeteer-core';
import { createRequire } from 'module';

const backendRequire = createRequire(new URL('./backend/package.json', import.meta.url));
const sqlite3 = backendRequire('sqlite3').verbose();

const APP_URL = 'http://localhost:5173';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DB_PATH = new URL('./backend/rental_management.db', import.meta.url).pathname;
const ADMIN = { username: 'admin', password: 'admin123' };
const tempPassword = `Reset!${Date.now().toString().slice(-6)}`;

const db = new sqlite3.Database(DB_PATH);
const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => db.run(sql, params, function cb(err) {
    if (err) reject(err);
    else resolve(this.changes);
  }));
const dbClose = () =>
  new Promise((resolve, reject) => db.close((err) => (err ? reject(err) : resolve())));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  defaultViewport: { width: 1400, height: 900 },
  args: ['--no-sandbox', '--disable-gpu']
});
const page = await browser.newPage();

const result = { findings: [], steps: [] };

const clearAndType = async (selector, value) => {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(selector, value);
};

try {
  const row = await dbGet('SELECT reset_token, password FROM users WHERE username = ?', [ADMIN.username]);
  if (!row?.reset_token) throw new Error('No reset token is available for admin');

  await page.goto(`${APP_URL}/reset-password?token=${row.reset_token}`, { waitUntil: 'networkidle2' });
  const passwordInputs = await page.$$('input[type="password"]');
  if (passwordInputs.length < 2) throw new Error('Reset password form did not render correctly');
  await passwordInputs[0].type(tempPassword);
  await passwordInputs[1].type(tempPassword);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNetworkIdle({ idleTime: 500, timeout: 20000 })
  ]);
  result.steps.push({ step: 'reset_submit', ok: true });

  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' });
  await clearAndType('input[name="identifier"]', ADMIN.username);
  await clearAndType('input[name="password"]', tempPassword);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 20000 })
  ]);
  result.steps.push({ step: 'login_with_reset_password', ok: true });

  await dbRun('UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE username = ?', [row.password, ADMIN.username]);
  result.steps.push({ step: 'restore_admin_password', ok: true });
} catch (error) {
  result.findings.push(error.message);
} finally {
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  await dbClose();
}
