import { test } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop",  width: 1280, height: 800 },
  { name: "tablet",  width: 900,  height: 1200 },
  { name: "mobile",  width: 390,  height: 844 },
];

const URL = "http://localhost:5173/mortgage-viz/";

for (const vp of VIEWPORTS) {
  test(`v2 tool — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await ctx.newPage();
    await page.goto(URL);

    // Wait for the heatmap cells to render
    await page.waitForSelector(".heatmap-container svg .cell");
    await page.waitForTimeout(400);

    // 1 — landing
    await page.screenshot({
      path: `tests/screenshots/v2-${vp.name}-01-landing.png`,
      fullPage: false,
    });

    // 2 — hover a mid-grid cell
    const cells = page.locator(".heatmap-container svg .cell");
    const count = await cells.count();
    if (count > 0) {
      const mid = cells.nth(Math.floor(count / 2));
      await mid.hover();
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `tests/screenshots/v2-${vp.name}-02-hover.png`,
        fullPage: false,
      });

      // 3 — click to pin + select
      await mid.click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `tests/screenshots/v2-${vp.name}-03-selected.png`,
        fullPage: false,
      });

      // 4 — open amortization drilldown modal
      await page.click(".drilldown-toggle");
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `tests/screenshots/v2-${vp.name}-04-drilldown.png`,
        fullPage: false,
      });
    }

    await ctx.close();
  });
}
