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

// Mocked routing: the clipboard and window.open are replaced, so this proves the dashboard's behaviour, not Duck.ai's.
test('Duck.ai row copies the prompt, opens Duck.ai, keeps the text, and reports failures (mocked)', async ({page}) => {
  await setup(page);
  const external = []; page.on('request', request => { if (/duck\.ai|duckduckgo\.com\/\?/.test(request.url())) external.push(request.url()); });
  await page.evaluate(() => {
    window.opened = []; window.copied = []; window.openResult = {};
    window.open = (...args) => { window.opened.push(args); return window.openResult; };
    Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText: async text => { window.copied.push(text); }}});
  });
  const form = page.locator('#duckForm'), prompt = page.locator('#duckPrompt'), status = page.locator('#duckStatus');
  await expect(form.locator('.engine')).toHaveText('Duck.ai');
  await expect(prompt).toHaveAttribute('placeholder', 'Prompt to copy for Duck.ai');
  await expect(page.locator('#duckCopyOpen')).toHaveAccessibleName('Copy prompt and open Duck.ai');
  await expect(page.locator('#duckOpen')).toHaveAccessibleName('Open Duck.ai without a prompt');
  await expect(page.locator('#duckOpen')).toHaveAttribute('href', 'https://duck.ai/');
  await expect(page.locator('#duckOpen')).toHaveAttribute('target', '_blank');
  expect(await form.evaluate(el => el.innerHTML)).not.toMatch(/Perplexity|DuckDuckGo|name="q"/);
  await expect(page.locator('#ddgForm, #dAI')).toHaveCount(0);
  await expect(status).toBeHidden();
  const snapshot = () => page.evaluate(() => ({opened: window.opened, copied: window.copied}));

  await prompt.fill('plan my week'); await prompt.press('Enter');
  await expect(status).toHaveText(/Prompt copied and Duck\.ai opened in a new tab\. Paste the prompt there/);
  await expect(status).not.toHaveClass(/error/);
  expect(await snapshot()).toEqual({opened:[['https://duck.ai/','_blank']], copied:['plan my week']});
  await expect(prompt).toHaveValue('plan my week');
  await page.locator('#duckCopyOpen').click();
  expect((await snapshot()).opened).toHaveLength(2);

  // Empty prompt: nothing is copied or opened, and the message says so.
  await prompt.fill('   '); await page.locator('#duckCopyOpen').click();
  await expect(status).toHaveText(/Type a prompt first/); await expect(status).toHaveClass(/error/);
  expect((await snapshot()).opened).toHaveLength(2);

  // Popup blocked: the prompt was copied and the message points to the direct link.
  await page.evaluate(() => { window.openResult = null; });
  await prompt.fill('blocked tab'); await prompt.press('Enter');
  await expect(status).toHaveText(/Prompt copied, but the browser blocked the new tab\. Use Open Duck\.ai/);
  await expect(prompt).toHaveValue('blocked tab');

  // Clipboard failure: Duck.ai is not opened, the text stays selected in the box, and the failure is visible.
  await page.evaluate(() => {
    window.openResult = {}; window.opened = [];
    navigator.clipboard.writeText = async () => { throw new Error('denied'); };
    document.execCommand = () => false;
  });
  await prompt.fill('keep me'); await prompt.press('Enter');
  await expect(status).toHaveText(/Could not copy the prompt\. It is still in the box/); await expect(status).toHaveClass(/error/);
  expect((await snapshot()).opened).toEqual([]);
  await expect(prompt).toHaveValue('keep me');
  expect(await prompt.evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd))).toBe('keep me');
  await expect(page.locator('#duckOpen')).toBeVisible();

  // Other providers are routed as before.
  await expect(page.locator('#googleForm')).toHaveAttribute('action', 'https://www.google.com/search');
  await expect(page.locator('#bingForm')).toHaveAttribute('action', 'https://www.bing.com/search');
  await expect(page.locator('#pxForm')).toHaveAttribute('action', 'https://www.perplexity.ai/search');
  await page.locator('#googleForm input[name=q]').fill('find this'); await page.locator('#gAI').click();
  expect((await snapshot()).opened).toEqual([['https://www.perplexity.ai/search?q=find%20this','_blank']]);
  // The secondary row setting still hides the Duck.ai and Perplexity rows.
  await page.evaluate(() => { setSettings({...getSettings(), showExtraSearch:'no'}); render(); });
  await expect(form).toBeHidden(); await expect(page.locator('#pxForm')).toBeHidden();
  expect(external).toEqual([]);
});

// Real clipboard in Linux Chromium, with only window.open replaced. Not evidence about Duck.ai itself.
for (const origin of ['file', 'http']) test(`Duck.ai prompt reaches the real clipboard from a ${origin} page`, async ({page}) => {
  await page.route(/^https:\/\//, route => route.abort());
  if (origin === 'http') await page.route('http://dashboard.test/**', route => route.fulfill({contentType:'text/html', body:require('node:fs').readFileSync('index.html', 'utf8')}));
  await page.goto(origin === 'http' ? 'http://dashboard.test/' : url);
  expect(await page.evaluate(() => window.isSecureContext)).toBe(origin === 'file');
  await page.evaluate(() => { window.opened = []; window.open = (...args) => { window.opened.push(args); return {}; }; });
  await page.locator('#duckPrompt').fill(`real clipboard from ${origin}`); await page.locator('#duckPrompt').press('Enter');
  await expect(page.locator('#duckStatus')).toHaveText(/Prompt copied and Duck\.ai opened/);
  expect(await page.evaluate(() => window.opened)).toEqual([['https://duck.ai/','_blank']]);
  const target = page.locator('#googleForm input[name=q]');
  await target.click(); await page.keyboard.press('ControlOrMeta+V');
  await expect(target).toHaveValue(`real clipboard from ${origin}`);
});

// Icon lookup. Every response here is supplied by the test; nothing is fetched from the real services.
const zlib = require('node:zlib');
function png(size) {
  const crc = buf => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); const out = Buffer.alloc(body.length + 8); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), body.length + 4); return out; };
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 0; // 8-bit greyscale
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.alloc((size + 1) * size, 0x80))), chunk('IEND', Buffer.alloc(0))]);
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
const loaded = async (page, src) => { await expect(shown(page)).toHaveAttribute('src', src); await expect.poll(() => shown(page).evaluate(el => el.complete && el.naturalWidth)).toBeGreaterThanOrEqual(32); };
const iconCache = page => page.evaluate(() => JSON.parse(localStorage.getItem('startpage.iconcache.v1') || '{}'));

test('legacy chat.openai.com tile shows the official ChatGPT icon without CORS and keeps its saved URL', async ({page}) => {
  const requests = await icons(page, {links: [legacyChat], serve: [[OFFICIAL, 180]]});
  await loaded(page, OFFICIAL);
  expect(await shown(page).evaluate(el => el.crossOrigin)).toBeNull();
  const official = requests.filter(request => request.url === OFFICIAL);
  expect(official).toHaveLength(1); expect(official[0].origin).toBeUndefined(); // a CORS request would carry an Origin header
  expect(await saved(page)).toEqual([legacyChat]);
  await expect(page.locator('#grid .card').first()).toHaveAttribute('data-url', 'https://chat.openai.com');
  expect(await iconCache(page)).toEqual({'chat.openai.com': OFFICIAL});
  await page.reload();
  await loaded(page, OFFICIAL);
  expect(await saved(page)).toEqual([legacyChat]);
});

test('icon lookup falls back to a service for the current host, skips placeholders, and ends on the monogram', async ({page}) => {
  // Official file and chatgpt.com paths unavailable: the service is asked for chatgpt.com, not the legacy host.
  const google = 'https://www.google.com/s2/favicons?domain=chatgpt.com&sz=128';
  let requests = await icons(page, {links: [legacyChat], serve: [[/google\.com\/s2\/favicons\?domain=chatgpt\.com&/, 128]]});
  await loaded(page, google);
  // Playwright drops every favicon.ico request without reporting it, so that path never appears in these lists.
  expect(requests.map(request => request.url).slice(0, 3)).toEqual([OFFICIAL, 'https://chatgpt.com/favicon-32x32.png', 'https://chatgpt.com/favicon-64x64.png']);
  expect(requests.some(request => /clearbit|faviconkit|chat\.openai\.com/.test(request.url))).toBe(false);
  expect(requests.every(request => request.origin === undefined)).toBe(true);
  // A 16px "no icon" image and a 1px blank are rejected; with nothing better, the letter monogram is shown and nothing is cached.
  await page.unrouteAll();
  requests = await icons(page, {links: [legacyChat], serve: [[/google\.com\/s2\/favicons/, 16], [/^https:\/\/icon\.horse\//, 1]]});
  await expect(page.locator('#grid .card .tile-letter')).toHaveText('C');
  await expect(page.locator('#grid .card .favicon img')).toHaveCount(0);
  expect(requests.at(-1).url).toBe('https://icon.horse/icon/chatgpt.com');
  expect(await iconCache(page)).toEqual({});
  // Other sites use their own host, and a custom icon is used as saved with no lookup at all.
  await page.unrouteAll();
  requests = await icons(page, {links: [{url: 'https://example.com/page', title: 'Example', icon: ''}, {url: 'https://chat.openai.com', title: 'Custom', icon: pixel}], serve: [['https://example.com/apple-touch-icon.png', 48]]});
  await loaded(page, 'https://example.com/apple-touch-icon.png');
  await expect(page.locator('#grid .card .favicon img').nth(1)).toHaveAttribute('src', pixel);
  expect(requests.map(request => request.url)).toEqual(['32x32.png', '64x64.png', '96x96.png'].map(name => 'https://example.com/favicon-' + name).concat('https://example.com/apple-touch-icon.png'));
  expect(await iconCache(page)).toEqual({'example.com': 'https://example.com/apple-touch-icon.png'});
});

test('Refresh icon replaces a stale cached source; a cached source that fails or is blank is looked up again', async ({page}) => {
  // The generic letter image that used to be cached for this tile still loads, so only Refresh replaces it.
  await icons(page, {links: [legacyChat], cache: {'chat.openai.com': HORSE}, serve: [[HORSE, 256], [OFFICIAL, 180]]});
  await loaded(page, HORSE);
  await page.locator('#grid .icon-btn').first().click();
  await page.getByRole('button', {name: 'Refresh icon', exact: true}).first().click();
  await loaded(page, OFFICIAL);
  expect(await iconCache(page)).toEqual({'chat.openai.com': OFFICIAL});
  await page.reload();
  await loaded(page, OFFICIAL);
  // Cached source no longer loads.
  await page.unrouteAll();
  await icons(page, {links: [legacyChat], cache: {'chat.openai.com': 'https://gone.example/icon.png'}, serve: [[OFFICIAL, 180]]});
  await loaded(page, OFFICIAL);
  expect(await iconCache(page)).toEqual({'chat.openai.com': OFFICIAL});
  // Cached source now returns a blank pixel.
  await page.unrouteAll();
  await icons(page, {links: [legacyChat], cache: {'chat.openai.com': 'https://api.faviconkit.com/chat.openai.com/128'}, serve: [[/^https:\/\/api\.faviconkit\.com\//, 1], [OFFICIAL, 180]]});
  await loaded(page, OFFICIAL);
  expect(await iconCache(page)).toEqual({'chat.openai.com': OFFICIAL});
});
