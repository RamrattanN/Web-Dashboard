// Visual review: layout, focus, contrast and dialog checks, plus screenshots written to visual-review/
// for human inspection. Screenshots are evidence to look at, not pixel assertions.
const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const url = pathToFileURL(path.resolve('index.html')).href;
const out = path.resolve('visual-review');
fs.mkdirSync(out, {recursive: true});
const shot = (page, name, options = {}) => page.screenshot({path: path.join(out, name + '.png'), ...options});

const viewports = {desktop: {width: 1440, height: 900}, tablet: {width: 820, height: 1100}, phone: {width: 375, height: 740}};
const titles = ['Mail', 'Calendar', 'A very long saved link title that must truncate cleanly', 'Banking', 'Docs', 'News', 'Maps', 'Photos', 'Weather'];
const links = titles.map((title, i) => ({url: `https://example.com/${i}`, title, group: ['Work', 'Personal', 'Finance'][i % 3], desc: i % 4 === 3 ? '' : `Description for ${title.toLowerCase()} with enough words to need clamping`, icon: ''}));

// A flat grey PNG standing in for a Picsum photo.
const zlib = require('node:zlib');
function png(size) {
  const crc = buf => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); const o = Buffer.alloc(body.length + 8); o.writeUInt32BE(data.length, 0); body.copy(o, 4); o.writeUInt32BE(crc(body), body.length + 4); return o; };
  // Each row is a filter-type byte of 0 followed by one grey byte per pixel; any other filter byte makes the image undecodable.
  const rows = Buffer.alloc((size + 1) * size, 0x70); for (let y = 0; y < size; y++) rows[y * (size + 1)] = 0;
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

// Reduced motion keeps computed colours and screenshots free of half-finished transitions.
test.use({contextOptions: {reducedMotion: 'reduce'}});

// `state` is null for a brand-new profile, a settings object, or a function producing one in the page.
async function open(page, state) {
  await page.route(/^https:\/\//, route => route.abort());
  await page.route(/^https:\/\/picsum\.photos\/seed\//, route => route.fulfill({contentType: 'image/png', body: png(64)}));
  await page.goto(url);
  const settings = typeof state === 'function' ? await state(page) : state;
  await page.evaluate(({links, settings}) => {
    localStorage.clear();
    if (settings) {
      localStorage.setItem('startpage.links.v1', JSON.stringify(links));
      localStorage.setItem('startpage.settings.v1', JSON.stringify({title: 'Dashboard Test', ...settings}));
    }
  }, {links, settings});
  await page.reload();
  await expect(page.locator('#grid .card').first()).toBeVisible();
  // No favicon can load, so every tile settles on its letter monogram before any screenshot.
  await expect(page.locator('#grid .card .tile-letter')).toHaveCount(await page.locator('#grid .card').count());
}
// A busy image with very dark and very bright regions, standing in for an arbitrary wallpaper.
const photo = page => page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 400;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 640, 400);
  sky.addColorStop(0, '#04101f'); sky.addColorStop(0.5, '#c2410c'); sky.addColorStop(1, '#fef9c3');
  g.fillStyle = sky; g.fillRect(0, 0, 640, 400);
  for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)'; g.beginPath(); g.arc((i * 97) % 640, (i * 53) % 400, 12 + (i % 5) * 9, 0, 7); g.fill(); }
  return c.toDataURL('image/jpeg', 0.7);
});
const states = {
  fresh: null,
  dark: {mode: 'none', color: '#0b1120'},
  photo: async page => ({mode: 'local', value: await photo(page)}),
  picsum: {mode: 'picsum', color: '#0b1120'},
};

for (const [size, viewport] of Object.entries(viewports)) for (const state of Object.keys(states)) {
  test(`visual review: ${size} ${state} page has no horizontal overflow`, async ({page}) => {
    await page.setViewportSize(viewport);
    await open(page, states[state]);
    if (state === 'photo') await expect(page.locator('#wallpaper')).toHaveCSS('background-image', /^url\("data:image\/jpeg/);
    if (state === 'picsum') await expect(page.locator('#wallpaper')).toHaveCSS('background-image', /^url\("https:\/\/picsum\.photos\/seed\/daily-/);
    await expect(page.locator('#changePictureBtn')).toBeVisible({visible: state === 'picsum'});
    await shot(page, `${size}-${state}`, {fullPage: true});
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    const header = await page.locator('.app-header').boundingBox();
    expect(header.width).toBeGreaterThanOrEqual(width - 1);
    expect(await page.locator('#grid .card').first().evaluate(el => getComputedStyle(el).transitionDuration)).toMatch(/^0s/);
    for (const id of ['#addBtn', '#importBtn', '#exportBtn', '#settingsBtn', '#logo'].concat(state === 'picsum' ? ['#changePictureBtn'] : [])) {
      const box = await page.locator(id).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  });
}

test('visual review: fresh profiles get the pale surface; existing profiles keep their wallpaper', async ({page}) => {
  await open(page, null);
  await expect(page.locator('#wallpaper')).toHaveCSS('background-color', 'rgb(243, 247, 250)');
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', 'none');
  expect(await page.evaluate(() => getSettings().mode)).toBe('none');
  // Links saved by an earlier version, settings never saved: the previous default colour is kept.
  await page.evaluate(links => { localStorage.clear(); localStorage.setItem('startpage.links.v1', JSON.stringify(links)); }, links);
  await page.reload();
  await expect(page.locator('#wallpaper')).toHaveCSS('background-color', 'rgb(11, 17, 32)');
  expect(await page.evaluate(() => localStorage.getItem('startpage.settings.v1'))).toBeNull();
  // Saved settings are shown as saved.
  await open(page, {mode: 'none', color: '#7c2d12', title: 'Kept title', groupFilter: 'Work', lockLayout: 'yes', maxTiles: 2});
  await expect(page.locator('#wallpaper')).toHaveCSS('background-color', 'rgb(124, 45, 18)');
  await expect(page.locator('#logo')).toHaveText('Kept title');
  await expect(page.locator('#grid .card')).toHaveCount(2);
  await expect(page.locator('#groupBar .pill.active')).toHaveText('Work');
  await expect(page.locator('#grid .card.locked')).toHaveCount(2);
});

test('visual review: text contrast meets 4.5:1 on pale, dark and image wallpapers', async ({page}) => {
  for (const state of Object.keys(states)) {
    await open(page, states[state]);
    await page.locator('#groupBar .pill').nth(1).click();
    const results = await page.evaluate(() => {
      const parse = c => c.match(/[\d.]+/g).map(Number);
      const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const surface = el => { for (let n = el; n; n = n.parentElement) { const b = parse(getComputedStyle(n).backgroundColor); if (b.length < 4 || b[3] === 1) return b; if (b[3] > 0) return null; } return null; };
      const ratio = (fg, bg) => { const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); };
      const checks = {'.tip': null, '.card .title': null, '.card .desc': null, '.pill:not(.active)': null, '.pill.active': null, '.search .engine': null, '.search input': '::placeholder', '.header-action.with-label span': null, '.action-btn span': null, '#duckStatus': null, '#wallpaperStatus span': null, '#wallpaperRetry': null, '#picsumHint': null};
      return [...Object.entries(checks), ['#duckStatus', 'error']].map(([selector, pseudo]) => {
        const el = document.querySelector(selector); if (!el) return {selector, missing: true};
        if (pseudo === 'error') { el.classList.add('error'); pseudo = null; selector += '.error'; }
        const bg = surface(el);
        // The header label sits on the navy gradient; compare with its lighter end.
        const background = selector.startsWith('.header-action') ? [23, 63, 99] : bg;
        return {selector, ratio: background ? ratio(parse(getComputedStyle(el, pseudo).color), background) : 0};
      });
    });
    for (const result of results) {
      expect(result.missing, `${state}: ${result.selector} present`).toBeFalsy();
      expect(result.ratio, `${state}: ${result.selector} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('visual review: controls have names, no emoji, and a visible keyboard focus indicator', async ({page}) => {
  await page.setViewportSize(viewports.desktop);
  await open(page, {mode: 'none', color: '#0b1120'});
  const unnamed = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter(b => !(b.getAttribute('aria-label') || b.textContent).trim()).map(b => b.outerHTML.slice(0, 80)));
  expect(unnamed).toEqual([]);
  const emoji = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter(b => /\p{Extended_Pictographic}/u.test(b.textContent)).map(b => b.textContent));
  expect(emoji).toEqual([]);
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('.icon-btn, .header-action')).every(b => b.dataset.tip && b.querySelector('svg use')))).toBe(true);
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('svg use')).every(u => document.querySelector(u.getAttribute('href'))))).toBe(true);
  const seen = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement === document.body)) break; // Tabbed past the last control.
    const focus = await page.evaluate(() => {
      const el = document.activeElement; const cs = getComputedStyle(el);
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
      const search = el.closest('.search');
      return {what: el.id || el.className || el.tagName, indicated: outline || cs.boxShadow !== 'none' || (!!search && getComputedStyle(search).borderTopColor === 'rgb(47, 120, 184)')};
    });
    seen.push(focus.what);
    expect(focus.indicated, `focus indicator on ${focus.what}`).toBe(true);
    if (i === 1) { await expect(page.locator('#addBtn')).toBeFocused(); await shot(page, 'desktop-focus-header-action'); }
    if (focus.what === 'pill' && !seen.slice(0, -1).includes('pill')) await shot(page, 'desktop-focus-group-filter');
    if (focus.what === 'icon-btn' && !seen.slice(0, -1).includes('icon-btn')) await shot(page, 'desktop-focus-tile-more');
  }
  for (const expected of ['logo', 'settingsBtn', 'gMic', 'duckPrompt', 'duckCopyOpen', 'duckOpen', 'pill', 'icon-btn']) expect(seen.join(' ')).toContain(expected);
  expect(seen.length).toBe(19 + 4 + links.length); // header and search controls, All plus three group filters, one menu button per tile
  // Duck.ai copy flow messages, with the clipboard and new tab replaced.
  await page.evaluate(() => { window.open = () => ({}); Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async () => {}}}); });
  await page.locator('#duckPrompt').fill('Plan my week'); await page.locator('#duckPrompt').press('Enter');
  await expect(page.locator('#duckStatus')).toBeVisible();
  await page.locator('#duckCopyOpen').hover();
  await shot(page, 'desktop-duck-copied');
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; document.execCommand = () => false; });
  await page.locator('#duckPrompt').press('Enter');
  await expect(page.locator('#duckStatus')).toHaveClass(/error/);
  await shot(page, 'desktop-duck-copy-failed');
  await page.setViewportSize(viewports.phone);
  // The grid recomputes its columns on the resize event, so wait for that before measuring.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await shot(page, 'phone-duck-copy-failed');
  await page.setViewportSize(viewports.desktop);
  // Hover tooltip on an icon control.
  await page.locator('#settingsBtn').hover();
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('settingsBtn'), '::after').display)).toBe('block');
  await shot(page, 'desktop-tooltip-settings');
});

test('visual review: tile hover, menu, selected group and locked layout states', async ({page}) => {
  await page.setViewportSize(viewports.desktop);
  await open(page, states.photo);
  const card = page.locator('#grid .card').nth(2);
  await card.hover();
  await expect(card).toHaveCSS('border-top-color', 'rgb(47, 120, 184)');
  const title = await card.locator('.title').evaluate(el => ({clipped: el.scrollWidth > el.clientWidth, overflow: getComputedStyle(el).textOverflow}));
  expect(title).toEqual({clipped: true, overflow: 'ellipsis'});
  await card.locator('.icon-btn').click();
  await expect(card.locator('.menu')).toBeVisible();
  const menu = await card.locator('.menu').boundingBox();
  expect(await page.evaluate(({x, y}) => !!document.elementFromPoint(x, y).closest('.menu'), {x: menu.x + menu.width / 2, y: menu.y + menu.height - 12})).toBe(true);
  expect(await card.locator('.icon-btn').evaluate(el => getComputedStyle(el, '::after').display)).toBe('none'); // tooltip must not cover the menu
  await shot(page, 'desktop-tile-menu');
  await page.locator('.tip').click();
  await expect(page.locator('#groupBar .pill.active')).toHaveText('All');
  await page.locator('#groupBar .pill').nth(1).click();
  await expect(page.locator('#groupBar .pill.active')).toHaveText('Finance');
  await expect(page.locator('#groupBar .pill.active')).toHaveCSS('background-color', 'rgb(23, 63, 99)');
  await expect(page.locator('#groupBar .pill.active')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { setSettings({...getSettings(), lockLayout: 'yes', showExtraSearch: 'no'}); render(); });
  await expect(page.locator('#grid .card').first()).toHaveCSS('cursor', 'pointer');
  await expect(page.locator('.search-row-2')).toBeHidden();
  await shot(page, 'desktop-group-selected-locked-one-search-row');
});

for (const size of ['desktop', 'phone']) test(`visual review: ${size} dialogs fit the viewport, scroll, and keep Save reachable`, async ({page}) => {
  const viewport = size === 'phone' ? {width: 375, height: 600} : {width: 1440, height: 700};
  await page.setViewportSize(viewport);
  await open(page, {mode: 'none', color: '#0b1120'});
  await page.locator('#settingsBtn').click();
  const dialog = page.locator('#settingsDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#versionHeader')).toHaveText(/WebDashboard v/);
  await expect(dialog.locator('legend')).toHaveText(['Dashboard', 'Layout', 'Wallpaper']);
  await expect(page.locator('#wallpaperMode option[value="bing"]')).toBeDisabled();
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.locator('#settingsForm').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await shot(page, `${size}-settings-top`);
  const visible = async selector => {
    const b = await page.locator(selector).boundingBox();
    return page.evaluate(({x, y, selector}) => document.elementFromPoint(x, y) === document.querySelector(selector), {x: b.x + b.width / 2, y: b.y + b.height / 2, selector});
  };
  // Every control can be scrolled clear of the sticky header and footer, and Save stays on screen throughout.
  for (const id of ['#maxTiles', '#aiCompanionDefault', '#colsMax', '#lockLayout', '#wallpaperMode', '#wallpaperValue', '#wallpaperFile']) {
    await page.locator(id).focus();
    expect(await visible(id), `${id} visible after focus`).toBe(true);
    expect(await visible('#saveSettingsBtn'), `Save visible with ${id} focused`).toBe(true);
  }
  await shot(page, `${size}-settings-bottom`);
  // Paired fields: side by side their controls are level even when one label wraps; on a narrow screen they stack.
  const pairs = await page.locator('#settingsDialog .row').evaluateAll(rows => rows.map(row => {
    const [a, b] = Array.from(row.querySelectorAll('input, select')).map(el => el.getBoundingClientRect());
    const labels = Array.from(row.querySelectorAll('label')).map(el => ({lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)), clipped: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1}));
    return {name: row.querySelector('label').textContent, top: Math.abs(a.top - b.top), bottom: Math.abs(a.bottom - b.bottom), sameColumn: Math.abs(a.left - b.left) < 1, below: b.top >= a.bottom, labels};
  }));
  expect(pairs.length).toBe(6);
  for (const pair of pairs) {
    expect(pair.labels.some(label => label.clipped), `${pair.name}: labels fully shown`).toBe(false);
    if (size === 'phone') { expect(pair.sameColumn && pair.below, `${pair.name}: stacked`).toBe(true); continue; }
    expect(pair.top, `${pair.name}: control tops level`).toBeLessThanOrEqual(1);
    expect(pair.bottom, `${pair.name}: control bottoms level`).toBeLessThanOrEqual(1);
  }
  // The case that prompted this check: the wallpaper value label wraps to two lines beside a one-line label.
  if (size === 'desktop') expect(pairs.find(pair => pair.name.startsWith('Image URL')).labels.map(label => label.lines)).toEqual([2, 1]);
  await page.locator('#wallpaperMode').focus();
  await expect(page.locator('#wallpaperMode')).toHaveCSS('border-top-color', 'rgb(47, 120, 184)');
  await page.getByRole('button', {name: 'Close', exact: true}).click();
  await page.locator('#addBtn').click();
  await expect(page.locator('#linkDialog')).toBeVisible();
  const link = await page.locator('#linkDialog').boundingBox();
  expect(link.x + link.width).toBeLessThanOrEqual(viewport.width); expect(link.y + link.height).toBeLessThanOrEqual(viewport.height);
  await page.locator('#urlInput').focus();
  await shot(page, `${size}-link-dialog`);
  expect(await visible('#saveLinkBtn')).toBe(true);
});

test('visual review: Picsum failure message, retry button and Settings explanation', async ({page}) => {
  await page.setViewportSize(viewports.desktop);
  await open(page, states.picsum);
  await expect(page.locator('#changePictureBtn')).toBeVisible();
  await page.route(/^https:\/\/picsum\.photos\/seed\/pick-/, route => route.abort());
  await page.locator('#changePictureBtn').click();
  await expect(page.locator('#wallpaperStatus')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Try again', exact: true})).toBeVisible();
  const retry = await page.locator('#wallpaperRetry').boundingBox();
  expect(retry.width).toBeGreaterThan(70); // the text button must not collapse to an icon square
  await page.locator('#changePictureBtn').hover();
  await shot(page, 'desktop-picsum-failed');
  await page.setViewportSize(viewports.phone);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect((await page.locator('#wallpaperRetry').boundingBox()).width).toBeGreaterThan(70);
  await shot(page, 'phone-picsum-failed', {fullPage: true});
  await page.setViewportSize(viewports.desktop);
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#wallpaperMode')).toHaveValue('picsum');
  await page.locator('#wallpaperFile').focus();
  await expect(page.locator('#picsumHint')).toBeVisible();
  await shot(page, 'desktop-settings-wallpaper-picsum');
});
