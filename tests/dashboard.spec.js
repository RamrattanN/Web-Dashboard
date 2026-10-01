const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const url = pathToFileURL(path.resolve('index.html')).href;
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const links = Array.from({length: 16}, (_, i) => ({url: `https://example.com/${i}`, title: `Tile ${i}`, group: i % 2 ? 'Other' : 'Work', desc: `Description ${i}`, icon: pixel}));
async function setup(page, settings = {}) {
  await page.route('https://**', route => route.abort());
  await page.goto(url);
  await page.evaluate(({links, settings}) => {
    localStorage.setItem('startpage.links.v1', JSON.stringify(links));
    localStorage.setItem('startpage.settings.v1', JSON.stringify({mode:'none', color:'#123456', maxTiles:6, colsMax:3, ...settings}));
  }, {links, settings});
  await page.reload();
}
async function saved(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('startpage.links.v1'))); }
async function drag(page, from, to, side = 'after') {
  const a = await page.locator('#grid .card').nth(from).boundingBox();
  await page.mouse.move(a.x + a.width/2, a.y + 25); await page.mouse.down();
  await page.mouse.move(a.x + a.width/2 + 10, a.y + 25);
  const b = await page.locator('#grid .card:not(.placeholder)').nth(to).boundingBox();
  await page.mouse.move(b.x + (side === 'after' ? b.width-10 : 10), b.y + 25, {steps:8});
  await page.mouse.up();
}
test('tiles open once, including locked layout; locking blocks drag', async ({page}) => {
  await setup(page);
  await page.evaluate(() => { window.open = (...args) => { (window.opened ||= []).push(args); }; });
  await page.locator('#grid .card').first().click();
  expect(await page.evaluate(() => window.opened)).toEqual([['https://example.com/0','_blank']]);
  await page.evaluate(() => {setSettings({...getSettings(), lockLayout:'yes'}); render();});
  await page.locator('#grid .card').first().click();
  expect(await page.evaluate(() => window.opened.length)).toBe(2);
  await drag(page,0,5);
  expect(await saved(page)).toEqual(links);
});
for (const group of ['All','Work']) test(`cross-row drag preserves capped/hidden links in ${group}`, async ({page}) => {
  await setup(page, {groupFilter:group});
  await drag(page,0,5);
  const expected = links.slice();
  const slots = group === 'All' ? [0,1,2,3,4,5] : [0,2,4,6,8,10];
  const order = [...slots.slice(1),slots[0]];
  slots.forEach((slot,i) => expected[slot] = links[order[i]]);
  expect(await saved(page)).toEqual(expected);
  await page.reload(); expect(await saved(page)).toEqual(expected);
  await drag(page,5,0,'before'); expect(await saved(page)).toEqual(links);
});
test('pointer cancellation neither opens nor reorders', async ({page}) => {
  await setup(page);
  await page.evaluate(() => { window.open = () => {throw new Error('Unexpected opening');}; });
  const box = await page.locator('#grid .card').first().boundingBox();
  await page.mouse.move(box.x + 40, box.y + 25); await page.mouse.down();
  await page.locator('#grid .card').first().dispatchEvent('pointercancel', {pointerId:1});
  expect(await saved(page)).toEqual(links);
});
test('settings Save persists; Close, Escape, and local file cancellation discard edits', async ({page}) => {
  await setup(page);
  const before = await page.evaluate(() => localStorage.getItem('startpage.settings.v1'));
  await page.locator('#settingsBtn').click();
  await page.locator('#maxTiles').fill('12');
  await page.locator('#wallpaperFile').setInputFiles({name:'test.png', mimeType:'image/png', buffer:Buffer.from(pixel.split(',')[1], 'base64')});
  await expect(page.locator('#wallpaperMode')).toHaveValue('local');
  await page.getByRole('button', {name:'Close', exact:true}).click();
  expect(await page.evaluate(() => localStorage.getItem('startpage.settings.v1'))).toBe(before);
  await page.locator('#settingsBtn').click(); await page.locator('#maxTiles').fill('10'); await page.keyboard.press('Escape');
  expect(await page.evaluate(() => localStorage.getItem('startpage.settings.v1'))).toBe(before);
  await page.locator('#settingsBtn').click(); await page.locator('#maxTiles').fill('9'); await page.locator('#saveSettingsBtn').click();
  await page.reload(); await expect(page.locator('#grid .card')).toHaveCount(9);
});
test('add and edit Cancel never save or trigger required field validation', async ({page}) => {
  await setup(page);
  await page.locator('#addBtn').click(); await page.getByRole('button', {name:'Cancel', exact:true}).click();
  await expect(page.locator('#linkDialog')).not.toBeVisible();
  await page.locator('#grid .icon-btn').first().click(); await page.getByRole('button', {name:'Edit shortcut', exact:true}).first().click();
  await page.locator('#titleInput').fill('Discard me'); await page.getByRole('button', {name:'Cancel', exact:true}).click();
  expect(await saved(page)).toEqual(links);
});
test('export/import round trip retains all links, settings, groups, icons and wallpaper', async ({page}) => {
  await setup(page, {mode:'local', value:pixel});
  const downloadPromise = page.waitForEvent('download'); await page.locator('#exportBtn').click();
  const download = await downloadPromise; const file = await download.path();
  const fs = require('node:fs'); const backup = JSON.parse(fs.readFileSync(file,'utf8'));
  expect(backup.links).toEqual(links); expect(backup.settings.value).toBe(pixel);
  await page.evaluate(() => {setLinks([]); setSettings({mode:'none'}); render();});
  await page.locator('#importFile').setInputFiles(file);
  await expect(page.locator('#grid .card')).toHaveCount(6);
  expect(await saved(page)).toEqual(links);
  expect(await page.evaluate(() => getSettings())).toEqual(backup.settings);
});
for (const failure of ['http','json','empty','image','network']) test(`Bing ${failure} failure preserves previous wallpaper`, async ({page}) => {
  await setup(page, {mode:'local', value:pixel});
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
  await page.route('https://www.bing.com/**', route => {
    if (failure === 'network') return route.abort();
    if (!route.request().url().includes('HPImageArchive')) return route.abort();
    return route.fulfill({status:failure === 'http' ? 503:200, contentType:'application/json', body:failure === 'json' ? '{' : JSON.stringify(failure === 'empty' ? {} : {images:[{url:'/image.jpg'}]})});
  });
  const warning = page.waitForEvent('console', msg => msg.text().includes('preserving the previous background'));
  await page.evaluate(() => {setSettings({...getSettings(), mode:'bing', value:'en-US'}); render();}); await warning;
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
});
test('Bing uses actual settings key, preloads success, and ignores stale responses', async ({page}) => {
  await setup(page);
  await page.route('https://www.bing.com/**', route => route.request().url().includes('HPImageArchive') ? route.fulfill({json:{images:[{url:'/daily.png'}]}}) : route.fulfill({contentType:'image/png', body:Buffer.from(pixel.split(',')[1],'base64')}));
  await page.evaluate(() => {setSettings({...getSettings(), mode:'bing', value:'en-US'}); render();});
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', 'url("https://www.bing.com/daily.png")');
  await page.reload();
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', 'url("https://www.bing.com/daily.png")');
  let release; const held = new Promise(r => release = r);
  await page.route('https://www.bing.com/HPImageArchive*', async route => {await held; await route.fulfill({json:{images:[{url:'/late.png'}]}});});
  const request = page.waitForRequest('https://www.bing.com/HPImageArchive*');
  await page.evaluate(() => {setSettings({...getSettings(), value:'en-GB'}); render();}); await request;
  await page.evaluate(() => {setSettings({...getSettings(), mode:'none', color:'#abcdef'}); render();}); release();
  await page.waitForResponse('https://www.bing.com/late.png');
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image','none');
  await expect(page.locator('#wallpaper')).toHaveCSS('background-color','rgb(171, 205, 239)');
});

test('invalid backup leaves existing data unchanged', async ({page}) => {
  await setup(page);
  const before = await page.evaluate(() => localStorage.getItem('startpage.settings.v1'));
  page.on('dialog', dialog => dialog.accept());
  for (const backup of [{links:[null]}, {links:[],settings:{groupFilter:42}}]) {
    await page.locator('#importFile').setInputFiles({name:'invalid.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(backup))});
    await expect(page.locator('#importFile')).toHaveValue('');
    expect(await saved(page)).toEqual(links);
    expect(await page.evaluate(() => localStorage.getItem('startpage.settings.v1'))).toBe(before);
  }
});

test('live Bing browser probe records provider outcome and preserves fallback on failure', async ({page}) => {
  test.skip(!process.env.LIVE_BING, 'Opt-in network diagnostic; deterministic tests cover success/failures.');
  await setup(page, {mode:'local', value:pixel});
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
  await page.route('https://www.bing.com/**', route => route.continue());
  const evidence = [];
  page.on('console', message => evidence.push(message.type() + ': ' + message.text()));
  page.on('requestfailed', request => evidence.push('request failed: ' + request.url() + ' ' + request.failure()?.errorText));
  page.on('response', response => {if(response.url().includes('bing.com')) evidence.push('HTTP ' + response.status() + ': ' + response.url());});
  await page.evaluate(async () => {setSettings({...getSettings(), mode:'bing', value:'en-US'}); await applyWallpaper();});
  const background = await page.locator('#wallpaper').evaluate(el => el.style.backgroundImage);
  const success = background.includes('https://www.bing.com/');
  if (!success) await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
  console.log('LIVE BING: ' + (success ? 'image loaded' : 'provider unavailable; previous image preserved') + '\n' + evidence.join('\n'));
});
