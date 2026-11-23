// Everything that is drawn: FUMPO, enemies, pickups, terrain and backgrounds.
// All vector art made in code, so the character is identical in every frame.
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ------------------------------------------------------------------ FUMPO ---
// Shaggy silhouette: a pear-shaped body whose edge is made of long pointed locks that hang down.
function shag(ctx, cx, cy, rx, ry, n, len, t, sway = 0) {
  const pt = (a, k = 1) => [cx + Math.cos(a) * rx * (1 + 0.14 * Math.max(0, Math.sin(a))) * k, cy + Math.sin(a) * ry * k];
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU - Math.PI / 2, a1 = ((i + 1) / n) * TAU - Math.PI / 2, am = (a0 + a1) / 2;
    const h = 0.65 + 0.7 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
    const [bx, by] = pt(a0), [ex, ey] = pt(a1), [mx, my] = pt(am);
    const out = len * h, r = Math.hypot(mx - cx, my - cy) || 1;
    const tipX = mx + (mx - cx) / r * out + sway * (0.4 + Math.max(0, -Math.sin(am))) + Math.sin(t * 3.1 + i * 1.7) * 0.6;
    const tipY = my + (my - cy) / r * out * 0.8 + out * 0.3 + Math.cos(t * 2.7 + i) * 0.4;       // locks droop a little
    if (i === 0) ctx.moveTo(bx, by);
    const [c0x, c0y] = pt(a0 + (am - a0) * 0.35, 1 + out * 0.95 / r), [c1x, c1y] = pt(a1 - (a1 - am) * 0.45, 1 + out * 0.55 / r);
    ctx.quadraticCurveTo(c0x, c0y, tipX, tipY);
    ctx.quadraticCurveTo(c1x, c1y, ex, ey);
  }
  ctx.closePath();
}

// (x, y) is the point between his feet. st: facing, vx, vy, onGround, t, run (phase),
// squash (-1 squashed .. +1 stretched), hurt (seconds left), mood: "idle"|"win"
export function drawFumpo(ctx, x, y, scale, st) {
  const t = st.t, f = st.facing || 1;
  const air = !st.onGround, speed = Math.abs(st.vx) / 300, stride = Math.min(1, speed * 1.6);
  const sq = st.squash || 0, sx = 1 - sq * 0.14, sy = 1 + sq * 0.18;
  const breathe = st.onGround && speed < 0.1 ? Math.sin(t * 2.6) * 0.018 : 0;
  const bob = st.onGround && speed > 0.1 ? Math.abs(Math.sin(st.run)) * -3 : 0;
  const win = st.mood === "win", hurt = st.hurt > 0;
  const tilt = win ? Math.sin(t * 9) * 0.12 : (st.vx / 300) * 0.07 * (air ? 1.5 : 1);
  const OUT = "#2e0a52", FUR = "#8f3be0", DARK = "#6a22b8";

  ctx.save();
  ctx.translate(x, y); ctx.scale(scale * f, scale);
  ctx.lineJoin = "round"; ctx.lineCap = "round";

  // feet with three toes
  const foot = (side) => {
    let fx, fy, fr;
    if (air) { fx = side * 13; fy = -1 + (st.vy > 0 ? 4 : -3); fr = side * 0.2 + (st.vy > 0 ? 0.25 : -0.3); }
    else { const ph = st.run + (side > 0 ? 0 : Math.PI); fx = side * 13 * (1 - stride * 0.45) + Math.cos(ph) * 12 * stride; fy = -3 - Math.max(0, Math.sin(ph)) * 7 * stride; fr = -Math.sin(ph) * 0.3 * stride; }
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(fr);
    ctx.fillStyle = side > 0 ? FUR : DARK; ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(1, 0, 10, 5.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    for (const tx of [2, 6.5, 10.5]) { ctx.beginPath(); ctx.arc(tx, 1.8, 3, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillRect(-2, -2, 11, 3.5);
    ctx.restore();
  };
  foot(-1); foot(1);                                    // both feet sit under the body fur

  ctx.save();
  ctx.translate(0, bob); ctx.rotate(tilt); ctx.scale(sx + breathe, sy - breathe);
  const cy = -42, rx = 27, ry = 35;

  // arms hang at the sides and swing; drawn before the body so the fur covers the shoulders
  const swing = air ? 0.9 : Math.sin(st.run) * 0.9 * stride;
  const arm = (side, rot) => {
    ctx.save(); ctx.translate(side * 27, cy + 2); ctx.rotate(rot);
    shag(ctx, 0, 12, 7.5, 12, 7, 3.4, t); ctx.fillStyle = side > 0 ? FUR : DARK; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.restore();
  };
  if (hurt || (air && st.vy > 300)) { arm(-1, 2.5); arm(1, -2.5); }             // hands up in panic, like the reference
  else if (win) { arm(-1, 2.4 + Math.sin(t * 12) * 0.3); arm(1, -2.4 - Math.sin(t * 12) * 0.3); }
  else { arm(-1, 0.25 + swing * 0.7); arm(1, -0.25 + swing * 0.7); }

  // body
  const g = ctx.createRadialGradient(-6, cy - 14, 4, 0, cy + 4, 46);
  g.addColorStop(0, "#b56cff"); g.addColorStop(0.5, FUR); g.addColorStop(1, "#5c1aa3");
  shag(ctx, 0, cy, rx, ry, 17, 7, t, -st.vx / 300 * 3);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
  // fur texture: short hanging strokes, dark and light
  for (let i = 0; i < 22; i++) {
    const u = (Math.sin(i * 91.7) * 43758.5 % 1 + 1) % 1, v = (Math.sin(i * 47.3) * 12543.1 % 1 + 1) % 1;
    const fx = (u - 0.5) * 46, fy = cy - 26 + v * 58;
    if (fy < cy + 18 && fy > cy - 22 && Math.abs(fx) < 24) continue;             // keep the face clean
    ctx.strokeStyle = i % 3 ? "rgba(46,10,82,.30)" : "rgba(214,160,255,.42)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx + 1.2, fy + 3.5, fx - 1.4, fy + 6.5); ctx.stroke();
  }

  // messy hair: green with a couple of purple locks
  const lean = -st.vx / 300 * 0.45 - (air ? st.vy / 900 : 0) * 0.25;
  for (let i = 0; i < 9; i++) {
    const bx = -19 + i * 4.8, h = 20 + Math.abs(Math.sin(i * 2.1)) * 14, sway = Math.sin(t * 4 + i) * 0.07 + lean + (i - 4) * 0.13;
    const by = cy - ry + 8 + Math.abs(i - 4) * 1.6, green = i % 4 !== 1;
    ctx.fillStyle = green ? "#aef032" : "#a24bff"; ctx.strokeStyle = green ? "#4f8a00" : OUT; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(bx - 5.5, by + 3);
    ctx.quadraticCurveTo(bx - 4.5 + Math.sin(sway) * h * 0.5, by - h * 0.55, bx + Math.sin(sway) * h, by - h);
    ctx.quadraticCurveTo(bx + 5 + Math.sin(sway) * h * 0.4, by - h * 0.45, bx + 5.5, by + 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // gold chain with chunky links and the FUMPO medallion
  const sw = Math.sin(t * 6) * 0.04 * (1 + speed * 2) - st.vx / 300 * 0.2;
  const chain = () => { ctx.beginPath(); ctx.moveTo(-25, cy + 13); ctx.quadraticCurveTo(sw * 22, cy + 36, 25, cy + 13); };
  chain(); ctx.strokeStyle = "#7a5206"; ctx.lineWidth = 5; ctx.stroke();
  chain(); ctx.strokeStyle = "#f6c033"; ctx.lineWidth = 3; ctx.setLineDash([4.5, 2.2]); ctx.stroke(); ctx.setLineDash([]);
  const mx = sw * 26, my = cy + 27 + Math.abs(sw) * 4;
  const mg = ctx.createRadialGradient(mx - 3, my - 3, 1, mx, my, 10); mg.addColorStop(0, "#fff0a8"); mg.addColorStop(0.6, "#f6c033"); mg.addColorStop(1, "#b97f10");
  ctx.fillStyle = mg; ctx.strokeStyle = "#7a5206"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx, my, 9.5, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#5c3d05";
  ctx.beginPath(); ctx.moveTo(mx - 3.4, my - 2.2); ctx.lineTo(mx - 3.4, my - 6); ctx.lineTo(mx - 1.5, my - 4.2); ctx.lineTo(mx, my - 6.6); ctx.lineTo(mx + 1.5, my - 4.2); ctx.lineTo(mx + 3.4, my - 6); ctx.lineTo(mx + 3.4, my - 2.2); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(mx, my + 2.6); ctx.scale(f, 1);                      // keep the lettering readable when he faces left
  ctx.font = "900 4.6px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("FUMPO", 0, 0); ctx.restore();

  // mouth: wide open, gappy square teeth, big tongue lolling out to one side
  const open = hurt ? 1.25 : air ? 1.2 : 1 + Math.sin(t * 3) * 0.04 + (win ? 0.2 : 0);
  const mY = cy + 3;
  ctx.fillStyle = "#2a0717"; ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-17, mY + 1); ctx.quadraticCurveTo(0, mY - 4, 17, mY + 1);
  ctx.quadraticCurveTo(19, mY + 15 * open, 2, mY + 17 * open); ctx.quadraticCurveTo(-18, mY + 15 * open, -17, mY + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fbf3df"; ctx.strokeStyle = "#b7a88a"; ctx.lineWidth = 0.9;
  for (const [tx, tw, th] of [[-12, 5.5, 5.5], [-3, 6, 6], [7, 5.5, 5.2]]) { rr(ctx, tx, mY - 1.2, tw, th, 1.5); ctx.fill(); ctx.stroke(); }
  rr(ctx, 9, mY + 13 * open - 5.5, 5, 5, 1.4); ctx.fill(); ctx.stroke();           // one lonely bottom tooth
  const tw = Math.sin(t * 7) * 0.1 * (0.4 + speed) - st.vx / 300 * 0.3 + (air ? -st.vy / 2600 : 0);
  ctx.save(); ctx.translate(-5, mY + 9 * open); ctx.rotate(0.35 + tw);
  const tg = ctx.createLinearGradient(0, -6, 0, 16); tg.addColorStop(0, "#ff8fb8"); tg.addColorStop(1, "#f0558f");
  ctx.fillStyle = tg; ctx.strokeStyle = "#b02f66"; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-8, -4); ctx.quadraticCurveTo(-11, 13, -1, 17); ctx.quadraticCurveTo(9, 15, 8, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(176,47,102,.7)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(-0.5, 10); ctx.stroke();
  ctx.restore();

  // eyes: two huge glossy eyeballs that touch, with small pupils wandering in different directions
  const look = { x: Math.max(-1, Math.min(1, st.vx / 200)) * 1.6, y: air ? Math.max(-1.5, Math.min(2, st.vy / 320)) : 0 };
  const blink = !hurt && (t % 3.9) < 0.11;
  const eye = (ex, ey, r, px, py) => {
    const eg = ctx.createRadialGradient(ex - r * 0.3, ey - r * 0.35, r * 0.1, ex, ey, r); eg.addColorStop(0, "#ffffff"); eg.addColorStop(1, "#e4d4ea");
    ctx.fillStyle = eg; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fill(); ctx.stroke();
    if (hurt) {
      ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.beginPath();
      ctx.moveTo(ex - r * 0.45, ey - r * 0.45); ctx.lineTo(ex + r * 0.45, ey + r * 0.45); ctx.moveTo(ex + r * 0.45, ey - r * 0.45); ctx.lineTo(ex - r * 0.45, ey + r * 0.45); ctx.stroke();
    } else if (blink) {
      ctx.fillStyle = FUR; ctx.beginPath(); ctx.arc(ex, ey, r + 0.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(ex - r * 0.7, ey + 1); ctx.quadraticCurveTo(ex, ey + 4.5, ex + r * 0.7, ey + 1); ctx.stroke();
    } else {
      const qx = ex + px * r + look.x * r * 0.16, qy = ey + py * r + look.y * r * 0.16, pr = r * 0.26;
      ctx.fillStyle = "#120416"; ctx.beginPath(); ctx.arc(qx, qy, pr, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(qx - pr * 0.3, qy - pr * 0.35, pr * 0.34, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.ellipse(ex - r * 0.38, ey - r * 0.45, r * 0.22, r * 0.13, -0.6, 0, TAU); ctx.fill();
    }
  };
  eye(-11.5, cy - 13, 12.5, 0.38, 0.3);
  eye(12.5, cy - 14, 13.5, 0.05, 0.28);
  // furry brow over the eyes
  ctx.fillStyle = FUR; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-25, cy - 20); ctx.quadraticCurveTo(-12, cy - 31, 0, cy - 24); ctx.quadraticCurveTo(13, cy - 33, 27, cy - 21);
  ctx.quadraticCurveTo(13, cy - 26, 1, cy - 21.5); ctx.quadraticCurveTo(-12, cy - 26, -25, cy - 20); ctx.closePath(); ctx.fill(); ctx.stroke();

  // sunglasses pushed up on the forehead, with a candlestick chart reflected in the lenses
  ctx.save(); ctx.translate(1, cy - 31); ctx.rotate(-0.06);
  ctx.fillStyle = "#0f0e16"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
  rr(ctx, -21, -7, 19, 12.5, 3); ctx.fill(); ctx.stroke(); rr(ctx, 2, -7, 19, 12.5, 3); ctx.fill(); ctx.stroke();
  ctx.fillRect(-3, -4.5, 6, 3);
  const candles = [[-18, 2, 5, 0], [-15, -1, 6, 1], [-12, 1, 4, 0], [-9, -3, 6, 1], [-6, -1, 4, 0], [5, -2, 5, 1], [8, 1, 4, 0], [11, -3, 6, 1], [14, 0, 5, 0], [17, -2, 4, 1]];
  for (const [cxx, cyy, ch, up] of candles) { ctx.fillStyle = up ? "#35e06a" : "#ff3d4f"; ctx.fillRect(cxx, cyy, 1.9, ch * 0.7); ctx.fillRect(cxx + 0.7, cyy - 1.2, 0.5, ch * 0.7 + 2.4); }
  ctx.restore();

  ctx.restore();
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
