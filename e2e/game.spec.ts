import { expect, test } from '@playwright/test';

async function chooseThreeUpgrades(page: import('@playwright/test').Page) {
  for (let choice = 0; choice < 3; choice += 1) {
    const dialog = page.getByRole('dialog', { name: '选择升级' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button').first().click();
  }
}

async function expectCoreControlsInViewport(page: import('@playwright/test').Page) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Playwright viewport is required for mobile geometry assertions');

  const controls = [
    page.getByRole('button', { name: '暂停游戏' }),
    page.getByRole('button', { name: 'Battery 充电' }),
    page.getByRole('button', { name: 'Battery 自动' }),
    page.getByRole('button', { name: 'Battery 放电' }),
    page.getByRole('button', { name: 'EV 暂停' }),
    page.getByRole('button', { name: 'EV 充电' }),
    page.getByRole('switch', { name: '允许买电' }),
    page.getByRole('switch', { name: '允许卖电' }),
  ];

  for (const control of controls) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box, `control ${await control.getAttribute('aria-label')} should be laid out`).not.toBeNull();
    if (!box) continue;
    expect(box.y, 'control must not be above the viewport').toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, 'control must not be below the viewport').toBeLessThanOrEqual(viewport.height);
    expect(box.x, 'control must not overflow left').toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, 'control must not overflow right').toBeLessThanOrEqual(viewport.width);
  }

  await expect.poll(() => page.evaluate(() => ({
    scrollY: window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))).toEqual({
    scrollY: 0,
    scrollHeight: viewport.height,
    clientHeight: viewport.height,
    horizontalOverflow: 0,
  });
}

test('plays, pauses, upgrades, and restarts without horizontal overflow', async ({ page }) => {
  await page.goto('/?seed=12345&testMode=1');
  await page.getByRole('button', { name: '开始游戏' }).click();
  await expectCoreControlsInViewport(page);
  await page.getByRole('button', { name: 'EV 充电' }).click();
  await page.getByRole('button', { name: 'Battery 放电' }).click();
  await page.getByRole('button', { name: '暂停游戏' }).click();
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
  await page.getByRole('button', { name: '继续游戏' }).click();
  await expect.poll(async () => page.getByRole('dialog', { name: '选择升级' }).isVisible()).toBe(true);
  const upgradeDialog = page.getByRole('dialog', { name: '选择升级' });
  await expect(upgradeDialog.getByRole('button').first()).toBeFocused();
  await upgradeDialog.getByRole('button').first().click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('keeps mobile controls and dialogs usable at touch size', async ({ page }) => {
  await page.goto('/?seed=12345&testMode=1');
  await expect(page.getByRole('dialog', { name: '电量守卫' })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始游戏' })).toBeFocused();
  await page.getByRole('button', { name: '开始游戏' }).click();

  const undersized = await page.locator('button, label.grid-switch').evaluateAll((controls) => controls
    .filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
    })
    .map((button) => ({ text: button.textContent?.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
  expect(undersized).toEqual([]);

  await page.getByRole('button', { name: '暂停游戏' }).click();
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
  await expect(page.getByRole('button', { name: '继续游戏' })).toBeFocused();
});

test('can restart three consecutive runs without a page refresh', async ({ page }) => {
  await page.addInitScript(() => {
    Date.now = () => 1;
  });
  await page.goto('/?seed=1&testMode=1&scenario=victory');
  for (let run = 0; run < 3; run += 1) {
    await page.getByRole('button', { name: '开始游戏' }).click();
    await chooseThreeUpgrades(page);
    await expect(page.getByRole('dialog', { name: '胜利' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '重新开始' }).click();
  }
});

test('shows Family depletion as the primary failure', async ({ page }) => {
  await page.goto('/?seed=2&testMode=1&scenario=family');
  await page.getByRole('button', { name: '开始游戏' }).click();
  const result = page.getByRole('dialog', { name: '游戏结束' });
  await expect(result).toBeVisible();
  await expect(result).toContainText('家庭满意度耗尽');
});

test('shows sustained outage after ten shortage Ticks', async ({ page }) => {
  await page.goto('/?seed=3&testMode=1&scenario=outage');
  await page.getByRole('button', { name: '开始游戏' }).click();
  const result = page.getByRole('dialog', { name: '游戏结束' });
  await expect(result).toBeVisible();
  await expect(result).toContainText('持续断电');
});
