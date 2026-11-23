export function createAtmosphere(canvas, isActive) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return { setDensity() {}, drawOnce() {} };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const shell = document.createElement('canvas');
  const turn = 2 * Math.PI;
  let width = 0, height = 0, radius = 0, pixelRatio = 0;
  let particles = [], hasReading = false, onScreen = false;
  let request = null, previous = null, phase = 0;

  // Bake the etched outline once per size. A stack of offset ellipses
  // shares a grazing highlight, like light catching the edge of thin glass.
  function prepareShell() {
    const side = Math.ceil(2.4 * radius * pixelRatio);
    shell.width = shell.height = side;
    const ink = shell.getContext('2d');
    ink.translate(side / 2, side / 2);
    ink.scale(radius * pixelRatio, radius * pixelRatio);
    ink.rotate(-0.43);
    const wash = ink.createLinearGradient(-1, -0.6, 0.8, 0.6);
    wash.addColorStop(0, 'rgba(224,223,184,.17)');
    wash.addColorStop(0.36, 'rgba(118,153,133,.05)');
    wash.addColorStop(0.72, 'rgba(28,49,44,.15)');
    wash.addColorStop(1, 'rgba(188,125,85,.20)');
    for (let layer = 0; layer < 13; layer++) {
      const depth = (layer - 6) / 7;
      const span = Math.sqrt(1 - depth * depth);
      const offset = depth * 0.49;
      ink.beginPath();
      ink.ellipse(0, offset, span, span * 0.56, 0, 0, turn);
      if (layer === 6) {
        ink.fillStyle = wash;
        ink.fill();
      }
      ink.lineWidth = 0.8 / radius;
      ink.strokeStyle = layer < 6 ? 'rgba(155,187,160,.13)' : 'rgba(180,201,172,.24)';
      ink.stroke();
      ink.beginPath();
      ink.ellipse(0, offset, span, span * 0.56, 0, 0.15, 1.45);
      ink.strokeStyle = 'rgba(207,158,111,.34)';
      ink.stroke();
    }
  }

  function draw() {
    const x = width * 0.51, y = height * 0.47;
    ctx.clearRect(0, 0, width, height);
    const side = shell.width / pixelRatio;
    ctx.drawImage(shell, x - side / 2, y - side / 2, side, side);
    for (const p of particles) {
      const angle = p.angle + phase * p.speed;
      const depth = Math.sin(angle);
      const px = x + Math.cos(angle) * radius * p.radius;
      const py = y + depth * radius * p.radius * 0.72;
      ctx.globalAlpha = (0.28 + depth * 0.14) * (hasReading ? 1 : 0.8);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, turn);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function step(now) {
    if (previous === null || now - previous >= 34) {
      phase += previous === null ? 0 : Math.min(now - previous, 100) * 0.0001;
      previous = now;
      draw();
    }
    request = requestAnimationFrame(step);
  }

  function drawOnce() {
    cancelAnimationFrame(request);
    request = previous = null;
    if (document.hidden || !onScreen || !isActive()) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.8);
    if (width !== rect.width || height !== rect.height || ratio !== pixelRatio) {
      width = rect.width;
      height = rect.height;
      pixelRatio = ratio;
      radius = Math.min(width * 0.43, height * 0.47);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      prepareShell();
    }
    draw();
    if (!reduced.matches) request = requestAnimationFrame(step);
  }

  function setDensity(value) {
    hasReading = Number.isFinite(value) && value >= 0;
    const count = hasReading ? Math.min(200, Math.round(40 + value * 0.95)) : 60;
    let seed = 438991;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    particles = Array.from({length: count}, (_, i) => ({
      angle: random() * turn, radius: 0.13 + random() * 0.85,
      speed: 0.07 + random() * 0.18, size: 0.5 + random() * 1.7,
      color: i % 5 === 0 ? '#e3ad79' : '#c7dfc0'
    }));
    drawOnce();
  }

  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    drawOnce();
  }).observe(canvas);
  new ResizeObserver(drawOnce).observe(canvas);
  window.addEventListener('resize', drawOnce);
  document.addEventListener('visibilitychange', drawOnce);
  reduced.addEventListener('change', drawOnce);
  setDensity();
  return { setDensity, drawOnce };
}
