import { test, expect, Page, Locator } from '@playwright/test';

import { sidebar } from '../sidebar';

async function expandAllSidebarSections(page: Page, section: Locator): Promise<void> {
  let expandedAny = true;
  let maxIterations = 10; // Prevent infinite loops
  
  while (expandedAny && maxIterations > 0) {
    expandedAny = false;
    maxIterations--;
    
    // Find all currently closed details elements
    const closedDetails = await section.locator('details:not([open])').all();
    
    for (const details of closedDetails) {
      // Click the summary to expand the details
      const summary = details.locator('summary');
      await summary.click();
      expandedAny = true;
      
      // Small delay to allow for DOM updates
      await page.waitForTimeout(50);
    }
    
    // If we expanded any sections, wait a bit longer for animations and DOM updates
    if (expandedAny) {
      await page.waitForTimeout(200);
    }
  }
}

test('root route redirects to getting started page', async ({ page }) => {
  await page.goto('/docs');

  await expect(page).toHaveURL('/docs/getting-started/intro');
});

async function assertPageLinksAreValid(
  page: Page,
  contentTestId: string,
  pageName: string,
  linksToSkip: Set<string>,
): Promise<Set<string>> {
  const seenLinks = new Set<string>();
  const pageContent = page.getByTestId(contentTestId);

  await expect(pageContent).toBeVisible();

  const outbounds = await pageContent.getByRole('link').all();
  const linkSet = new Set(
    await Promise.all(outbounds.map((link) => link.getAttribute('href'))),
  );

  console.log('Links to visit', Array.from(linkSet));

  for (const outboundLink of Array.from(linkSet)) {
    if (outboundLink.startsWith('http') || outboundLink.startsWith('#')) {
      // external link or a fragment link
      continue;
    }

    if (linksToSkip.has(outboundLink)) {
      console.log('Already seen link, skipping', outboundLink);
      continue;
    }
    seenLinks.add(outboundLink);
    await page.goto(outboundLink);

    // astros 404 page in dev
    await expect(
      page.getByText('404: not found'),
      `Trying to visit ${outboundLink}, but found Astro dev server 404 page. Came from ${pageName} doc.`,
    ).toBeHidden();
    // nx.dev 404 page
    await expect(
      page.getByText('Page not found'),
      `Trying to visit ${outboundLink}, but found Nx Dev 404 page. Came from ${pageName} doc.`,
    ).toBeHidden();
  }

  return seenLinks;
}

sidebar.forEach((entry) => {
  test(`Sidebar Section: ${entry.label}`, async ({ page }) => {
    // lot-o-links
    test.setTimeout(5 * 60 * 1000);

    const seenLinks = new Set<string>();
    await page.goto('/docs');

    const section = page
      .getByTestId('sidebar-wrapper')
      .locator('ul.top-level>li>details')
      .filter({ hasText: entry.label });
    await expect(section).toBeVisible();

    await test.step('expand all sub sections', async () => {
      // Recursively expand all details elements in the sidebar
      await expandAllSidebarSections(page, section);
    });

    const sectionLinks = await section.getByRole('link').all();

    for (const sidebarItem of sectionLinks) {
      const name = await sidebarItem.textContent();
      await test.step(name, async () => {
        await sidebarItem.click();
        const expectedLink = await sidebarItem.getAttribute('href');
        await expect(page).toHaveURL(expectedLink);

        const visitedLinks = await assertPageLinksAreValid(
          page,
          'main-pane',
          name,
          seenLinks,
        );

        visitedLinks.forEach((l) => seenLinks.add(l));
      });
    }
  });
});
