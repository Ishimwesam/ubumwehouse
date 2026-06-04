import puppeteer from 'puppeteer-core';
import { createRequire } from 'module';

const backendRequire = createRequire(new URL('./backend/package.json', import.meta.url));
const sqlite3 = backendRequire('sqlite3').verbose();

const APP_URL = 'http://localhost:5173';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DB_PATH = new URL('./backend/rental_management.db', import.meta.url).pathname;

const ADMIN = {
  username: 'admin',
  email: 'ishimwesamuel023@gmail.com',
  password: 'admin123'
};

const now = Date.now();
const QA_USER = {
  fullName: `QA User ${now}`,
  username: `qauser${String(now).slice(-8)}`,
  email: `qa.auth.${now}@example.com`,
  password: `QaAuth!${String(now).slice(-6)}`,
  resetPassword: `AdmReset!${String(now).slice(-6)}`
};

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

const result = {
  findings: [],
  steps: []
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clearAndType = async (selector, value) => {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  if (value) await page.type(selector, String(value));
};

const login = async (identifier, password) => {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' });
  await clearAndType('input[name="identifier"]', identifier);
  await clearAndType('input[name="password"]', password);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForFunction(() => window.location.pathname !== '/login', { timeout: 20000 })
  ]);
  await wait(1000);
};

const logout = async () => {
  const clicked = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button,a')).find((node) => (node.innerText || '').includes('Logout'));
    if (!button) return false;
    button.click();
    return true;
  });
  if (!clicked) throw new Error('Logout control not found');
  await page.waitForFunction(() => window.location.pathname === '/login', { timeout: 20000 });
};

try {
  const adminOriginal = await dbGet('SELECT password FROM users WHERE username = ?', [ADMIN.username]);

  await login(ADMIN.username, ADMIN.password);
  result.steps.push({ step: 'login_admin', ok: page.url().includes('/dashboard') });

  await page.goto(`${APP_URL}/settings`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find((node) => (node.innerText || '').includes('Account'));
    if (button) button.click();
  });
  await wait(500);
  await logout();
  result.steps.push({ step: 'logout', ok: page.url().includes('/login') });

  await page.goto(`${APP_URL}/register`, { waitUntil: 'networkidle2' });
  const registerInputs = await page.$$('.copilot-register-form input');
  if (registerInputs.length < 6) throw new Error('Registration form fields are missing');
  await registerInputs[0].type(QA_USER.fullName);
  await registerInputs[1].type(QA_USER.username);
  await registerInputs[2].type(QA_USER.email);
  await registerInputs[3].type('0780000002');
  await registerInputs[4].type(QA_USER.password);
  await registerInputs[5].type(QA_USER.password);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForFunction(() => window.location.pathname === '/login', { timeout: 20000 })
  ]);
  result.steps.push({ step: 'register', ok: page.url().includes('/login') });

  await login(QA_USER.username, QA_USER.password);
  result.steps.push({ step: 'login_registered_user', ok: page.url().includes('/dashboard') });
  await logout();

  await page.goto(`${APP_URL}/forgot-password`, { waitUntil: 'networkidle2' });
  await clearAndType('input[type="text"]', ADMIN.email);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNetworkIdle({ idleTime: 500, timeout: 20000 })
  ]);

  const devResetLink = await page.evaluate(() => {
    const link = document.querySelector('.copilot-forgot-devlink-link');
    return link ? link.getAttribute('href') : '';
  });
  result.steps.push({ step: 'forgot_password_request', ok: Boolean(devResetLink), devResetLink });
  if (!devResetLink) {
    throw new Error('Forgot password did not expose a development reset link');
  }

  await page.goto(devResetLink, { waitUntil: 'networkidle2' });
  const resetPasswordInputs = await page.$$('input[type="password"]');
  if (resetPasswordInputs.length < 2) throw new Error('Reset password form fields are missing');
  await resetPasswordInputs[0].type(QA_USER.resetPassword);
  await resetPasswordInputs[1].type(QA_USER.resetPassword);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNetworkIdle({ idleTime: 500, timeout: 20000 })
  ]);
  result.steps.push({ step: 'reset_password_submit', ok: true });

  await login(ADMIN.username, QA_USER.resetPassword);
  result.steps.push({ step: 'login_with_reset_password', ok: page.url().includes('/dashboard') });

  await dbRun('DELETE FROM users WHERE username = ?', [QA_USER.username]);
  await dbRun('UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE username = ?', [adminOriginal.password, ADMIN.username]);

  await logout();
  await login(ADMIN.username, ADMIN.password);
  result.steps.push({ step: 'admin_restored_login', ok: page.url().includes('/dashboard') });
} catch (error) {
  result.findings.push(error.message);
} finally {
  try {
    const adminOriginal = await dbGet('SELECT password FROM users WHERE username = ?', [ADMIN.username]);
    if (adminOriginal?.password) {
      await dbRun('DELETE FROM users WHERE username = ?', [QA_USER.username]);
    }
  } catch {}
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  await dbClose();
}
