import { test, expect, type Page, type Route } from 'playwright/test';

const PORTFOLIO_ID = 8;

const dashboardOrder = {
  order_id: 'SAME-1',
  order_source: 'dashboard',
  asset_type: 'S50C26',
  side: 'LONG',
  qty: 1,
  entry_price: 10,
  current_price: 12,
  tp_price: null,
  sl_price: null,
  leverage: null,
  margin_rate: null,
  order_status: 'FILLED',
  executed_by: 'Manual',
  created_at: '2026-11-25T10:00:00Z',
  linked_order_id: null,
  group_id: null,
  group_name: null,
  contract_type: 'option',
  option_type: 'Call',
  expiry_date: '2026-12-30',
  strike_price: 1000,
  cost: 0,
};

const mappedOrder = {
  order_id: 'SAME-1',
  order_source: 'mapped',
  asset_type: 'S50H26',
  side: 'SHORT',
  qty: 2,
  entry_price: 900,
  current_price: 880,
  tp_price: null,
  sl_price: null,
  leverage: null,
  margin_rate: null,
  order_status: 'FILLED',
  executed_by: 'Bot',
  created_at: '2026-11-25T09:00:00Z',
  linked_order_id: null,
  group_id: null,
  group_name: null,
  contract_type: 'future',
  cost: 0,
};

const recentTrade = (source: 'dashboard' | 'mapped', asset: string) => ({
  history_id: 42,
  history_source: source,
  history_key: '42',
  type: 'Long',
  asset,
  amount: 1,
  exit_price: 12,
  realized_pl: 20,
  executed_by: source === 'mapped' ? 'Bot' : 'Manual',
  decision_note: '',
  entry_date: '2026-11-20',
  exit_date: '2026-11-25',
});

const historyRows = [
  {
    ...recentTrade('dashboard', 'DASH-OPT'),
    portfolio_id: PORTFOLIO_ID,
    portfolio_name: 'TFEX Bridge Test',
    entry_price: 10,
    order_id: 'SAME-1',
    close_order_id: 'CLS-1',
    flow: 'close',
    remark: { note: 'Closed' },
    order_remark: 'Local option',
  },
  {
    ...recentTrade('mapped', 'BOT-FUT'),
    portfolio_id: PORTFOLIO_ID,
    portfolio_name: 'TFEX Bridge Test',
    entry_price: 900,
    order_id: 'SAME-1',
    close_order_id: null,
    flow: 'close',
    remark: { note: 'Closed' },
    order_remark: 'Bot future',
  },
];

const grid = {
  portfolio_id: PORTFOLIO_ID,
  portfolio_name: 'TFEX Bridge Test',
  port_type: 'Custom Portfolio',
  risk_status: 'Safe',
  risk_score: null,
  trade_plan_md: null,
  internal_notes: null,
  available_cash: 100000,
  margin_locked: 0,
  cash_buffer_limit: 0,
  broker_id: 1,
  broker_code: 'TFEX',
  product_ticker: null,
  product_tickers: [],
  x_amount: 1,
  initial_capital: 0,
  tags: null,
  spread_pairs: [],
  active_orders: [dashboardOrder, mappedOrder],
  recent_trades: [recentTrade('dashboard', 'DASH-OPT'), recentTrade('mapped', 'BOT-FUT')],
  risk: null,
  read_only: true,
  mapping_template: 'tfex',
  load_error: null,
  order_writes: {
    mapped: {
      insert: true,
      update: true,
      delete: true,
      fields: ['order_ref', 'asset_type', 'side', 'qty', 'entry_price', 'tp_price', 'fee', 'remark'],
      key_generated: false,
    },
    dashboard_options: { insert: true, update: true, delete: true },
  },
};

const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });

async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === `/api/v1/analytics/portfolio/${PORTFOLIO_ID}`) {
      return json(route, grid);
    }
    if (path === `/api/v1/analytics/performance/${PORTFOLIO_ID}`) {
      return json(route, { equity_curve: [], payoff_data: [], total_pl: 0 });
    }
    if (path === `/api/v1/portfolios/${PORTFOLIO_ID}`) {
      return json(route, {
        portfolio_id: PORTFOLIO_ID,
        portfolio_name: 'TFEX Bridge Test',
        port_type: 'Custom Portfolio',
        is_custom: true,
      });
    }
    if (path === '/api/v1/portfolios') {
      return json(route, [
        {
          portfolio_id: PORTFOLIO_ID,
          portfolio_name: 'TFEX Bridge Test',
          port_type: 'Custom Portfolio',
          is_custom: true,
          risk_status: 'Safe',
          available_cash: 100000,
        },
      ]);
    }
    if (path === '/api/v1/overview') {
      return json(route, {
        margin: 0,
        buffer: 0,
        available_cash: 0,
        total_pl: 0,
        pool_health_index: 0,
        money_reserve_status: 'Optimal',
        portfolios: [],
      });
    }
    if (path === '/api/v1/trade-history') {
      return json(route, historyRows);
    }
    if (path === '/api/v1/orders-groups') {
      return json(route, []);
    }
    if (path === '/api/v1/assets/products') {
      return json(route, []);
    }
    if (path === '/api/v1/orders' && request.method() === 'POST') {
      return json(route, { ...dashboardOrder, order_id: 'NEW-OPT' }, 201);
    }
    if (path === '/api/v1/orders/SAME-1' && request.method() === 'PUT') {
      return json(route, dashboardOrder);
    }
    if (path === '/api/v1/orders/SAME-1/status') {
      return json(route, { order_id: 'SAME-1', order_status: 'CANCELED', history_id: 42 });
    }
    if (path === '/api/v1/orders/SAME-1/close') {
      return json(route, { order_id: 'SAME-1', order_status: 'closed', history_id: 42 });
    }

    return json(route, {});
  });
}

const openMappedGrid = async (page: Page) => {
  await mockApi(page);
  await page.goto(`/analytics/portfolio/${PORTFOLIO_ID}`);
  await expect(page.getByRole('heading', { name: /TFEX Bridge Test/ }).first()).toBeVisible();
  // The All view has no symbol column; the two source-distinct legs prove both
  // rows rendered and are addressable by their own action labels.
  await expect(page.getByRole('button', { name: /^Edit S50C26 Call/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Edit S50H26/ })).toHaveCount(1);
};

/** Row actions are revealed on row hover (opacity/pointer-events), so hover first. */
const clickRowAction = async (page: Page, name: RegExp) => {
  const button = page.getByRole('button', { name });
  await page.locator('.at-row').filter({ has: button }).hover();
  await button.click();
};

test.describe('mapped portfolio hybrid options', () => {
  test('shows both stores for colliding order ids and labels each row', async ({ page }) => {
    await openMappedGrid(page);

    const ladder = page.getByRole('region', { name: 'Order detail' });
    await expect(ladder.getByText('Dashboard')).toBeVisible();
    await expect(ladder.getByText('Connected DB')).toBeVisible();

    const history = page.getByRole('region', { name: 'Order history' });
    await history.getByRole('button', { name: 'Expand order history' }).click();
    await expect(history.getByText('DASH-OPT')).toBeVisible();
    await expect(history.getByText('BOT-FUT')).toBeVisible();
    await expect(history.getByText('Dashboard')).toBeVisible();
    await expect(history.getByText('Connected DB')).toBeVisible();
  });

  test('edit and close use the clicked row source', async ({ page }) => {
    await openMappedGrid(page);

    // Dashboard option row.
    await clickRowAction(page, /^Edit S50C26 Call/);
    const [dashboardEdit] = await Promise.all([
      page.waitForRequest((req) => req.method() === 'PUT' && req.url().includes('/api/v1/orders/SAME-1')),
      page.getByRole('button', { name: 'Save Changes' }).click(),
    ]);
    expect(new URL(dashboardEdit.url()).searchParams.get('order_source')).toBe('dashboard');

    // Connected future row.
    await clickRowAction(page, /^Edit S50H26/);
    const [mappedEdit] = await Promise.all([
      page.waitForRequest((req) => req.method() === 'PUT' && req.url().includes('/api/v1/orders/SAME-1')),
      page.getByRole('button', { name: 'Save Changes' }).click(),
    ]);
    expect(new URL(mappedEdit.url()).searchParams.get('order_source')).toBe('mapped');

    // Dashboard close writes local history.
    await clickRowAction(page, /^Close S50C26 Call/);
    const [dashboardClose] = await Promise.all([
      page.waitForRequest((req) => req.method() === 'POST' && req.url().includes('/close')),
      page.getByRole('button', { name: 'Close Order' }).click(),
    ]);
    expect(new URL(dashboardClose.url()).searchParams.get('order_source')).toBe('dashboard');

    // Connected close stays on the foreign store.
    await clickRowAction(page, /^Close S50H26/);
    const [mappedClose] = await Promise.all([
      page.waitForRequest((req) => req.method() === 'POST' && req.url().includes('/close')),
      page.getByRole('button', { name: 'Close Order' }).click(),
    ]);
    expect(new URL(mappedClose.url()).searchParams.get('order_source')).toBe('mapped');
  });

  test('a local option is created through the Dashboard option path', async ({ page }) => {
    await openMappedGrid(page);

    await page.getByRole('button', { name: '+ New order' }).click();
    await expect(page.getByRole('button', { name: 'Connected DB' })).toBeVisible();
    await page.getByRole('button', { name: 'Dashboard option' }).click();

    await expect(page.getByText('Option type')).toBeVisible();
    await expect(page.getByLabel('Strike price')).toBeVisible();

    await page.getByRole('button', { name: 'Call', exact: true }).click();
    await page.getByLabel('Asset symbol').fill('S50C26');
    await page.getByLabel('Qty').fill('1');
    await page.getByLabel('Entry price').fill('10');
    await page.getByLabel('Strike price').fill('1000');
    await page.getByLabel('Expiry date').fill('2026-12-30');

    const [createRequest] = await Promise.all([
      page.waitForRequest((req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/v1/orders'),
      page.getByRole('button', { name: 'Create order' }).click(),
    ]);

    const body = createRequest.postDataJSON();
    expect(body.contract_type).toBe('option');
    expect(body.portfolio_id).toBe(PORTFOLIO_ID);
    expect(body.option_type).toBe('Call');
    expect(body.strike_price).toBe(1000);
  });
});
