// FUMPO platformer, level 1: "Moon Meadow". Physics, level, camera, HUD and input.
import * as A from "./art.js";

const $ = (id) => document.getElementById(id);
const cv = $("c"), ctx = cv.getContext("2d");
const T = 40, ROWS = 14, VIEW_H = ROWS * T, VIEW = 420;   // VIEW = world height on screen: the camera is zoomed in on FUMPO
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------------ level ---
// Terrain is a height map: for every column, the row where the ground starts (99 = pit).
const SEGMENTS = [[0, 18, 11], [21, 34, 11], [34, 40, 9], [43, 52, 9], [52, 58, 11], [64, 80, 11], [84, 96, 10], [100, 104, 8],
  [108, 112, 8], [116, 140, 11], [146, 160, 9], [164, 190, 11]];
const COLS = 190, LEVEL_W = COLS * T;
const top = new Array(COLS).fill(99);
for (const [a, b, r] of SEGMENTS) for (let c = a; c < b; c++) top[c] = r;
const PLATFORMS = [[59, 9, 2], [62, 8, 2], [88, 7, 3], [97, 8, 2], [104.5, 6, 3], [112.5, 7, 3], [121, 8, 3], [126, 6, 3], [161, 8, 2]]
  .map(([c, r, n]) => ({ x: c * T, y: r * T, w: n * T }));
const MOVERS = [{ x: 80.3 * T, y: 9.5 * T, w: 2.4 * T, a: 80.2 * T, b: 81.6 * T, v: 70 }, { x: 140.4 * T, y: 9.5 * T, w: 2.2 * T, a: 140.3 * T, b: 141.3 * T, v: 60 },
  { x: 143.8 * T, y: 8.5 * T, w: 2.2 * T, a: 142.9 * T, b: 143.8 * T, v: -60 }];
const SPIKES = [[47, 2], [124, 2], [155, 2], [172, 2]].map(([c, n]) => ({ x: c * T, y: top[c] * T, w: n * T }));
const FLAGS = [66, 118, 148].map((c) => ({ x: c * T + 20, y: top[c] * T, on: false }));
const ROCKET = { x: 183 * T, y: top[183] * T };
const CRYSTALS = [5, 12, 24, 31, 45, 54, 70, 77, 90, 110, 119, 131, 137, 150, 158, 167, 176, 187].map((c, i) => ({ x: c * T + 20, y: top[c] * T, seed: i }));
const coinDefs = [];
const line = (c, r, n) => { for (let i = 0; i < n; i++) coinDefs.push([c + i, r]); };
const arc = (c, r, n, h = 2) => { for (let i = 0; i < n; i++) coinDefs.push([c + i, r - Math.sin((i / (n - 1)) * Math.PI) * h]); };
line(6, 9.6, 4); arc(17.5, 9.2, 5); line(24, 9.6, 3); line(35, 7.6, 4); arc(40, 7.2, 4, 1.6); line(44, 7.6, 2); line(49, 7.6, 2);
line(59.3, 7.8, 2); line(62.3, 6.8, 2); line(69, 9.6, 3); line(76, 9.6, 3); arc(80, 7.8, 4, 1.4); line(88.3, 5.8, 3); line(92, 8.6, 3);
arc(96, 6.4, 4, 1.2); line(101, 6.6, 2); line(105, 4.8, 2); line(109, 6.6, 2); line(113, 5.8, 2); line(121.3, 6.8, 3); line(126.3, 4.8, 3);
line(130, 9.6, 4); arc(140, 7.6, 6, 1.6); line(149, 7.6, 3); line(157, 7.6, 2); arc(160, 6.6, 4, 1.4); line(166, 9.6, 4); arc(174, 9.2, 5); line(179, 9.6, 2);
const ENEMY_COLS = [27, 50, 68, 75, 92, 120, 128, 134, 152, 169, 177];
const PIZZAS = [[89.5, 5.6], [127.5, 4.6]];

const groundY = (x) => { const c = Math.floor(x / T); return c < 0 || c >= COLS || top[c] > ROWS ? Infinity : top[c] * T; };

// ------------------------------------------------------------------ state ---
const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
let muted = store.get("fumpo-plat-muted", "0") === "1", ac = null;
function beep(freq, dur, type = "square", vol = 0.05, slide = 0) {
  if (muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ac.currentTime + dur);
    g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
  } catch {}
}

const GRAV = 2300, RUN = 300, JUMP = 790, JUMP2 = 700, PW = 30, PH = 52;
let p, coins, enemies, pizzas, parts, texts, cam, mode = "title", time = 0, shake = 0, stats, spawn, launch = 0;

function reset() {
  spawn = { x: 3 * T, y: top[3] * T };
  p = { x: spawn.x, y: spawn.y, vx: 0, vy: 0, onGround: true, facing: 1, run: 0, squash: 0, hurt: 0, inv: 0, jumps: 0, coyote: 0, buffer: 0, hearts: 3, riding: null, dead: 0, mood: "idle" };
  coins = coinDefs.map(([c, r]) => ({ x: c * T + 20, y: r * T, got: false }));
  enemies = ENEMY_COLS.map((c) => ({ x: c * T + 20, y: top[c] * T, dir: -1, dead: 0, phase: c }));
  pizzas = PIZZAS.map(([c, r]) => ({ x: c * T, y: r * T, got: false }));
  for (const f of FLAGS) f.on = false;
  for (const m of MOVERS) { m.x = m.x0 ?? (m.x0 = m.x); m.v = m.v0 ?? (m.v0 = m.v); }
  parts = []; texts = [];
  cam = { x: 0, y: VIEW_H - VIEW };
  stats = { coins: 0, hits: 0, t: 0, stomps: 0 };
  launch = 0; shake = 0;
}

const input = { left: false, right: false, jump: false, jumpPressed: false };
function puff(x, y, n, color, spread = 120, up = 60) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * spread, vy: -Math.random() * up - 10, life: 0.35 + Math.random() * 0.3, max: 0.6, s: 3 + Math.random() * 4, c: color, g: 200 });
}
function hurt(fromX) {
  if (p.inv > 0 || mode !== "play") return;
  p.hearts--; stats.hits++; p.inv = 1.4; p.hurt = 0.5; p.vy = -520; p.vx = (p.x < fromX ? -1 : 1) * 260; p.onGround = false;
  shake = 0.3; beep(170, 0.3, "sawtooth", 0.07, -90); if (navigator.vibrate) try { navigator.vibrate(50); } catch {}
  if (p.hearts <= 0) gameOver();
}
function fell() {
  p.hearts--; stats.hits++; beep(140, 0.4, "sawtooth", 0.07, -80);
  if (p.hearts <= 0) return gameOver();
  Object.assign(p, { x: spawn.x, y: spawn.y, vx: 0, vy: 0, onGround: true, inv: 1.5, hurt: 0, jumps: 0 });
}
function gameOver() { mode = "over"; $("over").hidden = false; $("btn-retry").focus({ preventScroll: true }); }

// ----------------------------------------------------------------- update ---
function update(dt) {
  time += dt; stats.t += dt;
  for (const m of MOVERS) { m.dx = m.v * dt; m.x += m.dx; if (m.x < m.a) { m.x = m.a; m.v = Math.abs(m.v); } if (m.x > m.b) { m.x = m.b; m.v = -Math.abs(m.v); } }

  // run
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (p.hurt <= 0.25) {
    if (dir) { p.vx += dir * 2600 * dt; p.facing = dir; } else p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), (p.onGround ? 2400 : 700) * dt);
    p.vx = clamp(p.vx, -RUN, RUN);
  }
  // jump: buffered press, coyote time, double jump, short hop when released early
  p.buffer = input.jumpPressed ? 0.12 : Math.max(0, p.buffer - dt); input.jumpPressed = false;
  p.coyote = p.onGround ? 0.1 : Math.max(0, p.coyote - dt);
  if (p.buffer > 0 && (p.coyote > 0 || p.jumps < 2)) {
    const first = p.coyote > 0;
    p.vy = -(first ? JUMP : JUMP2); p.jumps = first ? 1 : 2; p.buffer = 0; p.coyote = 0; p.onGround = false; p.riding = null; p.squash = 1;
    beep(first ? 420 : 560, 0.12, "square", 0.045, 260); puff(p.x, p.y, first ? 6 : 9, first ? "#d7d2e8" : "#b6ff3c");
  }
  if (!input.jump && p.vy < -260) p.vy = -260;

  // horizontal move against the height map (walls are columns taller than a small step)
  let nx = p.x + p.vx * dt + (p.riding ? p.riding.dx : 0);
  const edge = nx + Math.sign(p.vx || 1) * PW / 2;
  if (groundY(edge) < p.y - 8) { nx = p.x; p.vx = 0; }
  p.x = clamp(nx, PW / 2, LEVEL_W - PW / 2);

  // vertical move, landing on ground, one-way platforms and moving platforms
  const prevY = p.y;
  p.vy = Math.min(p.vy + GRAV * dt, 1300); p.y += p.vy * dt;
  let floor = Math.min(groundY(p.x - PW / 2 + 5), groundY(p.x + PW / 2 - 5)), ride = null;
  for (const s of [...PLATFORMS, ...MOVERS]) {
    if (p.x + PW / 2 - 4 > s.x && p.x - PW / 2 + 4 < s.x + s.w && prevY <= s.y + 2 && s.y < floor) { floor = s.y; ride = s.v !== undefined ? s : null; }
  }
  const wasAir = !p.onGround;
  if (p.vy >= 0 && p.y >= floor && prevY <= floor + 14) {
    if (wasAir) { p.squash = -Math.min(1, p.vy / 900); if (p.vy > 350) { puff(p.x, floor, 8, "#d7d2e8"); beep(120, 0.06, "sine", 0.04); } }
    p.y = floor; p.vy = 0; p.onGround = true; p.jumps = 0; p.riding = ride;
  } else { p.onGround = false; p.riding = null; }
  if (p.y > VIEW_H + 160) return fell();

  // animation helpers
  if (p.onGround && Math.abs(p.vx) > 20) { p.run += Math.abs(p.vx) * dt * 0.052; if (Math.random() < dt * 9) puff(p.x - p.facing * 10, p.y, 1, "rgba(215,210,232,.8)", 40, 30); }
  p.squash *= Math.pow(0.0008, dt); p.hurt = Math.max(0, p.hurt - dt); p.inv = Math.max(0, p.inv - dt);

  // pickups
  for (const c of coins) if (!c.got && Math.abs(c.x - p.x) < 26 && Math.abs(c.y - (p.y - 30)) < 34) {
    c.got = true; stats.coins++; beep(880 + (stats.coins % 5) * 60, 0.08, "triangle", 0.06, 500);
    for (let i = 0; i < 7; i++) parts.push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 240, vy: (Math.random() - 0.5) * 240, life: 0.4, max: 0.4, s: 4, c: "#ffd23c", g: 0 });
  }
  for (const z of pizzas) if (!z.got && Math.abs(z.x - p.x) < 30 && Math.abs(z.y - (p.y - 30)) < 36) {
    z.got = true; if (p.hearts < 3) p.hearts++; beep(660, 0.2, "triangle", 0.06, 400); texts.push({ x: z.x, y: z.y - 20, t: 1, s: p.hearts < 3 ? "+1 heart" : "Yum!" });
  }
  for (const f of FLAGS) if (!f.on && Math.abs(f.x - p.x) < 40 && Math.abs(f.y - p.y) < 90) {
    f.on = true; spawn = { x: f.x, y: f.y }; beep(520, 0.25, "triangle", 0.05, 300); texts.push({ x: f.x, y: f.y - 90, t: 1.2, s: "Checkpoint!" });
  }
  // hazards
  for (const s of SPIKES) if (p.x + PW / 2 - 6 > s.x && p.x - PW / 2 + 6 < s.x + s.w && p.y > s.y - 14 && p.y < s.y + 10) hurt(s.x + s.w / 2);
  for (const e of enemies) {
    if (e.dead > 0) { e.dead += dt; continue; }
    const nxE = e.x + e.dir * 55 * dt, ahead = groundY(nxE + e.dir * 22);
    if (ahead !== e.y || SPIKES.some((s) => nxE + e.dir * 22 > s.x && nxE + e.dir * 22 < s.x + s.w && s.y === e.y)) e.dir *= -1; else e.x = nxE;
    if (Math.abs(e.x - p.x) < 30 && p.y > e.y - 34 && p.y - PH < e.y) {
      if (p.vy > 120 && prevY < e.y - 16) {                      // stomp
        e.dead = 0.001; p.vy = input.jump ? -720 : -480; p.jumps = 1; p.squash = 0.8; stats.stomps++; shake = 0.12;
        beep(260, 0.15, "square", 0.06, 300); puff(e.x, e.y - 14, 12, "#ff8a7a", 220, 160); texts.push({ x: e.x, y: e.y - 40, t: 0.8, s: "BONK" });
      } else hurt(e.x);
    }
  }
  // goal
  if (Math.abs(p.x - ROCKET.x) < 34 && p.y > ROCKET.y - 20) { mode = "launch"; launch = 0.001; p.mood = "win"; beep(300, 1.4, "sawtooth", 0.06, 900); }
}

function updateFx(dt) {
  for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; q.life -= dt; }
  parts = parts.filter((q) => q.life > 0);
  for (const t of texts) { t.y -= 40 * dt; t.t -= dt; }
  texts = texts.filter((t) => t.t > 0);
  if (shake > 0) shake -= dt;
}

// ------------------------------------------------------------------- draw ---
let W = 0, H = 0, dpr = 1, scale = 1, offY = 0, viewW = 800;
const isTouch = matchMedia("(pointer: coarse)").matches || location.search.includes("touch=1");
function fit() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const pad = isTouch && H > W ? 150 : 0;                         // room for the touch buttons in portrait
  scale = Math.min((H - pad) / VIEW, W / 430);
  viewW = W / scale; offY = Math.max(0, H - pad - VIEW * scale);
}
window.addEventListener("resize", fit);

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  A.drawBackground(ctx, W, offY + VIEW * scale, cam.x, time);
  const sx = shake > 0 ? (Math.random() - 0.5) * 10 * shake * 3 : 0, sy = shake > 0 ? (Math.random() - 0.5) * 10 * shake * 3 : 0;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, (-cam.x * scale + sx) * dpr, (offY - cam.y * scale + sy) * dpr);
  const c0 = Math.max(0, Math.floor(cam.x / T) - 1), c1 = Math.min(COLS, Math.ceil((cam.x + viewW) / T) + 1);
  const vis = (x, m = 80) => x > cam.x - m && x < cam.x + viewW + m;

  for (const k of CRYSTALS) if (vis(k.x)) A.drawCrystal(ctx, k.x, k.y + 4, k.seed);
  for (const f of FLAGS) if (vis(f.x)) A.drawFlag(ctx, f.x, f.y, time, f.on);
  if (vis(ROCKET.x, 200)) A.drawRocket(ctx, ROCKET.x, ROCKET.y, time, launch > 0 ? Math.pow(launch, 2.2) * 420 : 0);
  for (const s of SPIKES) if (vis(s.x)) A.drawSpikes(ctx, s.x, s.y + 2, s.w);
  for (let c = c0; c < c1; c++) {
    if (top[c] > ROWS) continue;
    for (let r = top[c]; r < ROWS + 12; r++) A.drawTile(ctx, c * T, r * T, T, r === top[c], c === 0 || top[c - 1] > r, c === COLS - 1 || top[c + 1] > r, c * 31 + r * 17);
  }
  for (const s of PLATFORMS) if (vis(s.x, 200)) A.drawPlatform(ctx, s.x, s.y, s.w);
  for (const s of MOVERS) if (vis(s.x, 200)) A.drawPlatform(ctx, s.x, s.y, s.w);
  for (const c of coins) if (!c.got && vis(c.x)) A.drawCoin(ctx, c.x, c.y, time + c.x * 0.01);
  for (const z of pizzas) if (!z.got && vis(z.x)) A.drawPizza(ctx, z.x, z.y, time);
  for (const e of enemies) if (e.dead < 0.35 && vis(e.x)) A.drawFud(ctx, e.x, e.y, time + e.phase, e.dir, e.dead > 0 ? Math.min(1, e.dead * 5) : 0);

  if (!(launch > 0.25)) {
    const blink = p.inv > 0 && Math.floor(time * 16) % 2 === 0;
    ctx.fillStyle = "rgba(0,0,0,.3)"; const gy = Math.min(groundY(p.x), ...PLATFORMS.concat(MOVERS).filter((s) => p.x > s.x && p.x < s.x + s.w && s.y >= p.y - 2).map((s) => s.y));
    if (isFinite(gy) && mode !== "title") { const k = clamp(1 - (gy - p.y) / 260, 0.3, 1); ctx.beginPath(); ctx.ellipse(p.x, gy + 3, 24 * k, 6 * k, 0, 0, Math.PI * 2); ctx.fill(); }
    if (!blink && mode !== "title") A.drawFumpo(ctx, p.x, p.y, 1.05, { ...p, t: time });
  }
  if (mode === "title") {
    const big = Math.min(3.2, (VIEW * 0.5) / 70), bx = cam.x + Math.min(viewW * 0.24, 230);
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(bx, top[3] * T + 4, 30 * big, 7 * big, 0, 0, Math.PI * 2); ctx.fill();
    A.drawFumpo(ctx, bx, top[3] * T, big, { t: time, facing: 1, vx: 0, vy: 0, onGround: true, run: 0, squash: Math.sin(time * 2.4) * 0.12, hurt: 0, mood: "idle" });
  }
  for (const q of parts) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.font = "900 20px system-ui, sans-serif"; ctx.textAlign = "center";
  for (const t of texts) { ctx.globalAlpha = clamp(t.t * 2, 0, 1); ctx.lineWidth = 5; ctx.strokeStyle = "#2b0a4a"; ctx.strokeText(t.s, t.x, t.y); ctx.fillStyle = "#b6ff3c"; ctx.fillText(t.s, t.x, t.y); }
  ctx.globalAlpha = 1;
}

function hud() {
  $("hearts").textContent = "♥".repeat(Math.max(0, p.hearts)) + "♡".repeat(Math.max(0, 3 - p.hearts));
  $("coins").textContent = `${stats.coins}/${coins.length}`;
  $("progress").style.width = clamp(p.x / ROCKET.x * 100, 0, 100) + "%";
}

// ------------------------------------------------------------------- loop ---
let last = performance.now(), acc = 0;
function frame(now) {
  const real = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  if (mode === "play") { acc += real; while (acc >= 1 / 120) { update(1 / 120); acc -= 1 / 120; if (mode !== "play") break; } }
  else if (mode === "title") { time += real; p.run += real * 3; }
  else if (mode === "launch") {
    time += real; launch += real * 0.5;
    if (launch < 0.25) { p.x += (ROCKET.x - p.x) * 0.2; p.vx = 0; }
    else for (let i = 0; i < 3; i++) parts.push({ x: ROCKET.x + (Math.random() - 0.5) * 20, y: ROCKET.y - Math.pow(launch, 2.2) * 420, vx: (Math.random() - 0.5) * 140, vy: 120 + Math.random() * 160, life: 0.7, max: 0.7, s: 6, c: Math.random() < 0.5 ? "#ff8a3c" : "#fff3b0", g: 0 });
    shake = 0.1;
    if (launch > 1.5) win();
  }
  if (mode !== "pause") updateFx(real);
  const target = clamp(p.x - viewW * 0.4 + p.facing * 70, 0, Math.max(0, LEVEL_W - viewW));
  cam.x += (target - cam.x) * (1 - Math.pow(0.004, real));
  const ty = clamp(p.y - VIEW * 0.66, 0, VIEW_H - VIEW);
  cam.y += (ty - cam.y) * (1 - Math.pow(0.02, real));
  draw(); hud();
  requestAnimationFrame(frame);
}

function win() {
  mode = "win";
  const pct = stats.coins / coins.length, stars = 1 + (pct >= 0.6 ? 1 : 0) + (pct >= 0.9 && stats.hits === 0 ? 1 : 0);
  $("win-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  $("win-sub").textContent = `${stats.coins} of ${coins.length} coins · ${Math.round(stats.t)} seconds · ${stats.stomps} FUD stomped`;
  $("win").hidden = false; $("btn-again").focus({ preventScroll: true });
  beep(660, 0.5, "triangle", 0.07, 500);
}
function start() { reset(); mode = "play"; for (const id of ["title", "over", "win", "pause"]) $(id).hidden = true; last = performance.now(); acc = 0; }
function togglePause() {
  if (mode === "play") { mode = "pause"; $("pause").hidden = false; }
  else if (mode === "pause") { mode = "play"; $("pause").hidden = true; last = performance.now(); }
}

// ------------------------------------------------------------------ input ---
const KEY = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" }, JUMPS = ["Space", "ArrowUp", "KeyW"];
document.addEventListener("keydown", (e) => {
  if (e.target.closest("button, a") && (e.code === "Space" || e.code === "Enter")) return;
  if (KEY[e.code]) { input[KEY[e.code]] = true; e.preventDefault(); }
  if (JUMPS.includes(e.code)) { e.preventDefault(); if (!e.repeat) { input.jump = true; input.jumpPressed = true; if (mode === "title") start(); } }
  if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat) togglePause();
  if (e.code === "KeyR" && !e.repeat && mode !== "title") start();
});
document.addEventListener("keyup", (e) => { if (KEY[e.code]) input[KEY[e.code]] = false; if (JUMPS.includes(e.code)) input.jump = false; });
window.addEventListener("blur", () => { input.left = input.right = input.jump = false; });
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "play") togglePause(); });
const hold = (id, on, off) => {
  const el = $(id);
  el.addEventListener("pointerdown", (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add("on"); on(); });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(ev, () => { el.classList.remove("on"); off(); });
};
hold("t-left", () => (input.left = true), () => (input.left = false));
hold("t-right", () => (input.right = true), () => (input.right = false));
hold("t-jump", () => { input.jump = true; input.jumpPressed = true; }, () => (input.jump = false));
for (const id of ["btn-start", "btn-retry", "btn-again", "btn-restart"]) $(id).addEventListener("click", start);
$("btn-resume").addEventListener("click", togglePause); $("btn-pause").addEventListener("click", togglePause);
const paintMute = () => ($("btn-mute").textContent = muted ? "Sound off" : "Sound on");
$("btn-mute").addEventListener("click", () => { muted = !muted; store.set("fumpo-plat-muted", muted ? "1" : "0"); paintMute(); });

// hook for automated checks only
window.__plat = { get p() { return p; }, get mode() { return mode; }, get stats() { return stats; }, input, start, top, T, ROCKET, groundY, enemies: () => enemies, spikes: SPIKES, platforms: PLATFORMS, movers: MOVERS,
  step(n, dt = 1 / 120) { for (let i = 0; i < n && mode === "play"; i++) update(dt); } };

document.body.classList.toggle("touch", isTouch);
reset(); fit(); paintMute();
requestAnimationFrame(frame);
