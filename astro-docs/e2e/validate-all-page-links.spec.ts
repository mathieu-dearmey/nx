import { test, expect } from '@playwright/test';

test('root route redirects to getting started page', async ({ page }) => {
  await page.goto('/docs');

  await expect(page).toHaveURL('/docs/getting-started/intro');
});

test('Sidebar links render content', async ({ page }) => {
  await page.goto('/docs/getting-started/intro');

  const sidebar = page.getByTestId('sidebar-wrapper');

  await expect(sidebar).toBeVisible();

  // TODO: get all the collapsed link items too
  const links = await sidebar.getByRole('link').all();

  for (const sidebarItem of links) {
    const name = await sidebarItem.textContent();

    await test.step(`Sidebar Item: ${name}`, async () => {
      await sidebarItem.click();
      const expectedLink = await sidebarItem.getAttribute('href');

      await expect(page).toHaveURL(expectedLink);

      const mainDocContent = page.getByTestId('main-pane');
      await expect(mainDocContent).toBeVisible();

      const outbounds = await mainDocContent.getByRole('link').all();
      const linkSet = new Set(
        await Promise.all(outbounds.map((link) => link.getAttribute('href'))),
      );

      for (const outboundLink of Array.from(linkSet)) {
        if (outboundLink.startsWith('http') || outboundLink.startsWith('#')) {
          // external link or a fragment link
          continue;
        }
        await page.goto(outboundLink);

        // astros 404 page in dev
        await expect(page.getByText('404: not found')).toBeHidden();
        // nx.dev 404 page
        await expect(page.getByText('Page not found')).toBeHidden();
      }
    });
  }
});
