import puppeteer from 'puppeteer-core';

const APP_URL = 'http://localhost:5173';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LOGIN = {
  username: 'admin',
  password: 'admin123'
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  defaultViewport: { width: 1440, height: 960 },
  args: ['--no-sandbox', '--disable-gpu']
});

const page = await browser.newPage();
const findings = [];
const requestFailures = [];
const consoleIssues = [];

page.on('pageerror', (error) => {
  consoleIssues.push({ type: 'pageerror', text: error.message });
});

page.on('console', (msg) => {
  const type = msg.type();
  if (['error', 'warning'].includes(type)) {
    consoleIssues.push({ type, text: msg.text() });
  }
});

page.on('requestfailed', (request) => {
  requestFailures.push({
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText || 'Unknown request failure'
  });
});

page.on('dialog', async (dialog) => {
  await dialog.accept();
});

const uniqueIssues = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const collectRouteResult = async (route, expectedText = '') => {
  const startedConsoleCount = consoleIssues.length;
  const startedFailureCount = requestFailures.length;

  await page.goto(`${APP_URL}${route}`, { waitUntil: 'networkidle2' });
  await wait(500);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const currentUrl = page.url();
  const routeConsole = consoleIssues.slice(startedConsoleCount);
  const routeFailures = requestFailures.slice(startedFailureCount);

  const result = {
    route,
    currentUrl,
    matchedExpectedText: expectedText ? bodyText.includes(expectedText) : true,
    redirectedToLogin: currentUrl.includes('/login'),
    hasLoadErrorText: /failed to load|route not found|internal server error/i.test(bodyText),
    consoleIssues: routeConsole,
    requestFailures: routeFailures,
    snippet: bodyText.replace(/\s+/g, ' ').slice(0, 240)
  };

  return result;
};

const clickButtonByText = async (text) => {
  const buttons = await page.$$('button');
  for (const button of buttons) {
    const buttonText = await page.evaluate((el) => el.innerText || '', button);
    if (buttonText.includes(text)) {
      await button.click();
      return true;
    }
  }
  return false;
};

const routeChecks = [
  { route: '/dashboard', expectedText: 'Dashboard' },
  { route: '/buildings', expectedText: 'Buildings Management' },
  { route: '/tenants', expectedText: 'Tenant' },
  { route: '/units', expectedText: 'Units' },
  { route: '/contracts', expectedText: 'Contracts' },
  { route: '/payments', expectedText: 'Payment' },
  { route: '/advanced-reports', expectedText: 'Advanced Reports Dashboard' },
  { route: '/reports', expectedText: 'Advanced Reports Dashboard' },
  { route: '/expenses', expectedText: 'Expenses' },
  { route: '/settings', expectedText: 'Settings' }
];

const results = {
  login: null,
  routes: [],
  workflows: []
};

try {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });

  await page.type('input[name="identifier"]', LOGIN.username);
  await page.type('input[name="password"]', LOGIN.password);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' })
  ]);

  const postLoginText = await page.evaluate(() => document.body.innerText);
  results.login = {
    url: page.url(),
    onDashboard: page.url().includes('/dashboard'),
    hasToken: await page.evaluate(() => !!localStorage.getItem('token')),
    snippet: postLoginText.replace(/\s+/g, ' ').slice(0, 240)
  };

  for (const check of routeChecks) {
    const result = await collectRouteResult(check.route, check.expectedText);
    results.routes.push(result);
  }

  await page.goto(`${APP_URL}/buildings`, { waitUntil: 'networkidle2' });
  const qaBuildingName = `QA Building ${Date.now()}`;
  const addClicked = await clickButtonByText('Add Building');
  if (!addClicked) {
    findings.push('Could not open Add Building form.');
  } else {
    await page.waitForSelector('input[name="name"]', { timeout: 10000 });
    await page.type('input[name="name"]', qaBuildingName);
    await page.type('input[name="address"]', 'QA Address');
    await page.type('input[name="city"]', 'Kigali');
    await page.type('input[name="country"]', 'Rwanda');
    await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll('label')).find((node) => node.innerText.includes('GROUND FLOOR'));
      if (label) {
        label.click();
      }
    });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    ]);
    const buildingCreated = await page.evaluate((name) => document.body.innerText.includes(name), qaBuildingName);
    if (!buildingCreated) {
      findings.push('Building create workflow did not show the newly created record.');
    } else {
      await page.evaluate((name) => {
        const cards = Array.from(document.querySelectorAll('div'));
        const card = cards.find((node) => node.innerText.includes(name));
        if (!card) return;
        const deleteButton = Array.from(card.querySelectorAll('button')).find((btn) => btn.innerText.includes('Delete'));
        if (deleteButton) deleteButton.click();
      }, qaBuildingName);
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 });
      const stillExists = await page.evaluate((name) => document.body.innerText.includes(name), qaBuildingName);
      if (stillExists) {
        findings.push('Building delete workflow did not remove the QA record.');
      }
    }
    results.workflows.push({
      name: 'building_create_delete',
      record: qaBuildingName,
      passed: !findings.some((item) => item.includes('Building'))
    });
  }

  await page.goto(`${APP_URL}/expenses`, { waitUntil: 'networkidle2' });
  const qaExpenseTitle = `QA Expense ${Date.now()}`;
  await page.waitForSelector('input[name="title"]', { timeout: 10000 });
  await page.type('input[name="title"]', qaExpenseTitle);
  await page.type('input[name="amount"]', '1234');
  await page.type('textarea[name="notes"]', 'Browser QA smoke test');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
  ]);
  const expenseCreated = await page.evaluate((title) => document.body.innerText.includes(title), qaExpenseTitle);
  if (!expenseCreated) {
    findings.push('Expense create workflow did not show the newly created record.');
  } else {
    await page.evaluate((title) => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const row = rows.find((node) => node.innerText.includes(title));
      if (!row) return;
      const deleteButton = Array.from(row.querySelectorAll('button')).find((btn) => btn.innerText.includes('Delete'));
      if (deleteButton) deleteButton.click();
    }, qaExpenseTitle);
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 });
    const stillExists = await page.evaluate((title) => document.body.innerText.includes(title), qaExpenseTitle);
    if (stillExists) {
      findings.push('Expense delete workflow did not remove the QA record.');
    }
  }
  results.workflows.push({
    name: 'expense_create_delete',
    record: qaExpenseTitle,
    passed: !findings.some((item) => item.includes('Expense'))
  });
} catch (error) {
  findings.push(`QA runner crashed: ${error.message}`);
} finally {
  results.findings = findings;
  results.consoleIssues = uniqueIssues(consoleIssues);
  results.requestFailures = uniqueIssues(requestFailures);
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}
