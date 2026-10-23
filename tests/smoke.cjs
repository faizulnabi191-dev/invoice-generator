const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
    assert.equal(await page.title(), 'Dial & Ledger');

    await page.getByRole('button', { name: /Inventory/ }).click();
    await page.getByRole('heading', { name: 'Inventory' }).waitFor();

    await page.getByRole('button', { name: 'Add watch' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('heading', { name: 'Add a watch' }).waitFor();
    await dialog.locator('input[name="brand"]').fill('Test Brand');
    await dialog.locator('input[name="model"]').fill('CI Test Watch');
    await dialog.locator('input[name="price"]').fill('1250');
    await dialog.locator('input[name="stock"]').fill('3');
    await dialog.getByRole('button', { name: 'Add to inventory' }).click();

    await page.getByText('CI Test Watch', { exact: true }).first().waitFor();
    assert.equal(await page.getByText('CI Test Watch', { exact: true }).count(), 1);
    assert.deepEqual(errors, [], 'page should not emit uncaught JavaScript errors');

    console.log('PASS: app loads, Inventory navigation works, and a watch can be added.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
