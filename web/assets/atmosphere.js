/* Illustrative urban section. Geometry is baked on resize, independent of readings. */
const TAU = Math.PI * 2;

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function skyline(ctx, baseline, height, faces, seed) {
  const random = seededRandom(seed);
  ctx.fillStyle = faces[0];
  ctx.fillRect(0, baseline - 1, 1000, 311 - baseline);
  for (let x = -40; x < 1040;) {
    const width = 10 + random() * 36;
    const top = baseline - (0.25 + random() * 0.75) * height;
    const depth = width * 0.23;
    ctx.fillStyle = faces[0];
    ctx.fillRect(x, top, width, baseline - top);
    ctx.fillStyle = faces[1];
    ctx.beginPath();
    ctx.moveTo(x + width, top);
    ctx.lineTo(x + width + depth, top + depth * 0.45);
    ctx.lineTo(x + width + depth, baseline);
    ctx.lineTo(x + width, baseline);
    ctx.fill();
    ctx.fillStyle = faces[1];
    ctx.fillRect(x + width * 0.16, top - 3, width * 0.45, 3);
    ctx.fillStyle = faces[2];
    for (let y = top + 5; y < baseline - 2; y += 6) {
      for (let col = x + 3; col < x + width - 3; col += 5) {
        if (random() > 0.38) ctx.fillRect(col, y, 2, 1.4);
      }
    }
    x += width + depth + random() * 5;
  }
}

function drawLandscape(ctx, w, h) {
  const scale = Math.max(w / 1000, h / 440);
  ctx.setTransform(scale, 0, 0, scale, w - scale * 1000, (h - scale * 440) * 0.54);
  const sky = ctx.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, '#4f6977');
  sky.addColorStop(0.42, '#a8aeaa');
  sky.addColorStop(0.66, '#ddc3a7');
  sky.addColorStop(1, '#40545c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1000, 440);

  const sun = ctx.createRadialGradient(756, 144, 2, 756, 144, 126);
  sun.addColorStop(0, '#fff1c7');
  sun.addColorStop(0.19, '#f4d9ac');
  sun.addColorStop(0.2, 'rgba(247,219,176,.48)');
  sun.addColorStop(1, 'rgba(247,219,176,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(620, 0, 280, 280);

  // Contours in the upper sky echo an engraved atmospheric atlas.
  ctx.lineWidth = 0.75;
  ctx.strokeStyle = 'rgba(240,232,210,.34)';
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 80 + i * 4);
    ctx.bezierCurveTo(300, -135 + i * 8, 380, 240 + i * 3, 705, 78 + i * 3);
    ctx.bezierCurveTo(848, 10 + i * 2, 880, 100 + i * 5, 1020, 39 + i * 6);
    ctx.stroke();
  }

  skyline(ctx, 249, 51, ['#9ba29c', '#a8ada5', '#c6c5b3'], 828);
  skyline(ctx, 271, 80, ['#7c8988', '#899590', '#adb3a6'], 465);

  // A distant tower and a cable-stayed crossing are imaginary urban landmarks.
  ctx.fillStyle = '#606f71';
  ctx.fillRect(860, 151, 25, 120);
  ctx.fillRect(865, 143, 14, 12);
  ctx.fillRect(869, 132, 5, 13);
  ctx.fillRect(871, 115, 1, 18);
  skyline(ctx, 309, 67, ['#53666a', '#647879', '#95a19b'], 903);
  const water = ctx.createLinearGradient(0, 300, 0, 440);
  water.addColorStop(0, '#85928d');
  water.addColorStop(1, '#2c414c');
  ctx.fillStyle = water;
  ctx.fillRect(0, 306, 1000, 134);
  const random = seededRandom(712);
  for (let i = 0; i < 650; i++) {
    const x = random() * 1000;
    const y = 308 + random() * 132;
    ctx.fillStyle = x > 690 && x < 820 ? 'rgba(239,214,170,.32)' : 'rgba(191,200,189,.18)';
    ctx.fillRect(x, y, 1 + random() * (y - 295) * 0.25, 0.8);
  }

  ctx.strokeStyle = '#394c52';
  ctx.lineWidth = 1.1;
  for (const tower of [600, 811]) {
    for (let end = 12; end <= 96; end += 12) {
      ctx.beginPath();
      ctx.moveTo(tower - end, 315 + (tower - end - 600) * 0.032);
      ctx.lineTo(tower, 241 + (96 - end) * 0.35 + (tower - 600) * 0.032);
      ctx.lineTo(tower + end, 315 + (tower + end - 600) * 0.032);
      ctx.stroke();
    }
    ctx.fillStyle = '#3c4e53';
    ctx.fillRect(tower - 1.8, 238 + (tower - 600) * 0.032, 3.6, 99);
  }
  ctx.beginPath();
  ctx.moveTo(0, 296);
  ctx.lineTo(1000, 328);
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#34484f';
  for (let x = -10; x < 1000; x += 86) ctx.fillRect(x, 295 + x * 0.032, 4, 29);

  // Fine grain is seeded once per buffer and never regenerated during animation.
  ctx.fillStyle = 'rgba(250,243,224,.10)';
  for (let i = 0; i < 4500; i++) ctx.fillRect(random() * 1000, random() * 440, 1, 1);
}

export function createAtmosphere(canvas, isActive) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return { setDensity() {}, drawOnce() {}, destroy() {} };
  const layer = document.createElement('canvas');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const random = seededRandom(438991);
  const particles = Array.from({length: 88}, () => ({
    x: random(), y: random() * 0.76 + 0.04, size: 0.6 + random() * 1.1,
    speed: 0.002 + random() * 0.01, phase: random() * TAU
  }));
  let count = 0, onScreen = false, destroyed = false;
  let frame = null, previous = null, phase = 0, width = 0, height = 0, ratio = 1;

  function paint() {
    ctx.drawImage(layer, 0, 0, width, height);
    if (!count) return;
    ctx.fillStyle = 'rgba(231,205,172,' + (0.02 + count / 700) + ')';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(253,238,206,.56)';
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const x = ((p.x + phase * p.speed) % 1) * width;
      const y = p.y * height + Math.sin(phase * 0.16 + p.phase) * 4;
      ctx.moveTo(x + p.size, y);
      ctx.arc(x, y, p.size, 0, TAU);
    }
    ctx.fill();
  }

  function tick(now) {
    if (previous === null || now - previous >= 48) {
      phase += previous === null ? 0 : Math.min(now - previous, 100) / 1000;
      previous = now;
      paint();
    }
    frame = requestAnimationFrame(tick);
  }

  function drawOnce() {
    cancelAnimationFrame(frame);
    frame = previous = null;
    if (destroyed || document.hidden || !onScreen || !isActive()) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nextRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    if (width !== rect.width || height !== rect.height || nextRatio !== ratio) {
      width = rect.width;
      height = rect.height;
      ratio = nextRatio;
      layer.width = canvas.width = Math.max(1, Math.round(width * ratio));
      layer.height = canvas.height = Math.max(1, Math.round(height * ratio));
      drawLandscape(layer.getContext('2d'), layer.width, layer.height);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    paint();
    if (count && !motion.matches) frame = requestAnimationFrame(tick);
  }

  function setDensity(pm) {
    count = Number.isFinite(pm) && pm >= 0 ? Math.min(88, 8 + Math.round(pm * 0.45)) : 0;
    drawOnce();
  }
  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    drawOnce();
  });
  const size = new ResizeObserver(drawOnce);
  visibility.observe(canvas);
  size.observe(canvas);
  document.addEventListener('visibilitychange', drawOnce);
  motion.addEventListener('change', drawOnce);

  function destroy() {
    destroyed = true;
    cancelAnimationFrame(frame);
    visibility.disconnect();
    size.disconnect();
    motion.removeEventListener('change', drawOnce);
    document.removeEventListener('visibilitychange', drawOnce);
    layer.width = layer.height = 0;
  }
  return { setDensity, drawOnce, destroy };
}
