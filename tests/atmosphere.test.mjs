import assert from 'node:assert/strict';
import test from 'node:test';
import { createAtmosphere } from '../web/assets/atmosphere.js';

test('atlas caches scenery, limits density, and paints static frames when motion is reduced', t => {
  let intersect, draws = 0, dots = 0, gradients = 0, disconnects = 0;
  const document = new EventTarget();
  const reduced = new EventTarget();
  reduced.matches = true;
  const noop = () => {};
  const gradient = () => { gradients++; return {addColorStop: noop}; };
  const context = {
    arc() { dots++; },
    drawImage() { dots = 0; draws++; },
    beginPath: noop, fill: noop, setTransform: noop, stroke: noop,
    fillRect: noop, moveTo: noop, lineTo: noop, bezierCurveTo: noop,
    createLinearGradient: gradient, createRadialGradient: gradient
  };
  const canvas = {
    getContext: () => context,
    getBoundingClientRect: () => ({width:390, height:300})
  };
  document.createElement = () => ({getContext: () => context});
  const window = new EventTarget();
  window.devicePixelRatio = 3;
  const globals = {
    window, document, matchMedia: () => reduced,
    cancelAnimationFrame: noop,
    requestAnimationFrame: () => assert.fail('Unexpected animation in reduced-motion mode'),
    IntersectionObserver: class {
      constructor(callback) { intersect = callback; }
      observe() {}
      disconnect() { disconnects++; }
    },
    ResizeObserver: class { observe() {} disconnect() { disconnects++; } }
  };
  for (const [name, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {configurable:true, value});
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }
  const atmosphere = createAtmosphere(canvas, () => true);
  intersect([{isIntersecting:true}]);
  assert.equal(canvas.width, 585);
  assert.equal(dots, 0, 'unavailable data has a neutral illustration');
  const initialGradients = gradients;
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  atmosphere.setDensity(1000); // Synthetic fixture above the illustration's particle cap.
  atmosphere.drawOnce();
  assert.equal(draws, 1);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(draws, 2);
  assert.equal(dots, 88);
  assert.equal(gradients, initialGradients);
  intersect([{isIntersecting:false}]);
  atmosphere.setDensity(0);
  assert.equal(draws, 2);
  intersect([{isIntersecting:true}]);
  assert.equal(dots, 8, 'a valid zero is distinct from unavailable');
  atmosphere.destroy();
  assert.equal(disconnects, 2);
  atmosphere.drawOnce();
  assert.equal(draws, 3);
});
