import { test, expect, Page, Locator } from '@playwright/test';
import { sidebar } from '../sidebar';

const knownLinkIgnoreList = ['/reference/nx/executors', '/reference/devkit'];

test('root route redirects to getting started page', async ({ page }) => {
  await page.goto('/docs');

  await expect(page).toHaveURL('/docs/getting-started/intro');
});

const sidebar_section_selector = 'ul.top-level>li>details';
sidebar.forEach((entry) => {
  test(`Sidebar Section: ${entry.label}`, async ({ page, context }) => {
    // lot-o-links
    test.setTimeout(5 * 60 * 1000);

    const seenLinks = new Set<string>();
    await page.goto('/docs');

    await expandSideBar(page);

    const section = page
      .getByTestId('sidebar-wrapper')
      .locator(sidebar_section_selector)
      // get sepecific seciton title
      .locator('summary')
      .filter({ hasText: entry.label })
      // the summary will always be first if multiple matches happen
      // e.g. "features" has 'ci-features' but it will be nested under 'features'
      .first()
      // get parent element
      .locator('xpath=..');

    await expect(section).toBeVisible();

    const sectionLinks = await section.getByRole('link').all();

    for (const sidebarItem of sectionLinks) {
      const name = await sidebarItem.textContent();
      await test.step(name, async () => {
        await sidebarItem.click();
        const expectedLink = await sidebarItem.getAttribute('href');
        await expect(page).toHaveURL(expectedLink);

        const visitedLinks = await checkPageLinksValidity(
          page,
          'main-pane',
          seenLinks
        );

        visitedLinks.forEach((link) => seenLinks.add(link));
      });
    }
  });
});

async function checkPageLinksValidity(
  page: Page,
  contentTestId: string,
  linksToSkip: Set<string>
): Promise<Set<string>> {
  const passed = new Set<string>();
  const pageContent = page.getByTestId(contentTestId);

  await expect(pageContent).toBeVisible();

  // I don't trust playwright to be waiting for astro server
  // to finish serving the page before moving on
  await page.waitForTimeout(500);

  const visitingFrom = page.url();

  const outbounds = await pageContent.getByRole('link').all();
  const linkSet = new Set(
    await Promise.all(outbounds.map((link) => link.getAttribute('href')))
  );

  console.debug('Links to visit', Array.from(linkSet));

  for (const outboundLink of Array.from(linkSet)) {
    if (outboundLink.startsWith('http') || outboundLink.startsWith('#')) {
      // external link or a fragment link
      continue;
    }

    if (linksToSkip.has(outboundLink)) {
      console.debug('Already seen link, skipping', outboundLink);
      continue;
    }

    if (knownLinkIgnoreList.some((l) => outboundLink.includes(l))) {
      console.warn(`Link ${outboundLink} is in manual ignore list. Skipping..`);
      continue;
    }

    await page.goto(outboundLink);

    // NOTE: we use soft assert so we can check all links on the page in 1 go
    // to make fixing a page at a time easier

    // astros 404 page in dev
    await expect
      .soft(
        page.getByText('404: not found'),
        `Trying to visit ${outboundLink}, but found Astro dev server 404 page. Came from ${visitingFrom}.`
      )
      .toBeHidden({ timeout: 2_000 });
    // nx.dev 404 page
    await expect
      .soft(
        page.getByText('Page not found'),
        `Trying to visit ${outboundLink}, but found Nx Dev 404 page. Came from ${visitingFrom}.`
      )
      .toBeHidden({ timeout: 2_000 });
  }

  // error out if the page had any 404s
  expect(test.info().errors.length).toBe(0);

  return passed;
}

async function expandSideBar(page: Page) {
  // toggle first item to make sure the sidebar session state is set
  await page
    .getByTestId('sidebar-wrapper')
    .locator(sidebar_section_selector)
    .locator('summary')
    .first()
    .click();

  const newState = await page.evaluate(() => {
    const sidebarState = window.sessionStorage.getItem('sl-sidebar-state');
    if (sidebarState) {
      const parsedState = JSON.parse(sidebarState);
      // open every item in the sidebar.
      // to get the right length we'd have to open/clode every page
      // so just use a really large number to make sure we hit every possible section
      parsedState.open = Array.from({ length: 10_000 }, () => true);

      window.sessionStorage.setItem(
        'sl-sidebar-state',
        JSON.stringify(parsedState)
      );
    }
  });

  console.log('newState', newState);

  // reload page to make sure new session state is applied
  await page.reload();
}
