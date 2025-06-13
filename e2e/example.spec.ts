import { test, expect } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  await page.goto('/');
  
  await expect(page).toHaveTitle(/Pitch Perfect/);
  
  await expect(page.getByText('Welcome to Pitch Perfect!')).toBeVisible();
  
  await expect(page.getByText('Get started by editing')).toBeVisible();
});

test('navigation links work', async ({ page }) => {
  await page.goto('/');
  
  const docsLink = page.getByRole('link', { name: /docs/i });
  await expect(docsLink).toBeVisible();
  await expect(docsLink).toHaveAttribute('href', 'https://nextjs.org/docs');
  
  const learnLink = page.getByRole('link', { name: /learn/i });
  await expect(learnLink).toBeVisible();
  await expect(learnLink).toHaveAttribute('href', 'https://nextjs.org/learn');
});