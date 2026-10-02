const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const url = pathToFileURL(path.resolve('index.html')).href;
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const links = Array.from({length: 16}, (_, i) => ({url: `https://example.com/${i}`, title: `Tile ${i}`, group: i % 2 ? 'Other' : 'Work', desc: `Description ${i}`, icon: pixel}));
async function setup(page, settings = {}) {
  await page.route(/^https:\/\//, route => route.abort());
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

test('single click opens an actual browser tab', async ({page}) => {
  await setup(page);
  await page.context().route('https://example.com/**', route => route.fulfill({body:'Destination', contentType:'text/plain'}));
  const popup = page.waitForEvent('popup');
  await page.locator('#grid .card').first().click();
  const destination = await popup;
  await expect(destination).toHaveURL('https://example.com/0');
  expect(page.context().pages()).toHaveLength(2);
});

test('cancel during an active cross-row drag restores the complete collection', async ({page}) => {
  await setup(page);
  const box = await page.locator('#grid .card').first().boundingBox();
  await page.mouse.move(box.x+40, box.y+25); await page.mouse.down();
  await page.mouse.move(box.x+60, box.y+125, {steps:4});
  await expect(page.locator('.drag-layer')).toHaveCount(1);
  await page.locator('#grid .card:not(.placeholder)').first().dispatchEvent('pointercancel', {pointerId:1});
  await page.mouse.up();
  await expect(page.locator('.drag-layer, .placeholder')).toHaveCount(0);
  expect(await saved(page)).toEqual(links);
});

const six = ['Work','Other','Work','Work','Other','Work'].map((group, i) => ({url: `https://example.com/six-${i}`, title: `Six ${i}`, group, desc: `Description ${i}`, icon: pixel}));
for (const [group, shown, order] of [['All',[0,1,2],[1,2,0,3,4,5]], ['Work',[0,2,3],[2,1,3,0,4,5]]]) test(`import persists after reload; three-of-six reorder keeps hidden links in ${group}`, async ({page}) => {
  await setup(page);
  const backup = {links: six, settings: {mode:'none', color:'#654321', maxTiles:3, colsMax:3, groupFilter:group, title:'Imported'}};
  await page.locator('#importFile').setInputFiles({name:'backup.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.locator('#grid .card .title')).toHaveText(shown.map(i => `Six ${i}`));
  await page.reload();
  await expect(page.locator('#grid .card .title')).toHaveText(shown.map(i => `Six ${i}`));
  await expect(page.locator('#logo')).toHaveText('Imported');
  await expect(page.locator('#wallpaper')).toHaveCSS('background-color', 'rgb(101, 67, 33)');
  expect(await saved(page)).toEqual(six);
  expect(await page.evaluate(() => getSettings())).toMatchObject(backup.settings);
  await drag(page,0,2);
  const expected = order.map(i => six[i]);
  expect(await saved(page)).toEqual(expected);
  await page.reload(); expect(await saved(page)).toEqual(expected);
  await expect(page.locator('#grid .card .title')).toHaveText([...shown.slice(1), shown[0]].map(i => `Six ${i}`));
});

test('cancelled Settings edits leave saved values and appearance unchanged', async ({page}) => {
  await setup(page, {mode:'local', value:pixel});
  const before = await page.evaluate(() => localStorage.getItem('startpage.settings.v1'));
  for (const dismiss of ['Close','Escape']) {
    await page.locator('#settingsBtn').click();
    await page.locator('#maxTiles').fill('2');
    await page.locator('#wallpaperFile').setInputFiles({name:'other.gif', mimeType:'image/gif', buffer:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')});
    await expect(page.locator('#wallpaperValue')).toHaveValue(/^data:image\/gif/);
    if (dismiss === 'Close') await page.getByRole('button', {name:'Close', exact:true}).click(); else await page.keyboard.press('Escape');
    await expect(page.locator('#settingsDialog')).not.toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('startpage.settings.v1'))).toBe(before);
    await expect(page.locator('#grid .card')).toHaveCount(6);
    await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#maxTiles')).toHaveValue('6');
    await expect(page.locator('#wallpaperMode')).toHaveValue('local');
    await expect(page.locator('#wallpaperValue')).toHaveValue(pixel);
    await page.getByRole('button', {name:'Close', exact:true}).click();
  }
});

test('failed static wallpaper request preserves the working background', async ({page}) => {
  await setup(page, {mode:'local', value:pixel});
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
  const warning = page.waitForEvent('console', msg => msg.text().includes('preserving the previous background'));
  await page.locator('#settingsBtn').click();
  await page.locator('#wallpaperMode').selectOption('static');
  await page.locator('#wallpaperValue').fill('https://example.com/missing-wallpaper.png');
  await page.locator('#saveSettingsBtn').click(); await warning;
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
  expect(await page.evaluate(() => getSettings().mode)).toBe('static');
});

test('a second pointer during a drag is ignored and the first drag completes intact', async ({page}) => {
  await setup(page);
  await page.evaluate(() => { window.opened = []; window.open = (...args) => { window.opened.push(args); }; });
  const a = await page.locator('#grid .card').first().boundingBox();
  await page.mouse.move(a.x + a.width/2, a.y + 25); await page.mouse.down();
  await page.mouse.move(a.x + a.width/2 + 10, a.y + 25);
  await expect(page.locator('.drag-layer')).toHaveCount(1);
  const other = page.locator('#grid .card:not(.placeholder)').nth(3);
  const o = await other.boundingBox();
  for (const [type, dx] of [['pointerdown',0], ['pointermove',40], ['pointerup',40], ['pointerdown',0], ['pointerup',0]])
    await other.dispatchEvent(type, {pointerId:7, pointerType:'touch', isPrimary:false, button:0, buttons:type === 'pointerup' ? 0 : 1, clientX:o.x + 30 + dx, clientY:o.y + 25});
  await expect(page.locator('.drag-layer')).toHaveCount(1);
  await expect(page.locator('#grid .placeholder')).toHaveCount(1);
  const b = await page.locator('#grid .card:not(.placeholder)').nth(5).boundingBox();
  await page.mouse.move(b.x + b.width - 10, b.y + 25, {steps:8}); await page.mouse.up();
  await expect(page.locator('.drag-layer, .placeholder')).toHaveCount(0);
  expect(await saved(page)).toEqual([...links.slice(1,6), links[0], ...links.slice(6)]);
  expect(await page.evaluate(() => window.opened)).toEqual([]);
});

test('ordering ignores stray placeholders and refuses invalid or duplicate indices', async ({page}) => {
  await setup(page);
  await page.evaluate(() => { const stray = document.createElement('div'); stray.className = 'card placeholder'; grid.appendChild(stray); });
  await drag(page,0,5);
  const reordered = [...links.slice(1,6), links[0], ...links.slice(6)];
  expect(await saved(page)).toEqual(reordered);
  await expect(page.locator('.drag-layer, .placeholder')).toHaveCount(0);
  for (const index of ['999','-1','1.5','x','1']) {
    expect(await page.evaluate(index => { render(); grid.querySelector('.card').dataset.gindex = index; return commitOrderFromDOM(); }, index)).toBe(false);
    expect(await saved(page)).toEqual(reordered);
  }
});

for (const [mode, value] of [['local', pixel], ['static', 'https://example.com/wall.png']]) test(`switching from ${mode} to Bing never sends the previous value and keeps it saved`, async ({page}) => {
  await setup(page, {mode, value});
  const bing = []; page.on('request', request => { if (request.url().startsWith('https://www.bing.com/')) bing.push(request.url()); });
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#wallpaperValue')).toHaveValue(value);
  await page.evaluate(() => { wallpaperMode.value = 'bing'; wallpaperMode.dispatchEvent(new Event('change', {bubbles:true})); });
  await expect(page.locator('#wallpaperValue')).toHaveValue('');
  const request = page.waitForRequest('https://www.bing.com/HPImageArchive*');
  await page.locator('#saveSettingsBtn').click();
  expect(new URL((await request).url()).searchParams.get('mkt')).toBe('en-US');
  expect(await page.evaluate(() => getSettings())).toMatchObject({mode:'bing', value:'', savedValues:{[mode]:value}});
  if (mode === 'local') await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
  await page.locator('#settingsBtn').click();
  await page.locator('#wallpaperMode').selectOption(mode);
  await expect(page.locator('#wallpaperValue')).toHaveValue(value);
  await page.locator('#saveSettingsBtn').click();
  expect(await page.evaluate(() => getSettings())).toMatchObject({mode, value});
  // A value left under Bing by older settings or an edited backup is rejected before any request.
  await page.evaluate(async value => { setSettings({...getSettings(), mode:'bing', value}); await applyWallpaper(); }, value);
  expect(bing).toHaveLength(1);
  if (mode === 'local') await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
});

test('Bing daily is not selectable or the first-run default; a saved Bing mode is preserved', async ({page}) => {
  await page.route(/^https:\/\//, route => route.abort());
  await page.goto(url);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  expect(await page.evaluate(() => getSettings().mode)).toBe('none');
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', 'none');
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#wallpaperMode')).toHaveValue('none');
  await expect(page.locator('#wallpaperMode option[value="bing"]')).toBeDisabled();
  await page.getByRole('button', {name:'Close', exact:true}).click();
  await page.evaluate(() => setSettings({...getSettings(), mode:'bing', value:'en-GB'})); await page.reload();
  const alerts = []; page.on('dialog', dialog => { alerts.push(dialog.message()); dialog.accept(); });
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#wallpaperMode')).toHaveValue('bing');
  await page.locator('#maxTiles').fill('4');
  await page.locator('#wallpaperValue').fill('https://example.com/a.png'); await page.locator('#saveSettingsBtn').click();
  await expect.poll(() => alerts.length).toBe(1); expect(alerts[0]).toContain('Bing market');
  expect(await page.evaluate(() => getSettings().value)).toBe('en-GB');
  await page.locator('#wallpaperValue').fill('en-GB'); await page.locator('#saveSettingsBtn').click();
  await expect(page.locator('#settingsDialog')).not.toBeVisible();
  expect(await page.evaluate(() => getSettings())).toMatchObject({mode:'bing', value:'en-GB', maxTiles:4});
});

test('a failed wallpaper is not retried by unrelated renders; Save retries it', async ({page}) => {
  await setup(page, {mode:'local', value:pixel});
  const missing = 'https://example.com/missing-wallpaper.png'; let attempts = 0;
  page.on('request', request => { if (request.url() === missing) attempts++; });
  await page.evaluate(async missing => { setSettings({...getSettings(), mode:'static', value:missing}); await applyWallpaper(); }, missing);
  expect(attempts).toBe(1);
  await page.evaluate(async () => { render(); render(); await applyWallpaper(); });
  await page.locator('#groupBar .pill').first().click();
  await expect(page.locator('#groupBar .pill.active')).toHaveCount(1);
  expect(attempts).toBe(1);
  const retry = page.waitForRequest(missing);
  await page.locator('#settingsBtn').click(); await page.locator('#saveSettingsBtn').click(); await retry;
  expect(attempts).toBe(2);
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
});

test('saving a local image that exceeds storage shows an error and keeps existing settings', async ({page}) => {
  await setup(page, {mode:'local', value:pixel});
  const before = await page.evaluate(() => localStorage.getItem('startpage.settings.v1'));
  const alerts = []; page.on('dialog', dialog => { alerts.push(dialog.message()); dialog.accept(); });
  await page.locator('#settingsBtn').click();
  await page.locator('#wallpaperFile').setInputFiles({name:'huge.gif', mimeType:'image/gif', buffer:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')});
  await expect(page.locator('#wallpaperValue')).toHaveValue(/^data:image\/gif/);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.locator('#saveSettingsBtn').click();
  await expect.poll(() => alerts.length).toBe(1); expect(alerts[0]).toContain('storage is full');
  await expect(page.locator('#settingsDialog')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('startpage.settings.v1'))).toBe(before);
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
});

const grouped = [['Amazon','General'], ['Google News','News'], ['Gmail','Work'], ['Facebook','General'], ['LinkedIn','Work'], ['ChatGPT','Work']].map(([title, group], i) => ({url: `https://example.com/g${i}`, title, group, desc: '', icon: pixel}));
async function pills(page) { return page.locator('#groupBar .pill').evaluateAll(els => els.map(el => [el.textContent, el.classList.contains('active'), el.getAttribute('aria-pressed')])); }
test('All group button clears the filter in one click, respects the tile limit, and persists', async ({page}) => {
  await setup(page, {maxTiles:4});
  await page.evaluate(grouped => { setLinks(grouped); render(); }, grouped);
  const titles = () => page.locator('#grid .card .title').allTextContents();
  const state = active => ['All','General','News','Work'].map(name => [name, name === active, String(name === active)]);
  expect(await pills(page)).toEqual(state('All'));
  expect(await titles()).toEqual(['Amazon','Google News','Gmail','Facebook']);
  const members = {Work:['Gmail','LinkedIn','ChatGPT'], News:['Google News'], General:['Amazon','Facebook']};
  for (const group of ['Work','News','General']) {
    await page.getByRole('button', {name:group, exact:true}).click();
    expect(await pills(page)).toEqual(state(group));
    expect(await titles()).toEqual(members[group]);
    await page.reload();
    expect(await pills(page)).toEqual(state(group));
    expect(await titles()).toEqual(members[group]);
    await page.getByRole('button', {name:'All', exact:true}).click();
    expect(await pills(page)).toEqual(state('All'));
    expect(await titles()).toEqual(['Amazon','Google News','Gmail','Facebook']);
    expect(await page.evaluate(() => getSettings().groupFilter)).toBe('All');
    await page.reload();
    expect(await pills(page)).toEqual(state('All'));
    expect(await titles()).toEqual(['Amazon','Google News','Gmail','Facebook']);
  }
  // A second click on the selected group still returns to All; clicking All again changes nothing.
  await page.getByRole('button', {name:'General', exact:true}).click(); await page.getByRole('button', {name:'General', exact:true}).click();
  expect(await pills(page)).toEqual(state('All'));
  await page.getByRole('button', {name:'All', exact:true}).click();
  expect(await pills(page)).toEqual(state('All'));
  // Dragging inside a filtered group moves only that group's links and keeps every hidden link.
  await page.getByRole('button', {name:'Work', exact:true}).click();
  await drag(page,0,2);
  expect((await saved(page)).map(link => link.title)).toEqual(['Amazon','Google News','LinkedIn','Facebook','ChatGPT','Gmail']);
  expect(await pills(page)).toEqual(state('Work'));
  // A saved filter naming a group that no longer exists highlights nothing, and All clears it.
  await page.evaluate(() => { setSettings({...getSettings(), groupFilter:'Gone'}); render(); });
  expect((await pills(page)).filter(([, active]) => active)).toEqual([]);
  await expect(page.locator('#grid .card')).toHaveCount(0);
  await page.getByRole('button', {name:'All', exact:true}).click();
  expect(await pills(page)).toEqual(state('All'));
  await expect(page.locator('#grid .card')).toHaveCount(4);
});

// Icon lookup. Every response here is supplied by the test; nothing is fetched from the real services.
const zlib = require('node:zlib');
function png(size) {
  const crc = buf => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); const out = Buffer.alloc(body.length + 8); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), body.length + 4); return out; };
  // Each row is a filter-type byte of 0 followed by one grey byte per pixel; any other filter byte makes the image undecodable.
  const rows = Buffer.alloc((size + 1) * size, 0x80); for (let y = 0; y < size; y++) rows[y * (size + 1)] = 0;
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 0; // 8-bit greyscale
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
const OFFICIAL = 'https://cdn.oaistatic.com/assets/favicon-180x180-od45eci6.webp';
const HORSE = 'https://icon.horse/icon/chat.openai.com';
const legacyChat = {url: 'https://chat.openai.com', title: 'ChatGPT', group: 'Work', desc: '', icon: ''};
async function icons(page, {links, cache, serve}) {
  await setup(page);
  const requests = []; page.on('request', request => { if (request.resourceType() === 'image') requests.push({url: request.url(), origin: request.headers().origin}); });
  // Responses carry no Access-Control-Allow-Origin header, as the real icon services do not.
  for (const [pattern, size] of serve) await page.route(pattern, route => route.fulfill({contentType: 'image/png', body: png(size)}));
  await page.evaluate(({links, cache}) => {
    setLinks(links);
    if (cache) localStorage.setItem('startpage.iconcache.v1', JSON.stringify(cache)); else localStorage.removeItem('startpage.iconcache.v1');
  }, {links, cache});
  await page.reload();
  return requests;
}
const shown = page => page.locator('#grid .card .favicon img').first();
// The displayed icon must be the given source, fully decoded at the fixture's exact pixel size.
const loaded = async (page, src, size, which = 0) => {
  const img = page.locator('#grid .card .favicon img').nth(which);
  await expect(img).toHaveAttribute('src', src);
  await expect.poll(() => img.evaluate(el => el.complete ? el.naturalWidth : -1)).toBe(size);
  expect(await img.evaluate(el => el.decode().then(() => 'decoded', () => 'undecodable'))).toBe('decoded');
};
const iconCache = page => page.evaluate(() => JSON.parse(localStorage.getItem('startpage.iconcache.v1') || '{}'));

test('legacy chat.openai.com tile shows the official ChatGPT icon without CORS and keeps its saved URL', async ({page}) => {
  const requests = await icons(page, {links: [legacyChat], serve: [[OFFICIAL, 180]]});
  await loaded(page, OFFICIAL, 180);
  expect(await shown(page).evaluate(el => el.crossOrigin)).toBeNull();
  const official = requests.filter(request => request.url === OFFICIAL);
  expect(official).toHaveLength(1); expect(official[0].origin).toBeUndefined(); // a CORS request would carry an Origin header
  expect(await saved(page)).toEqual([legacyChat]);
  await expect(page.locator('#grid .card').first()).toHaveAttribute('data-url', 'https://chat.openai.com');
  expect(await iconCache(page)).toEqual({'chat.openai.com': OFFICIAL});
  await page.reload();
  await loaded(page, OFFICIAL, 180);
  expect(await saved(page)).toEqual([legacyChat]);
});

test('icon lookup falls back to a service for the current host, skips 1px images, and ends on the monogram', async ({page}) => {
  // Official file and chatgpt.com paths unavailable: the service is asked for chatgpt.com, not the legacy host.
  const google = 'https://www.google.com/s2/favicons?domain=chatgpt.com&sz=128';
  let requests = await icons(page, {links: [legacyChat], serve: [[/google\.com\/s2\/favicons\?domain=chatgpt\.com&/, 128]]});
  await loaded(page, google, 128);
  // Playwright drops every favicon.ico request without reporting it, so that path never appears in these lists.
  expect(requests.map(request => request.url).slice(0, 3)).toEqual([OFFICIAL, 'https://chatgpt.com/favicon-32x32.png', 'https://chatgpt.com/favicon-64x64.png']);
  expect(requests.some(request => /clearbit|faviconkit|chat\.openai\.com/.test(request.url))).toBe(false);
  expect(requests.every(request => request.origin === undefined)).toBe(true);
  // Every source either fails or returns a 1px blank: the letter monogram is shown and nothing is cached.
  await page.unrouteAll();
  requests = await icons(page, {links: [legacyChat], serve: [[/google\.com\/s2\/favicons/, 1], [/^https:\/\/icon\.horse\//, 1]]});
  await expect(page.locator('#grid .card .tile-letter')).toHaveText('C');
  await expect(page.locator('#grid .card .favicon img')).toHaveCount(0);
  expect(requests.at(-1).url).toBe('https://icon.horse/icon/chatgpt.com');
  expect(await iconCache(page)).toEqual({});
  // Other sites use their own host, and a custom icon is used as saved with no lookup at all.
  await page.unrouteAll();
  requests = await icons(page, {links: [{url: 'https://example.com/page', title: 'Example', icon: ''}, {url: 'https://chat.openai.com', title: 'Custom', icon: pixel}], serve: [['https://example.com/apple-touch-icon.png', 48]]});
  await loaded(page, 'https://example.com/apple-touch-icon.png', 48);
  await expect(page.locator('#grid .card .favicon img').nth(1)).toHaveAttribute('src', pixel);
  expect(requests.map(request => request.url)).toEqual(['32x32.png', '64x64.png', '96x96.png'].map(name => 'https://example.com/favicon-' + name).concat('https://example.com/apple-touch-icon.png'));
  expect(await iconCache(page)).toEqual({'example.com': 'https://example.com/apple-touch-icon.png'});
});

test('Refresh icon replaces a stale cached source; a cached source that fails or is blank is looked up again', async ({page}) => {
  // The generic letter image that used to be cached for this tile still loads, so only Refresh replaces it.
  await icons(page, {links: [legacyChat], cache: {'chat.openai.com': HORSE}, serve: [[HORSE, 256], [OFFICIAL, 180]]});
  await loaded(page, HORSE, 256);
  await page.locator('#grid .icon-btn').first().click();
  await page.getByRole('button', {name: 'Refresh icon', exact: true}).first().click();
  await loaded(page, OFFICIAL, 180);
  expect(await iconCache(page)).toEqual({'chat.openai.com': OFFICIAL});
  await page.reload();
  await loaded(page, OFFICIAL, 180);
  // Cached source no longer loads.
  await page.unrouteAll();
  await icons(page, {links: [legacyChat], cache: {'chat.openai.com': 'https://gone.example/icon.png'}, serve: [[OFFICIAL, 180]]});
  await loaded(page, OFFICIAL, 180);
  expect(await iconCache(page)).toEqual({'chat.openai.com': OFFICIAL});
  // Cached source now returns a blank pixel.
  await page.unrouteAll();
  await icons(page, {links: [legacyChat], cache: {'chat.openai.com': 'https://api.faviconkit.com/chat.openai.com/128'}, serve: [[/^https:\/\/api\.faviconkit\.com\//, 1], [OFFICIAL, 180]]});
  await loaded(page, OFFICIAL, 180);
  expect(await iconCache(page)).toEqual({'chat.openai.com': OFFICIAL});
});

// Picsum daily wallpaper. Every picsum.photos response is supplied by the test: this proves the
// dashboard's selection, persistence and failure handling, not the provider or a real browser session.
const picsumUrl = seed => `https://picsum.photos/seed/${seed}/1920/1080`;
const picsumShown = (page, seed) => expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${picsumUrl(seed)}")`);
const picsumSaved = page => page.evaluate(() => { const st = getSettings(); return {mode: st.mode, seed: st.picsumSeed, date: st.picsumDate}; });
async function startPicsum(page, {time = '2026-10-01T10:00:00', settings = {mode: 'picsum', color: '#123456'}} = {}) {
  await page.clock.setFixedTime(new Date(time));
  await setup(page);
  // The browser fetches a picture twice (preload, then paint), so `seeds` lists each distinct seed once, in order;
  // `requests` counts every fetch. hold(seed) may return a promise that delays that seed's first response.
  const net = {seeds: [], requests: 0, fail: () => false, hold: () => undefined};
  await page.route(/^https:\/\/picsum\.photos\/seed\//, async route => {
    const seed = decodeURIComponent(route.request().url().split('/')[4]);
    net.requests++;
    if (!net.seeds.includes(seed)) net.seeds.push(seed);
    await net.hold(seed);
    return net.fail(seed) ? route.abort() : route.fulfill({contentType: 'image/png', body: png(64)});
  });
  await page.evaluate(settings => setSettings({...getSettings(), ...settings}), settings);
  net.reload = async () => { await page.reload(); };
  // Resolves once no Picsum request has arrived for 400ms.
  net.quiet = async () => { let last; do { last = net.requests; await page.waitForTimeout(400); } while (net.requests !== last); };
  return net;
}

test('Picsum daily shows the picture for the local day, keeps it on a same-day reload, and changes on a new day', async ({page}) => {
  const net = await startPicsum(page);
  await net.reload();
  await picsumShown(page, 'daily-2026-10-01');
  // The stand-in picture is a real, decodable image, so "shown" means painted, not merely requested.
  expect(await page.evaluate(src => { const img = new Image(); img.src = src; return img.decode().then(() => img.naturalWidth, () => 'undecodable'); }, picsumUrl('daily-2026-10-01'))).toBe(64);
  await expect(page.locator('#wallpaper')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await expect.poll(() => picsumSaved(page)).toEqual({mode: 'picsum', seed: 'daily-2026-10-01', date: '2026-10-01'});
  await expect(page.locator('#changePictureBtn')).toBeVisible();
  await expect(page.locator('#changePictureBtn')).toHaveAccessibleName('Change picture');
  await expect(page.locator('#wallpaperStatus')).toBeHidden();
  await net.reload();
  await picsumShown(page, 'daily-2026-10-01');
  // Unrelated redraws do not request the picture again.
  await net.quiet();
  const before = net.requests;
  await page.evaluate(async () => { render(); render(); await applyWallpaper(); });
  await net.quiet();
  expect(net.requests).toBe(before);
  // Opening on the next day requests that day's picture and saves it.
  await page.clock.setFixedTime(new Date('2026-10-02T08:00:00'));
  await net.reload();
  await picsumShown(page, 'daily-2026-10-02');
  await expect.poll(() => picsumSaved(page)).toEqual({mode: 'picsum', seed: 'daily-2026-10-02', date: '2026-10-02'});
  expect(net.seeds).toEqual(['daily-2026-10-01', 'daily-2026-10-02']);
});

test.describe('Picsum in a timezone ahead of UTC', () => {
  test.use({timezoneId: 'Pacific/Auckland'});
  test('the daily seed uses the local calendar date, not the UTC date', async ({page}) => {
    const net = await startPicsum(page, {time: '2026-10-01T22:30:00Z'}); // already 2 October in Auckland
    await net.reload();
    await picsumShown(page, 'daily-2026-10-02');
    await expect.poll(() => picsumSaved(page)).toEqual({mode: 'picsum', seed: 'daily-2026-10-02', date: '2026-10-02'});
  });
});

test('Change picture loads a new seed each click, saves it, and a same-day reload keeps the manual choice', async ({page}) => {
  const net = await startPicsum(page);
  await net.reload();
  await picsumShown(page, 'daily-2026-10-01');
  await page.locator('#changePictureBtn').click();
  await expect.poll(() => net.seeds.length).toBe(2);
  const first = net.seeds[1];
  expect(first).toMatch(/^pick-2026-10-01-[a-z0-9]+$/);
  await picsumShown(page, first);
  await expect.poll(() => picsumSaved(page)).toEqual({mode: 'picsum', seed: first, date: '2026-10-01'});
  await page.locator('#changePictureBtn').click();
  await expect.poll(() => net.seeds.length).toBe(3);
  const second = net.seeds[2];
  expect(second).toMatch(/^pick-2026-10-01-[a-z0-9]+$/); expect(second).not.toBe(first);
  await picsumShown(page, second);
  await net.quiet();
  const beforeReload = net.requests;
  await net.reload();
  await picsumShown(page, second);
  expect(net.requests).toBeGreaterThan(beforeReload); // the reload asked for the saved manual seed again
  expect(net.seeds).toEqual(['daily-2026-10-01', first, second]);
  await expect.poll(() => picsumSaved(page)).toEqual({mode: 'picsum', seed: second, date: '2026-10-01'});
  // A manual choice lasts for its day only.
  await page.clock.setFixedTime(new Date('2026-10-02T08:00:00'));
  await net.reload();
  await picsumShown(page, 'daily-2026-10-02');
});

test('a failed Picsum picture keeps the working background, shows a message, is not saved, and can be retried', async ({page}) => {
  const net = await startPicsum(page);
  await net.reload();
  await picsumShown(page, 'daily-2026-10-01');
  let failing = true; net.fail = seed => failing && seed.startsWith('pick-');
  await page.locator('#changePictureBtn').click();
  const status = page.locator('#wallpaperStatus');
  await expect(status).toBeVisible();
  await expect(status).toContainText('Picsum could not supply a picture. The current background is kept.');
  await picsumShown(page, 'daily-2026-10-01');
  expect(await picsumSaved(page)).toEqual({mode: 'picsum', seed: 'daily-2026-10-01', date: '2026-10-01'});
  const failed = net.seeds.at(-1);
  expect(failed).toMatch(/^pick-/);
  // No automatic retry on unrelated redraws.
  await net.quiet();
  const before = net.requests;
  await page.evaluate(async () => { render(); await applyWallpaper(); });
  await net.quiet();
  expect(net.requests).toBe(before);
  await expect(status).toBeVisible();
  // Try again asks for the same candidate; once it loads it is shown and saved.
  failing = false;
  await page.getByRole('button', {name: 'Try again', exact: true}).click();
  await picsumShown(page, failed);
  expect(net.requests).toBeGreaterThan(before);
  await expect(status).toBeHidden();
  await expect.poll(() => picsumSaved(page)).toEqual({mode: 'picsum', seed: failed, date: '2026-10-01'});

  // A fresh load with no picture available keeps the solid colour and saves nothing.
  await page.evaluate(() => { const st = getSettings(); delete st.picsumSeed; delete st.picsumDate; setSettings(st); });
  net.fail = () => true;
  await net.reload();
  await expect(status).toBeVisible();
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', 'none');
  await expect(page.locator('#wallpaper')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  expect(await picsumSaved(page)).toEqual({mode: 'picsum', seed: undefined, date: undefined});
  net.fail = () => false;
  await page.getByRole('button', {name: 'Try again', exact: true}).click();
  await picsumShown(page, 'daily-2026-10-01');
  await expect(status).toBeHidden();

  // Coming from another mode, a failure leaves that mode's image on screen.
  await page.evaluate(pixel => { setSettings({...getSettings(), mode: 'local', value: pixel}); render(); }, pixel);
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
  await expect(page.locator('#changePictureBtn')).toBeHidden();
  net.fail = () => true;
  await page.evaluate(() => { const st = getSettings(); delete st.picsumSeed; delete st.picsumDate; setSettings({...st, mode: 'picsum', value: ''}); render(); });
  await expect(status).toBeVisible();
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
});

test('a slow Picsum response cannot replace a newer picture or a different wallpaper mode', async ({page}) => {
  const net = await startPicsum(page);
  await net.reload();
  await picsumShown(page, 'daily-2026-10-01');
  // Hold the first candidate, then ask for a second one.
  let releaseAll; const gate = new Promise(resolve => { releaseAll = resolve; });
  let holdNext = true;
  net.hold = seed => { if (holdNext && seed.startsWith('pick-')) { holdNext = false; return gate; } };
  await page.locator('#changePictureBtn').click();
  await expect.poll(() => net.seeds.length).toBe(2);
  const slow = net.seeds[1];
  await page.locator('#changePictureBtn').click();
  await expect.poll(() => net.seeds.length).toBe(3);
  const fast = net.seeds[2];
  await picsumShown(page, fast);
  const answered = page.waitForResponse(picsumUrl(slow));
  releaseAll(); await answered;
  await picsumShown(page, fast);
  expect(await picsumSaved(page)).toEqual({mode: 'picsum', seed: fast, date: '2026-10-01'});

  // Hold a candidate, switch to solid colour, then let the candidate arrive.
  let release2; const gate2 = new Promise(resolve => { release2 = resolve; }); let held = false;
  net.hold = seed => { if (!held && seed.startsWith('pick-')) { held = true; return gate2; } };
  await page.locator('#changePictureBtn').click();
  await expect.poll(() => net.seeds.length).toBe(4);
  const late = net.seeds[3];
  await page.evaluate(() => { setSettings({...getSettings(), mode: 'none', color: '#abcdef'}); render(); });
  const lateAnswered = page.waitForResponse(picsumUrl(late));
  release2(); await lateAnswered;
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', 'none');
  await expect(page.locator('#wallpaper')).toHaveCSS('background-color', 'rgb(171, 205, 239)');
  expect(await picsumSaved(page)).toEqual({mode: 'none', seed: fast, date: '2026-10-01'});
  await expect(page.locator('#changePictureBtn')).toBeHidden();
});

test('switching to and from Picsum in Settings keeps each mode\'s saved value; Bing stays disabled', async ({page}) => {
  const net = await startPicsum(page, {settings: {mode: 'local', value: pixel, color: '#123456'}});
  await net.reload();
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
  await expect(page.locator('#changePictureBtn')).toBeHidden();
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#wallpaperMode option[value="picsum"]')).toHaveText('Picsum daily (online photos)');
  await expect(page.locator('#wallpaperMode option[value="bing"]')).toBeDisabled();
  await expect(page.locator('#picsumHint')).toContainText('supplied online by picsum.photos');
  await page.locator('#wallpaperMode').selectOption('picsum');
  await expect(page.locator('#wallpaperValue')).toHaveValue('');
  await page.locator('#saveSettingsBtn').click();
  await picsumShown(page, 'daily-2026-10-01');
  await expect(page.locator('#changePictureBtn')).toBeVisible();
  expect(await page.evaluate(() => getSettings())).toMatchObject({mode: 'picsum', value: '', savedValues: {local: pixel}, picsumSeed: 'daily-2026-10-01', picsumDate: '2026-10-01'});
  await page.locator('#changePictureBtn').click();
  await expect.poll(() => net.seeds.length).toBe(2);
  const chosen = net.seeds[1];
  await picsumShown(page, chosen);
  // Back to the local image: its data returns, and the Picsum choice stays saved for a later switch back.
  await page.locator('#settingsBtn').click();
  await page.locator('#wallpaperMode').selectOption('local');
  await expect(page.locator('#wallpaperValue')).toHaveValue(pixel);
  await page.locator('#saveSettingsBtn').click();
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', `url("${pixel}")`);
  await expect(page.locator('#changePictureBtn')).toBeHidden();
  expect(await page.evaluate(() => getSettings())).toMatchObject({mode: 'local', value: pixel, picsumSeed: chosen, picsumDate: '2026-10-01'});
  await page.locator('#settingsBtn').click();
  await page.locator('#wallpaperMode').selectOption('picsum');
  await page.locator('#saveSettingsBtn').click();
  await picsumShown(page, chosen);
  expect(await saved(page)).toEqual(links);
});

test('backups keep the Picsum selection; older backups and invalid Picsum fields are handled', async ({page}) => {
  const net = await startPicsum(page);
  await net.reload();
  await page.locator('#changePictureBtn').click();
  await expect.poll(() => net.seeds.length).toBe(2);
  const chosen = net.seeds[1];
  await picsumShown(page, chosen);
  await expect.poll(() => picsumSaved(page)).toEqual({mode: 'picsum', seed: chosen, date: '2026-10-01'});
  const downloadPromise = page.waitForEvent('download'); await page.locator('#exportBtn').click();
  const file = await (await downloadPromise).path();
  const backup = JSON.parse(require('node:fs').readFileSync(file, 'utf8'));
  expect(backup.settings).toMatchObject({mode: 'picsum', picsumSeed: chosen, picsumDate: '2026-10-01'});
  expect(backup.links).toEqual(links);
  // Importing it over a different dashboard restores the same picture, and a reload keeps it.
  await page.evaluate(() => { setLinks([]); setSettings({mode: 'none', color: '#000000'}); render(); });
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', 'none');
  await page.locator('#importFile').setInputFiles(file);
  await picsumShown(page, chosen);
  expect(await saved(page)).toEqual(links);
  await net.reload();
  await picsumShown(page, chosen);
  // Imported on a later day, the same backup shows that day's picture.
  await page.clock.setFixedTime(new Date('2026-10-05T09:00:00'));
  await page.locator('#importFile').setInputFiles(file);
  await picsumShown(page, 'daily-2026-10-05');
  // A backup written before Picsum existed still imports and shows its own wallpaper.
  const older = {links: links.slice(0, 3), settings: {mode: 'none', value: '', color: '#654321', maxTiles: 6, colsMax: 3}};
  await page.locator('#importFile').setInputFiles({name: 'older.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(older))});
  await expect(page.locator('#wallpaper')).toHaveCSS('background-color', 'rgb(101, 67, 33)');
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', 'none');
  await expect(page.locator('#changePictureBtn')).toBeHidden();
  expect(await saved(page)).toEqual(links.slice(0, 3));
  // Malformed Picsum fields are rejected or ignored without sending them to the provider.
  const alerts = []; page.on('dialog', dialog => { alerts.push(dialog.message()); dialog.accept(); });
  const before = await page.evaluate(() => localStorage.getItem('startpage.settings.v1'));
  await page.locator('#importFile').setInputFiles({name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({links: [], settings: {mode: 'picsum', picsumSeed: 42}}))});
  await expect.poll(() => alerts.length).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('startpage.settings.v1'))).toBe(before);
  await page.locator('#importFile').setInputFiles({name: 'odd.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({links: links.slice(0, 3), settings: {mode: 'picsum', picsumSeed: '../../evil?x=1', picsumDate: '2026-10-05'}}))});
  await picsumShown(page, 'daily-2026-10-05');
  expect(net.seeds.some(seed => seed.includes('evil'))).toBe(false);
});

const site = {url: 'https://example.com/page', title: 'Example', group: 'Work', desc: '', icon: ''};
const sitePath = name => 'https://example.com/' + name;
for (const size of [16, 32]) test(`a ${size}x${size} icon is displayed and cached, with no later fallback or rediscovery`, async ({page}) => {
  // Found through lookup: the first path that answers is kept and nothing after it is tried.
  let requests = await icons(page, {links: [site], serve: [[sitePath('favicon-32x32.png'), size]]});
  await loaded(page, sitePath('favicon-32x32.png'), size);
  await expect(page.locator('#grid .card .tile-letter')).toHaveCount(0);
  expect(await iconCache(page)).toEqual({'example.com': sitePath('favicon-32x32.png')});
  expect(requests.map(request => request.url)).toEqual([sitePath('favicon-32x32.png')]);
  // Reload: shown straight from the cached source, with no other source requested.
  requests.length = 0;
  await page.reload();
  await loaded(page, sitePath('favicon-32x32.png'), size);
  expect([...new Set(requests.map(request => request.url))]).toEqual([sitePath('favicon-32x32.png')]);
  expect(await iconCache(page)).toEqual({'example.com': sitePath('favicon-32x32.png')});
  // A source cached by an earlier version stays in use at this size.
  await page.unrouteAll();
  const cached = 'https://icons.example.net/cached.png';
  requests = await icons(page, {links: [site], cache: {'example.com': cached}, serve: [[cached, size], [sitePath('favicon-32x32.png'), 64]]});
  await loaded(page, cached, size);
  expect([...new Set(requests.map(request => request.url))]).toEqual([cached]);
  expect(await iconCache(page)).toEqual({'example.com': cached});
});

test('1px and failed icon sources advance to the next valid source; exhausted sources show the monogram; custom icons are untouched', async ({page}) => {
  // 1px blank, then a failed request, then a real 16px icon.
  let requests = await icons(page, {links: [site], serve: [[sitePath('favicon-32x32.png'), 1], [sitePath('favicon-96x96.png'), 16]]});
  await loaded(page, sitePath('favicon-96x96.png'), 16);
  expect(requests.map(request => request.url)).toEqual(['32x32', '64x64', '96x96'].map(name => sitePath(`favicon-${name}.png`)));
  expect(await iconCache(page)).toEqual({'example.com': sitePath('favicon-96x96.png')});
  // A cached source that has become a 1px blank is replaced by the next valid source.
  await page.unrouteAll();
  const cached = 'https://icons.example.net/cached.png';
  await icons(page, {links: [site], cache: {'example.com': cached}, serve: [[cached, 1], [sitePath('apple-touch-icon.png'), 32]]});
  await loaded(page, sitePath('apple-touch-icon.png'), 32);
  expect(await iconCache(page)).toEqual({'example.com': sitePath('apple-touch-icon.png')});
  // Nothing usable anywhere: the letter monogram, and nothing cached.
  await page.unrouteAll();
  requests = await icons(page, {links: [site], serve: [[sitePath('favicon-64x64.png'), 1], [/^https:\/\/icons\.duckduckgo\.com\//, 1]]});
  await expect(page.locator('#grid .card .tile-letter')).toHaveText('E');
  await expect(page.locator('#grid .card .favicon img')).toHaveCount(0);
  expect(requests.at(-1).url).toBe('https://icon.horse/icon/example.com');
  expect(await iconCache(page)).toEqual({});
  // Custom icons, including a 1px one, are shown as saved with no lookup and no cache entry.
  await page.unrouteAll();
  const custom = 'https://cdn.example.org/my-icon.png';
  requests = await icons(page, {links: [{...site, icon: pixel}, {...site, url: 'https://example.org/', icon: custom}], serve: [[custom, 16]]});
  await expect(page.locator('#grid .card .favicon img').first()).toHaveAttribute('src', pixel);
  await loaded(page, custom, 16, 1);
  expect(requests.map(request => request.url)).toEqual([custom]);
  expect(await iconCache(page)).toEqual({});
  await expect(page.locator('#grid .card .tile-letter')).toHaveCount(0);
});

// Search providers: Google, Bing, DuckDuckGo and Perplexity. Destinations are intercepted, so these prove
// what the dashboard opens and sends, not how the real sites respond.
const providerOrder = page => page.locator('#providerGrid .search').evaluateAll(forms => forms.map(form => form.dataset.provider));
const DEFAULT_PROVIDERS = ['google', 'bing', 'duckduckgo', 'perplexity'];
const queries = ['two words', 'naïve café 東京 🚀', 'C++ & "quotes" #1 ?=/+% a+b'];
const engines = [['Google', '#googleForm', 'https://www.google.com/search'], ['Bing', '#bingForm', 'https://www.bing.com/search'], ['DuckDuckGo', '#ddgForm', 'https://duckduckgo.com/'], ['Perplexity', '#pxForm', 'https://www.perplexity.ai/search']];
for (const [name, formId, base] of engines) {
  test(`${name} opens the encoded query in a new tab and keeps the dashboard and its input`, async ({page}) => {
    await setup(page);
    await page.context().route(/^https:\/\/(www\.google\.com|www\.bing\.com|duckduckgo\.com|www\.perplexity\.ai)\//, route => route.fulfill({contentType: 'text/plain', body: 'destination'}));
    const input = page.locator(`${formId} input[name=q]`);
    const dashboard = page.url();
    for (const query of queries) {
      const opened = page.waitForEvent('popup');
      await input.fill(query); await input.press('Enter');
      const tab = await opened;
      await tab.waitForLoadState();
      const target = new URL(tab.url());
      expect(target.origin + target.pathname).toBe(base);
      expect(target.searchParams.get('q')).toBe(query);              // decodes to exactly what was typed
      expect([...target.searchParams.keys()]).toEqual(['q']);        // nothing else is sent
      expect(tab.url().slice(base.length)).toMatch(/^\?q=[A-Za-z0-9%+*._~-]*$/); // every other character is percent-encoded
      expect(page.url()).toBe(dashboard);
      await expect(input).toHaveValue(query);
      await expect(page.locator('#providerStatus')).toBeHidden();
      await tab.close();
    }
    // Empty or blank input opens nothing and says why.
    const pages = page.context().pages().length;
    for (const blank of ['', '   ']) {
      await input.fill(blank); await input.press('Enter');
      await expect(page.locator('#providerStatus')).toHaveText(name === 'Perplexity' ? 'Type a question for Perplexity first, or use Open Perplexity.' : `Type a search for ${name} first.`);
      await expect(page.locator('#providerStatus')).toHaveClass(/error/);
      await expect(input).toBeFocused();
    }
    expect(page.context().pages().length).toBe(pages);
  });
}

test('the search section has exactly four providers; removed boxes and their workflows are gone; tiles are untouched', async ({page}) => {
  // A brand-new profile, which includes the default ChatGPT shortcut tile.
  await page.route(/^https:\/\//, route => route.abort());
  await page.goto(url);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  expect(await providerOrder(page)).toEqual(DEFAULT_PROVIDERS);
  await expect(page.locator('#providerGrid .engine')).toHaveText(['Google', 'Bing', 'DuckDuckGo', 'Perplexity']);
  await expect(page.locator('#duckForm, #chatgptForm, #claudeForm, #duckPrompt, #chatgptPrompt, #claudePrompt')).toHaveCount(0);
  expect(await page.locator('#providerGrid').evaluate(el => el.textContent + el.innerHTML)).not.toMatch(/Duck\.ai|duck\.ai|ChatGPT|chatgpt|Claude|claude|Copy/);
  expect(await page.evaluate(() => typeof copyText)).toBe('undefined');
  // DuckDuckGo is an ordinary search form: its address, a field named q, and no companion or clipboard controls.
  const ddg = page.locator('#ddgForm');
  await expect(ddg).toHaveAttribute('action', 'https://duckduckgo.com/');
  await expect(ddg).toHaveAttribute('target', '_blank');
  await expect(ddg.locator('input[name=q]')).toHaveAttribute('placeholder', 'Search DuckDuckGo');
  const controls = await ddg.locator('button, a').evaluateAll(els => els.map(el => el.id || el.getAttribute('aria-label') || el.textContent));
  expect(controls).toEqual(['Reorder the DuckDuckGo box', 'dMic', 'Move earlier', 'Move later']); // grip, voice input and the move menu only
  await expect(page.locator('#googleForm')).toHaveAttribute('action', 'https://www.google.com/search');
  await expect(page.locator('#bingForm')).toHaveAttribute('action', 'https://www.bing.com/search');
  await expect(page.locator('#pxForm')).toHaveAttribute('action', 'https://www.perplexity.ai/search');
  await expect(page.locator('#pxOpen')).toHaveAttribute('href', 'https://www.perplexity.ai/');
  // Shortcut tiles, including ChatGPT, are exactly the defaults.
  await expect(page.locator('#grid .card .title')).toHaveText(['Amazon', 'Google News', 'Gmail', 'Facebook', 'LinkedIn', 'ChatGPT']);
  expect((await saved(page)).at(-1)).toEqual({url: 'https://chatgpt.com', title: 'ChatGPT', desc: 'Assistant', group: 'Work'});
  // Typing sends nothing; the companion buttons on Google and Bing still hand the query to Perplexity.
  await page.evaluate(() => { window.opened = []; window.open = (...args) => { window.opened.push(args); return {}; }; });
  await page.locator('#googleForm input[name=q]').fill('find this');
  expect(await page.evaluate(() => window.opened)).toEqual([]);
  await page.locator('#gAI').click();
  expect(await page.evaluate(() => window.opened)).toEqual([['https://www.perplexity.ai/search?q=find%20this', '_blank']]);
  // The visibility setting keeps its stored key and hides the two secondary providers.
  await page.locator('#settingsBtn').click();
  await expect(page.locator('label[for="showExtraSearch"]')).toHaveText('Show DuckDuckGo and Perplexity');
  await page.locator('#showExtraSearch').selectOption('no'); await page.locator('#saveSettingsBtn').click();
  await expect(page.locator('#ddgForm')).toBeHidden(); await expect(page.locator('#pxForm')).toBeHidden();
  await expect(page.locator('#googleForm')).toBeVisible(); await expect(page.locator('#bingForm')).toBeVisible();
  expect(await page.evaluate(() => getSettings().showExtraSearch)).toBe('no');
  await page.reload();
  await expect(page.locator('#providerGrid .search:visible')).toHaveCount(2);
  await expect(page.locator('#grid .card .title')).toHaveText(['Amazon', 'Google News', 'Gmail', 'Facebook', 'LinkedIn', 'ChatGPT']);
});

async function dragProvider(page, from, to, {release = true} = {}) {
  const handle = await page.locator(`#providerGrid .search[data-provider="${from}"] .drag-handle`).boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 12, handle.y + handle.height / 2 + 6);
  const target = await page.locator(`#providerGrid .search[data-provider="${to}"]`).boundingBox();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, {steps: 10});
  if (release) await page.mouse.up();
}

test('provider boxes reorder by their grip, keep what is typed, persist, and leave tile order alone', async ({page}) => {
  await setup(page);
  expect(await providerOrder(page)).toEqual(DEFAULT_PROVIDERS);
  expect(await page.evaluate(() => getSettings().providerOrder)).toBeUndefined();
  await expect(page.locator('#ddgForm .drag-handle')).toHaveAccessibleName('Reorder the DuckDuckGo box');
  const typed = {google: 'g text', bing: 'b text', duckduckgo: 'd text', perplexity: 'p text'};
  for (const [id, text] of Object.entries(typed)) await page.locator(`#providerGrid .search[data-provider="${id}"] input[type=text]`).fill(text);
  const values = () => page.locator('#providerGrid .search').evaluateAll(forms => Object.fromEntries(forms.map(form => [form.dataset.provider, form.querySelector('input[type=text]').value])));
  // Dragging from the input, the label or a control does not reorder; text selection in the input still works.
  for (const selector of ['input[type=text]', '.engine', '.mic']) {
    const from = await page.locator(`#googleForm ${selector}`).boundingBox(), to = await page.locator('#pxForm').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {steps: 6}); await page.mouse.up();
    expect(await providerOrder(page)).toEqual(DEFAULT_PROVIDERS);
  }
  const box = await page.locator('#googleForm input[type=text]').boundingBox();
  await page.mouse.move(box.x + 4, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, {steps: 4}); await page.mouse.up();
  expect(await page.locator('#googleForm input[type=text]').evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd))).toBe('g text');
  // Forwards across rows, then backwards.
  await dragProvider(page, 'google', 'perplexity');
  expect(await providerOrder(page)).toEqual(['bing', 'duckduckgo', 'perplexity', 'google']);
  await expect(page.locator('#providerGrid .reordering')).toHaveCount(0);
  await expect(page.locator('#providerGrid .provider-menu:visible')).toHaveCount(0); // a drag is not a click on the grip
  expect(await values()).toEqual(typed);
  expect(await page.evaluate(() => getSettings().providerOrder)).toEqual(['bing', 'duckduckgo', 'perplexity', 'google']);
  await dragProvider(page, 'perplexity', 'bing');
  expect(await providerOrder(page)).toEqual(['perplexity', 'bing', 'duckduckgo', 'google']);
  expect(await values()).toEqual(typed);
  expect(page.context().pages()).toHaveLength(1); // reordering opens nothing
  // After a drag the grip still answers an ordinary click.
  await page.locator('#pxForm .drag-handle').click();
  await expect(page.locator('#pxForm .provider-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  // A cancelled drag puts everything back and saves nothing.
  await dragProvider(page, 'perplexity', 'google', {release: false});
  await expect(page.locator('#pxForm')).toHaveClass(/reordering/);
  await page.locator('#pxForm .drag-handle').dispatchEvent('pointercancel', {pointerId: 1});
  await page.mouse.up();
  await expect(page.locator('#providerGrid .reordering')).toHaveCount(0);
  expect(await providerOrder(page)).toEqual(['perplexity', 'bing', 'duckduckgo', 'google']);
  expect(await page.evaluate(() => getSettings().providerOrder)).toEqual(['perplexity', 'bing', 'duckduckgo', 'google']);
  expect(await page.locator('#providerGrid .search').evaluateAll(forms => forms.every(form => form.style.order === ''))).toBe(true);
  // The order survives a reload; shortcut tiles are untouched throughout.
  await page.reload();
  expect(await providerOrder(page)).toEqual(['perplexity', 'bing', 'duckduckgo', 'google']);
  expect(await saved(page)).toEqual(links);
  await drag(page, 0, 2);
  expect(await providerOrder(page)).toEqual(['perplexity', 'bing', 'duckduckgo', 'google']);
  expect((await saved(page)).slice(0, 3).map(link => link.title)).toEqual(['Tile 1', 'Tile 2', 'Tile 0']);
});

test('provider boxes can be moved with the keyboard: menu actions and arrow keys', async ({page}) => {
  await setup(page);
  const handle = page.locator('#bingForm .drag-handle');
  await page.locator('#bingForm input[type=text]').fill('typed in Bing');
  await handle.focus();
  await expect(handle).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(handle).toHaveAttribute('aria-expanded', 'true');
  const earlier = page.locator('#bingForm').getByRole('button', {name: 'Move earlier', exact: true}), later = page.locator('#bingForm').getByRole('button', {name: 'Move later', exact: true});
  await expect(earlier).toBeVisible(); await expect(later).toBeVisible();
  await later.focus(); await page.keyboard.press('Enter');
  expect(await providerOrder(page)).toEqual(['google', 'duckduckgo', 'bing', 'perplexity']);
  await expect(later).toBeFocused();
  await expect(page.locator('#providerOrderStatus')).toHaveText('Bing moved to position 3 of 4.');
  await page.keyboard.press('Enter');
  expect(await providerOrder(page)).toEqual(['google', 'duckduckgo', 'perplexity', 'bing']);
  // At the last position Move later is disabled and focus returns to the grip.
  await expect(later).toBeDisabled(); await expect(handle).toBeFocused();
  await earlier.focus(); await page.keyboard.press('Space');
  await page.keyboard.press('Space'); await page.keyboard.press('Space');
  expect(await providerOrder(page)).toEqual(['bing', 'google', 'duckduckgo', 'perplexity']);
  await expect(earlier).toBeDisabled(); await expect(handle).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(handle).toHaveAttribute('aria-expanded', 'false'); await expect(earlier).toBeHidden();
  // Arrow keys on the grip move the box without opening the menu.
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown');
  expect(await providerOrder(page)).toEqual(['google', 'duckduckgo', 'bing', 'perplexity']);
  await expect(handle).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  expect(await providerOrder(page)).toEqual(['bing', 'google', 'duckduckgo', 'perplexity']);
  await expect(page.locator('#bingForm input[type=text]')).toHaveValue('typed in Bing');
  expect(await page.evaluate(() => getSettings().providerOrder)).toEqual(['bing', 'google', 'duckduckgo', 'perplexity']);
  await page.reload();
  expect(await providerOrder(page)).toEqual(['bing', 'google', 'duckduckgo', 'perplexity']);
  // With the secondary providers hidden, a move swaps the two visible boxes and the hidden ones keep their places.
  await page.evaluate(() => { setSettings({...getSettings(), showExtraSearch: 'no', providerOrder: ['duckduckgo', 'google', 'perplexity', 'bing']}); render(); });
  await expect(page.locator('#providerGrid .search:visible')).toHaveCount(2);
  await page.locator('#googleForm .drag-handle').focus(); await page.keyboard.press('ArrowRight');
  expect(await providerOrder(page)).toEqual(['duckduckgo', 'bing', 'perplexity', 'google']);
  await expect(page.locator('#providerOrderStatus')).toHaveText('Google moved to position 2 of 2.');
  expect(await saved(page)).toEqual(links);
});

test('orders saved by the six-box version are migrated: Duck.ai becomes DuckDuckGo, ChatGPT and Claude are dropped', async ({page}) => {
  await setup(page);
  const stored = order => page.evaluate(order => { setSettings({...getSettings(), providerOrder: order}); }, order);
  const cases = [
    [['claude', 'chatgpt', 'google', 'bing', 'duck', 'perplexity'], ['google', 'bing', 'duckduckgo', 'perplexity']],
    [['duck', 'perplexity', 'chatgpt', 'google', 'claude', 'bing'], ['duckduckgo', 'perplexity', 'google', 'bing']],
    [['bing', 'claude', 'duck'], ['bing', 'duckduckgo', 'google', 'perplexity']],                       // providers missing from the saved order follow in default order
    [['duckduckgo', 'duck', 'google', 'duckduckgo'], ['duckduckgo', 'google', 'bing', 'perplexity']],   // each provider exactly once
    [['perplexity', 'retired-engine', 'google', 'perplexity'], ['perplexity', 'google', 'bing', 'duckduckgo']],
    [['chatgpt', 'claude'], DEFAULT_PROVIDERS],
    [[], DEFAULT_PROVIDERS],
  ];
  for (const [savedOrder, expected] of cases) {
    await stored(savedOrder);
    await page.reload();
    expect(await providerOrder(page), JSON.stringify(savedOrder)).toEqual(expected);
    await expect(page.locator('#providerGrid .search')).toHaveCount(4);
    // Reading an old order does not rewrite it; the next reorder stores only supported ids.
    expect(await page.evaluate(() => getSettings().providerOrder)).toEqual(savedOrder);
  }
  await stored(['duck', 'perplexity', 'chatgpt', 'google', 'claude', 'bing']);
  await page.reload();
  await page.locator('#ddgForm .drag-handle').focus(); await page.keyboard.press('ArrowRight');
  expect(await providerOrder(page)).toEqual(['perplexity', 'duckduckgo', 'google', 'bing']);
  expect(await page.evaluate(() => getSettings().providerOrder)).toEqual(['perplexity', 'duckduckgo', 'google', 'bing']);
  // Other settings saved alongside the old order are untouched, and so are the tiles.
  expect(await page.evaluate(() => getSettings())).toMatchObject({mode: 'none', color: '#123456', maxTiles: 6, colsMax: 3});
  expect(await saved(page)).toEqual(links);
});

test('provider order travels in backups; six-box and older backups, unknown ids and invalid values are handled', async ({page}) => {
  await setup(page);
  const alerts = []; page.on('dialog', dialog => { alerts.push(dialog.message()); dialog.accept(); });
  const importBackup = backup => page.locator('#importFile').setInputFiles({name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))});
  // A backup written before provider ordering existed: the default order.
  expect(await providerOrder(page)).toEqual(DEFAULT_PROVIDERS);
  await importBackup({links, settings: {mode: 'none', color: '#123456', maxTiles: 6, colsMax: 3}});
  await expect(page.locator('#wallpaper')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  expect(await providerOrder(page)).toEqual(DEFAULT_PROVIDERS);
  // Export carries the order; importing it elsewhere restores it.
  await page.evaluate(() => { setSettings({...getSettings(), providerOrder: ['perplexity', 'duckduckgo', 'google', 'bing']}); render(); });
  expect(await providerOrder(page)).toEqual(['perplexity', 'duckduckgo', 'google', 'bing']);
  const downloadPromise = page.waitForEvent('download'); await page.locator('#exportBtn').click();
  const file = await (await downloadPromise).path();
  const backup = JSON.parse(require('node:fs').readFileSync(file, 'utf8'));
  expect(backup.settings.providerOrder).toEqual(['perplexity', 'duckduckgo', 'google', 'bing']);
  expect(backup.links).toEqual(links);
  await page.evaluate(() => { const st = getSettings(); delete st.providerOrder; setSettings(st); setLinks([]); render(); });
  expect(await providerOrder(page)).toEqual(DEFAULT_PROVIDERS);
  await page.locator('#importFile').setInputFiles(file);
  await expect.poll(() => providerOrder(page)).toEqual(['perplexity', 'duckduckgo', 'google', 'bing']);
  expect(await saved(page)).toEqual(links);
  await page.reload();
  expect(await providerOrder(page)).toEqual(['perplexity', 'duckduckgo', 'google', 'bing']);
  // A backup written by the six-box version, with its tiles (including a ChatGPT tile) and the old visibility setting.
  const chatTile = {url: 'https://chatgpt.com', title: 'ChatGPT', desc: 'Assistant', group: 'Work', icon: pixel};
  await importBackup({links: [...links.slice(0, 2), chatTile], settings: {providerOrder: ['claude', 'duck', 'chatgpt', 'bing', 'perplexity', 'google'], showExtraSearch: 'yes', maxTiles: 6}});
  await expect.poll(() => providerOrder(page)).toEqual(['duckduckgo', 'bing', 'perplexity', 'google']);
  await expect(page.locator('#providerGrid .search:visible')).toHaveCount(4);
  expect(await saved(page)).toEqual([...links.slice(0, 2), chatTile]);
  await expect(page.locator('#grid .card .title')).toHaveText(['Tile 0', 'Tile 1', 'ChatGPT']);
  await page.reload();
  expect(await providerOrder(page)).toEqual(['duckduckgo', 'bing', 'perplexity', 'google']);
  // An unknown id and a duplicate: known ids keep their order and the rest follow.
  await importBackup({links, settings: {providerOrder: ['perplexity', 'retired-engine', 'google', 'perplexity']}});
  await expect.poll(() => providerOrder(page)).toEqual(['perplexity', 'google', 'bing', 'duckduckgo']);
  expect(alerts).toEqual([]);
  // A malformed order is rejected and nothing changes.
  const before = await page.evaluate(() => localStorage.getItem('startpage.settings.v1'));
  for (const providerOrder of ['google,bing', [1, 2], {google: 0}]) await importBackup({links: [], settings: {providerOrder}});
  await expect.poll(() => alerts.length).toBe(3);
  expect(await page.evaluate(() => localStorage.getItem('startpage.settings.v1'))).toBe(before);
  expect(await providerOrder(page)).toEqual(['perplexity', 'google', 'bing', 'duckduckgo']);
  expect(await saved(page)).toEqual(links);
});
