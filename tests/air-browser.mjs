// Integration regression. Start the app and a local Chrome debugging instance first.
// node tests/air-browser.mjs <app-url> <debug-url> [existing-screenshot-directory]
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const [appUrl, debugUrl, screenDir] = process.argv.slice(2);
if (!appUrl || !debugUrl) throw new Error('Supply the local app URL and Chrome debugging URL.');
for (const endpoint of [appUrl, debugUrl]) {
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(endpoint).hostname));
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const pending = new Map();
  let serial = 0;
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(msg.error.message));
    else entry.resolve(msg.result);
  };
  return {
    close: () => ws.close(),
    call(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++serial;
        pending.set(id, {resolve, reject});
        ws.send(JSON.stringify({id, method, params}));
      });
    }
  };
}

// All values below are synthetic regression fixtures injected into an isolated browser context.
function installFixtures() {
  const realFetch = window.fetch;
  window.airFixtures = { air: [], guidance: [] };
  window.fetch = (input, options) => {
    const url = new URL(input, location.href);
    const key = url.pathname.split('/').pop();
    if (!Object.hasOwn(window.airFixtures, key)) return realFetch(input, options);
    return new Promise(resolve => window.airFixtures[key].push({
      finish: data => resolve(new Response(JSON.stringify(data), {headers:{'Content-Type':'application/json'}}))
    }));
  };
  window.finishAir = (index, value) => {
    const now = Date.now();
    const time = new Date(now).toISOString();
    const first = Math.ceil(now / 3600000) * 3600000;
    const primary = value === null ? null : {
      value, kind:'model', provider:'Test fixture', pollutant:'pm2_5', measured_at:time,
      unit:'µg/m³', source_url:'https://open-meteo.com/en/docs/air-quality-api', stale:false
    };
    const forecast = primary ? [0, 2].map(i => ({
      time:new Date(first + i * 3600000).toISOString(), pm2_5:value + i, pm10:null
    })) : [];
    window.airFixtures.air[index].finish({
      primary, modeled:primary, observed:[], forecast, fetched_at:time, warnings:[]
    });
  };
  window.finishGuidance = (index, title) => window.airFixtures.guidance[index].finish({
    title, summary:'Fixture guidance summary.', eyebrow:'For your household', actions:['Fixture action']
  });
}

const version = await (await fetch(debugUrl + '/json/version')).json();
const browser = await connect(version.webSocketDebuggerUrl);
const {browserContextId} = await browser.call('Target.createBrowserContext');
let page;
try {
  const {targetId} = await browser.call('Target.createTarget', {url:'about:blank', browserContextId});
  const tabs = await (await fetch(debugUrl + '/json/list')).json();
  page = await connect(tabs.find(tab => tab.id === targetId).webSocketDebuggerUrl);
  await page.call('Page.enable');
  await page.call('Emulation.setDeviceMetricsOverride', {width:1440, height:960, deviceScaleFactor:1, mobile:false});
  await page.call('Page.addScriptToEvaluateOnNewDocument', {source:'(' + installFixtures.toString() + ')()'});
  await page.call('Page.navigate', {url:appUrl});

  async function evaluate(expression) {
    const out = await page.call('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
    if (out.exceptionDetails) throw new Error(out.exceptionDetails.exception?.description || out.exceptionDetails.text);
    return out.result.value;
  }
  async function until(expression) {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(expression)) return;
      await delay(50);
    }
    throw new Error('Browser state timed out: ' + expression);
  }
  async function screenshot(name) {
    if (!screenDir) return;
    const {data} = await page.call('Page.captureScreenshot', {format:'png'});
    await writeFile(join(screenDir, name + '.png'), Buffer.from(data, 'base64'));
  }
  async function chooseCity(index) {
    await evaluate("document.querySelector('#location-trigger').click(); document.querySelectorAll('#city-results button')[" + index + "].click()");
  }
  await until('window.airFixtures?.air.length === 1');
  await screenshot('atlas-loading');
  await chooseCity(1);
  await chooseCity(0);
  await until('airFixtures.air.length === 3');
  await evaluate('finishAir(2, 30)');
  await until('airFixtures.guidance.length === 1');
  await evaluate("finishAir(0, 10); finishAir(1, 20); document.querySelector('#profile-trigger').click(); document.querySelector('#has-older').click(); document.querySelector('#profile-form').requestSubmit()");
  await until('airFixtures.guidance.length === 2');
  await evaluate("finishGuidance(1, 'Current household fixture'); finishGuidance(0, 'Old household fixture')");
  await until("document.querySelector('#daily-note-title').textContent === 'Current household fixture'");
  assert.equal(await evaluate("document.querySelector('#pm-value').textContent"), '30');
  assert.equal(await evaluate("document.querySelector('#atlas-city').textContent"), 'New Delhi');
  await screenshot('atlas-forecast');
  await page.call('Emulation.setDeviceMetricsOverride', {width:390, height:844, deviceScaleFactor:1, mobile:true});
  await delay(80);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await screenshot('atlas-forecast-mobile');
  await evaluate("document.querySelector('#forecast-hour').focus()");
  async function arrowRight() {
    for (const type of ['keyDown','keyUp']) {
      await page.call('Input.dispatchKeyEvent', {type, key:'ArrowRight', code:'ArrowRight', windowsVirtualKeyCode:39});
    }
  }
  await arrowRight();
  assert.equal(await evaluate("document.querySelector('#pm-value').textContent"), '—');
  assert.match(await evaluate("document.querySelector('#forecast-hour').getAttribute('aria-valuetext')"), /unavailable/);
  await arrowRight();
  assert.equal(await evaluate("document.querySelector('#pm-value').textContent"), '32');
  await evaluate("document.querySelector('#forecast-reset').click()");
  assert.equal(await evaluate("document.querySelector('#pm-value').textContent"), '30');
  await chooseCity(2);
  await until('airFixtures.air.length === 4');
  await evaluate('finishAir(3, null)');
  await until('airFixtures.guidance.length === 3');
  await evaluate("finishGuidance(2, 'Guidance fixture for unavailable air')");
  assert.equal(await evaluate("document.querySelector('#forecast-controls').hidden"), true);
  assert.equal(await evaluate("document.querySelector('#pm-value').textContent"), '—');
  await evaluate('window.scrollTo(0,0)');
  await page.call('Emulation.setDeviceMetricsOverride', {width:1440, height:960, deviceScaleFactor:1, mobile:false});
  await delay(80);
  await screenshot('atlas-unavailable');
  console.log('Passed location A/B/A, household race, missing-hour keyboard selection, current reset and unavailable state.');
} finally {
  page?.close();
  await browser.call('Target.disposeBrowserContext', {browserContextId});
  browser.close();
}
