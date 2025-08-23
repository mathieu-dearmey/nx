import type { FullConfig } from '@playwright/test';
const maxWaitTime = 120000;
const url = 'http://localhost:4321';
// Wait for server to be available before running tests
export default async function waitForServer(config: FullConfig) {
  const startTime = Date.now();
  const checkInterval = 2000; // Check every 2 seconds

  console.log(`Waiting for server at ${url} to be available...`);

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok || response.status < 500) {
        console.log(`Server is ready at ${url}`);
        return;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }

    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  throw new Error(
    `Server at ${url} did not become available within ${
      maxWaitTime / 1000
    } seconds`
  );
}
