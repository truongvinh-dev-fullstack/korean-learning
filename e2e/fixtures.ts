import { test as base, expect } from "@playwright/test";

/** Every browser journey fails on an unexpected server response or runtime error. */
export const test = base.extend<{ checkRuntime: void; expectedServerErrors: { path: string; method: string; status: number }[] }>({
  expectedServerErrors: async ({}, runFixture) => { await runFixture([]); },
  checkRuntime: [async ({ page, expectedServerErrors }, runTest, testInfo) => {
    const errors: string[] = [];
    const browserLog: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400) browserLog.push(`HTTP ${response.status()} ${response.url()}`);
      if (response.status() >= 500) {
        // Fault-injection tests register one exact response. All other 5xx still fail.
        const index = expectedServerErrors.findIndex((expected) => expected.path === new URL(response.url()).pathname && expected.method === response.request().method() && expected.status === response.status());
        if (index >= 0) expectedServerErrors.splice(index, 1);
        else errors.push(`${response.status()} ${response.url()}`);
      }
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
    expect(expectedServerErrors, "Registered injected errors must actually be observed").toEqual([]);
  }, { auto: true }],
});

export { expect };
