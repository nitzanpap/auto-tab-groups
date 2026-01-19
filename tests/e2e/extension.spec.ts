import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import path from "path";

const extensionPath = path.join(__dirname, "../../.output/chrome-mv3");

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
});

test.afterAll(async () => {
  await context.close();
});

test.describe("Auto Tab Groups Extension", () => {
  test("extension loads and popup opens", async () => {
    // Get the extension ID from the service worker
    let extensionId = "";

    // Wait for the service worker to register and get extension ID
    await new Promise<void>((resolve) => {
      const checkServiceWorker = async () => {
        const workers = context.serviceWorkers();
        for (const worker of workers) {
          const url = worker.url();
          if (url.includes("chrome-extension://")) {
            extensionId = url.split("/")[2];
            resolve();
            return;
          }
        }
        setTimeout(checkServiceWorker, 100);
      };
      checkServiceWorker();
    });

    expect(extensionId).toBeTruthy();

    // Open the popup
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    const page = await context.newPage();
    await page.goto(popupUrl);

    // Verify popup elements are present
    await expect(page.locator("#group")).toBeVisible();
    await expect(page.locator("#ungroup")).toBeVisible();
    await expect(page.locator("#autoGroupToggle")).toBeVisible();

    // Check version is displayed
    const versionElement = page.locator("#versionNumber");
    await expect(versionElement).toBeVisible();
    const version = await versionElement.textContent();
    expect(version).toBe("2.0.0");

    await page.close();
  });

  test("auto-group toggle works", async () => {
    let extensionId = "";

    const workers = context.serviceWorkers();
    for (const worker of workers) {
      const url = worker.url();
      if (url.includes("chrome-extension://")) {
        extensionId = url.split("/")[2];
        break;
      }
    }

    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    const page = await context.newPage();
    await page.goto(popupUrl);

    const toggle = page.locator("#autoGroupToggle");
    const initialState = await toggle.isChecked();

    // Toggle the state
    await toggle.click();
    await page.waitForTimeout(500);

    // Verify state changed
    const newState = await toggle.isChecked();
    expect(newState).toBe(!initialState);

    // Toggle back
    await toggle.click();
    await page.waitForTimeout(500);

    // Verify state restored
    const restoredState = await toggle.isChecked();
    expect(restoredState).toBe(initialState);

    await page.close();
  });

  test("rules section expands", async () => {
    let extensionId = "";

    const workers = context.serviceWorkers();
    for (const worker of workers) {
      const url = worker.url();
      if (url.includes("chrome-extension://")) {
        extensionId = url.split("/")[2];
        break;
      }
    }

    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    const page = await context.newPage();
    await page.goto(popupUrl);

    // Find and click the rules toggle
    const rulesToggle = page.locator(".rules-toggle");
    await expect(rulesToggle).toBeVisible();

    await rulesToggle.click();
    await page.waitForTimeout(300);

    // Verify rules content is visible
    const rulesContent = page.locator(".rules-content");
    await expect(rulesContent).toHaveClass(/expanded/);

    // Verify add rule button is visible
    const addRuleButton = page.locator("#addRuleButton");
    await expect(addRuleButton).toBeVisible();

    await page.close();
  });

  test("sidebar loads correctly", async () => {
    let extensionId = "";

    const workers = context.serviceWorkers();
    for (const worker of workers) {
      const url = worker.url();
      if (url.includes("chrome-extension://")) {
        extensionId = url.split("/")[2];
        break;
      }
    }

    const sidebarUrl = `chrome-extension://${extensionId}/sidebar.html`;
    const page = await context.newPage();
    await page.goto(sidebarUrl);

    // Verify sidebar elements are present (same as popup)
    await expect(page.locator("#group")).toBeVisible();
    await expect(page.locator("#ungroup")).toBeVisible();
    await expect(page.locator("#autoGroupToggle")).toBeVisible();

    await page.close();
  });
});
