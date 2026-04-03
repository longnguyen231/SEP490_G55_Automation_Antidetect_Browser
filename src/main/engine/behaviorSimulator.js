/**
 * behaviorSimulator.js — Human-like behavior simulation for anti-detection.
 *
 * Simulates realistic user interactions to bypass bot-detection systems like
 * Cloudflare, DataDome, and PerimeterX. These systems analyze mouse movements,
 * scroll patterns, click timing, and idle behavior to distinguish bots from humans.
 *
 * Key techniques:
 *   - Bezier curve mouse movements (not straight lines)
 *   - Gaussian-distributed random delays between actions
 *   - Natural scroll behavior with variable speed and direction
 *   - Random idle periods that mimic reading/thinking
 *   - Realistic click patterns with micro-movements before clicking
 */

/**
 * Seeded PRNG for reproducible but random-looking behavior per profile.
 * Uses mulberry32 — fast, high-quality 32-bit PRNG.
 */
function createRng(seed) {
  let state = seed | 0;
  return function () {
    state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Generate a random number in [min, max] using the provided RNG.
 */
function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

/**
 * Generate a random integer in [min, max] inclusive.
 */
function randInt(rng, min, max) {
  return Math.floor(randRange(rng, min, max + 1));
}

/**
 * Gaussian-distributed random value (Box-Muller transform).
 * More realistic than uniform for timing: most delays cluster around the mean.
 */
function gaussianRandom(rng, mean, stddev) {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, mean + z * stddev);
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Math.round(ms))));
}

// ═══════════════════════════════════════════════════════════════════════
// BEZIER CURVE MOUSE MOVEMENT
// Real humans move the mouse in smooth arcs, not straight lines.
// We use cubic Bezier curves with randomized control points.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Calculate a point on a cubic Bezier curve at parameter t ∈ [0, 1].
 */
function bezierPoint(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/**
 * Generate an array of {x, y} points along a curved path from start to end.
 * Control points are randomized to create natural-looking arcs.
 *
 * @param {Function} rng - Seeded random number generator
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Ending X coordinate
 * @param {number} endY - Ending Y coordinate
 * @param {number} [steps=25] - Number of intermediate points
 * @returns {Array<{x: number, y: number}>}
 */
function generateBezierPath(rng, startX, startY, endX, endY, steps = 25) {
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Control points offset perpendicular to the line, creating a natural arc.
  // Offset magnitude scales with distance to keep curves proportional.
  const offsetScale = Math.min(dist * 0.4, 200);

  const cp1x = startX + dx * 0.25 + (rng() - 0.5) * offsetScale;
  const cp1y = startY + dy * 0.25 + (rng() - 0.5) * offsetScale;
  const cp2x = startX + dx * 0.75 + (rng() - 0.5) * offsetScale;
  const cp2y = startY + dy * 0.75 + (rng() - 0.5) * offsetScale;

  const points = [];
  // Dynamically adjust step count based on distance (more steps for longer paths)
  const actualSteps = Math.max(8, Math.min(steps, Math.round(dist / 10)));

  for (let i = 0; i <= actualSteps; i++) {
    const t = i / actualSteps;
    // Add slight easing — accelerate then decelerate like a real hand
    const eased = t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;

    points.push({
      x: Math.round(bezierPoint(eased, startX, cp1x, cp2x, endX)),
      y: Math.round(bezierPoint(eased, startY, cp1y, cp2y, endY)),
    });
  }

  return points;
}

/**
 * Move the mouse along a curved Bezier path from current position to target.
 * Each step has a small random delay to mimic human motor control.
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {Function} rng - Seeded RNG
 * @param {number} targetX - Target X coordinate
 * @param {number} targetY - Target Y coordinate
 * @param {Object} [opts] - Options
 * @param {number} [opts.speed=1] - Speed multiplier (0.5 = slow, 2 = fast)
 */
async function moveMouseCurved(page, rng, targetX, targetY, opts = {}) {
  const speed = opts.speed || 1;

  // Get current mouse position (or start from a random edge position)
  let startX, startY;
  try {
    const pos = await page.evaluate(() => ({
      x: window.__lastMouseX || Math.round(window.innerWidth * 0.5),
      y: window.__lastMouseY || Math.round(window.innerHeight * 0.5),
    }));
    startX = pos.x;
    startY = pos.y;
  } catch {
    startX = randInt(rng, 100, 800);
    startY = randInt(rng, 100, 400);
  }

  const path = generateBezierPath(rng, startX, startY, targetX, targetY);

  for (const point of path) {
    await page.mouse.move(point.x, point.y);
    // Small random delay between each movement step (2-12ms base, adjusted by speed)
    await sleep(randRange(rng, 2, 12) / speed);
  }

  // Track the last position for the next movement
  try {
    await page.evaluate(({ x, y }) => {
      window.__lastMouseX = x;
      window.__lastMouseY = y;
    }, { x: targetX, y: targetY });
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════
// SCROLL BEHAVIOR
// Real users scroll in bursts with variable speed, occasionally
// scrolling back up slightly.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Simulate natural scrolling behavior on a page.
 * Scrolls in small increments with variable delays.
 *
 * @param {import('playwright').Page} page
 * @param {Function} rng
 * @param {Object} [opts]
 * @param {number} [opts.distance=300] - Total pixels to scroll
 * @param {string} [opts.direction='down'] - 'down' or 'up'
 * @param {number} [opts.speed=1] - Speed multiplier
 */
async function naturalScroll(page, rng, opts = {}) {
  const totalDistance = opts.distance || randInt(rng, 200, 600);
  const direction = opts.direction === 'up' ? -1 : 1;
  const speed = opts.speed || 1;

  let scrolled = 0;

  while (scrolled < totalDistance) {
    // Each scroll increment varies (50-150px), simulating mousewheel notches
    const increment = randInt(rng, 50, 150);
    const actualScroll = Math.min(increment, totalDistance - scrolled);

    await page.mouse.wheel(0, actualScroll * direction);
    scrolled += actualScroll;

    // Variable delay between scroll events (30-120ms)
    await sleep(randRange(rng, 30, 120) / speed);

    // 10% chance of a brief pause (like reading something that caught the eye)
    if (rng() < 0.1) {
      await sleep(randRange(rng, 300, 800));
    }

    // 5% chance of a small reverse scroll (user overshoots then corrects)
    if (rng() < 0.05 && scrolled > 100) {
      const correction = randInt(rng, 20, 60);
      await page.mouse.wheel(0, -correction * direction);
      await sleep(randRange(rng, 50, 150));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CLICK SIMULATION
// Before clicking, humans move the mouse to the target (often imprecisely
// at first), hover briefly, then click. Sometimes they double-click or
// make micro-adjustments.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Click an element with human-like behavior: move mouse to it, brief hover,
 * then click. Optionally adds micro-movements near the target.
 *
 * @param {import('playwright').Page} page
 * @param {Function} rng
 * @param {string} selector - CSS selector of the element to click
 * @param {Object} [opts]
 * @param {number} [opts.hoverTime] - Time to hover before clicking (ms)
 */
async function humanClick(page, rng, selector, opts = {}) {
  try {
    const box = await page.locator(selector).first().boundingBox();
    if (!box) return false;

    // Target a random point within the element (not dead center — that's bot-like)
    const targetX = box.x + randRange(rng, box.width * 0.2, box.width * 0.8);
    const targetY = box.y + randRange(rng, box.height * 0.2, box.height * 0.8);

    // Move to target with curved path
    await moveMouseCurved(page, rng, targetX, targetY);

    // Brief hover before clicking (50-300ms)
    const hoverTime = opts.hoverTime || randRange(rng, 50, 300);
    await sleep(hoverTime);

    // Optional micro-adjustment (30% chance — simulates user fine-tuning aim)
    if (rng() < 0.3) {
      const adjustX = targetX + randRange(rng, -3, 3);
      const adjustY = targetY + randRange(rng, -3, 3);
      await page.mouse.move(adjustX, adjustY);
      await sleep(randRange(rng, 20, 50));
    }

    // Click
    await page.mouse.click(targetX, targetY, {
      delay: randInt(rng, 40, 120), // time between mousedown and mouseup
    });

    return true;
  } catch {
    // Fallback: use Playwright's built-in click if element interaction fails
    try {
      await page.click(selector, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TYPING SIMULATION
// Real typing has variable speed, occasional pauses between words,
// and sometimes brief hesitations mid-word.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Type text with human-like timing variations.
 *
 * @param {import('playwright').Page} page
 * @param {Function} rng
 * @param {string} selector - CSS selector of the input element
 * @param {string} text - Text to type
 * @param {Object} [opts]
 * @param {number} [opts.wpm=60] - Words per minute (approximate)
 */
async function humanType(page, rng, selector, text, opts = {}) {
  const wpm = opts.wpm || 60;
  // Average ms per character based on WPM (assuming 5 chars per word)
  const baseDelay = (60 * 1000) / (wpm * 5);

  // Click the input first
  await humanClick(page, rng, selector);
  await sleep(randRange(rng, 100, 300));

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Type the character
    await page.keyboard.type(char, { delay: 0 });

    // Calculate delay for next character
    let delay = gaussianRandom(rng, baseDelay, baseDelay * 0.3);

    // Space characters get a slightly longer pause (word boundary)
    if (char === ' ') {
      delay *= 1.5;
    }

    // Occasional longer pause (thinking/hesitation) — 3% chance
    if (rng() < 0.03) {
      delay += randRange(rng, 200, 600);
    }

    await sleep(delay);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// IDLE TIME SIMULATION
// Real users don't constantly interact — they read, think, switch tabs.
// Inserting realistic idle periods prevents detection heuristics that
// measure interaction density.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Simulate an idle period as if the user is reading/thinking.
 * Occasionally moves the mouse slightly (hand jitter on a real mouse).
 *
 * @param {import('playwright').Page} page
 * @param {Function} rng
 * @param {Object} [opts]
 * @param {number} [opts.minMs=2000] - Minimum idle time
 * @param {number} [opts.maxMs=8000] - Maximum idle time
 */
async function simulateIdle(page, rng, opts = {}) {
  const minMs = opts.minMs || 2000;
  const maxMs = opts.maxMs || 8000;
  const idleTime = randRange(rng, minMs, maxMs);

  const startTime = Date.now();
  while (Date.now() - startTime < idleTime) {
    // 40% chance of a small mouse jitter during idle (hand resting on mouse)
    if (rng() < 0.4) {
      try {
        const pos = await page.evaluate(() => ({
          x: window.__lastMouseX || window.innerWidth / 2,
          y: window.__lastMouseY || window.innerHeight / 2,
        }));
        const jitterX = pos.x + randRange(rng, -5, 5);
        const jitterY = pos.y + randRange(rng, -5, 5);
        await page.mouse.move(jitterX, jitterY);
      } catch {}
    }
    // Wait 500-1500ms between jitter checks
    await sleep(randRange(rng, 500, 1500));
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RANDOM DELAY
// Insert a random delay between actions. Uses Gaussian distribution
// for more realistic timing patterns.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Wait for a random amount of time.
 *
 * @param {Function} rng
 * @param {number} [minMs=500] - Minimum delay
 * @param {number} [maxMs=2000] - Maximum delay
 */
async function randomDelay(rng, minMs = 500, maxMs = 2000) {
  const mean = (minMs + maxMs) / 2;
  const stddev = (maxMs - minMs) / 4;
  const delay = gaussianRandom(rng, mean, stddev);
  // Clamp to [minMs, maxMs * 1.5] to avoid extreme outliers
  await sleep(Math.min(maxMs * 1.5, Math.max(minMs, delay)));
}

// ═══════════════════════════════════════════════════════════════════════
// COMPOSITE BEHAVIOR: "Browse like a human"
// Combines multiple behaviors into a single realistic browsing session.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Simulate a sequence of human-like behaviors on the current page.
 * Useful after navigating to a new page to appear like a real visitor.
 *
 * @param {import('playwright').Page} page
 * @param {Function} rng
 * @param {Object} [opts]
 * @param {number} [opts.duration=10000] - Approximate total duration (ms)
 */
async function simulateBrowsing(page, rng, opts = {}) {
  const duration = opts.duration || randInt(rng, 5000, 15000);
  const startTime = Date.now();

  while (Date.now() - startTime < duration) {
    const action = rng();

    if (action < 0.3) {
      // 30% — Scroll down
      await naturalScroll(page, rng, { distance: randInt(rng, 100, 400) });
    } else if (action < 0.45) {
      // 15% — Scroll up
      await naturalScroll(page, rng, { distance: randInt(rng, 50, 200), direction: 'up' });
    } else if (action < 0.65) {
      // 20% — Move mouse to a random position (looking around)
      try {
        const viewport = await page.viewportSize();
        const w = viewport?.width || 1920;
        const h = viewport?.height || 1080;
        const randX = randInt(rng, 50, w - 50);
        const randY = randInt(rng, 50, h - 50);
        await moveMouseCurved(page, rng, randX, randY);
      } catch {}
    } else {
      // 35% — Idle / reading
      await simulateIdle(page, rng, { minMs: 1000, maxMs: 3000 });
    }

    // Brief pause between actions
    await randomDelay(rng, 200, 800);

    // Safety: break if we've gone way over duration
    if (Date.now() - startTime > duration * 2) break;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// INIT SCRIPT — Inject mouse position tracking into the page
// This allows moveMouseCurved to know the current cursor position.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Add an init script to track mouse position for the behavior simulator.
 * Should be called once per context before using behavior simulation.
 *
 * @param {import('playwright').BrowserContext} context
 */
async function injectMouseTracker(context) {
  try {
    await context.addInitScript(() => {
      try {
        document.addEventListener('mousemove', (e) => {
          window.__lastMouseX = e.clientX;
          window.__lastMouseY = e.clientY;
        }, { passive: true });
      } catch {}
    });
  } catch {}
}

module.exports = {
  createRng,
  randRange,
  randInt,
  gaussianRandom,
  sleep,
  generateBezierPath,
  moveMouseCurved,
  naturalScroll,
  humanClick,
  humanType,
  simulateIdle,
  randomDelay,
  simulateBrowsing,
  injectMouseTracker,
};
