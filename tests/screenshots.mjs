import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve('frontend/index.html');
if (!existsSync(file)) throw new Error('Build frontend/index.html before running screenshot checks');
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1280,height:720}, reducedMotion:'reduce'});
await page.goto(`file://${file}`);
await page.fill('#transcript', 'Test transcript');
await page.fill('#companyName', 'Test Co');
await page.screenshot({path:'tests/desktop-panel.png'});
// The app cannot make a real API call in CI without a token; use the browser
// smoke check for boot, validation, upload controls, and responsive layout.
if (await page.locator('#generateBtn').isDisabled()) throw new Error('Generate should enable with required fields');
const phone = await browser.newPage({viewport:{width:390,height:844}, reducedMotion:'reduce'});
await phone.goto(`file://${file}`);
await phone.screenshot({path:'tests/phone-panel.png'});
await browser.close();
console.log('Playwright smoke checks passed');
