import { chromium } from 'playwright-core';
import fs from 'node:fs';
fs.rmSync('rec-images', { recursive: true, force: true });
fs.mkdirSync('public/img', { recursive: true });
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
  recordVideo: { dir: 'rec-images', size: { width: 780, height: 1688 } },
});
const p = await ctx.newPage();
const wait = (ms) => p.waitForTimeout(ms);
await p.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const css = document.createElement('style');
    css.textContent =
      '.tap{position:fixed;z-index:99998;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(29,78,216,.35);border:3px solid #1d4ed8;pointer-events:none;animation:tp .55s ease-out forwards}@keyframes tp{from{transform:scale(.4);opacity:1}to{transform:scale(1.5);opacity:0}}';
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
await wait(1000);
const pick = async (i, q) => {
  const e = p.getByPlaceholder(/Place, station/).nth(i);
  await e.click();
  await e.pressSequentially(q, { delay: 80 });
  await wait(900);
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  await wait(700);
};
await pick(0, 'Helwan');
await pick(1, 'New El-Marg');
await wait(1500);
await p.locator('.sheet-handle').click();
await wait(2500);
await p
  .locator('.sheet button', { hasText: /^Image$/ })
  .first()
  .click();
await wait(3000);

const save = async (name) => {
  await wait(2200);
  const b64 = await p.evaluate(async () => {
    const src = document.querySelector('[role=dialog] .img-preview img').src;
    const blob = await (await fetch(src)).blob();
    return await new Promise((r) => {
      const f = new FileReader();
      f.onload = () => r(f.result.split(',')[1]);
      f.readAsDataURL(blob);
    });
  });
  fs.writeFileSync(`public/img/${name}.png`, Buffer.from(b64, 'base64'));
  console.log('saved', name);
};
const click = async (name) => {
  await p.screenshot({ path: 'dbg.png' });
  await p
    .locator('[role=dialog] button')
    .filter({ hasText: new RegExp('^' + name + '$') })
    .first()
    .click({ timeout: 8000 });
};

await save('default');
await click('Route only');
await save('route-only');
await click('Network map');
await click('Diagram');
await save('diagram');
await click('Route only'); // diagram + route only
await click('Network map');
await click('Dark');
await save('dark');
await click('Light');
await p
  .locator('[role=dialog] .img-body')
  .evaluate((e) => e.scrollBy(0, 0))
  .catch(() => {});
await click('Story');
await save('story');
await click('Portrait');
await click('العربية');
await click('Dark');
await save('arabic-dark');
await click('Light');
await click('English');
await click('Like app').catch(() => {});
await click('Whole network').catch(() => {});
await wait(2500);
await click('Network map');
await wait(1500);
const v = p.video();
await ctx.close();
console.log('VIDEO', await v.path());
await b.close();
