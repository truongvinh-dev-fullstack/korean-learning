import { test as base, expect } from "@playwright/test";

/** Every browser journey fails on an unexpected server response or runtime error. */
export const test = base.extend<{ checkRuntime: void }>({
  checkRuntime: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
        errors.push(`console: ${message.text()}`);
      }
    });
    await use();
    expect(errors, "Unexpected browser or server errors").toEqual([]);
  }, { auto: true }],
});

export { expect };
