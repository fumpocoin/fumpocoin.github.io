// Page glue: input (keyboard + touch), camera, HUD, overlays and the game loop.
import { createGame, step, objective, WANTED_MAX } from "./sim.js";
import { render } from "./render.js";

const $ = (id) => document.getElementById(id);
const cv = $("c"), ctx = cv.getContext("2d");
let W = 0, H = 0, dpr = 1;
function fit() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", fit);

// ---------------------------------------------------------------- sound ---
const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
let muted = store.get("fumpo-play-muted", "0") === "1", ac = null;
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

// ---------------------------------------------------------------- input ---
const keys = new Set();
let actionQueued = false, touchMove = { x: 0, y: 0 }, touchBrake = false;
const isTouch = matchMedia("(pointer: coarse)").matches || location.search.includes("touch=1");
document.addEventListener("keydown", (e) => {
  if (e.target.closest("button, a") && (e.code === "Space" || e.code === "Enter")) return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === "KeyE" || e.code === "Enter") actionQueued = true;
  if (e.code === "KeyP" || e.code === "Escape") togglePause();
  if (e.code === "KeyR" && mode !== "brief") restart();
});
document.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());

// touch: a floating stick on the left half, two buttons on the right
const stick = $("stick"), knob = $("knob");
let stickId = null, origin = null;
$("pad").addEventListener("pointerdown", (e) => {
  if (stickId !== null) return;
  stickId = e.pointerId; origin = { x: e.clientX, y: e.clientY };
  stick.style.left = origin.x + "px"; stick.style.top = origin.y + "px"; stick.hidden = false;
  $("pad").setPointerCapture(e.pointerId);
});
$("pad").addEventListener("pointermove", (e) => {
  if (e.pointerId !== stickId) return;
  let dx = e.clientX - origin.x, dy = e.clientY - origin.y; const d = Math.hypot(dx, dy), max = 52;
  if (d > max) { dx *= max / d; dy *= max / d; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  touchMove = { x: dx / max, y: dy / max };
});
const endStick = (e) => { if (e.pointerId !== stickId) return; stickId = null; touchMove = { x: 0, y: 0 }; stick.hidden = true; knob.style.transform = ""; };
$("pad").addEventListener("pointerup", endStick); $("pad").addEventListener("pointercancel", endStick);
$("btn-action").addEventListener("pointerdown", (e) => { e.preventDefault(); actionQueued = true; });
$("btn-brake").addEventListener("pointerdown", (e) => { e.preventDefault(); touchBrake = true; });
for (const ev of ["pointerup", "pointercancel", "pointerleave"]) $("btn-brake").addEventListener(ev, () => (touchBrake = false));

function readInput() {
  let mx = touchMove.x, my = touchMove.y;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) my -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) my += 1;
  const input = { mx, my, action: actionQueued, brake: touchBrake || keys.has("Space") };
  actionQueued = false;
  return input;
}

// ----------------------------------------------------------------- game ---
let g = createGame(), mode = "brief";          // brief | play | pause | end
const cam = { x: g.player.x, y: g.player.y, scale: 14 };
let hintTimer = 0, lastHint = "", toastTimer = 0;

function toast(text, secs = 2.6) { $("toast").textContent = text; $("toast").hidden = false; toastTimer = secs; }
function show(id) { for (const o of ["brief", "pause", "end"]) $(o).hidden = o !== id; }
function start() { mode = "play"; show(null); last = performance.now(); }
function restart() { g = createGame(); cam.x = g.player.x; cam.y = g.player.y; $("toast").hidden = true; start(); }
function togglePause() {
  if (mode === "play") { mode = "pause"; show("pause"); }
  else if (mode === "pause") start();
}
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "play") togglePause(); });
$("btn-start").addEventListener("click", start);
$("btn-resume").addEventListener("click", start);
$("btn-pause").addEventListener("click", togglePause);
for (const id of ["btn-restart", "btn-again"]) $(id).addEventListener("click", restart);
$("btn-mute").addEventListener("click", () => { muted = !muted; store.set("fumpo-play-muted", muted ? "1" : "0"); paintMute(); });
const paintMute = () => ($("btn-mute").textContent = muted ? "Sound off" : "Sound on");

function handleEvents() {
  for (const e of g.events.splice(0)) {
    if (e.type === "enter") beep(330, 0.1, "triangle", 0.05, 200);
    else if (e.type === "exit") beep(300, 0.1, "triangle", 0.05, -120);
    else if (e.type === "crash" && !e.police) { beep(110, 0.25, "sawtooth", 0.07, -60); if (navigator.vibrate) navigator.vibrate(40); }
    else if (e.type === "ram") beep(90, 0.3, "sawtooth", 0.08, -40);
    else if (e.type === "pizza") { beep(660, 0.12, "triangle", 0.06, 300); toast("FUMPO grabbed the pizza... and forgot his wallet. RUN!", 3.5); }
    else if (e.type === "wanted") beep(520, 0.4, "square", 0.05, 380);
    else if (e.type === "cop" && e.state === "lost") toast("They lost sight of you. Stay hidden!");
    else if (e.type === "escaped") { beep(880, 0.25, "triangle", 0.06, 400); toast("You lost them! Take the pizza home."); }
    else if (e.type === "win") end(true);
    else if (e.type === "fail") end(false, e.reason);
  }
}
function end(win, reason) {
  mode = "end"; show("end");
  $("end-title").textContent = win ? "Pizza delivered!" : reason;
  $("end-sub").textContent = win
    ? `Mission complete in ${Math.round(g.t)} seconds, with the pizza still ${g.mission.heat > 60 ? "hot" : "warm"}.`
    : "The Pizza Incident did not go as planned.";
  beep(win ? 660 : 160, 0.5, win ? "triangle" : "sawtooth", 0.07, win ? 500 : -100);
  $("btn-again").focus({ preventScroll: true });
}

function hud() {
  $("objective").textContent = objective(g);
  $("stars").textContent = "★".repeat(g.wanted) + "☆".repeat(WANTED_MAX - g.wanted);
  $("stars").classList.toggle("hot", g.wanted > 0);
  $("car").style.width = Math.round(g.car.health) + "%";
  $("car").style.background = g.car.health > 55 ? "#b6ff3c" : g.car.health > 30 ? "#ffd23c" : "#ff4d6d";
  const m = g.mission;
  $("heat-row").hidden = !m.hasPizza;
  if (m.hasPizza) { $("heat").style.width = Math.max(0, m.heat / m.heatMax * 100) + "%"; $("heat-s").textContent = Math.max(0, Math.ceil(m.heat)) + "s"; }
  const near = !g.player.inCar && Math.hypot(g.car.x - g.player.x, g.car.y - g.player.y) < 3.6;
  $("btn-action").textContent = g.player.inCar ? "EXIT" : "ENTER";
  $("btn-action").classList.toggle("ready", near || (g.player.inCar && Math.abs(g.car.speed) < 3));
  $("btn-brake").hidden = !g.player.inCar;
  $("keys").textContent = g.player.inCar ? "WASD drive · Space brake · E exit" : near ? "Press E to get in" : "WASD move · E enter car";
  if (m.hint && m.hint !== lastHint) { toast(m.hint, 2); lastHint = m.hint; hintTimer = 3; }
}

let last = performance.now(), acc = 0, time = 0;
function frame(now) {
  const real = Math.min(0.1, (now - last) / 1000 || 0); last = now; time += real;
  if (mode === "play") {
    acc += real;
    const input = readInput();
    while (acc >= 1 / 60) { step(g, input, 1 / 60); input.action = false; acc -= 1 / 60; }
    handleEvents(); hud();
    if (toastTimer > 0 && (toastTimer -= real) <= 0) $("toast").hidden = true;
    if (hintTimer > 0 && (hintTimer -= real) <= 0) { g.mission.hint = ""; lastHint = ""; }
  }
  // camera: follow with a little look-ahead, pull back when driving
  const p = g.player.inCar ? g.car : g.player, sp = g.player.inCar ? g.car.speed : 0;
  const tx = p.x + Math.cos(g.car.heading) * sp * 0.45, ty = p.y + Math.sin(g.car.heading) * sp * 0.45;
  const k = 1 - Math.pow(0.002, real);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  const span = g.player.inCar ? 46 + Math.abs(sp) * 0.8 : 24;      // metres visible on the short side
  cam.scale += (Math.min(W, H) / span - cam.scale) * (1 - Math.pow(0.05, real));
  render(ctx, g, { w: W, h: H, scale: cam.scale, camX: cam.x, camY: cam.y }, time);
  requestAnimationFrame(frame);
}

// hook for automated checks only
window.__play = { get g() { return g; }, get mode() { return mode; }, start, restart, step: (input, n = 1) => { for (let i = 0; i < n; i++) step(g, input, 1 / 60); handleEvents(); hud(); } };

document.body.classList.toggle("touch", isTouch);
fit(); paintMute(); hud(); show("brief");
cam.scale = Math.min(W, H) / 24;
requestAnimationFrame(frame);
