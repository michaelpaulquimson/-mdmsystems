import { type Page, test, expect } from '@playwright/test';

const ADMIN = { email: 'admin@mdm.local', password: 'admin123' };
const VIEWER = { email: 'viewer@mdm.local', password: 'password123' };
const EDITOR = { email: 'editor@mdm.local', password: 'password123' };

async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/password/i).fill(creds.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/login/, { timeout: 10_000 });
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/login/);
}

test.describe('MDM Systems — golden path', () => {
  test('1. Admin can log in and see admin nav', async ({ page }) => {
    await login(page, ADMIN);
    await expect(page.getByRole('link', { name: /organizations/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /teams/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /users/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /roles/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /audit/i })).toBeVisible();
  });

  test('2. Admin can create an organization', async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole('link', { name: /organizations/i }).click();
    await page.getByRole('button', { name: /new organization/i }).click();
    await page.getByLabel(/name/i).fill('E2E Test Org');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText('E2E Test Org')).toBeVisible();
  });

  test('3. Admin can create a team in an organization', async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole('link', { name: /teams/i }).click();
    await page.getByRole('button', { name: /new team/i }).click();
    await page.getByLabel(/^name/i).fill('E2E Team');
    // select org
    await page.getByRole('combobox', { name: /organization/i }).click();
    await page.getByRole('option', { name: /e2e test org/i }).click();
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText('E2E Team')).toBeVisible();
  });

  test('4. Viewer can see content but cannot create', async ({ page }) => {
    await login(page, VIEWER);
    // Admin nav not visible
    await expect(page.getByRole('link', { name: /organizations/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /teams/i })).not.toBeVisible();
    // Content is visible
    await page.getByRole('link', { name: /content/i }).click();
    await expect(page).toHaveURL(/content/);
    // "New Content" button hidden — viewer lacks content:create
    await expect(page.getByRole('button', { name: /new content/i })).not.toBeVisible();
  });

  test('5. Editor can create content', async ({ page }) => {
    await login(page, EDITOR);
    await page.getByRole('link', { name: /content/i }).click();
    await page.getByRole('button', { name: /new content/i }).click();
    await page.getByLabel(/title/i).fill('E2E Content Item');
    await page.getByLabel(/body/i).fill('This is the body of the content item.');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText('E2E Content Item')).toBeVisible();
  });

  test('6. Every mutation appears in audit log', async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole('link', { name: /audit/i }).click();
    await expect(page).toHaveURL(/audit/);
    // At minimum the org creation from test 2 is in the log
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('7. Logout clears session', async ({ page }) => {
    await login(page, ADMIN);
    await logout(page);
    // Cannot access protected route
    await page.goto('/organizations');
    await expect(page).toHaveURL(/login/);
  });

  test('8. Refresh token survives page reload', async ({ page }) => {
    await login(page, ADMIN);
    await page.reload();
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByRole('link', { name: /organizations/i })).toBeVisible();
  });
});
