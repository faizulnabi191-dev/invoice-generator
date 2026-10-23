const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
    assert.equal(await page.title(), 'Dial & Ledger');

    await page.getByRole('button', { name: /Inventory/ }).click();
    await page.getByRole('heading', { name: 'Inventory' }).waitFor();

    await page.getByRole('button', { name: 'Add watch' }).click();
    const watchDialog = page.getByRole('dialog');
    await watchDialog.getByRole('heading', { name: 'Add a watch' }).waitFor();
    await watchDialog.locator('input[name="brand"]').fill('CI Test Brand');
    await watchDialog.locator('input[name="model"]').fill('CI Test Watch');
    await watchDialog.locator('input[name="price"]').fill('1250');
    await watchDialog.locator('input[name="stock"]').fill('3');
    await watchDialog.getByRole('button', { name: 'Add to inventory' }).click();

    const watchCard = page.locator('.watch').filter({ has: page.getByRole('heading', { name: 'CI Test Watch', exact: true }) });
    await watchCard.waitFor();
    await watchCard.getByText('3 in stock', { exact: true }).waitFor();

    await watchCard.getByRole('button', { name: 'Invoice this' }).click();
    await page.getByRole('heading', { name: 'New invoice' }).waitFor();
    await page.locator('[data-bind="client.name"]').fill('CI Test Customer');
    await page.locator('[data-bind="status"]').selectOption('Sent');
    await page.getByRole('button', { name: 'Save invoice', exact: true }).click();

    await page.getByRole('heading', { name: 'Invoices' }).waitFor();
    await page.getByText('CI Test Customer', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: /Inventory/ }).click();
    await watchCard.getByText(/^(2 in stock|2 left)$/).waitFor();

    const invoiceRow = page.locator('#invRows tr').filter({ hasText: 'CI Test Customer' });
    const downloadPromise = page.waitForEvent('download');
    await invoiceRow.getByRole('button', { name: /Download PDF/ }).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /\.pdf$/i);

    assert.deepEqual(errors, [], 'page should not emit uncaught JavaScript errors');
    console.log('PASS: app loads, watch creation works, Sent invoice deducts stock, and invoice PDF downloads.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
