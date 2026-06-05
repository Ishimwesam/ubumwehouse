import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ubumwe-stack-smoke-'));
const dbPath = path.join(tmpRoot, 'smoke.db');
const uploadDir = path.join(tmpRoot, 'uploads');
const port = Number(process.env.SMOKE_PORT || 5193);
const base = `http://127.0.0.1:${port}/api`;
const today = new Date().toISOString().slice(0, 10);
const period = today.slice(0, 7);
const stamp = Date.now();

const backend = spawn('npm', ['--prefix', 'backend', 'start'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: String(port),
    DB_PATH: dbPath,
    UPLOAD_DIR: uploadDir,
    JWT_SECRET: 'smoke-jwt-secret',
    SESSION_SECRET: 'smoke-session-secret',
    DEFAULT_ADMIN_USERNAME: 'admin',
    DEFAULT_ADMIN_PASSWORD: 'admin123',
    DEFAULT_ADMIN_EMAIL: 'admin@example.com',
    REQUIRE_DEVICE_LOCK: 'false',
    BACKUPS_ENABLED: 'false',
    WHATSAPP_REMINDERS_ENABLED: 'false'
  }
});

let backendOutput = '';
backend.stdout.on('data', (chunk) => {
  backendOutput += chunk.toString();
});
backend.stderr.on('data', (chunk) => {
  backendOutput += chunk.toString();
});

const cleanup = async () => {
  backend.kill('SIGTERM');
  await wait(300);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
};

const fail = async (message) => {
  await cleanup();
  throw new Error(`${message}\n\nBackend output:\n${backendOutput.slice(-4000)}`);
};

const waitForBackend = async () => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {
      // wait for server to bind
    }
    await wait(250);
  }

  await fail('Backend did not become healthy.');
};

const request = async (apiPath, options = {}) => {
  const response = await fetch(base + apiPath, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }

  if (!response.ok) {
    await fail(`${options.method || 'GET'} ${apiPath} -> ${response.status} ${JSON.stringify(body)}`);
  }

  return body;
};

try {
  await waitForBackend();

  let login;
  const loginDeadline = Date.now() + 12000;
  while (!login && Date.now() < loginDeadline) {
    const response = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const body = await response.json().catch(() => ({}));

    if (response.ok && body.token) {
      login = body;
    } else {
      const isStartupAuthDelay = response.status === 401 || (
        response.status === 403 && /verify your email/i.test(String(body.error || body.message || ''))
      );

      if (!isStartupAuthDelay) {
        await fail(`POST /auth/login -> ${response.status} ${JSON.stringify(body)}`);
      }
      await wait(300);
    }
  }

  if (!login?.token) {
    await fail('Default admin was not ready for login.');
  }

  const auth = { Authorization: `Bearer ${login.token}` };

  const building = await request('/buildings', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Smoke Building ${stamp}`,
      address: 'QA Road',
      city: 'Kigali',
      country: 'Rwanda',
      available_floors: ['GROUND FLOOR']
    })
  });

  const unit = await request('/units', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      building_id: building.building.id,
      unit_number: `QA-${stamp}`,
      unit_type: 'Shop',
      monthly_rent: 100000,
      floor: 'GROUND FLOOR'
    })
  });

  const tenant = await request('/tenants', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: `Smoke Tenant ${stamp}`,
      email: `smoke${stamp}@example.com`,
      phone: `25078${String(stamp).slice(-7)}`,
      national_id: `QA${stamp}`,
      identification_document: '',
      address: 'Kigali',
      occupation_status: 'Business owner',
      occupation_place: 'Market',
      emergency_contact_name: 'Emergency Contact',
      emergency_contact_phone: '250788000000',
      unit_id: unit.unit.id,
      move_in_date: today,
      status: 'active'
    })
  });

  const form = new FormData();
  form.append('tenant_id', tenant.tenant.id);
  form.append('unit_id', unit.unit.id);
  form.append('amount', '100000');
  form.append('payment_date', today);
  form.append('payment_period', period);
  form.append('payment_method', 'cash');
  form.append('notes', 'Smoke payment');
  form.append('receipt', new Blob(['%PDF-1.4\n% smoke receipt\n'], { type: 'application/pdf' }), 'receipt.pdf');

  const payment = await request('/payments', { method: 'POST', headers: auth, body: form });
  await request(`/payments/${payment.payment.id}/confirm`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation_notes: 'Smoke confirmed' })
  });

  const endpoints = [
    '/dashboard/summary',
    '/dashboard/monthly-income',
    '/dashboard/unpaid-tenants',
    '/dashboard/occupancy',
    '/tenants',
    '/units',
    '/buildings',
    '/payments',
    '/contracts',
    '/expenses',
    '/calendar-events',
    `/tenants/${tenant.tenant.id}/ledger`
  ];

  for (const endpoint of endpoints) {
    await request(endpoint, { headers: auth });
  }

  console.log(`Full-stack API smoke test passed for ${endpoints.length} read endpoints and the create/payment workflow.`);
  await cleanup();
} catch (error) {
  await cleanup();
  throw error;
}
