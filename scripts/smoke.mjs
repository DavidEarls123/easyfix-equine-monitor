/* ==========================================================================
   Does every screen still render?

   A missing component reference is not a build error — Vite compiles it
   happily and React blows up at run time, leaving a blank page. That is
   exactly how a broken Ride planning screen once shipped, so this walks every
   route in a real browser and fails if any of them renders nothing or logs an
   error.

     npm run build && npm run smoke

   Playwright is an optional dev dependency; if it is not installed this exits
   quietly rather than failing a machine that never asked for it.
   ========================================================================== */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const ROUTES = [
  "dashboard",
  "barns",
  "animals",
  "staff",
  "rides",
  "board",
  "video",
  "alerts",
  "settings",
];

const PORT = process.env.SMOKE_PORT || 4178;
const BASE = `http://localhost:${PORT}`;

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("smoke: playwright not installed — skipping (npm i -D playwright)");
  process.exit(0);
}

const server = spawn("npx", ["vite", "preview", "--port", String(PORT)], { stdio: "ignore" });
const stop = () => server.kill();
process.on("exit", stop);

// wait for the preview server rather than guessing at a delay
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(BASE);
    if (r.ok) break;
  } catch {
    /* not up yet */
  }
  await sleep(500);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const failures = [];
for (const route of ROUTES) {
  const errors = [];
  const onError = (e) => errors.push(String(e.message || e).split("\n")[0]);
  const onConsole = (m) => m.type() === "error" && !/404|favicon/.test(m.text()) && errors.push(m.text().split("\n")[0]);
  page.on("pageerror", onError);
  page.on("console", onConsole);

  await page.goto(`${BASE}/#/${route}`, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  const size = await page.evaluate(() => document.getElementById("root")?.innerHTML.length ?? 0);

  page.off("pageerror", onError);
  page.off("console", onConsole);

  // a screen that renders under a few hundred characters has not really rendered
  if (size < 500) failures.push(`/${route}: rendered ${size} chars`);
  if (errors.length) failures.push(`/${route}: ${errors[0]}`);
  console.log(`${failures.some((f) => f.startsWith(`/${route}:`)) ? "FAIL" : "ok  "}  /${route}  (${size} chars)`);
}

await browser.close();
stop();

if (failures.length) {
  console.error("\nsmoke failed:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
console.log("\nsmoke: every route rendered");
