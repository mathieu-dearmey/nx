import fs from 'node:fs';
import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';
const distDir = path.join(workspaceRoot, 'astro-docs', 'dist');
const sitemapPath = path.join(distDir, 'sitemap-0.xml');

if (!fs.existsSync(distDir)) {
  console.error(
    `Dist directory does not exist at path Have you ran the build?: ${distDir}`,
  );
  process.exit(1);
}

if (!fs.existsSync(sitemapPath)) {
  console.error(
    `Sitemap does not exist at path. Have you ran the build?: ${sitemapPath}`,
  );
  process.exit(1);
}

function findHtmlFiles(dir: string, files: string[] = []) {
  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        findHtmlFiles(fullPath, files);
      } else if (item.endsWith('.html')) {
        files.push(fullPath);
      }
    }
  } catch (err: any) {
    console.error(`Error reading directory ${dir}:`, err);
  }

  return files;
}

function extractInternalLinks(htmlContent: string, filePath: string) {
  const links = new Set<string>();

  // NOTE: surely regex parsing html won't blow up in my face
  // Regex to match href attributes in anchor tags
  const hrefRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = hrefRegex.exec(htmlContent)) !== null) {
    const href = match[1];

    if (
      // Skip external links
      href.startsWith('http') ||
      // skip anchor links
      href.startsWith('#') ||
      // skip any mailto links
      href.startsWith('mailto')
    ) {
      continue;
    }
    try {
      const cleanLink = new URL(href, 'http://localhost');
      links.add(cleanLink.pathname);
    } catch (error) {
      console.error(`Unable to parse link for validation: ${href}`, error);
      process.exit(1);
    }
  }

  return links;
}

function parseSitemap(sitemapContent: string) {
  const routes = new Set<string>();

  // Extract all <loc> URLs from the sitemap
  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  let match;

  while ((match = locRegex.exec(sitemapContent)) !== null) {
    const url = match[1];

    const parsedUrl = new URL(url);

    routes.add(parsedUrl.pathname);
  }

  return routes;
}

function validateLinks() {
  const linksToFiles = new Map<string, string[]>();

  console.log('🔍 Starting link validation...\n');

  console.log('📁 Finding HTML files in dist directory...');
  const htmlFiles = findHtmlFiles(distDir);
  console.log(`Found ${htmlFiles.length} HTML files\n`);

  console.log('🔗 Extracting internal links...');
  for (const file of htmlFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const links = extractInternalLinks(content, file);

      links.forEach((link) => {
        const existing = linksToFiles.get('link');
        if (existing) {
          existing.push(file);
          linksToFiles.set(link, existing);
        } else {
          linksToFiles.set(link, [file]);
        }
      });
    } catch (err) {
      console.error(`Error reading file ${file}:`, err);
      process.exit(1);
    }
  }

  const actualLinksUsed = new Set(linksToFiles.keys());

  console.log(
    `Extracted ${actualLinksUsed.size} total internal links from ${htmlFiles.length} files\n`,
  );

  console.log('📍 Parsing sitemap for valid routes...');

  const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
  const availableInternalRoutes = parseSitemap(sitemapContent);
  console.log(`Found ${actualLinksUsed.size} unique routes in sitemap\n`);

  console.log('✅ Validating links...\n');

  // @ts-expect-error - new set methods, they're real
  const brokenLinks: Set<string> = actualLinksUsed.difference(
    availableInternalRoutes,
  );

  if (brokenLinks.size > 0) {
    console.log(`Found ${brokenLinks.size} broken links:\n`);

    brokenLinks.forEach((link) => {
      const files = linksToFiles.get(link);

      if (!files) {
        throw new Error(
          `Unable to find file where link was parsed from: ${link}`,
        );
      }
      console.log(`\n❌ ${link}. Used In:`);
      files.forEach((file) =>
        console.log(`\t- ${path.relative(distDir, file)}`),
      );
    });
    process.exit(1);
  }

  process.exit(0);
}

validateLinks();
