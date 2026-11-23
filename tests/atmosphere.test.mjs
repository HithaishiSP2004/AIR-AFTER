import assert from 'node:assert/strict';
import test from 'node:test';
import { createAtmosphere } from '../web/assets/atmosphere.js';

test('hidden density updates paint once on return with reduced motion', (t) => {
  let intersect, draws = 0, dots = 0;
  const document = new EventTarget();
  const reduced = new EventTarget();
  reduced.matches = true;
  const noop = () => {};
  const context = {
    clearRect() { draws++; dots = 0; },
    arc() { dots++; },
    drawImage: noop, beginPath: noop, fill: noop, setTransform: noop,
    translate: noop, scale: noop, rotate: noop, ellipse: noop, stroke: noop,
    createLinearGradient: () => ({ addColorStop: noop })
  };
  const canvas = {
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 390, height: 300 })
  };
  document.createElement = () => ({ getContext: () => context });
  const window = new EventTarget();
  window.devicePixelRatio = 3;
  const globals = {
    window, document, matchMedia: () => reduced,
    cancelAnimationFrame: noop,
    requestAnimationFrame: () => assert.fail('scheduled animation in reduced motion'),
    IntersectionObserver: class {
      constructor(callback) { intersect = callback; }
      observe() {}
    },
    ResizeObserver: class { observe() {} }
  };
  for (const [name, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }
  const atmosphere = createAtmosphere(canvas, () => true);
  intersect([{ isIntersecting: true }]);
  assert.equal(canvas.width, 702);
  assert.equal(dots, 60);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  atmosphere.setDensity(1000); // Synthetic test fixture above the particle cap.
  atmosphere.drawOnce();
  assert.equal(draws, 1);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(draws, 2);
  assert.equal(dots, 200);
});
