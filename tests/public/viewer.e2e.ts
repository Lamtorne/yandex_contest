import { expect, test } from '@playwright/test';

test.describe('Выноски на 3D-модели', () => {
  test.describe('Просмотр в браузере', () => {
    test.describe('Базовый сценарий', () => {
      test('показывает обе сцены карточки с подписями аннотаций', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByTestId('callouts-status')).toContainText('Аннотаций:');
        await expect(page.getByTestId('scene-main')).toBeVisible();
        await expect(page.getByTestId('scene-top')).toBeVisible();

        const mainCallouts = page.locator('[data-surface-id="main"] [data-callout-id]');
        expect(await mainCallouts.count()).toBeGreaterThan(1);
      });

      test('переключение варианта обновляет набор аннотаций', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('callouts-status')).toContainText('Аннотаций:');

        const before = await page
          .locator('[data-surface-id="main"] [data-callout-id]')
          .evaluateAll(nodes => nodes.map(node => node.getAttribute('data-callout-id')).sort());

        await page.locator('[data-variant-id="graphite-pro"]').click();
        await expect(page.getByTestId('callouts-status')).toContainText('Графит Pro');

        const after = await page
          .locator('[data-surface-id="main"] [data-callout-id]')
          .evaluateAll(nodes => nodes.map(node => node.getAttribute('data-callout-id')).sort());

        expect(after).not.toEqual(before);
        expect(after.length).toBeGreaterThan(before.length);
      });
    });
  });
});
