import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:5003/api';
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 9223);
const ADMIN_USERNAME = process.env.QA_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || 'admin123';

const routes = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/tenants', label: 'Tenants' },
  { path: '/buildings', label: 'Buildings' },
  { path: '/units', label: 'Units' },
  { path: '/monthly-rent-sheet', label: 'Rent Collection' },
  { path: '/contracts', label: 'Contracts' },
  { path: '/expenses', label: 'Expenses' },
  { path: '/payments', label: 'Payment' },
  { path: '/reports', label: 'Reports' },
  { path: '/calendar-events', label: 'Calendar' },
  { path: '/settings', label: 'Settings' }
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fail = (message) => {
  throw new Error(message);
};

if (!fs.existsSync(CHROME_PATH)) {
  fail(`Chrome was not found at ${CHROME_PATH}. Set CHROME_PATH to run browser smoke tests.`);
}

const loginResponse = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
});

const loginBody = await loginResponse.json().catch(() => ({}));
if (!loginResponse.ok || !loginBody.token) {
  fail(`Admin API login failed: ${loginResponse.status} ${JSON.stringify(loginBody)}`);
}

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-browser-smoke-'));
const chrome = spawn(CHROME_PATH, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${userDataDir}`,
  'about:blank'
], { stdio: 'ignore' });

let ws;
let nextId = 1;
const pending = new Map();

const cleanup = async () => {
  try {
    ws?.close();
  } catch {
    // ignore close errors during cleanup
  }
  chrome.kill('SIGTERM');
  await wait(250);
  fs.rmSync(userDataDir, { recursive: true, force: true });
};

process.on('exit', () => {
  try {
    chrome.kill('SIGTERM');
  } catch {
    // ignore shutdown errors
  }
});

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
};

const getPageWebSocketUrl = async () => {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      try {
        const target = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' });
        if (target.webSocketDebuggerUrl) return target.webSocketDebuggerUrl;
      } catch {
        const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        const pageTarget = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
        if (pageTarget) return pageTarget.webSocketDebuggerUrl;
      }
    } catch {
      await wait(200);
    }
  }
  fail('Chrome page DevTools endpoint did not become ready.');
};

const send = (method, params = {}) => {
  const id = nextId;
  nextId += 1;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }
    }, 15000);
  });
};

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.result?.exceptionDetails) {
    fail(result.result.exceptionDetails.text || 'Browser evaluation failed.');
  }
  return result.result?.result?.value;
};

const navigate = async (url) => {
  await send('Page.navigate', { url });
  await wait(1200);
};

try {
  const wsUrl = await getPageWebSocketUrl();
  ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message);
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await navigate(`${APP_URL}/login`);
  await evaluate(`localStorage.setItem('token', ${JSON.stringify(loginBody.token)})`);

  const findings = [];
  for (const route of routes) {
    await navigate(`${APP_URL}${route.path}`);
    const pageState = await evaluate(`(() => {
      const text = document.body ? document.body.innerText : '';
      const root = document.querySelector('#root');
      return {
        url: location.href,
        text,
        rootChildren: root ? root.children.length : 0,
        title: document.title
      };
    })()`);

    const text = pageState.text || '';
    if (pageState.rootChildren < 1 || text.trim().length < 25) {
      findings.push(`${route.path}: page rendered blank or nearly blank`);
    }
    if (!text.toLowerCase().includes(route.label.toLowerCase())) {
      findings.push(`${route.path}: expected label "${route.label}" was not visible`);
    }
    if (/white screen|failed to load|route not found|internal server error|uncaught error/i.test(text)) {
      findings.push(`${route.path}: visible error text detected`);
    }
    if (pageState.url.includes('/login')) {
      findings.push(`${route.path}: redirected back to login`);
    }
  }

  if (findings.length) {
    fail(`Browser smoke test failed:\n${findings.map((item) => `- ${item}`).join('\n')}`);
  }

  console.log(`Browser smoke test passed for ${routes.length} main routes.`);
} finally {
  await cleanup();
}
