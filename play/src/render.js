// Top-down renderer. It only reads the simulation state; nothing here changes gameplay.
// To move to isometric art later, replace this file: project(x, y) and the draw* functions.
import { BLOCK, ROAD, COLS, ROWS, dir8, target, ARREST_SECONDS } from "./sim.js";

const TAU = Math.PI * 2;

export function render(ctx, g, view, time) {
  const { w, h, scale, camX, camY } = view;
  const X = (x) => (x - camX) * scale + w / 2, Y = (y) => (y - camY) * scale + h / 2;
  const world = g.world;

  ctx.fillStyle = "#1a1228"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#4a4560"; ctx.fillRect(X(0), Y(0), world.w * scale, world.h * scale);       // sidewalks

  // roads
  ctx.fillStyle = "#2a2836";
  for (let i = 0; i <= COLS; i++) ctx.fillRect(X(i * (BLOCK + ROAD)), Y(0), ROAD * scale, world.h * scale);
  for (let j = 0; j <= ROWS; j++) ctx.fillRect(X(0), Y(j * (BLOCK + ROAD)), world.w * scale, ROAD * scale);
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = Math.max(1, 0.18 * scale); ctx.setLineDash([2.2 * scale, 2.6 * scale]);
  ctx.beginPath();
  for (let i = 0; i <= COLS; i++) { const x = X(ROAD / 2 + i * (BLOCK + ROAD)); ctx.moveTo(x, Y(0)); ctx.lineTo(x, Y(world.h)); }
  for (let j = 0; j <= ROWS; j++) { const y = Y(ROAD / 2 + j * (BLOCK + ROAD)); ctx.moveTo(X(0), y); ctx.lineTo(X(world.w), y); }
  ctx.stroke(); ctx.setLineDash([]);

  for (const p of world.parks) { ctx.fillStyle = "#2f6b3f"; ctx.fillRect(X(p.x), Y(p.y), p.w * scale, p.h * scale); }

  // mission zones
  const goal = target(g);
  for (const z of [world.pizzeria, world.home]) {
    const active = z === goal, pulse = 1 + Math.sin(time * 4) * 0.08;
    ctx.beginPath(); ctx.arc(X(z.x), Y(z.y), z.r * scale * (active ? pulse : 1), 0, TAU);
    ctx.fillStyle = active ? "rgba(182,255,60,.22)" : "rgba(255,255,255,.07)"; ctx.fill();
    ctx.lineWidth = Math.max(2, 0.25 * scale); ctx.strokeStyle = active ? "#b6ff3c" : "rgba(255,255,255,.25)"; ctx.stroke();
    ctx.fillStyle = active ? "#b6ff3c" : "rgba(255,255,255,.5)"; ctx.font = `900 ${Math.max(10, 1.5 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(z.label, X(z.x), Y(z.y));
  }

  // buildings: soft shadow, then roof
  for (const b of world.buildings) {
    if (X(b.x + b.w) < -40 || X(b.x) > w + 40 || Y(b.y + b.h) < -40 || Y(b.y) > h + 40) continue;
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(X(b.x) + 0.8 * scale, Y(b.y) + 0.8 * scale, b.w * scale, b.h * scale);
    ctx.fillStyle = b.color; ctx.fillRect(X(b.x), Y(b.y), b.w * scale, b.h * scale);
    ctx.fillStyle = "rgba(255,255,255,.10)"; ctx.fillRect(X(b.x) + scale, Y(b.y) + scale, b.w * scale - 2 * scale, b.h * scale - 2 * scale);
    ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(X(b.x + b.w * 0.62), Y(b.y + b.h * 0.2), 3 * scale, 3 * scale);   // roof unit
  }
  for (const t of world.trees) {
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.arc(X(t.x) + 0.5 * scale, Y(t.y) + 0.5 * scale, t.r * scale, 0, TAU); ctx.fill();
    ctx.fillStyle = "#3f9a55"; ctx.beginPath(); ctx.arc(X(t.x), Y(t.y), t.r * scale, 0, TAU); ctx.fill();
    ctx.fillStyle = "#58b96d"; ctx.beginPath(); ctx.arc(X(t.x) - 0.5 * scale, Y(t.y) - 0.5 * scale, t.r * 0.55 * scale, 0, TAU); ctx.fill();
  }

  drawCar(ctx, X(g.car.x), Y(g.car.y), g.car.heading, scale, g.car, g.player.inCar, time, false);
  drawCar(ctx, X(g.police.x), Y(g.police.y), g.police.heading, scale, g.police, false, time, g.cop.state === "pursuit" || g.cop.state === "lost" || g.cop.state === "search");
  if (!g.player.inCar) drawCharacter(ctx, X(g.player.x), Y(g.player.y), scale * 1.5, { dir: dir8(g.player.facing), anim: g.player.anim, phase: g.player.phase });

  // arrest progress ring
  if (g.cop.arrest > 0.05) {
    const p = g.player.inCar ? g.car : g.player;
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 3.4 * scale, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, g.cop.arrest / ARREST_SECONDS));
    ctx.strokeStyle = "#ff4d6d"; ctx.lineWidth = Math.max(3, 0.4 * scale); ctx.stroke();
  }

  // arrow to the objective when it is off screen
  const gx = X(goal.x), gy = Y(goal.y), m = 46;
  if (gx < m || gx > w - m || gy < m || gy > h - m) {
    const ang = Math.atan2(gy - h / 2, gx - w / 2);
    const ax = Math.max(m, Math.min(w - m, w / 2 + Math.cos(ang) * (w / 2 - m))), ay = Math.max(m, Math.min(h - m, h / 2 + Math.sin(ang) * (h / 2 - m)));
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.fillStyle = "#b6ff3c"; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawCar(ctx, x, y, heading, s, car, occupied, time, siren) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(heading);
  const L = 4.7 * s, Wd = 2.2 * s;
  ctx.fillStyle = "rgba(0,0,0,.35)"; roundRect(ctx, -L / 2 + 0.4 * s, -Wd / 2 + 0.4 * s, L, Wd, 0.5 * s); ctx.fill();
  ctx.fillStyle = car.police ? "#f1f3f8" : car.health < 30 ? "#7a6a2a" : "#ffd23c";
  roundRect(ctx, -L / 2, -Wd / 2, L, Wd, 0.55 * s); ctx.fill();
  if (car.police) { ctx.fillStyle = "#1c2b57"; ctx.fillRect(-L * 0.12, -Wd / 2, L * 0.24, Wd); }
  ctx.fillStyle = "#1b1b2a"; roundRect(ctx, -L * 0.2, -Wd * 0.38, L * 0.42, Wd * 0.76, 0.3 * s); ctx.fill();     // cabin glass
  ctx.fillStyle = car.police ? "#dfe6ff" : "#fff6c9"; ctx.fillRect(L / 2 - 0.35 * s, -Wd * 0.4, 0.3 * s, 0.5 * s); ctx.fillRect(L / 2 - 0.35 * s, Wd * 0.4 - 0.5 * s, 0.3 * s, 0.5 * s);
  ctx.fillStyle = "#c2263a"; ctx.fillRect(-L / 2 + 0.05 * s, -Wd * 0.4, 0.25 * s, 0.5 * s); ctx.fillRect(-L / 2 + 0.05 * s, Wd * 0.4 - 0.5 * s, 0.25 * s, 0.5 * s);
  if (car.police) {
    const on = siren && Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = on ? "#ff3b5c" : "#7a1f2e"; ctx.fillRect(-0.3 * s, -Wd * 0.3, 0.6 * s, Wd * 0.28);
    ctx.fillStyle = siren && !on ? "#4d7bff" : "#22386e"; ctx.fillRect(-0.3 * s, Wd * 0.02, 0.6 * s, Wd * 0.28);
  } else if (occupied) {                                                        // FUMPO's green hair through the roof
    ctx.fillStyle = "#b6ff3c"; ctx.beginPath(); ctx.arc(0.1 * s, 0, 0.42 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = "#a24bff"; ctx.beginPath(); ctx.arc(0.1 * s, 0, 0.26 * s, 0, TAU); ctx.fill();
  }
  if (car.health < 55) { ctx.fillStyle = "rgba(60,60,60,.55)"; ctx.beginPath(); ctx.arc(L * 0.3, 0, (0.5 + Math.sin(time * 9) * 0.15) * s, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// PLACEHOLDER character, drawn in code. This is the single function to replace with sprite
// atlases: it receives the direction index (0-7), the animation name and the animation phase.
export function drawCharacter(ctx, x, y, s, { dir, anim, phase }) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(dir * Math.PI / 4 - Math.PI / 2);
  const swing = anim === "idle" ? 0 : Math.sin(phase) * (anim === "run" ? 0.34 : 0.22);
  const bob = anim === "idle" ? Math.sin(phase * 0.2) * 0.02 : 0;
  ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(0.12 * s, 0.12 * s, 0.7 * s, 0.62 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#7b2fd1";                                                     // feet
  ctx.beginPath(); ctx.ellipse(swing * s, -0.3 * s, 0.3 * s, 0.2 * s, 0, 0, TAU); ctx.ellipse(-swing * s, 0.3 * s, 0.3 * s, 0.2 * s, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-swing * 0.8 * s, -0.62 * s, 0.2 * s, 0.17 * s, 0, 0, TAU); ctx.ellipse(swing * 0.8 * s, 0.62 * s, 0.2 * s, 0.17 * s, 0, 0, TAU); ctx.fill();   // hands
  ctx.fillStyle = "#a24bff"; ctx.beginPath();                                    // fuzzy body
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, r = (0.56 + (i % 2 ? 0.1 : 0) + bob) * s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#f2b632"; ctx.lineWidth = Math.max(1.5, 0.09 * s); ctx.beginPath(); ctx.arc(0.1 * s, 0, 0.4 * s, -1.1, 1.1); ctx.stroke();      // gold chain
  ctx.fillStyle = "#b6ff3c"; ctx.beginPath();                                    // green hair
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = (i % 2 ? 0.34 : 0.18) * s; ctx.lineTo(-0.12 * s + Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0.36 * s, -0.19 * s, 0.15 * s, 0, TAU); ctx.arc(0.36 * s, 0.19 * s, 0.15 * s, 0, TAU); ctx.fill();   // eyes
  ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(0.42 * s, -0.19 * s, 0.06 * s, 0, TAU); ctx.arc(0.42 * s, 0.19 * s, 0.06 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = "#15151f"; roundRect(ctx, 0.12 * s, -0.36 * s, 0.14 * s, 0.72 * s, 0.05 * s); ctx.fill();                                         // sunglasses on the forehead
  ctx.fillStyle = "#ff6fa5"; ctx.beginPath(); ctx.ellipse(0.6 * s, 0, 0.1 * s, 0.09 * s, 0, 0, TAU); ctx.fill();                                    // tongue
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
