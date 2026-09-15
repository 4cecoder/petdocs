import { chromium, firefox } from "playwright";
import fs from "fs";
import path from "path";

const sessionPath = "/tmp/petlia_session.json";
if (!fs.existsSync(sessionPath)) {
  console.error("Session token file not found at", sessionPath);
  process.exit(1);
}

const sessionRaw = fs.readFileSync(sessionPath, "utf8");
const sessionData = JSON.parse(sessionRaw);
console.log("Loaded session for user:", sessionData.user?.email);

const outputDir = path.resolve("research/screenshots");
fs.mkdirSync(outputDir, { recursive: true });

async function explore() {
  console.log("Launching headed browser...");
  // Try chromium, fallback to firefox if needed
  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      slowMo: 300,
    });
  } catch (e) {
    console.log("Chromium launch failed, trying firefox:", e.message);
    browser = await firefox.launch({
      headless: false,
      slowMo: 300,
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });

  // Inject cookies from Zen browser
  await context.addCookies([
    {
      name: "__dpl",
      value: "633cc4c9-fd12-448e-a147-1b03a9528064",
      domain: ".petlia.app",
      path: "/",
    },
    {
      name: "session-id",
      value: "d8108dc8-73ee-496e-84fa-dc3c9c6aab93",
      domain: ".petlia.app",
      path: "/",
    },
  ]);

  // Inject localStorage on every frame/page creation
  await context.addInitScript((token) => {
    try {
      window.localStorage.setItem("sb-zjzohtdooavdvcrfggsi-auth-token", token);
      window.localStorage.setItem("petlia-theme", "light");
    } catch (e) {
      console.error("initScript error:", e);
    }
  }, sessionRaw);

  const page = await context.newPage();

  // Test petlia.app first, fallback to petlia.lovable.app
  let targetOrigin = "https://petlia.app";
  console.log("Navigating to", `${targetOrigin}/dashboard`);

  let loaded = false;
  try {
    const res = await page.goto(`${targetOrigin}/dashboard`, { waitUntil: "commit", timeout: 15000 });
    console.log("Commit response status:", res?.status());
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
    loaded = true;
  } catch (err) {
    console.warn("Failed petlia.app, trying petlia.lovable.app:", err.message);
    targetOrigin = "https://petlia.lovable.app";
    try {
      await page.goto(`${targetOrigin}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });
      loaded = true;
    } catch (err2) {
      console.error("Both failed:", err2.message);
    }
  }

  console.log("Loaded on target origin:", targetOrigin);
  await page.waitForTimeout(4000);

  console.log("Current URL:", page.url());
  const title = await page.title();
  console.log("Page Title:", title);

  // Take screenshot of dashboard
  await page.screenshot({ path: path.join(outputDir, "01-dashboard.png"), fullPage: true });
  console.log("Saved 01-dashboard.png");

  const dashText = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(outputDir, "dashboard-text.txt"), dashText);
  console.log("Dashboard text snippet:\n", dashText.slice(0, 500));

  // Extract navigation links and pet profiles
  const pageLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]")).map(a => ({
      href: a.getAttribute("href"),
      text: a.innerText.trim(),
    }));
  });
  console.log("Found links:", pageLinks.slice(0, 15));

  // Explore tabs
  const tabs = [
    { name: "02-records", path: "/records" },
    { name: "03-reminders", path: "/reminders" },
    { name: "04-settings", path: "/settings" },
  ];

  for (const tab of tabs) {
    console.log(`Exploring ${tab.path}...`);
    try {
      await page.goto(`${targetOrigin}${tab.path}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(outputDir, `${tab.name}.png`), fullPage: true });
      const text = await page.evaluate(() => document.body.innerText);
      fs.writeFileSync(path.join(outputDir, `${tab.name}-text.txt`), text);
      console.log(`Saved ${tab.name}`);
    } catch (e) {
      console.warn(`Could not load ${tab.path}:`, e.message);
    }
  }

  // Look for pet profile links
  const petLink = pageLinks.find(l => l.href && l.href.startsWith("/pet/"));
  if (petLink) {
    console.log("Exploring pet profile:", petLink.href);
    try {
      await page.goto(`${targetOrigin}${petLink.href}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(outputDir, "05-pet-profile.png"), fullPage: true });
      const text = await page.evaluate(() => document.body.innerText);
      fs.writeFileSync(path.join(outputDir, "05-pet-profile-text.txt"), text);
      console.log("Saved 05-pet-profile.png");
    } catch (e) {
      console.warn("Could not load pet profile:", e.message);
    }
  }

  console.log("Exploration finished. Pausing 5s for visual inspection...");
  await page.waitForTimeout(5000);
  await browser.close();
  console.log("Done!");
}

explore().catch(console.error);
