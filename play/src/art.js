// Everything that is drawn: FUMPO, enemies, pickups, terrain and backgrounds.
// All vector art made in code, so the character is identical in every frame.
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// A fluffy shape: an ellipse with a ring of soft round tufts. Outline first, fill on top,
// so only the outer silhouette keeps a dark line and the result reads as fur, not spikes.
function fluff(ctx, cx, cy, rx, ry, n, bump, t, fill, stroke, lw, lean = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - Math.PI / 2, k = bump * (0.8 + 0.4 * Math.abs(Math.sin(i * 2.3)));
    pts.push([cx + Math.cos(a) * rx + lean * Math.max(0, -Math.sin(a)) + Math.sin(t * 4 + i * 1.9) * 0.5, cy + Math.sin(a) * ry + Math.cos(t * 3.3 + i) * 0.4, k]);
  }
  const shape = () => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); for (const [x, y, k] of pts) { ctx.moveTo(x + k, y); ctx.arc(x, y, k, 0, TAU); } };
  shape(); ctx.strokeStyle = stroke; ctx.lineWidth = lw * 2; ctx.stroke();
  shape(); ctx.fillStyle = fill; ctx.fill();
}

// ------------------------------------------------------------------ FUMPO ---
// (x, y) is the point between his feet. st: facing, vx, vy, onGround, t, run (phase),
// squash (-1 squashed .. +1 stretched), hurt (seconds left), mood: "idle"|"win"
export function drawFumpo(ctx, x, y, scale, st) {
  const t = st.t, f = st.facing || 1;
  const air = !st.onGround, speed = Math.abs(st.vx) / 300;
  const sq = st.squash || 0;
  const sx = 1 - sq * 0.16, sy = 1 + sq * 0.2;
  const breathe = st.onGround && speed < 0.1 ? Math.sin(t * 2.6) * 0.02 : 0;
  const bob = st.onGround && speed > 0.1 ? Math.abs(Math.sin(st.run)) * -3 : 0;
  const tilt = st.mood === "win" ? Math.sin(t * 9) * 0.14 : (st.vx / 300) * 0.1 * (air ? 1.4 : 1);

  ctx.save();
  ctx.translate(x, y); ctx.scale(scale * f, scale);
  ctx.lineJoin = "round"; ctx.lineCap = "round";

  // feet (drawn before the body so the fur overlaps them)
  const footY = -7;
  const legs = [-1, 1].map((side) => {
    if (air) return { x: side * 11 - 2, y: footY - 6 + (st.vy > 0 ? 4 : -2), r: side * 0.25 + (st.vy > 0 ? 0.3 : -0.4) };
    const ph = st.run + (side > 0 ? 0 : Math.PI);
    const stride = Math.min(1, speed * 1.6);
    return { x: side * 9 * (1 - stride) + Math.cos(ph) * 13 * stride, y: footY - Math.max(0, Math.sin(ph)) * 9 * stride, r: -Math.sin(ph) * 0.35 * stride };
  });
  const foot = (l, shade) => {
    ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.r);
    fluff(ctx, 3, 0, 12.5, 7, 9, 3, t, shade, "#3a0d66", 2);
    ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.ellipse(6, -3, 5, 2.2, 0, 0, TAU); ctx.fill();
    ctx.restore();
  };
  foot(legs[0], "#7524c4");

  ctx.save();
  ctx.translate(0, bob); ctx.rotate(tilt); ctx.scale(sx + breathe, sy - breathe);

  const cy = -36, rx = 27, ry = 29;
  // back arm
  const swing = air ? -0.9 : Math.sin(st.run) * 0.9 * Math.min(1, speed * 1.6);
  const arm = (ax, ay, rot, shade) => {
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(rot);
    fluff(ctx, 0, 9, 5.5, 9.5, 8, 2.6, t, shade, "#3a0d66", 2);
    ctx.restore();
  };
  arm(-21, cy + 4, 0.55 + swing * 0.7, "#6a1fb5");

  // body
  const g = ctx.createRadialGradient(6, cy - 12, 4, 0, cy, 36);
  g.addColorStop(0, "#c77dff"); g.addColorStop(0.55, "#9d4edd"); g.addColorStop(1, "#6a1fb5");
  fluff(ctx, 0, cy, rx - 3, ry - 3, 20, 6, t, g, "#3a0d66", 2.5, -st.vx / 300 * 3);
  // inner fur strokes for texture
  ctx.strokeStyle = "rgba(58,13,102,.28)"; ctx.lineWidth = 1.6;
  for (const [fx, fy] of [[-14, -22], [-6, -14], [6, -12], [15, -20], [-17, -38], [-10, -28], [14, -30], [2, -20]]) {
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx + 1.5, fy + 4, fx - 1, fy + 7); ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,.10)"; ctx.beginPath(); ctx.ellipse(-8, cy - 14, 9, 6, -0.5, 0, TAU); ctx.fill();

  // green mohawk
  const lean = -st.vx / 300 * 0.5 - (air ? st.vy / 900 : 0) * 0.3;
  ctx.fillStyle = "#b6ff3c"; ctx.strokeStyle = "#5c9a00"; ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const bx = -17 + i * 5.6, h = 15 + Math.sin(i * 1.3) * 5 + (i > 1 && i < 5 ? 7 : 0), sway = Math.sin(t * 4 + i) * 0.06 + lean;
    const baseY = cy - ry + 5 + Math.abs(i - 3) * 1.6;
    ctx.beginPath(); ctx.moveTo(bx - 4.5, baseY + 3);
    ctx.quadraticCurveTo(bx - 3 + Math.sin(sway) * h * 0.6, baseY - h * 0.6, bx + Math.sin(sway) * h, baseY - h);
    ctx.quadraticCurveTo(bx + 3 + Math.sin(sway) * h * 0.5, baseY - h * 0.5, bx + 4.5, baseY + 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // chain + medallion (swings with movement)
  const sw = Math.sin(t * 6) * 0.05 * (1 + speed * 2) - st.vx / 300 * 0.25;
  ctx.strokeStyle = "#f2b632"; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(-21, cy + 8); ctx.quadraticCurveTo(-2 + sw * 20, cy + 26, 22, cy + 6); ctx.stroke();
  ctx.strokeStyle = "#a8741a"; ctx.lineWidth = 1; ctx.setLineDash([2.5, 3]);
  ctx.beginPath(); ctx.moveTo(-21, cy + 8); ctx.quadraticCurveTo(-2 + sw * 20, cy + 26, 22, cy + 6); ctx.stroke(); ctx.setLineDash([]);
  const mx = 2 + sw * 24, my = cy + 21 + Math.abs(sw) * 4;
  ctx.fillStyle = "#ffd23c"; ctx.strokeStyle = "#a8741a"; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(mx, my, 7.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#a8741a"; ctx.beginPath();                                    // little crown on the medallion
  ctx.moveTo(mx - 3.6, my + 2.4); ctx.lineTo(mx - 3.6, my - 2); ctx.lineTo(mx - 1.6, my); ctx.lineTo(mx, my - 3); ctx.lineTo(mx + 1.6, my); ctx.lineTo(mx + 3.6, my - 2); ctx.lineTo(mx + 3.6, my + 2.4); ctx.closePath(); ctx.fill();

  // face
  const hurt = st.hurt > 0, win = st.mood === "win";
  const look = { x: Math.max(-1, Math.min(1, st.vx / 200)) * 2.2 + 1.2, y: air ? Math.max(-2, Math.min(2.5, st.vy / 300)) : 0 };
  const blink = !hurt && (t % 3.7) < 0.12;
  const eye = (ex, ey, r) => {
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#2b0a4a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fill(); ctx.stroke();
    if (hurt) {
      ctx.strokeStyle = "#2b0a4a"; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(ex - r * 0.5, ey - r * 0.5); ctx.lineTo(ex + r * 0.5, ey + r * 0.5); ctx.moveTo(ex + r * 0.5, ey - r * 0.5); ctx.lineTo(ex - r * 0.5, ey + r * 0.5); ctx.stroke();
    } else if (blink) {
      ctx.fillStyle = "#9d4edd"; ctx.beginPath(); ctx.arc(ex, ey, r + 0.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#2b0a4a"; ctx.beginPath(); ctx.moveTo(ex - r * 0.7, ey + 1); ctx.quadraticCurveTo(ex, ey + 4, ex + r * 0.7, ey + 1); ctx.stroke();
    } else {
      const pr = air && st.vy > 250 ? r * 0.34 : r * 0.46;
      ctx.fillStyle = "#16061f"; ctx.beginPath(); ctx.arc(ex + look.x * r * 0.14, ey + look.y * r * 0.16, pr, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex + look.x * r * 0.14 - pr * 0.35, ey + look.y * r * 0.16 - pr * 0.4, pr * 0.32, 0, TAU); ctx.fill();
    }
  };
  eye(-3, cy - 9, 9.5);          // far eye, slightly smaller: he is gloriously derpy
  eye(13.5, cy - 8, 11.5);

  // sunglasses pushed up on the forehead
  ctx.save(); ctx.translate(4, cy - 24); ctx.rotate(-0.08);
  ctx.fillStyle = "#15131c"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
  rr(ctx, -17, -6, 16, 11, 3.5); ctx.fill(); ctx.stroke();
  rr(ctx, 2, -6, 17, 11, 3.5); ctx.fill(); ctx.stroke();
  ctx.fillRect(-2, -3.5, 5, 2.5);
  ctx.strokeStyle = "rgba(182,255,60,.85)"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-13, 2.5); ctx.lineTo(-7, -3.5); ctx.moveTo(6, 2.5); ctx.lineTo(13, -3.5); ctx.stroke();
  ctx.restore();

  // mouth: huge grin, teeth, tongue out
  const open = hurt ? 0.5 : air ? 1.25 : 1 + Math.sin(t * 3) * 0.05 + (win ? 0.3 : 0);
  const mY = cy + 5;
  ctx.fillStyle = "#3d0b24"; ctx.strokeStyle = "#2b0a4a"; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-11, mY); ctx.quadraticCurveTo(6, mY - 3, 23, mY - 1.5);
  ctx.quadraticCurveTo(21, mY + 13 * open, 6, mY + 14 * open); ctx.quadraticCurveTo(-8, mY + 12 * open, -11, mY); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff8ec"; ctx.strokeStyle = "#cbb9a0"; ctx.lineWidth = 0.8;
  for (const [tx, tw] of [[-6, 5.5], [1.5, 6], [9.5, 5.5], [16.5, 4.5]]) { rr(ctx, tx, mY - 1.2, tw, 5.2, 1.6); ctx.fill(); ctx.stroke(); }
  if (!hurt) {
    const tw = Math.sin(t * 7) * 0.12 * (0.4 + speed) - st.vx / 300 * 0.35 + (air ? -st.vy / 2500 : 0);
    ctx.save(); ctx.translate(10, mY + 8 * open); ctx.rotate(tw);
    ctx.fillStyle = "#ff6fa5"; ctx.strokeStyle = "#c23a72"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-6.5, -2); ctx.quadraticCurveTo(-8, 11, 0, 13.5); ctx.quadraticCurveTo(8, 11, 6.5, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#c23a72"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 8); ctx.stroke();
    ctx.restore();
  }

  arm(-11, cy + 13, win ? -2.6 + Math.sin(t * 12) * 0.4 : 0.15 - swing * 0.9, "#8a35d6");   // front arm
  ctx.restore();
  foot(legs[1], "#8a35d6");
  ctx.restore();
}

// ---------------------------------------------------------------- enemies ---
// FUD blob: a grumpy red thing that waddles. (x, y) = feet centre.
export function drawFud(ctx, x, y, t, dir, squish = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  const w = Math.sin(t * 8) * 0.07, sy = 1 - squish * 0.75;
  ctx.scale(1 + w + squish * 0.4, sy * (1 - w));
  const g = ctx.createRadialGradient(-4, -24, 3, 0, -16, 26);
  g.addColorStop(0, "#ff8a7a"); g.addColorStop(0.6, "#e5383b"); g.addColorStop(1, "#8c1c22");
  ctx.fillStyle = g; ctx.strokeStyle = "#4a0d12"; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(-25, -30, 0, -32); ctx.quadraticCurveTo(25, -30, 20, 0);
  ctx.quadraticCurveTo(13, 4, 7, 0); ctx.quadraticCurveTo(0, 4, -7, 0); ctx.quadraticCurveTo(-13, 4, -20, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(2, -18, 5.5, 0, TAU); ctx.arc(13, -18, 5.5, 0, TAU); ctx.fill();
  ctx.fillStyle = "#1a0508"; ctx.beginPath(); ctx.arc(4, -17, 2.4, 0, TAU); ctx.arc(15, -17, 2.4, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#4a0d12"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-4, -27); ctx.lineTo(7, -22.5); ctx.moveTo(19, -27); ctx.lineTo(9, -22.5); ctx.stroke();     // angry brows
  ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(1, -7); ctx.quadraticCurveTo(8, -11, 15, -7); ctx.stroke();
  ctx.restore();
}

export function drawCoin(ctx, x, y, t, r = 13) {
  const sx = Math.abs(Math.cos(t * 3.2)) * 0.8 + 0.2;
  ctx.save(); ctx.translate(x, y + Math.sin(t * 3) * 3); ctx.scale(sx, 1);
  ctx.fillStyle = "rgba(255,210,60,.18)"; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, "#fff3b0"); g.addColorStop(0.5, "#ffd23c"); g.addColorStop(1, "#d99a12");
  ctx.fillStyle = g; ctx.strokeStyle = "#a8741a"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(168,116,26,.6)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.stroke();
  ctx.fillStyle = "#a8741a"; ctx.font = "900 14px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("F", 0, 1);
  ctx.restore();
}

export function drawPizza(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 2.5) * 4); ctx.rotate(Math.sin(t * 2) * 0.15);
  ctx.fillStyle = "rgba(255,138,60,.2)"; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill();
  ctx.lineJoin = "round"; ctx.strokeStyle = "#8a4b12"; ctx.lineWidth = 2.5;
  ctx.fillStyle = "#e9a441"; ctx.beginPath(); ctx.moveTo(-15, -12); ctx.quadraticCurveTo(0, -19, 15, -12); ctx.lineTo(0, 17); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffd76a"; ctx.beginPath(); ctx.moveTo(-11, -9); ctx.quadraticCurveTo(0, -14, 11, -9); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d1383d"; for (const [px, py] of [[-4, -6], [5, -5], [0, 2]]) { ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export function drawSpikes(ctx, x, y, w) {            // (x, y) = bottom-left
  ctx.fillStyle = "#d7d2e8"; ctx.strokeStyle = "#5a4f7a"; ctx.lineWidth = 2; ctx.lineJoin = "round";
  const n = Math.max(2, Math.round(w / 13));
  for (let i = 0; i < n; i++) {
    const a = x + (i / n) * w, b = x + ((i + 1) / n) * w;
    ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo((a + b) / 2, y - 20); ctx.lineTo(b, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

export function drawFlag(ctx, x, y, t, active) {       // (x, y) = base of the pole
  ctx.strokeStyle = "#d7d2e8"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 74); ctx.stroke();
  ctx.fillStyle = active ? "#b6ff3c" : "#7a6a9a"; ctx.strokeStyle = active ? "#5c9a00" : "#4a3f66"; ctx.lineWidth = 2;
  const wv = Math.sin(t * 5) * 4;
  ctx.beginPath(); ctx.moveTo(x, y - 74); ctx.quadraticCurveTo(x + 18, y - 78 + wv, x + 36, y - 66); ctx.quadraticCurveTo(x + 18, y - 56 - wv, x, y - 50); ctx.closePath(); ctx.fill(); ctx.stroke();
}

export function drawRocket(ctx, x, y, t, lift = 0) {    // (x, y) = ground under the rocket
  ctx.save(); ctx.translate(x, y - lift);
  if (lift > 0) {
    const fl = 40 + Math.random() * 30;
    const fg = ctx.createLinearGradient(0, 0, 0, fl); fg.addColorStop(0, "#fff3b0"); fg.addColorStop(0.4, "#ff8a3c"); fg.addColorStop(1, "rgba(255,77,109,0)");
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-14, -6); ctx.quadraticCurveTo(0, fl * 1.5, 14, -6); ctx.closePath(); ctx.fill();
  }
  ctx.lineJoin = "round"; ctx.strokeStyle = "#3a2a5c"; ctx.lineWidth = 3;
  ctx.fillStyle = "#a24bff";                                                 // fins
  ctx.beginPath(); ctx.moveTo(-18, -40); ctx.lineTo(-38, -4); ctx.lineTo(-16, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(18, -40); ctx.lineTo(38, -4); ctx.lineTo(16, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
  const g = ctx.createLinearGradient(-22, 0, 22, 0); g.addColorStop(0, "#d9d3ea"); g.addColorStop(0.45, "#ffffff"); g.addColorStop(1, "#b9b0d2");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -132); ctx.quadraticCurveTo(26, -100, 22, -10); ctx.lineTo(-22, -10); ctx.quadraticCurveTo(-26, -100, 0, -132); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#a24bff"; ctx.beginPath(); ctx.moveTo(0, -132); ctx.quadraticCurveTo(15, -116, 17, -98); ctx.lineTo(-17, -98); ctx.quadraticCurveTo(-15, -116, 0, -132); ctx.closePath(); ctx.fill(); ctx.stroke();
  const wg = ctx.createLinearGradient(-10, -80, 10, -56); wg.addColorStop(0, "#7af0d0"); wg.addColorStop(1, "#7a5cff");
  ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(0, -68, 12, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#b6ff3c"; ctx.fillRect(-22, -26, 44, 6);
  ctx.restore();
}

// ---------------------------------------------------------------- terrain ---
export function drawTile(ctx, x, y, s, top, left, right, seed) {
  if (top) { const g = ctx.createLinearGradient(0, y, 0, y + s); g.addColorStop(0, "#5f3099"); g.addColorStop(1, "#3d1d6b"); ctx.fillStyle = g; }
  else ctx.fillStyle = "#3d1d6b";                         // flat below the surface, so rows join without banding
  ctx.fillRect(x, y, s + 0.6, s + 0.6);
  ctx.fillStyle = "rgba(0,0,0,.16)";
  if ((seed * 7) % 5 === 0) { ctx.beginPath(); ctx.ellipse(x + s * 0.3, y + s * 0.62, 6, 3.6, 0, 0, TAU); ctx.fill(); }
  if ((seed * 3) % 7 === 0) { ctx.beginPath(); ctx.ellipse(x + s * 0.72, y + s * 0.34, 4, 2.6, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = "rgba(0,0,0,.25)";
  if (left) ctx.fillRect(x, y, 4, s);
  if (right) ctx.fillRect(x + s - 4, y, 4, s);
  if (top) {                                             // glowing lime moss on top
    ctx.fillStyle = "#b6ff3c"; ctx.beginPath(); ctx.moveTo(x - 1, y + 9);
    for (let i = 0; i <= 4; i++) { const px = x + (i / 4) * s; ctx.quadraticCurveTo(px - s / 8, y + 13 + ((seed + i) % 3) * 2.5, px, y + 8); }
    ctx.lineTo(x + s + 1, y - 2); ctx.lineTo(x - 1, y - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e4ffa8"; ctx.fillRect(x - 1, y - 2, s + 2, 2.5);
    ctx.fillStyle = "#7fc41a";
    for (let i = 0; i < 3; i++) { const bx = x + ((seed * 13 + i * 17) % s); ctx.beginPath(); ctx.moveTo(bx - 2, y - 1); ctx.lineTo(bx + (i - 1) * 2, y - 8 - (seed + i) % 4); ctx.lineTo(bx + 2, y - 1); ctx.fill(); }
  }
}

export function drawPlatform(ctx, x, y, w) {             // floating slab, (x, y) = top-left
  ctx.fillStyle = "rgba(182,255,60,.15)"; rr(ctx, x - 4, y - 4, w + 8, 24, 12); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + 16); g.addColorStop(0, "#6b3aa8"); g.addColorStop(1, "#40206f");
  ctx.fillStyle = g; ctx.strokeStyle = "#241040"; ctx.lineWidth = 2; rr(ctx, x, y, w, 16, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#b6ff3c"; rr(ctx, x + 2, y, w - 4, 5.5, 3); ctx.fill();
}

export function drawCrystal(ctx, x, y, seed) {           // decoration, (x, y) = base
  const h = 26 + (seed % 3) * 9, c = seed % 2 ? ["#7af0d0", "#2aa58a"] : ["#ff9be6", "#b0409a"];
  ctx.lineJoin = "round"; ctx.lineWidth = 1.5; ctx.strokeStyle = c[1];
  for (const [dx, k] of [[-9, 0.6], [0, 1], [9, 0.7]]) {
    ctx.fillStyle = c[0]; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(x + dx - 5, y); ctx.lineTo(x + dx - 2, y - h * k); ctx.lineTo(x + dx + 3, y - h * k * 0.86); ctx.lineTo(x + dx + 5, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// -------------------------------------------------------------- background ---
const STARS = Array.from({ length: 90 }, (_, i) => ({ x: (i * 97.3) % 1, y: ((i * 53.7) % 1) * 0.78, s: 0.6 + ((i * 31) % 10) / 6, p: i }));
export function drawBackground(ctx, w, h, camX, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0d0420"); g.addColorStop(0.55, "#2a0f52"); g.addColorStop(0.85, "#6a1f8f"); g.addColorStop(1, "#b0408f");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (const s of STARS) {
    const x = (((s.x * w * 1.6 - camX * 0.03) % w) + w) % w;
    ctx.globalAlpha = 0.45 + Math.sin(t * 2 + s.p) * 0.35; ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x, s.y * h, s.s, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // big ringed planet
  const px = w * 0.76 - camX * 0.02, py = h * 0.24, pr = Math.min(w, h) * 0.13;
  ctx.fillStyle = "rgba(255,155,230,.10)"; ctx.beginPath(); ctx.arc(px, py, pr * 1.6, 0, TAU); ctx.fill();
  const pg = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
  pg.addColorStop(0, "#ffd0f4"); pg.addColorStop(0.6, "#d978c9"); pg.addColorStop(1, "#7a2f86");
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(122,47,134,.45)"; ctx.beginPath(); ctx.arc(px - pr * 0.3, py + pr * 0.1, pr * 0.2, 0, TAU); ctx.arc(px + pr * 0.35, py - pr * 0.3, pr * 0.13, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(255,232,170,.75)"; ctx.lineWidth = Math.max(2, pr * 0.07);
  ctx.beginPath(); ctx.ellipse(px, py, pr * 1.7, pr * 0.36, -0.35, 0.15, Math.PI - 0.15); ctx.stroke();
  for (let i = 0; i < 5; i++) {                           // drifting nebula clouds
    const cx = (((i * 0.27 + 0.1) * w * 1.5 - camX * 0.05 + t * 6) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2, cyy = h * (0.18 + (i % 3) * 0.13);
    const cg = ctx.createRadialGradient(cx, cyy, 0, cx, cyy, w * 0.22);
    cg.addColorStop(0, i % 2 ? "rgba(162,75,255,.20)" : "rgba(255,111,165,.14)"); cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(cx, cyy, w * 0.24, h * 0.09, 0, 0, TAU); ctx.fill();
  }
  for (let i = 0; i < 4; i++) {                           // far floating islands
    const ix = (((i * 0.31 + 0.15) * w * 1.6 - camX * 0.12) % (w * 1.5) + w * 1.5) % (w * 1.5) - w * 0.25, iy = h * (0.36 + (i % 2) * 0.12) + Math.sin(t * 0.6 + i) * 5, iw = 46 + i * 14;
    ctx.fillStyle = "#34115f"; ctx.beginPath(); ctx.moveTo(ix - iw, iy); ctx.quadraticCurveTo(ix - iw * 0.3, iy + iw * 0.9, ix, iy + iw * 0.75); ctx.quadraticCurveTo(ix + iw * 0.5, iy + iw * 0.6, ix + iw, iy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#7fc41a"; ctx.beginPath(); ctx.ellipse(ix, iy, iw, 5, 0, 0, TAU); ctx.fill();
  }
  // three parallax ridges
  const ridge = (par, base, amp, col, f1, f2) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w + 20; x += 20) {
      const wx = x + camX * par;
      ctx.lineTo(x, h * base - Math.sin(wx * f1) * amp - Math.sin(wx * f2 + 1.3) * amp * 0.55 - Math.abs(Math.sin(wx * f1 * 0.37)) * amp * 0.5);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  };
  ridge(0.08, 0.72, h * 0.07, "#3a1466", 0.004, 0.011);
  ridge(0.18, 0.80, h * 0.06, "#2c0e52", 0.006, 0.017);
  ridge(0.32, 0.89, h * 0.045, "#1e0a3c", 0.009, 0.023);
}
