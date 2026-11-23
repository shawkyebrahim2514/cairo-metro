import { chromium } from 'playwright-core';
import fs from 'node:fs';
fs.rmSync('rec-clip', { recursive: true, force: true });
const b = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'en-US',
  recordVideo: { dir: 'rec-clip', size: { width: 780, height: 1688 } },
});
const t0 = Date.now();
const mark = (n) => console.log(n, ((Date.now() - t0) / 1000).toFixed(1));
const p = await ctx.newPage();
const wait = (ms) => p.waitForTimeout(ms);
await p.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const css = document.createElement('style');
    css.textContent =
      '.install-card{display:none!important}.tap{position:fixed;z-index:99998;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(29,78,216,.35);border:3px solid #1d4ed8;pointer-events:none;animation:tp .55s ease-out forwards}@keyframes tp{from{transform:scale(.4);opacity:1}to{transform:scale(1.5);opacity:0}}';
    document.head.append(css);
    addEventListener(
      'pointerdown',
      (e) => {
        const d = document.createElement('div');
        d.className = 'tap';
        d.style.left = e.clientX + 'px';
        d.style.top = e.clientY + 'px';
        document.body.append(d);
        setTimeout(() => d.remove(), 600);
      },
      true,
    );
  });
});
await p.goto('https://shawkyebrahim2514.github.io/cairo-metro/#/');
await wait(1500);
await p.evaluate(() =>
  [...document.querySelectorAll('button')]
    .filter((b) => ['Skip', 'Close'].includes(b.textContent.trim()))
    .forEach((b) => b.click()),
);
await p.getByRole('button', { name: 'Trip planner' }).click();
await wait(800);
const pick = async (i, q) => {
  const e = p.getByPlaceholder(/Place, station/).nth(i);
  await e.click();
  await e.pressSequentially(q, { delay: 70 });
  await wait(800);
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  await wait(600);
};
mark('start-plan');
await pick(0, 'Helwan');
await pick(1, 'New El-Marg');
await wait(1200);
await p.locator('.sheet-handle').click();
await wait(2200);
mark('result');
await p
  .locator('.sheet button', { hasText: /^Image$/ })
  .first()
  .click();
await wait(2600);
mark('dialog');
const click = async (name) => {
  await p
    .locator('[role=dialog] button')
    .filter({ hasText: new RegExp('^' + name + '$') })
    .first()
    .click({ timeout: 8000 });
};
await click('Route only');
await wait(2200);
await click('Diagram');
await wait(2200);
await click('Dark');
await wait(2200);
await click('Story');
await wait(2200);
await click('Portrait');
await click('العربية');
await wait(2400);
mark('end');
const v = p.video();
await ctx.close();
console.log('VIDEO', await v.path());
await b.close();
