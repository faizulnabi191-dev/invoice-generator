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
    const invoiceRow = page.locator('#invRows tr').filter({ hasText: 'CI Test Customer' });
    const downloadPromise = page.waitForEvent('download');
    await invoiceRow.getByRole('button', { name: /Download PDF/ }).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /\.pdf$/i);

    // Cancelling a stock-affecting invoice must return its watch to inventory.
    await invoiceRow.getByRole('button', { name: /^View/ }).click();
    const invoiceDialog = page.getByRole('dialog');
    await invoiceDialog.locator('[data-statusfor]').selectOption('Cancelled');
    await page.getByRole('button', { name: /Inventory/ }).click();
    await watchCard.getByText('3 in stock', { exact: true }).waitFor();

    // Reopening the cancelled invoice should deduct stock exactly once again.
    await page.getByRole('button', { name: /Invoices/ }).click();
    await page.getByRole('heading', { name: 'Invoices' }).waitFor();
    const cancelledRow = page.locator('#invRows tr').filter({ hasText: 'CI Test Customer' });
    await cancelledRow.getByRole('button', { name: /^View/ }).click();
    await page.getByRole('dialog').locator('[data-statusfor]').selectOption('Sent');
    await page.getByRole('button', { name: /Inventory/ }).click();
    await watchCard.getByText(/^(2 in stock|2 left)$/).waitFor();

    // Editing quantity from one to two should reconcile the stock delta.
    await page.getByRole('button', { name: /Invoices/ }).click();
    await page.getByRole('heading', { name: 'Invoices' }).waitFor();
    const sentRow = page.locator('#invRows tr').filter({ hasText: 'CI Test Customer' });
    await sentRow.getByRole('button', { name: /^Edit/ }).click();
    await page.getByRole('heading', { name: /^Edit/ }).waitFor();
    await page.locator('[data-f="qty"]').first().fill('2');
    await page.getByRole('button', { name: 'Save invoice', exact: true }).click();
    await page.getByRole('heading', { name: 'Invoices' }).waitFor();
    await page.getByRole('button', { name: /Inventory/ }).click();
    await watchCard.getByText(/^(1 in stock|1 left)$/).waitFor();

    // Cancelling after an edit returns the full edited quantity.
    await page.getByRole('button', { name: /Invoices/ }).click();
    await page.getByRole('heading', { name: 'Invoices' }).waitFor();
    const editedRow = page.locator('#invRows tr').filter({ hasText: 'CI Test Customer' });
    await editedRow.getByRole('button', { name: /^View/ }).click();
    await page.getByRole('dialog').locator('[data-statusfor]').selectOption('Cancelled');
    await page.getByRole('button', { name: /Inventory/ }).click();
    await watchCard.getByText('3 in stock', { exact: true }).waitFor();

    assert.deepEqual(errors, [], 'page should not emit uncaught JavaScript errors');
    console.log('PASS: app loads, watch creation works, invoice PDF downloads, cancellation/reopening reconciles stock, and editing quantity updates stock correctly.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
