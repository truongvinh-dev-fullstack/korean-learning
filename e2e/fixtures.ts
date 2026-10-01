import { test as base, expect } from "@playwright/test";

/** Every browser journey fails on an unexpected server response or runtime error. */
export const test = base.extend<{ checkRuntime: void }>({
  checkRuntime: [async ({ page }, runTest, testInfo) => {
    const errors: string[] = [];
    const browserLog: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400) browserLog.push(`HTTP ${response.status()} ${response.url()}`);
      if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
    });
    page.on("pageerror", (error) => {
      browserLog.push(`pageerror: ${error.stack ?? error.message}`);
      errors.push(`pageerror: ${error.message}`);
    });
    page.on("requestfailed", (request) => browserLog.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
    page.on("console", (message) => {
      browserLog.push(`${message.type()}: ${message.text()}`);
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
        errors.push(`console: ${message.text()}`);
      }
    });
    try { await runTest(); }
    finally {
      await testInfo.attach("browser-runtime.log", { body: browserLog.join("\n"), contentType: "text/plain" });
    }
    expect(errors, "Unexpected browser or server errors").toEqual([]);
  }, { auto: true }],
});

export { expect };
