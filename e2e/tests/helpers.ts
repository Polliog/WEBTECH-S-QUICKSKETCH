import { Page, expect } from '@playwright/test';

let counter = 0;

export function uniqueUsername(prefix = 'user'): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

export async function register(
  page: Page,
  username: string,
  password = 'password123',
): Promise<void> {
  await page.goto('/register');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.fill('#confirm', password);
  await page.getByRole('button', { name: 'Crea account' }).click();
  await page.waitForURL('**/gallery');
}

export async function login(
  page: Page,
  username: string,
  password = 'password123',
): Promise<void> {
  await page.goto('/login');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await page.waitForURL('**/gallery');
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Esci' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/gallery'));
}

export async function drawOnCanvas(page: Page): Promise<void> {
  const canvas = page.locator('canvas');
  await canvas.waitFor();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas not visible');
  }
  await page.mouse.move(box.x + 60, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 220, box.y + 120, { steps: 10 });
  await page.mouse.move(box.x + 160, box.y + 260, { steps: 10 });
  await page.mouse.up();
}

export async function createSketch(
  page: Page,
): Promise<{ url: string; word: string }> {
  await page.goto('/create');
  const chip = page.locator('.word-chip').first();
  await chip.waitFor();
  const word = (await chip.innerText()).trim();
  await chip.click();
  await page.getByRole('button', { name: 'Inizia a disegnare' }).click();
  await drawOnCanvas(page);
  await page.getByRole('button', { name: 'Pubblica' }).click();
  await page.waitForURL(/\/sketch\//);
  return { url: page.url(), word };
}

export async function guess(page: Page, word: string): Promise<void> {
  const attempts = page.locator('.history li');
  const before = await attempts.count();
  const input = page.locator('input[name="guess"]');
  await input.fill(word);
  await input.press('Enter');
  await expect(attempts).toHaveCount(before + 1);
}
