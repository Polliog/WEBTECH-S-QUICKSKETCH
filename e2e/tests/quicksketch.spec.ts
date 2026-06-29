import { test, expect } from '@playwright/test';
import {
  uniqueUsername,
  register,
  login,
  logout,
  createSketch,
  guess,
} from './helpers';

test('1. registrazione di un nuovo utente', async ({ page }) => {
  const username = uniqueUsername('reg');
  await register(page, username);

  await expect(page).toHaveURL(/\/gallery/);
  await expect(page.locator('.navbar')).toContainText(username);
});

test('2. login e logout', async ({ page }) => {
  const username = uniqueUsername('log');
  await register(page, username);
  await logout(page);

  await expect(page.getByRole('link', { name: 'Accedi' })).toBeVisible();

  await login(page, username);
  await expect(page.locator('.navbar')).toContainText(username);
});

test('3. utente anonimo naviga la galleria ma non puo creare ne indovinare', async ({
  page,
}) => {
  await page.goto('/gallery');
  await expect(page.getByRole('heading', { name: 'Galleria' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Crea' })).toHaveCount(0);

  await page.goto('/create');
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/gallery');
  await page.locator('.tile').first().click();
  await expect(page.getByText('Accedi per provare a indovinare')).toBeVisible();
});

test('4. creazione di uno sketch: parola, disegno, salvataggio', async ({
  page,
}) => {
  await register(page, uniqueUsername('draw'));
  const { url, word } = await createSketch(page);

  expect(url).toMatch(/\/sketch\//);
  await expect(page.getByText('Il tuo sketch')).toBeVisible();
  await expect(page.locator('.box')).toContainText(word);
});

test('5. il timer di disegno scade e forza la submission', async ({ page }) => {
  await register(page, uniqueUsername('timer'));
  await page.goto('/create');

  const chip = page.locator('.word-chip').first();
  await chip.click();
  await page.getByRole('button', { name: 'Inizia a disegnare' }).click();
  await expect(page.locator('canvas')).toBeVisible();

  await page.waitForURL(/\/sketch\//, { timeout: 20_000 });
  await expect(page.getByText('Il tuo sketch')).toBeVisible();
});

test('6. un utente indovina la parola e vince', async ({ page }) => {
  await register(page, uniqueUsername('author'));
  const { url, word } = await createSketch(page);
  await logout(page);

  await register(page, uniqueUsername('winner'));
  await page.goto(url);

  await guess(page, word);
  await expect(page.getByText('Indovinato!')).toBeVisible();
  await expect(page.locator('.result.won')).toContainText(word);
});

test('7. dopo 10 tentativi falliti vede la soluzione e lo sketch si chiude', async ({
  page,
}) => {
  await register(page, uniqueUsername('author'));
  const { url, word } = await createSketch(page);
  await logout(page);

  await register(page, uniqueUsername('loser'));
  await page.goto(url);

  for (let i = 0; i < 10; i++) {
    await guess(page, `sbagliato${i}`);
  }

  await expect(page.getByText('Tentativi esauriti')).toBeVisible();
  await expect(page.locator('.result.lost')).toContainText(word);
  await expect(page.locator('input[name="guess"]')).toHaveCount(0);
});

test('8. uno sketch gia vinto non e piu giocabile dallo stesso utente', async ({
  page,
}) => {
  await register(page, uniqueUsername('author'));
  const { url, word } = await createSketch(page);
  await logout(page);

  await register(page, uniqueUsername('player'));
  await page.goto(url);
  await guess(page, word);
  await expect(page.getByText('Indovinato!')).toBeVisible();

  await page.goto(url);
  await expect(page.getByText('Indovinato!')).toBeVisible();
  await expect(page.locator('input[name="guess"]')).toHaveCount(0);
});

test('9. le classifiche si aggiornano dopo una vittoria', async ({ page }) => {
  await register(page, uniqueUsername('author'));
  const { url, word } = await createSketch(page);
  await logout(page);

  const winner = uniqueUsername('champ');
  await register(page, winner);
  await page.goto(url);
  await guess(page, word);
  await expect(page.getByText('Indovinato!')).toBeVisible();

  await page.goto('/leaderboard');
  await page.getByRole('button', { name: 'Migliori giocatori' }).click();
  await expect(page.locator('.table')).toContainText(winner);
});

test('10. la pagina statistiche mostra i dati corretti', async ({ page }) => {
  await register(page, uniqueUsername('author'));
  const { url, word } = await createSketch(page);
  await logout(page);

  await register(page, uniqueUsername('stats'));
  await page.goto(url);
  await guess(page, word);
  await expect(page.getByText('Indovinato!')).toBeVisible();

  await page.goto('/stats');
  const card = page.locator('.stat', { hasText: 'Parole indovinate' });
  await expect(card.locator('.value')).toHaveText('1');
});

test('11. login con credenziali errate mostra un errore', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#username', uniqueUsername('ghost'));
  await page.fill('#password', 'password123');
  await page.getByRole('button', { name: 'Accedi' }).click();

  await expect(page.getByText('Credenziali non valide')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
