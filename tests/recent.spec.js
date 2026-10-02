const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const url = pathToFileURL(path.resolve('index.html')).href;
async function setup(page){
  await page.route(/^https:\/\//, r => r.abort());
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.evaluate(() => { window.open = (...args) => {window.opened = args; return {};}; });
}
test('first use is hidden; tile tap and menu opening record and reopen a single URL', async ({page}) => {
  await setup(page);
  await expect(page.locator('#recentCard')).toBeHidden();
  await page.locator('#grid .card').first().click();
  await expect(page.locator('#recentRows tr')).toHaveCount(1);
  await expect(page.locator('#recentRows')).toContainText('Amazon');
  await page.locator('#recentRows a').click();
  await expect(page.locator('#recentRows tr')).toHaveCount(1);
  await page.locator('#grid .card').nth(1).getByRole('button', {name:'More actions for Google News',exact:true}).click();
  await page.locator('#grid .card').nth(1).getByRole('button',{name:'Open in new tab',exact:true}).click();
  await expect(page.locator('#recentRows tr')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('#recentRows tr')).toHaveCount(2);
});
test('unique newest ten, expand collapse, scrolling and keyboard clear', async ({page}) => {
  await setup(page);
  await page.evaluate(() => { for(let i=0;i<12;i++) recordRecent('https://example.com/'+i,'Page '+i); recordRecent('https://example.com/5','Reopened'); });
  await expect(page.locator('#recentRows tr')).toHaveCount(3);
  await expect(page.locator('#recentRows tr').first()).toContainText('Reopened');
  await page.getByRole('button',{name:'Show more',exact:true}).click();
  await expect(page.locator('#recentRows tr')).toHaveCount(10);
  expect(await page.locator('.recent-scroll').evaluate(e => e.scrollHeight > e.clientHeight)).toBe(true);
  await page.getByRole('button',{name:'Show less',exact:true}).click();
  await expect(page.locator('#recentRows tr')).toHaveCount(3);
  await page.locator('#recentClear').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#recentCard')).toBeHidden();
  await expect(page.locator('#exportBtn')).toBeFocused();
  await page.reload(); await expect(page.locator('#recentCard')).toBeHidden();
  await page.evaluate(() => recordRecent('https://example.com/5','Reopened after clear'));
  await expect(page.locator('#recentRows tr')).toHaveCount(1);
  const state = await page.evaluate(() => getRecent());
  expect(state.items[0].viewedAt).toBeGreaterThan(state.clearedAt);
});
test('cutoff excludes stale items, invalid URLs and malformed storage',async ({page}) => {
  await setup(page);
  await page.evaluate(() => {localStorage.setItem(RECENT_KEY,JSON.stringify({clearedAt:100,items:[{url:'https://example.com/old',viewedAt:100},{url:'javascript:alert(1)',viewedAt:200},{url:'https://example.com/new',title:'<img onerror=alert(1)>',viewedAt:101}]}));renderRecent();});
  await expect(page.locator('#recentRows tr')).toHaveCount(1);
  await expect(page.locator('#recentRows')).toContainText('<img onerror=alert(1)>');
  expect(await page.locator('#recentRows img').count()).toBe(0);
  await page.evaluate(() => {localStorage.setItem(RECENT_KEY,'invalid');renderRecent();});
  await expect(page.locator('#recentCard')).toBeHidden();
});
test('blocked tile opening and drag cancellation add no activity; failed clear keeps card',async ({page}) => {
  await setup(page);
  await page.evaluate(() => {window.open = () => null;});
  await page.locator('#grid .card').first().click();
  await expect(page.locator('#recentCard')).toBeHidden();
  await page.evaluate(() => {recordRecent('https://example.com','Example'); Storage.prototype.setItem = () => {throw new Error('quota');};});
  await page.locator('#recentClear').click();
  await expect(page.locator('#recentCard')).toBeVisible();
  await expect(page.locator('#recentStatus')).toContainText('could not be saved');
});
test('submitted search records encoded destination; empty search records nothing',async ({page}) => {
  await setup(page);
  await page.locator('#googleForm input[name=q]').fill('café & test');
  const popup = page.waitForEvent('popup');
  await page.locator('#googleForm input[name=q]').press('Enter');
  await (await popup).close();
  const state = await page.evaluate(() => getRecent());
  expect(new URL(state.items[0].url).searchParams.get('q')).toBe('café & test');
  await page.locator('#googleForm input[name=q]').fill('');
  await page.locator('#googleForm input[name=q]').press('Enter');
  expect((await page.evaluate(() => getRecent())).items).toHaveLength(1);
});
test('backups exclude recent activity and importing cannot undo a clear',async ({page}) => {
  await setup(page);
  await page.evaluate(() => recordRecent('https://example.com','Example'));
  const download = page.waitForEvent('download'); await page.locator('#exportBtn').click();
  const backup = JSON.parse(fs.readFileSync(await (await download).path(),'utf8'));
  expect(Object.keys(backup).sort()).toEqual(['links','settings']);
  await page.locator('#recentClear').click();
  const before = await page.evaluate(() => localStorage.getItem(RECENT_KEY));
  await page.locator('#importFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  expect(await page.evaluate(() => localStorage.getItem(RECENT_KEY))).toBe(before);
  await expect(page.locator('#recentCard')).toBeHidden();
});
for(const width of [1200,375]) test(`recent card fits and labels remain readable at ${width}px`,async ({page}) => {
  await setup(page); await page.setViewportSize({width,height:900});
  await page.evaluate(() => {for(let i=0;i<10;i++)recordRecent('https://example.com/'+i,'A long recent page title '+i);});
  await page.locator('#recentToggle').click();
  await page.locator('#recentCard').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = await page.locator('#recentCard').boundingBox(); expect(box.width).toBeLessThanOrEqual(width);
  fs.mkdirSync('visual-review',{recursive:true});
  await page.screenshot({path:`visual-review/recent-${width}.png`});
});
