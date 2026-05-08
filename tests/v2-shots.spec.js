import { test } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet",  width: 768,  height: 1024 },
  { name: "mobile",  width: 375,  height: 667 },
];

const URL = "http://localhost:5173/mortgage-viz/";

for (const vp of VIEWPORTS) {
  test(`v2 — ${vp.name} hero + scroll`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await ctx.newPage();
    await page.goto(URL);

    // Hero — wait for the headline to be visible
    await page.waitForSelector(".hero__headline", { state: "visible" });
    // Let entrance animations settle
    await page.waitForTimeout(1800);
    await page.screenshot({
      path: `tests/screenshots/v2-${vp.name}-01-hero.png`,
      fullPage: false,
    });

    // Scroll to tool
    await page.evaluate(() => {
      document.getElementById("tool")?.scrollIntoView({ behavior: "instant" });
    });
    await page.waitForSelector(".heatmap-container svg .cell");
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `tests/screenshots/v2-${vp.name}-02-tool.png`,
      fullPage: false,
    });

    // Scroll to drilldown
    await page.evaluate(() => {
      document.getElementById("drilldown")?.scrollIntoView({ behavior: "instant" });
    });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `tests/screenshots/v2-${vp.name}-03-drilldown.png`,
      fullPage: false,
    });

    // Methodology
    await page.evaluate(() => {
      document.getElementById("methodology")?.scrollIntoView({ behavior: "instant" });
    });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `tests/screenshots/v2-${vp.name}-04-methodology.png`,
      fullPage: false,
    });

    // Full page (desktop only — others are too tall)
    if (vp.name === "desktop") {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `tests/screenshots/v2-${vp.name}-05-fullpage.png`,
        fullPage: true,
      });
    }

    await ctx.close();
  });
}
