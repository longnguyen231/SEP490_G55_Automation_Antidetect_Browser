// High-level browser actions by profileId using Playwright API (works for both Playwright and CDP engines)
// Exposes helpers like click, scroll, keyboard, capture, wait, etc.
// Each function returns a structured { success, ... } result and logs via appendLog when possible.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { runningProfiles } = require('../state/runtime');
const { appendLog } = require('../logging/logger');

function ok(v = {}) { return { success: true, ...v }; }
function err(message, extra = {}) { return { success: false, error: String(message || 'unknown error'), ...extra }; }

async function withPage(profileId, { index = 0, createIfMissing = true } = {}) {
  const running = runningProfiles.get(profileId);
  if (!running) return err('Profile not running');
  const engine = running.engine;
  // When engine is playwright, reuse existing browser/context; otherwise connect over CDP
  if (engine === 'playwright') {
    const browser = running.browser; const context = running.context;
    if (!browser || !context || context.isClosed?.()) return err('Browser context not available');
    let page = context.pages()[index] || context.pages()[0];
    if (!page && createIfMissing) page = await context.newPage();
    if (!page) return err('No page available');
    return ok({ engine, browser, context, page, cleanup: async () => {} });
  }
  // CDP: connect via playwright connectOverCDP for unified Page API
  try {
    const ws = running.wsEndpoint;
    const browser = await chromium.connectOverCDP(ws);
    const context = browser.contexts?.()[0];
    if (!context) { try { await browser.close(); } catch {} return err('No browser context found (CDP)'); }
    let page = context.pages()[index] || context.pages()[0];
    if (!page && createIfMissing) page = await context.newPage();
    if (!page) { try { await browser.close(); } catch {} return err('No page available'); }
    const cleanup = async () => { try { await browser.close(); } catch {} };
    return ok({ engine: 'cdp', browser, context, page, cleanup });
  } catch (e) {
    return err(e?.message || e);
  }
}

async function clickAt(profileId, { x, y, button = 'left', clickCount = 1, delay } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return err('x and y are required numbers');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await page.mouse.move(x, y);
    await page.mouse.click(x, y, { button, clickCount, delay });
    appendLog(profileId, `Action: clickAt (${x}, ${y}) button=${button} count=${clickCount}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function clickByPercent(profileId, { xPercent, yPercent, selector, button = 'left', clickCount = 1, delay, timeout = 10000 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    if (selector) {
      const el = page.locator(selector).first();
      await el.waitFor({ state: 'visible', timeout });
      const box = await el.boundingBox();
      if (!box) throw new Error('Element not visible');
      const cx = box.x + Math.max(0, Math.min(1, Number(xPercent || 0.5))) * box.width;
      const cy = box.y + Math.max(0, Math.min(1, Number(yPercent || 0.5))) * box.height;
      await page.mouse.move(cx, cy);
      await page.mouse.click(cx, cy, { button, clickCount, delay });
      appendLog(profileId, `Action: clickByPercent on ${selector} at ${xPercent || 0.5},${yPercent || 0.5}`);
    } else {
      const vp = page.viewportSize?.();
      if (!vp) throw new Error('Viewport size not available');
      const cx = Math.round(Math.max(0, Math.min(1, Number(xPercent || 0.5))) * (vp.width - 1));
      const cy = Math.round(Math.max(0, Math.min(1, Number(yPercent || 0.5))) * (vp.height - 1));
      await page.mouse.move(cx, cy);
      await page.mouse.click(cx, cy, { button, clickCount, delay });
      appendLog(profileId, `Action: clickByPercent viewport at ${xPercent || 0.5},${yPercent || 0.5}`);
    }
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function clickOnElement(profileId, { selector, button = 'left', clickCount = 1, timeout = 10000, position } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await page.click(selector, { button, clickCount, timeout, position });
    appendLog(profileId, `Action: clickOnElement ${selector}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function scrollByPercent(profileId, { xPercent = 0, yPercent = 0, selector } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    if (selector) {
      await page.evaluate(({ selector, xPercent, yPercent }) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error('Element not found');
        const dx = Math.round((el.scrollWidth - el.clientWidth) * xPercent);
        const dy = Math.round((el.scrollHeight - el.clientHeight) * yPercent);
        el.scrollTo({ left: dx, top: dy, behavior: 'auto' });
      }, { selector, xPercent: clamp01(xPercent), yPercent: clamp01(yPercent) });
    } else {
      await page.evaluate(({ xPercent, yPercent }) => {
        const dx = Math.round((document.documentElement.scrollWidth - window.innerWidth) * xPercent);
        const dy = Math.round((document.documentElement.scrollHeight - window.innerHeight) * yPercent);
        window.scrollTo({ left: dx, top: dy, behavior: 'auto' });
      }, { xPercent: clamp01(xPercent), yPercent: clamp01(yPercent) });
    }
    appendLog(profileId, `Action: scrollByPercent ${xPercent},${yPercent} ${selector ? 'in ' + selector : 'viewport'}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function scrollFromTo(profileId, { x1, y1, x2, y2, steps = 2 }) {
  if (![x1, y1, x2, y2].every(Number.isFinite)) return err('x1,y1,x2,y2 are required numbers');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await page.mouse.move(x1, y1);
    // Use wheel deltas to simulate scroll; horizontal via deltaX, vertical via deltaY
    await page.mouse.wheel(x2 - x1, y2 - y1);
    // Optional smoothness via repeated smaller wheels
    if (steps > 1) {
      const dx = (x2 - x1) / steps; const dy = (y2 - y1) / steps;
      for (let i = 0; i < steps - 1; i++) { // eslint-disable-line no-plusplus
        // eslint-disable-next-line no-await-in-loop
        await page.mouse.wheel(dx, dy);
      }
    }
    appendLog(profileId, `Action: scrollFromTo (${x1},${y1}) -> (${x2},${y2})`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function scrollElementToElement(profileId, { fromSelector, toSelector, behavior = 'auto', block = 'center', inline = 'nearest', timeout = 10000 } = {}) {
  if (!fromSelector || !toSelector) return err('fromSelector and toSelector are required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    await page.waitForSelector(fromSelector, { state: 'attached', timeout });
    await page.waitForSelector(toSelector, { state: 'attached', timeout });
    await page.evaluate(({ fromSelector, toSelector, behavior, block, inline }) => {
      const from = document.querySelector(fromSelector);
      const to = document.querySelector(toSelector);
      if (!from || !to) throw new Error('Element(s) not found');
      from.scrollIntoView({ behavior, block, inline });
      to.scrollIntoView({ behavior, block, inline });
    }, { fromSelector, toSelector, behavior, block, inline });
    appendLog(profileId, `Action: scrollElementToElement ${fromSelector} -> ${toSelector}`);
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function sendKeyboard(profileId, { text, press, sequence, delay = 0 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    if (typeof text === 'string' && text.length) {
      await page.keyboard.type(text, { delay });
      appendLog(profileId, `Action: keyboard type '${text.slice(0,50)}'`);
    }
    if (typeof press === 'string' && press.length) {
      await page.keyboard.press(press);
      appendLog(profileId, `Action: keyboard press ${press}`);
    }
    if (Array.isArray(sequence) && sequence.length) {
      for (const key of sequence) { // eslint-disable-line no-restricted-syntax
        // eslint-disable-next-line no-await-in-loop
        await page.keyboard.press(String(key));
      }
      appendLog(profileId, `Action: keyboard sequence ${sequence.join(',')}`);
    }
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function captureScreen(profileId, { index = 0, path: outPath, fullPage = false } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try {
    if (outPath) { try { fs.mkdirSync(path.dirname(outPath), { recursive: true }); } catch {} }
    const result = await page.screenshot({ path: outPath, fullPage: !!fullPage, type: 'png' });
    await cleanup();
    return ok(outPath ? { path: outPath } : { base64: Buffer.from(result).toString('base64') });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function captureElement(profileId, { selector, path: outPath, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout });
    if (outPath) { try { fs.mkdirSync(path.dirname(outPath), { recursive: true }); } catch {} }
    const result = await el.screenshot({ path: outPath, type: 'png' });
    await cleanup();
    return ok(outPath ? { path: outPath } : { base64: Buffer.from(result).toString('base64') });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function waitAction(profileId, { ms, selector, state = 'visible', timeout } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    if (Number.isFinite(ms) && ms > 0) {
      await page.waitForTimeout(Math.min(ms, 10 * 60 * 1000));
      appendLog(profileId, `Action: waited ${ms}ms`);
    } else if (selector) {
      await page.waitForSelector(selector, { state, timeout: Number.isFinite(timeout) ? timeout : 15000 });
      appendLog(profileId, `Action: waitFor ${selector} state=${state}`);
    } else {
      await page.waitForTimeout(500);
    }
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Extra handy actions
async function hoverOnElement(profileId, { selector, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.hover(selector, { timeout }); await cleanup(); appendLog(profileId, `Action: hover ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function dragAndDrop(profileId, { from, to, steps = 10, timeout = 10000 } = {}) {
  if (!from || !to) return err('from and to selectors are required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.dragAndDrop(from, to, { sourcePosition: undefined, targetPosition: undefined, force: false, timeout }); await cleanup(); appendLog(profileId, `Action: dragAndDrop ${from} -> ${to}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function fillInput(profileId, { selector, value, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.fill(selector, String(value ?? '')); await cleanup(); appendLog(profileId, `Action: fill ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function selectOption(profileId, { selector, values, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.selectOption(selector, values); await cleanup(); appendLog(profileId, `Action: selectOption ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Generic dispatcher
const ACTION_MAP = {
  'click.at': clickAt,
  'click.percent': clickByPercent,
  'click.element': clickOnElement,
  'scroll.percent': scrollByPercent,
  'scroll.fromTo': scrollFromTo,
  'scroll.elementToElement': scrollElementToElement,
  'keyboard.send': sendKeyboard,
  'capture.screen': captureScreen,
  'capture.element': captureElement,
  'wait': waitAction,
  'hover': hoverOnElement,
  'dragAndDrop': dragAndDrop,
  'input.fill': fillInput,
  'select.option': selectOption,
  // Navigation & page lifecycle
  'nav.goto': navigateTo,
  'nav.back': goBack,
  'nav.forward': goForward,
  'nav.reload': reloadPage,
  'wait.loadState': waitLoadState,
  // Element utilities
  'element.focus': focusElement,
  'input.type': typeInto,
  'input.clear': clearInput,
  'input.check': checkElement,
  'input.uncheck': uncheckElement,
  'input.setFiles': setFiles,
  // Storage & cookies
  'storage.local.set': storageLocalSet,
  'storage.local.get': storageLocalGet,
  'storage.local.remove': storageLocalRemove,
  'storage.local.clear': storageLocalClear,
  'storage.session.set': storageSessionSet,
  'storage.session.get': storageSessionGet,
  'storage.session.remove': storageSessionRemove,
  'storage.session.clear': storageSessionClear,
  'cookies.get': cookiesGet,
  'cookies.set': cookiesSet,
  'cookies.clear': cookiesClear,
  // Network & env
  'network.setOffline': networkSetOffline,
  'geolocation.set': geolocationSet,
  'viewport.set': viewportSet,
  'headers.setExtra': headersSetExtra,
  // Tabs
  'tab.new': tabNew,
  'tab.close': tabClose,
  'page.front': bringToFront,
  // JS & Content
  'js.eval': evaluateJS,
  'element.eval': elementEval,
  'page.content': getPageContent,
  'page.title': getPageTitle,
  'page.url': getPageUrl,
  'element.text': elementGetText,
  'element.html': elementGetHtml,
  'element.attr': elementGetAttr,
  // Injectors & export
  'page.script.add': addScriptTag,
  'page.style.add': addStyleTag,
  'page.pdf': exportPdf,
};

async function performAction(profileId, action, params = {}) {
  const fn = ACTION_MAP[action];
  if (!fn) return err(`Unknown action '${action}'`);
  try { return await fn(profileId, params || {}); } catch (e) { return err(e?.message || e); }
}

function clamp01(v) { const n = Number(v); if (!Number.isFinite(n)) return 0; return Math.max(0, Math.min(1, n)); }

function getActionNames() { return Object.keys(ACTION_MAP); }

// ============ Additional Actions Implementations ============

// Navigation and page lifecycle
async function navigateTo(profileId, { url, waitUntil = 'load', index = 0, newPage = false } = {}) {
  if (!url) return err('url is required');
  const { success, error, page, context, cleanup } = await withPage(profileId, { index, createIfMissing: true });
  if (!success) return err(error);
  try {
    let target = page;
    if (newPage) target = await context.newPage();
    await target.goto(url, { waitUntil });
    appendLog(profileId, `Action: goto ${url}`);
    const title = await target.title().catch(() => '');
    const currentUrl = target.url();
    await cleanup();
    return ok({ url: currentUrl, title });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function goBack(profileId, { waitUntil = 'load', index = 0 } = {}) { return await navHistory(profileId, 'back', { waitUntil, index }); }
async function goForward(profileId, { waitUntil = 'load', index = 0 } = {}) { return await navHistory(profileId, 'forward', { waitUntil, index }); }
async function reloadPage(profileId, { waitUntil = 'load', index = 0 } = {}) { return await navHistory(profileId, 'reload', { waitUntil, index }); }

async function navHistory(profileId, kind, { waitUntil = 'load', index = 0 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try {
    if (kind === 'back') await page.goBack({ waitUntil });
    else if (kind === 'forward') await page.goForward({ waitUntil });
    else if (kind === 'reload') await page.reload({ waitUntil });
    const title = await page.title().catch(() => '');
    const currentUrl = page.url();
    appendLog(profileId, `Action: nav ${kind}`);
    await cleanup();
    return ok({ url: currentUrl, title });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function waitLoadState(profileId, { state = 'load', index = 0, timeout = 30000 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try { await page.waitForLoadState(state, { timeout }); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Element utilities
async function focusElement(profileId, { selector, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.focus(selector, { timeout }); await cleanup(); appendLog(profileId, `Action: focus ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function typeInto(profileId, { selector, text, delay = 0, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.type(selector, String(text ?? ''), { delay, timeout }); await cleanup(); appendLog(profileId, `Action: type into ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function clearInput(profileId, { selector, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.fill(selector, ''); await cleanup(); appendLog(profileId, `Action: clear ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function checkElement(profileId, { selector, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.check(selector, { timeout }); await cleanup(); appendLog(profileId, `Action: check ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function uncheckElement(profileId, { selector, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.uncheck(selector, { timeout }); await cleanup(); appendLog(profileId, `Action: uncheck ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function setFiles(profileId, { selector, files, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  if (!files || (Array.isArray(files) && !files.length)) return err('files is required');
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await page.setInputFiles(selector, files); await cleanup(); appendLog(profileId, `Action: setFiles ${selector}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Storage helpers
async function storageLocalSet(profileId, { items = {} } = {}) { return await storageEval(profileId, 'localStorage', 'set', items); }
async function storageLocalGet(profileId, { keys } = {}) { return await storageEval(profileId, 'localStorage', 'get', keys); }
async function storageLocalRemove(profileId, { keys } = {}) { return await storageEval(profileId, 'localStorage', 'remove', keys); }
async function storageLocalClear(profileId) { return await storageEval(profileId, 'localStorage', 'clear'); }
async function storageSessionSet(profileId, { items = {} } = {}) { return await storageEval(profileId, 'sessionStorage', 'set', items); }
async function storageSessionGet(profileId, { keys } = {}) { return await storageEval(profileId, 'sessionStorage', 'get', keys); }
async function storageSessionRemove(profileId, { keys } = {}) { return await storageEval(profileId, 'sessionStorage', 'remove', keys); }
async function storageSessionClear(profileId) { return await storageEval(profileId, 'sessionStorage', 'clear'); }

async function storageEval(profileId, which, op, payload) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    const result = await page.evaluate(({ which, op, payload }) => {
      const store = which === 'sessionStorage' ? window.sessionStorage : window.localStorage;
      switch (op) {
        case 'set':
          Object.entries(payload || {}).forEach(([k, v]) => store.setItem(String(k), typeof v === 'string' ? v : JSON.stringify(v)));
          return true;
        case 'get':
          if (!payload) return Object.fromEntries(Object.entries(store).map(([k, v]) => [k, v]));
          const keys = Array.isArray(payload) ? payload : [payload];
          const out = {};
          keys.forEach(k => { const v = store.getItem(String(k)); if (v != null) out[k] = v; });
          return out;
        case 'remove':
          (Array.isArray(payload) ? payload : [payload]).forEach(k => store.removeItem(String(k)));
          return true;
        case 'clear':
          store.clear(); return true;
        default:
          return false;
      }
    }, { which, op, payload });
    await cleanup();
    return ok({ result });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Cookies
async function cookiesGet(profileId, { urls } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { const cookies = await context.cookies(urls); await cleanup(); return ok({ cookies }); } catch (e) { await cleanup(); return err(e?.message || e); }
}
async function cookiesSet(profileId, { cookies = [] } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await context.addCookies(cookies); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}
async function cookiesClear(profileId) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    const all = await context.cookies();
    if (all.length) {
      // Clearing by setting expiry in the past not supported directly; recreate context storage state minimal approach
      await Promise.all(all.map(c => context.clearCookies?.() || Promise.resolve()));
      try { await context.clearCookies(); } catch {}
    }
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Network and environment
async function networkSetOffline(profileId, { offline = true } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await context.setOffline(!!offline); await cleanup(); appendLog(profileId, `Action: offline=${!!offline}`); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function geolocationSet(profileId, { latitude, longitude, accuracy = 100 } = {}) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return err('latitude and longitude are required numbers');
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await context.setGeolocation({ latitude: Number(latitude), longitude: Number(longitude), accuracy: Number(accuracy) }); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function viewportSet(profileId, { width, height, deviceScaleFactor } = {}) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return err('width and height are required numbers');
  const { success, error, context, cleanup, engine } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    const pages = context.pages();
    for (const p of pages) { // eslint-disable-line no-restricted-syntax
      // eslint-disable-next-line no-await-in-loop
      await p.setViewportSize({ width: w, height: h });
      if (Number.isFinite(deviceScaleFactor) && deviceScaleFactor > 0 && engine === 'cdp') {
        try {
          // Apply CDP metrics override to reflect DPR
          // eslint-disable-next-line no-await-in-loop
          const session = await context.newCDPSession(p);
          // eslint-disable-next-line no-await-in-loop
          await session.send('Emulation.setDeviceMetricsOverride', {
            width: w,
            height: h,
            deviceScaleFactor: Number(deviceScaleFactor),
            mobile: false,
            screenWidth: w,
            screenHeight: h,
          });
        } catch { /* ignore */ }
      }
    }
    await cleanup();
    return ok();
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function headersSetExtra(profileId, { headers = {} } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { await context.setExtraHTTPHeaders(headers); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// Tabs
async function tabNew(profileId, { url, waitUntil = 'domcontentloaded' } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { const page = await context.newPage(); if (url) await page.goto(url, { waitUntil }); const index = context.pages().indexOf(page); await cleanup(); return ok({ index, url: page.url() }); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function tabClose(profileId, { index = 0 } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { const pages = context.pages(); const page = pages[index]; if (!page) { await cleanup(); return err('Invalid page index'); } await page.close({ runBeforeUnload: true }); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function bringToFront(profileId, { index = 0 } = {}) {
  const { success, error, context, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try { const page = context.pages()[index] || context.pages()[0]; if (!page) { await cleanup(); return err('No page available'); } await page.bringToFront(); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

// JS and content related actions
async function evaluateJS(profileId, { expression, arg, returnByValue = true, index = 0 } = {}) {
  if (typeof expression !== 'string') return err('expression must be a string');
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try {
    const result = await page.evaluate((expr, arg) => {
      try { return { ok: true, value: eval(expr) }; }
      catch (e) { return { ok: false, error: e?.message || String(e) }; }
    }, expression, arg);
    await cleanup();
    if (!result?.ok) return err(result?.error || 'eval failed');
    return ok({ value: result.value });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function elementEval(profileId, { selector, expression, index = 0, timeout = 10000 } = {}) {
  if (!selector) return err('selector is required');
  if (typeof expression !== 'string') return err('expression must be a string');
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try {
    const loc = page.locator(selector).first();
    await loc.waitFor({ state: 'attached', timeout });
    const result = await loc.evaluate((el, expr) => {
      try { return { ok: true, value: eval(expr) }; }
      catch (e) { return { ok: false, error: e?.message || String(e) }; }
    }, expression);
    await cleanup();
    if (!result?.ok) return err(result?.error || 'element eval failed');
    return ok({ value: result.value });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function getPageContent(profileId, { index = 0 } = {}) { const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const html = await page.content(); await cleanup(); return ok({ html }); } catch (e) { await cleanup(); return err(e?.message || e); } }
async function getPageTitle(profileId, { index = 0 } = {}) { const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const title = await page.title(); await cleanup(); return ok({ title }); } catch (e) { await cleanup(); return err(e?.message || e); } }
async function getPageUrl(profileId, { index = 0 } = {}) { const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const url = page.url(); await cleanup(); return ok({ url }); } catch (e) { await cleanup(); return err(e?.message || e); } }

async function elementGetText(profileId, { selector, index = 0, timeout = 10000 } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const loc = page.locator(selector).first(); await loc.waitFor({ state: 'visible', timeout }); const text = await loc.innerText(); await cleanup(); return ok({ text }); } catch (e) { await cleanup(); return err(e?.message || e); } }
async function elementGetHtml(profileId, { selector, index = 0, timeout = 10000 } = {}) { if (!selector) return err('selector is required'); const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const loc = page.locator(selector).first(); await loc.waitFor({ state: 'attached', timeout }); const html = await loc.innerHTML(); await cleanup(); return ok({ html }); } catch (e) { await cleanup(); return err(e?.message || e); } }
async function elementGetAttr(profileId, { selector, name, index = 0, timeout = 10000 } = {}) { if (!selector) return err('selector is required'); if (!name) return err('name is required'); const { success, error, page, cleanup } = await withPage(profileId, { index }); if (!success) return err(error); try { const loc = page.locator(selector).first(); await loc.waitFor({ state: 'attached', timeout }); const value = await loc.getAttribute(name); await cleanup(); return ok({ value }); } catch (e) { await cleanup(); return err(e?.message || e); } }

async function addScriptTag(profileId, { url, path: filePath, content, type, index = 0 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try { await page.addScriptTag({ url, path: filePath, content, type }); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}
async function addStyleTag(profileId, { url, path: filePath, content, index = 0 } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, { index });
  if (!success) return err(error);
  try { await page.addStyleTag({ url, path: filePath, content }); await cleanup(); return ok(); } catch (e) { await cleanup(); return err(e?.message || e); }
}

async function exportPdf(profileId, { path: outPath, format = 'A4', printBackground = true, landscape = false, scale = 1, margin } = {}) {
  const { success, error, page, cleanup } = await withPage(profileId, {});
  if (!success) return err(error);
  try {
    if (!outPath) return err('path is required');
    fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
    await page.pdf({ path: outPath, format, printBackground, landscape, scale, margin });
    await cleanup();
    return ok({ path: outPath });
  } catch (e) { await cleanup(); return err(e?.message || e); }
}

module.exports = {
  performAction,
  clickAt,
  clickByPercent,
  clickOnElement,
  scrollByPercent,
  scrollFromTo,
  scrollElementToElement,
  sendKeyboard,
  captureScreen,
  captureElement,
  waitAction,
  hoverOnElement,
  dragAndDrop,
  fillInput,
  selectOption,
  navigateTo,
  goBack,
  goForward,
  reloadPage,
  waitLoadState,
  focusElement,
  typeInto,
  clearInput,
  checkElement,
  uncheckElement,
  setFiles,
  storageLocalSet,
  storageLocalGet,
  storageLocalRemove,
  storageLocalClear,
  storageSessionSet,
  storageSessionGet,
  storageSessionRemove,
  storageSessionClear,
  cookiesGet,
  cookiesSet,
  cookiesClear,
  networkSetOffline,
  geolocationSet,
  viewportSet,
  headersSetExtra,
  tabNew,
  tabClose,
  bringToFront,
  evaluateJS,
  elementEval,
  getPageContent,
  getPageTitle,
  getPageUrl,
  elementGetText,
  elementGetHtml,
  elementGetAttr,
  addScriptTag,
  addStyleTag,
  exportPdf,
  getActionNames,
};
