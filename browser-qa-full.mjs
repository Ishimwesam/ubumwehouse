import puppeteer from 'puppeteer-core';
import { createRequire } from 'module';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const backendRequire = createRequire(new URL('./backend/package.json', import.meta.url));
const sqlite3 = backendRequire('sqlite3').verbose();
const bcrypt = backendRequire('bcryptjs');

const APP_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5003/api';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DB_PATH = new URL('./backend/rental_management.db', import.meta.url).pathname;
const SAMPLE_IMAGE_PATH = new URL('./backend/src/uploads/1776425780498-191314756.jpeg', import.meta.url).pathname;

const ADMIN = {
  username: 'admin',
  email: 'ishimwesamuel023@gmail.com',
  password: 'admin123'
};

const now = Date.now();
const qa = {
  buildingName: `QA Building ${now}`,
  buildingNameUpdated: `QA Building ${now} Updated`,
  unitNumber: `QA-U-${now}`,
  unitNumberUpdated: `QA-U-${now}-E`,
  tenantName: `QA Tenant ${now}`,
  tenantEmail: `qa.tenant.${now}@example.com`,
  tenantPhone: `078${String(now).slice(-7)}`,
  tenantPhoneUpdated: `079${String(now).slice(-7)}`,
  tenantNationalId: `${String(now).padEnd(16, '7').slice(0, 16)}`,
  contractNote: `QA Contract ${now}`,
  paymentNote: `QA Payment ${now}`,
  expenseTitle: `QA Expense ${now}`,
  registerUsername: `qauser${String(now).slice(-8)}`,
  registerEmail: `qa.user.${now}@example.com`,
  registerPassword: `QaReg!${String(now).slice(-6)}`,
  profileFullName: `Administrator QA ${now}`,
  tempPassword: `Adm!${String(now).slice(-8)}a`,
  resetPassword: `Rst!${String(now).slice(-8)}b`,
  verifyToken: crypto.randomBytes(16).toString('hex')
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const db = new sqlite3.Database(DB_PATH);
const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => db.run(sql, params, function cb(err) {
    if (err) reject(err);
    else resolve({ changes: this.changes, lastID: this.lastID });
  }));
const dbClose = () =>
  new Promise((resolve, reject) => db.close((err) => (err ? reject(err) : resolve())));

const state = {
  adminOriginal: null,
  findings: [],
  requestFailures: [],
  consoleIssues: [],
  routeChecks: [],
  workflows: [],
  apiChecks: [],
  forgotPassword: {},
  verifyEmail: {},
  registration: {},
  login: null
};

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  defaultViewport: { width: 1440, height: 960 },
  args: ['--no-sandbox', '--disable-gpu']
});
const page = await browser.newPage();

page.on('pageerror', (error) => {
  state.consoleIssues.push({ type: 'pageerror', text: error.message });
});

page.on('console', (msg) => {
  const type = msg.type();
  if (['error', 'warning'].includes(type)) {
    state.consoleIssues.push({ type, text: msg.text() });
  }
});

page.on('requestfailed', (request) => {
  state.requestFailures.push({
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText || 'Unknown request failure'
  });
});

page.on('dialog', async (dialog) => {
  await dialog.accept();
});

const unique = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const api = async (path, { method = 'GET', token, json, formData } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;

  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (formData) {
    body = formData;
  }

  const response = await fetch(`${API_URL}${path}`, { method, headers, body });
  const contentType = response.headers.get('content-type') || '';
  let data;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { response, data };
};

const loginApi = async (username, password) => {
  const { response, data } = await api('/auth/login', {
    method: 'POST',
    json: { username, password }
  });
  if (!response.ok) {
    throw new Error(`API login failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data.token;
};

const clearAndType = async (selector, value) => {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  if (value) {
    await page.type(selector, String(value));
  }
};

const selectValue = async (selector, value) => {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.select(selector, value);
};

const clickButtonContaining = async (text) => {
  const clicked = await page.evaluate((needle) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find((node) => (node.innerText || '').includes(needle));
    if (!button) return false;
    button.click();
    return true;
  }, text);
  if (!clicked) throw new Error(`Button containing "${text}" not found`);
};

const clickInContainer = async (containerText, buttonText) => {
  const clicked = await page.evaluate((containerNeedle, buttonNeedle) => {
    const candidates = Array.from(document.querySelectorAll('div, tr, section, article'));
    const match = candidates.find((node) => (node.innerText || '').includes(containerNeedle));
    if (!match) return false;
    const button = Array.from(match.querySelectorAll('button, a')).find((node) => (node.innerText || '').includes(buttonNeedle));
    if (!button) return false;
    button.click();
    return true;
  }, containerText, buttonText);
  if (!clicked) throw new Error(`Could not click "${buttonText}" inside container "${containerText}"`);
};

const routeCheck = async (route, expectedText = '') => {
  const consoleStart = state.consoleIssues.length;
  const failuresStart = state.requestFailures.length;
  await page.goto(`${APP_URL}${route}`, { waitUntil: 'networkidle2' });
  await wait(500);
  const text = await page.evaluate(() => document.body.innerText);
  state.routeChecks.push({
    route,
    url: page.url(),
    expectedText,
    matchedExpectedText: expectedText ? text.includes(expectedText) : true,
    redirectedToLogin: page.url().includes('/login'),
    hasLoadErrorText: /failed to load|route not found|internal server error/i.test(text),
    consoleIssues: state.consoleIssues.slice(consoleStart),
    requestFailures: state.requestFailures.slice(failuresStart)
  });
};

const assert = (condition, message) => {
  if (!condition) {
    state.findings.push(message);
  }
};

const workflow = async (name, fn) => {
  try {
    await fn();
    state.workflows.push({ name, passed: true });
  } catch (error) {
    state.findings.push(`${name}: ${error.message}`);
    state.workflows.push({ name, passed: false, error: error.message });
  }
};

const loginViaUi = async (identifier, password) => {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' });
  await clearAndType('input[name="identifier"]', identifier);
  await clearAndType('input[name="password"]', password);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' })
  ]);
};

const logoutViaUi = async () => {
  await clickButtonContaining('Logout');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
};

try {
  state.adminOriginal = await dbGet(
    'SELECT id, username, email, phone, full_name, role, profile_image, password FROM users WHERE username = ?',
    [ADMIN.username]
  );

  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });

  await loginViaUi(ADMIN.username, ADMIN.password);
  state.login = {
    url: page.url(),
    hasToken: await page.evaluate(() => !!localStorage.getItem('token'))
  };
  assert(page.url().includes('/dashboard'), 'UI login did not land on dashboard.');

  const adminToken = await loginApi(ADMIN.username, ADMIN.password);
  const { data: buildings } = await api('/buildings', { token: adminToken });
  const firstBuildingId = buildings[0]?.id || '';

  for (const [route, expected] of [
    ['/dashboard', 'Dashboard'],
    ['/buildings', 'Buildings Management'],
    ['/buildings/' + firstBuildingId, 'Building'],
    ['/tenants', 'Tenants Management'],
    ['/units', 'Units / Rooms Management'],
    ['/contracts', 'Contracts'],
    ['/payments', 'Payments Management'],
    ['/advanced-reports', 'Advanced Reports Dashboard'],
    ['/reports', 'Advanced Reports Dashboard'],
    ['/manual-confirmation', 'Manual Payment Confirmation'],
    ['/daily-income', 'Daily Income Summary'],
    ['/monthly-rent-sheet', 'Rent Collection Sheet'],
    ['/calendar-events', 'Calendar'],
    ['/expenses', 'Expenses'],
    ['/settings', 'Settings']
  ]) {
    await routeCheck(route, expected);
  }

  await workflow('building_create_edit_delete', async () => {
    await page.goto(`${APP_URL}/buildings`, { waitUntil: 'networkidle2' });
    await clickButtonContaining('Add Building');
    await clearAndType('input[name="name"]', qa.buildingName);
    await clearAndType('input[name="address"]', 'QA Address');
    await clearAndType('input[name="city"]', 'Kigali');
    await clearAndType('input[name="country"]', 'Rwanda');
    await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll('label')).find((node) => node.innerText.includes('GROUND FLOOR'));
      if (label) label.click();
    });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);
    assert(await page.evaluate((name) => document.body.innerText.includes(name), qa.buildingName), 'Building create workflow failed.');

    await clickInContainer(qa.buildingName, 'Edit');
    await clearAndType('input[name="name"]', qa.buildingNameUpdated);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);
    assert(await page.evaluate((name) => document.body.innerText.includes(name), qa.buildingNameUpdated), 'Building edit workflow failed.');
  });

  await workflow('unit_create_edit', async () => {
    const token = await loginApi(ADMIN.username, ADMIN.password);
    const { data: freshBuildings } = await api('/buildings', { token });
    const qaBuilding = freshBuildings.find((item) => item.name === qa.buildingNameUpdated);
    if (!qaBuilding) throw new Error('QA building was not found for unit workflow.');

    await page.goto(`${APP_URL}/units`, { waitUntil: 'networkidle2' });
    await clickButtonContaining('Add Unit');
    await selectValue('select[name="building_id"]', qaBuilding.id);
    await clearAndType('input[name="unit_number"]', qa.unitNumber);
    await selectValue('select[name="unit_type"]', 'room');
    await clearAndType('input[name="monthly_rent"]', '20000');
    await selectValue('select[name="floor"]', 'GROUND FLOOR');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);
    assert(await page.evaluate((unitNumber) => document.body.innerText.includes(unitNumber), qa.unitNumber), 'Unit create workflow failed.');

    await clickInContainer(qa.unitNumber, 'Edit');
    await clearAndType('input[name="unit_number"]', qa.unitNumberUpdated);
    await clearAndType('input[name="monthly_rent"]', '25000');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);
    assert(await page.evaluate((unitNumber) => document.body.innerText.includes(unitNumber), qa.unitNumberUpdated), 'Unit edit workflow failed.');
  });

  await workflow('tenant_create_edit_view', async () => {
    await page.goto(`${APP_URL}/tenants`, { waitUntil: 'networkidle2' });
    await clickButtonContaining('Add Tenant');
    await clearAndType('input[name="full_name"]', qa.tenantName);
    await clearAndType('input[name="email"]', qa.tenantEmail);
    await clearAndType('input[name="phone"]', qa.tenantPhone);
    await clearAndType('input[name="national_id"]', qa.tenantNationalId);
    await clearAndType('input[name="identification_document"]', 'QA-ID');
    await clearAndType('textarea[name="address"]', 'QA Address Block');
    await selectValue('select[name="unit_id"]', await page.$eval('select[name="unit_id"]', (select, unitText) => {
      const option = Array.from(select.options).find((item) => item.text.includes(unitText));
      return option ? option.value : '';
    }, qa.unitNumberUpdated));
    await clearAndType('input[name="move_in_date"]', new Date().toISOString().slice(0, 10));
    await clearAndType('input[name="occupation_status"]', 'Employed');
    await clearAndType('input[name="occupation_place"]', 'QA Office');
    await clearAndType('input[name="emergency_contact_name"]', 'QA Emergency');
    await clearAndType('input[name="emergency_contact_phone"]', '0780000001');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);
    assert(await page.evaluate((name) => document.body.innerText.includes(name), qa.tenantName), 'Tenant create workflow failed.');

    await clickInContainer(qa.tenantName, 'Edit');
    await clearAndType('input[name="phone"]', qa.tenantPhoneUpdated);
    await clearAndType('input[name="occupation_place"]', 'QA Office Updated');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);
    await clickInContainer(qa.tenantName, 'View');
    assert(await page.evaluate((text) => document.body.innerText.includes(text), 'QA Office Updated'), 'Tenant view/details workflow failed.');
    await clickButtonContaining('Close');
  });

  await workflow('contract_create_terminate', async () => {
    await page.goto(`${APP_URL}/contracts`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('select[name="tenant_id"]', { timeout: 15000 });

    const tenantId = await page.$eval('select[name="tenant_id"]', (select, tenantText) => {
      const option = Array.from(select.options).find((item) => item.text.includes(tenantText));
      return option ? option.value : '';
    }, qa.tenantName);
    const unitId = await page.$eval('select[name="unit_id"]', (select, unitText) => {
      const option = Array.from(select.options).find((item) => item.text.includes(unitText));
      return option ? option.value : '';
    }, qa.unitNumberUpdated);

    if (!tenantId || !unitId) throw new Error('Contract form did not expose the QA tenant/unit.');

    await selectValue('select[name="tenant_id"]', tenantId);
    await selectValue('select[name="unit_id"]', unitId);
    const today = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await clearAndType('input[name="contract_start"]', today);
    await clearAndType('input[name="contract_end"]', endDate);
    await clearAndType('textarea[name="notes"]', qa.contractNote);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);
    assert(await page.evaluate((name) => document.body.innerText.includes(name), qa.tenantName), 'Contract create workflow failed.');

    await clickInContainer(qa.tenantName, 'Terminate');
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 });
  });

  await workflow('payment_create_confirm_edit_delete', async () => {
    await page.goto(`${APP_URL}/payments`, { waitUntil: 'networkidle2' });
    await clickButtonContaining('Make Payment');
    await clearAndType('input[placeholder*="Search tenant"]', qa.tenantName);
    await page.waitForFunction((name) => {
      const select = document.querySelector('select[required]');
      return select && Array.from(select.options).some((opt) => opt.text.includes(name));
    }, { timeout: 15000 }, qa.tenantName);

    const tenantId = await page.$eval('div[style] select[required]', (select, tenantText) => {
      const option = Array.from(select.options).find((item) => item.text.includes(tenantText));
      return option ? option.value : '';
    }, qa.tenantName);
    if (!tenantId) throw new Error('Payment form did not expose the QA tenant.');
    await page.select('div[style] select[required]', tenantId);
    await wait(500);

    const unitId = await page.$eval('select[disabled]', () => '');
    void unitId;
    const selects = await page.$$('select');
    if (selects.length < 4) throw new Error('Payment form selects are missing.');
    const paymentUnitId = await page.$eval('select:nth-of-type(2)', (select) => select.value);
    assert(Boolean(paymentUnitId), 'Payment unit did not auto-select for the QA tenant.');

    await clearAndType('input[type="number"]', '10000');
    await clearAndType('input[type="month"]', new Date().toISOString().slice(0, 7));
    await clearAndType('input[type="date"]', new Date().toISOString().slice(0, 10));
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(SAMPLE_IMAGE_PATH);
    await clearAndType('textarea', qa.paymentNote);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);
    assert(page.url().includes('/manual-confirmation'), 'Payment create did not navigate to manual confirmation.');

    await clickInContainer(qa.tenantName, 'Confirm and Upload Receipt');
    await wait(500);
    await clickButtonContaining('Confirm Payment');
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 });

    await page.goto(`${APP_URL}/payments`, { waitUntil: 'networkidle2' });
    await clickButtonContaining('Payment History');
    await clearAndType('input[placeholder*="Search payments"]', qa.tenantName);
    await clickInContainer(qa.tenantName, 'Edit');
    const amountInput = (await page.$$('input[type="number"]'))[0];
    await amountInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await amountInput.type('9000');
    await clearAndType('textarea', `${qa.paymentNote} updated`);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);
    await clickButtonContaining('Payment History');
    await clearAndType('input[placeholder*="Search payments"]', qa.tenantName);
    await clickInContainer(qa.tenantName, 'Delete');
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 });
  });

  await workflow('expense_create_delete', async () => {
    await page.goto(`${APP_URL}/expenses`, { waitUntil: 'networkidle2' });
    await clearAndType('input[name="title"]', qa.expenseTitle);
    await clearAndType('input[name="amount"]', '1234');
    await clearAndType('textarea[name="notes"]', 'QA expense note');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);
    await clickInContainer(qa.expenseTitle, 'Delete');
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 });
  });

  await workflow('settings_profile_password_and_logout_login', async () => {
    await page.goto(`${APP_URL}/settings`, { waitUntil: 'networkidle2' });
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(SAMPLE_IMAGE_PATH);
    await clickButtonContaining('Upload Profile Picture');
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 });
    await clearAndType('input[name="full_name"]', qa.profileFullName);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);

    await clickButtonContaining('Password');
    await clearAndType('input[name="oldPassword"]', ADMIN.password);
    await clearAndType('input[name="newPassword"]', qa.tempPassword);
    await clearAndType('input[name="confirmPassword"]', qa.tempPassword);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);

    await clickButtonContaining('Account');
    await clickButtonContaining('Logout');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await loginViaUi(ADMIN.username, qa.tempPassword);
    assert(page.url().includes('/dashboard'), 'Login with updated password failed.');

    await page.goto(`${APP_URL}/settings`, { waitUntil: 'networkidle2' });
    await clickButtonContaining('Password');
    await clearAndType('input[name="oldPassword"]', qa.tempPassword);
    await clearAndType('input[name="newPassword"]', ADMIN.password);
    await clearAndType('input[name="confirmPassword"]', ADMIN.password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);
  });

  await workflow('forgot_password_and_reset', async () => {
    await logoutViaUi();
    await page.goto(`${APP_URL}/forgot-password`, { waitUntil: 'networkidle2' });
    await clearAndType('input[type="text"]', ADMIN.email);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);

    const devResetLink = await page.evaluate(() => {
      const link = document.querySelector('.copilot-forgot-devlink-link');
      return link ? link.getAttribute('href') : '';
    });
    state.forgotPassword = { devResetLinkPresent: Boolean(devResetLink) };
    if (!devResetLink) throw new Error('Development reset link was not shown on forgot password page.');

    await page.goto(devResetLink, { waitUntil: 'networkidle2' });
    await clearAndType('input[type="password"]:nth-of-type(1)', qa.resetPassword);
    await clearAndType('input[type="password"]:nth-of-type(2)', qa.resetPassword);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);

    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' });
    await loginViaUi(ADMIN.username, qa.resetPassword);
    assert(page.url().includes('/dashboard'), 'Login with reset password failed.');

    await page.goto(`${APP_URL}/settings`, { waitUntil: 'networkidle2' });
    await clickButtonContaining('Password');
    await clearAndType('input[name="oldPassword"]', qa.resetPassword);
    await clearAndType('input[name="newPassword"]', ADMIN.password);
    await clearAndType('input[name="confirmPassword"]', ADMIN.password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);
  });

  await workflow('registration_and_relogin', async () => {
    await logoutViaUi();
    await page.goto(`${APP_URL}/register`, { waitUntil: 'networkidle2' });
    const registerInputs = await page.$$('.copilot-register-form input');
    if (registerInputs.length < 6) throw new Error('Registration form fields are missing.');
    await registerInputs[0].type(`QA User ${now}`);
    await registerInputs[1].type(qa.registerUsername);
    await registerInputs[2].type(qa.registerEmail);
    await registerInputs[3].type('0780000002');
    await registerInputs[4].type(qa.registerPassword);
    await registerInputs[5].type(qa.registerPassword);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    await loginViaUi(qa.registerUsername, qa.registerPassword);
    state.registration.loggedInAsQaUser = page.url().includes('/dashboard');
    await logoutViaUi();
    await loginViaUi(ADMIN.username, ADMIN.password);
  });

  await workflow('verify_email_flow', async () => {
    await dbRun(
      'UPDATE users SET email_verified = 0, verification_token = ?, verification_token_expires = datetime(\'now\', \'+1 day\') WHERE username = ?',
      [qa.verifyToken, qa.registerUsername]
    );
    await page.goto(`${APP_URL}/verify-email?token=${qa.verifyToken}`, { waitUntil: 'networkidle2' });
    const bodyText = await page.evaluate(() => document.body.innerText);
    state.verifyEmail = {
      successPage: /Email verified successfully/i.test(bodyText)
    };
    assert(state.verifyEmail.successPage, 'Verify email flow did not report success for a valid token.');
  });

  await workflow('api_chat', async () => {
    const token = await loginApi(ADMIN.username, ADMIN.password);
    const chat = await api('/chat/messages', { token });
    state.apiChecks.push({
      chatStatus: chat.response.status
    });
    assert(chat.response.ok, 'Chat API did not return success.');
  });

  await workflow('cleanup_created_entities', async () => {
    const token = await loginApi(ADMIN.username, ADMIN.password);
    const buildingsRes = await api('/buildings', { token });
    const qaBuilding = (buildingsRes.data || []).find((item) => item.name === qa.buildingNameUpdated);

    const tenantsRes = await api('/tenants', { token });
    const qaTenant = (tenantsRes.data || []).find((item) => item.email === qa.tenantEmail);

    const unitsRes = await api('/units', { token });
    const qaUnit = (unitsRes.data || []).find((item) => item.unit_number === qa.unitNumberUpdated);

    if (qaTenant) {
      await api(`/tenants/${qaTenant.id}`, { method: 'DELETE', token });
    }
    if (qaUnit) {
      await api(`/units/${qaUnit.id}`, { method: 'DELETE', token });
    }
    if (qaBuilding) {
      await api(`/buildings/${qaBuilding.id}`, { method: 'DELETE', token });
    }

    await dbRun('DELETE FROM contracts WHERE notes = ?', [qa.contractNote]);
    await dbRun('DELETE FROM users WHERE username = ?', [qa.registerUsername]);
  });
} catch (error) {
  state.findings.push(`Full QA runner crashed: ${error.message}`);
} finally {
  try {
    if (state.adminOriginal) {
      await dbRun(
        `UPDATE users
         SET email = ?, phone = ?, full_name = ?, role = ?, profile_image = ?, password = ?, email_verified = 1,
             verification_token = NULL, verification_token_expires = NULL, reset_token = NULL, reset_token_expires = NULL,
             reset_otp = NULL, reset_otp_expires = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE username = ?`,
        [
          state.adminOriginal.email,
          state.adminOriginal.phone,
          state.adminOriginal.full_name,
          state.adminOriginal.role,
          state.adminOriginal.profile_image,
          state.adminOriginal.password || bcrypt.hashSync(ADMIN.password, 10),
          ADMIN.username
        ]
      );
    } else {
      await dbRun(
        'UPDATE users SET password = ?, email_verified = 1 WHERE username = ?',
        [bcrypt.hashSync(ADMIN.password, 10), ADMIN.username]
      );
    }
  } catch (restoreError) {
    state.findings.push(`Admin restore failed: ${restoreError.message}`);
  }

  state.consoleIssues = unique(state.consoleIssues);
  state.requestFailures = unique(state.requestFailures);
  console.log(JSON.stringify(state, null, 2));
  await browser.close();
  await dbClose();
}
