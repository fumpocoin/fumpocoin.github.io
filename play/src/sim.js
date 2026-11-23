// Game simulation: world, movement, vehicles, police AI and the mission.
// Pure logic in world units (metres, seconds). It knows nothing about the screen,
// so the top-down renderer can later be swapped for isometric sprites without touching this file.
// Axes: x grows right, y grows down. Angles in radians, 0 = +x (east).

export const BLOCK = 40, ROAD = 14, COLS = 6, ROWS = 5, WALK = 3;
export const WORLD_W = COLS * BLOCK + (COLS + 1) * ROAD;
export const WORLD_H = ROWS * BLOCK + (ROWS + 1) * ROAD;
export const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]; // index 0-7, clockwise

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dir8 = (angle) => ((Math.round((angle + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;

const roadX = (i) => ROAD / 2 + i * (BLOCK + ROAD);
const roadY = (j) => ROAD / 2 + j * (BLOCK + ROAD);
const blockX = (i) => ROAD + i * (BLOCK + ROAD);
const blockY = (j) => ROAD + j * (BLOCK + ROAD);

// ------------------------------------------------------------------ world ---
export function createWorld() {
  const buildings = [], parks = [], trees = [];
  const PARK = "2,2", PALETTE = ["#5b4b8a", "#7a5aa6", "#4d6a8f", "#8a5a7a", "#5f7f6a", "#8f7a4d"];
  for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) {
    const x = blockX(i) + WALK, y = blockY(j) + WALK, s = BLOCK - WALK * 2;
    if (`${i},${j}` === PARK) {
      parks.push({ x: blockX(i), y: blockY(j), w: BLOCK, h: BLOCK });
      for (const [tx, ty] of [[9, 9], [30, 11], [12, 29], [29, 30], [20, 20]]) trees.push({ x: blockX(i) + tx, y: blockY(j) + ty, r: 2.2 });
      continue;
    }
    const color = PALETTE[(i * 3 + j * 5) % PALETTE.length];
    const kind = (i + j * 2) % 3;
    if (kind === 0) buildings.push({ x, y, w: s, h: s, color });
    else if (kind === 1) {                       // two halves with an alley between them
      const half = (s - 6) / 2;
      buildings.push({ x, y, w: half, h: s, color }, { x: x + half + 6, y, w: half, h: s, color: PALETTE[(i + j + 2) % PALETTE.length] });
    } else {
      const half = (s - 6) / 2;
      buildings.push({ x, y, w: s, h: half, color }, { x, y: y + half + 6, w: s, h: half, color: PALETTE[(i + j + 4) % PALETTE.length] });
    }
  }
  const nodes = [];
  for (let i = 0; i <= COLS; i++) for (let j = 0; j <= ROWS; j++) nodes.push({ i, j, x: roadX(i), y: roadY(j) });
  return {
    w: WORLD_W, h: WORLD_H, buildings, parks, trees, nodes,
    pizzeria: { x: roadX(5) - 3.5, y: roadY(1) + (BLOCK + ROAD) / 2, r: 5, label: "PIZZA" },
    home: { x: roadX(1) + 3.5, y: roadY(4) + (BLOCK + ROAD) / 2, r: 5, label: "HOME" },
    patrol: [[1, 1], [4, 1], [4, 4], [1, 4]],
  };
}
const node = (world, i, j) => world.nodes[clamp(i, 0, COLS) * (ROWS + 1) + clamp(j, 0, ROWS)];
const nearestNode = (world, p) => node(world, Math.round((p.x - ROAD / 2) / (BLOCK + ROAD)), Math.round((p.y - ROAD / 2) / (BLOCK + ROAD)));

// --------------------------------------------------------------- collision ---
// Pushes a circle out of a box. Returns the push normal, or null when they do not touch.
function circleBox(c, r, b) {
  const nx = clamp(c.x, b.x, b.x + b.w), ny = clamp(c.y, b.y, b.y + b.h);
  let dx = c.x - nx, dy = c.y - ny, d = Math.hypot(dx, dy);
  if (d >= r) return null;
  if (d < 1e-6) {                                 // centre is inside the box: leave by the nearest side
    const l = c.x - b.x, rr = b.x + b.w - c.x, t = c.y - b.y, bt = b.y + b.h - c.y, m = Math.min(l, rr, t, bt);
    if (m === l) { dx = -1; dy = 0; d = -l; } else if (m === rr) { dx = 1; dy = 0; d = -rr; }
    else if (m === t) { dx = 0; dy = -1; d = -t; } else { dx = 0; dy = 1; d = -bt; }
    c.x += dx * (r - d); c.y += dy * (r - d);
    return { x: dx, y: dy };
  }
  dx /= d; dy /= d; c.x += dx * (r - d); c.y += dy * (r - d);
  return { x: dx, y: dy };
}
function collideStatic(world, c, r) {
  let hit = null;
  for (const b of world.buildings) { const n = circleBox(c, r, b); if (n) hit = n; }
  for (const t of world.trees) {
    const dx = c.x - t.x, dy = c.y - t.y, d = Math.hypot(dx, dy) || 1e-6, min = r + t.r * 0.45;
    if (d < min) { c.x += dx / d * (min - d); c.y += dy / d * (min - d); hit = { x: dx / d, y: dy / d }; }
  }
  if (c.x < r) { c.x = r; hit = { x: 1, y: 0 }; } else if (c.x > world.w - r) { c.x = world.w - r; hit = { x: -1, y: 0 }; }
  if (c.y < r) { c.y = r; hit = { x: 0, y: 1 }; } else if (c.y > world.h - r) { c.y = world.h - r; hit = { x: 0, y: -1 }; }
  return hit;
}
// Is the straight line between two points free of buildings?
export function lineOfSight(world, a, b) {
  for (const k of world.buildings) {
    let t0 = 0, t1 = 1; const dx = b.x - a.x, dy = b.y - a.y; let ok = true;
    for (const [p, q] of [[-dx, a.x - k.x], [dx, k.x + k.w - a.x], [-dy, a.y - k.y], [dy, k.y + k.h - a.y]]) {
      if (p === 0) { if (q < 0) { ok = false; break; } } else {
        const t = q / p; if (p < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; } else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; }
      }
    }
    if (ok && t0 < t1) return false;
  }
  return true;
}

// ---------------------------------------------------------------- vehicles ---
const CAR = { accel: 13, brake: 26, reverse: 7, drag: 0.55, turn: 2.5, half: 1.15, r: 1.15 };
export function makeCar(x, y, heading, opts = {}) {
  return { x, y, heading, speed: 0, health: 100, maxSpeed: 25, police: false, stuck: 0, reverseFor: 0, ...opts };
}
const carCircles = (c) => [1, -1].map((s) => ({ x: c.x + Math.cos(c.heading) * CAR.half * s, y: c.y + Math.sin(c.heading) * CAR.half * s }));

function stepCar(world, car, throttle, steer, braking, dt, events) {
  if (braking) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.brake * dt);
  else if (throttle > 0) car.speed += (car.speed < 0 ? CAR.brake : CAR.accel) * throttle * dt;
  else if (throttle < 0) car.speed += (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * throttle * dt;
  car.speed -= car.speed * CAR.drag * dt;
  const limp = car.health < 30 ? 0.7 : 1;         // a wrecked car is slower
  car.speed = clamp(car.speed, -CAR.reverse, car.maxSpeed * limp);
  car.heading = wrap(car.heading + steer * CAR.turn * clamp(car.speed / 7, -1, 1) * dt);
  car.x += Math.cos(car.heading) * car.speed * dt;
  car.y += Math.sin(car.heading) * car.speed * dt;
  for (const c of carCircles(car)) {
    const before = { x: c.x, y: c.y }, n = collideStatic(world, c, CAR.r);
    if (!n) continue;
    car.x += c.x - before.x; car.y += c.y - before.y;
    const into = -(Math.cos(car.heading) * n.x + Math.sin(car.heading) * n.y) * car.speed; // speed into the wall
    if (into > 0.5) {
      if (into > 6) { car.health = Math.max(0, car.health - (into - 6) * 1.8); events.push({ type: "crash", force: into, police: car.police }); }
      car.speed *= into > 3 ? -0.25 : 0.6;
    }
  }
}
function collideCars(a, b, events) {
  for (const ca of carCircles(a)) for (const cb of carCircles(b)) {
    const dx = ca.x - cb.x, dy = ca.y - cb.y, d = Math.hypot(dx, dy) || 1e-6, min = CAR.r * 2;
    if (d >= min) continue;
    const push = (min - d) / 2, nx = dx / d, ny = dy / d;
    a.x += nx * push; a.y += ny * push; b.x -= nx * push; b.y -= ny * push;
    const rel = Math.abs(a.speed) + Math.abs(b.speed);
    if (rel > 7) { a.health = Math.max(0, a.health - rel * 0.5); events.push({ type: "ram", force: rel }); }
    a.speed *= 0.55; b.speed *= 0.55;
    return true;
  }
  return false;
}

// ------------------------------------------------------------------- game ---
export const WANTED_MAX = 5;
export function createGame(world = createWorld()) {
  const car = makeCar(roadX(2) + 3.5, roadY(3) + 24, Math.PI / 2);
  return {
    world, t: 0, status: "play", failReason: "", events: [],
    player: { x: car.x - 6, y: car.y + 1, r: 0.55, facing: 0, speed: 0, inCar: false, phase: 0, anim: "idle" },
    car,
    police: makeCar(roadX(5), roadY(0), Math.PI, { police: true, maxSpeed: 23.5 }),
    cop: { state: "patrol", wp: 0, lastSeen: null, timer: 0, sees: false, arrest: 0 },
    wanted: 0,
    mission: { step: 0, hasPizza: false, heat: 0, heatMax: 120, hint: "" },
  };
}
export const objective = (g) => {
  const m = g.mission;
  if (m.step === 0) return "Get in the car";
  if (m.step === 1) return "Drive to the pizzeria";
  return g.wanted > 0 ? "Lose the cops!" : "Bring the pizza home";
};
export const target = (g) => (g.mission.step === 0 ? g.car : g.mission.step === 1 ? g.world.pizzeria : g.world.home);
const playerPos = (g) => (g.player.inCar ? g.car : g.player);
const playerSpeed = (g) => (g.player.inCar ? Math.abs(g.car.speed) : g.player.speed);

function fail(g, reason) { if (g.status === "play") { g.status = "fail"; g.failReason = reason; g.events.push({ type: "fail", reason }); } }

// input: { mx, my } move vector (-1..1, y down), action (true on the frame it is pressed), brake (held)
export function step(g, input, dt) {
  if (g.status !== "play") return;
  g.t += dt;
  const { world, player: p, car, events } = g;
  const mx = clamp(input.mx || 0, -1, 1), my = clamp(input.my || 0, -1, 1);

  // --- enter / exit the car
  if (input.action) {
    if (!p.inCar && dist(p, car) < 3.6 && car.health > 0) { p.inCar = true; events.push({ type: "enter" }); if (g.mission.step === 0) g.mission.step = 1; }
    else if (p.inCar && Math.abs(car.speed) < 3) {
      for (const side of [-1, 1]) {               // step out on a free side
        const spot = { x: car.x + Math.cos(car.heading + Math.PI / 2 * side) * 2.3, y: car.y + Math.sin(car.heading + Math.PI / 2 * side) * 2.3 };
        const probe = { ...spot };
        if (!collideStatic(world, probe, p.r)) { p.x = spot.x; p.y = spot.y; p.inCar = false; car.speed = 0; events.push({ type: "exit" }); break; }
      }
    } else if (p.inCar) g.mission.hint = "Slow down to get out";
  }

  // --- move
  if (p.inCar) {
    // steering is relative to the car: push where you want to go, like a twin-stick racer
    const mag = Math.hypot(mx, my);
    let throttle = 0, steer = 0;
    if (mag > 0.15) {
      const want = Math.atan2(my, mx), diff = wrap(want - car.heading);
      // always turn towards where the stick points (a U-turn if needed); back up only when wedged against something
      throttle = mag * (Math.abs(diff) > 1.3 ? 0.6 : 1); steer = clamp(diff * 2.2, -1, 1);
      if (car.reverseFor > 0) { car.reverseFor -= dt; throttle = -1; steer = -steer; }
      else if (Math.abs(car.speed) < 0.7) { car.stuck += dt; if (car.stuck > 0.45) { car.stuck = 0; car.reverseFor = 0.75; } }
      else car.stuck = 0;
    } else { car.stuck = 0; car.reverseFor = 0; }
    stepCar(world, car, throttle, steer, !!input.brake, dt, events);
    p.x = car.x; p.y = car.y; p.facing = car.heading; p.speed = 0; p.anim = "drive";
  } else {
    const mag = Math.min(1, Math.hypot(mx, my));
    p.speed = mag * 5.6;
    if (mag > 0.1) { p.facing = Math.atan2(my, mx); p.x += mx / Math.max(1, Math.hypot(mx, my)) * 5.6 * dt; p.y += my / Math.max(1, Math.hypot(mx, my)) * 5.6 * dt; p.phase += dt * 9 * mag; }
    p.anim = mag > 0.6 ? "run" : mag > 0.1 ? "walk" : "idle";
    collideStatic(world, p, p.r);
    for (const c of [car, g.police]) for (const cc of carCircles(c)) {   // do not walk through cars
      const dx = p.x - cc.x, dy = p.y - cc.y, d = Math.hypot(dx, dy) || 1e-6, min = p.r + CAR.r;
      if (d < min) { p.x += dx / d * (min - d); p.y += dy / d * (min - d); }
    }
    stepCar(world, car, 0, 0, true, dt, events);  // the empty car rolls to a stop
  }

  stepPolice(g, dt);
  if (collideCars(car, g.police, events) && g.wanted > 0 && g.wanted < 2 && Math.abs(car.speed) + Math.abs(g.police.speed) > 9) raiseWanted(g, 2);

  // --- mission
  const m = g.mission, pos = playerPos(g);
  if (m.step === 1 && dist(pos, world.pizzeria) < world.pizzeria.r + 1.5) {
    m.step = 2; m.hasPizza = true; m.heat = m.heatMax;
    events.push({ type: "pizza" });
    raiseWanted(g, 1);
    g.cop.lastSeen = { x: pos.x, y: pos.y }; g.cop.state = "pursuit"; g.cop.timer = 0;
  }
  if (m.step === 2) {
    m.heat -= dt;
    if (m.heat <= 0) fail(g, "The pizza went cold.");
    if (dist(pos, world.home) < world.home.r + 1.5) {
      if (g.wanted === 0) { g.status = "win"; events.push({ type: "win", time: g.t }); }
      else m.hint = "You cannot go home with cops on your tail!";
    }
  }
  if (p.inCar && car.health <= 0) fail(g, "Your ride is totalled.");
}

function raiseWanted(g, level) {
  if (level > g.wanted) { g.wanted = Math.min(WANTED_MAX, level); g.events.push({ type: "wanted", level: g.wanted }); }
}

// --------------------------------------------------------------- police AI ---
// States: patrol -> pursuit (sees a wanted player) -> lost (no sight, drives to the last
// known spot) -> search (checks nearby corners) -> patrol. Arrest when it boxes the player in.
export const SIGHT = 55, LOST_AFTER = 3.5, SEARCH_FOR = 11, ARREST_SECONDS = 1.8;
function stepPolice(g, dt) {
  const { world, police: car, cop } = g, pos = playerPos(g);
  const d = dist(car, pos);
  cop.sees = g.wanted > 0 && d < SIGHT && lineOfSight(world, car, pos);
  let goal = null, direct = false;

  if (g.wanted === 0) cop.state = "patrol";
  else if (cop.sees) { cop.state = "pursuit"; cop.lastSeen = { x: pos.x, y: pos.y }; cop.timer = 0; }

  if (cop.state === "patrol") {
    const [i, j] = world.patrol[cop.wp % world.patrol.length];
    goal = node(world, i, j);
    if (dist(car, goal) < 6) cop.wp++;
  } else if (cop.state === "pursuit") {
    if (cop.sees) { goal = pos; direct = true; }
    else { cop.timer += dt; goal = cop.lastSeen; if (cop.timer > LOST_AFTER) { cop.state = "lost"; g.events.push({ type: "cop", state: "lost" }); } }
  } else if (cop.state === "lost") {
    goal = cop.lastSeen;
    if (dist(car, goal) < 7) { cop.state = "search"; cop.timer = 0; cop.searchNode = null; g.events.push({ type: "cop", state: "search" }); }
  } else if (cop.state === "search") {
    cop.timer += dt;
    if (!cop.searchNode || dist(car, cop.searchNode) < 6) {
      const n = nearestNode(world, car), opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => node(world, n.i + a, n.j + b)).filter((k) => k !== n && k !== cop.prevNode);
      cop.prevNode = n; cop.searchNode = opts[Math.floor(g.t * 7.3 + n.i * 3 + n.j) % opts.length];
    }
    goal = cop.searchNode;
    if (cop.timer > SEARCH_FOR) { g.wanted = 0; cop.state = "patrol"; g.events.push({ type: "escaped" }); }
  }

  // drive: straight at the target when it is visible, otherwise corner to corner along the roads
  let aim = goal;
  if (!direct && goal) {
    const here = nearestNode(world, car), there = nearestNode(world, goal);
    if (here !== there || dist(car, here) > 9) {
      if (dist(car, here) > 5 && !cop.onRoute) aim = here;
      else {
        cop.onRoute = true;
        const di = Math.sign(there.i - here.i), dj = Math.sign(there.j - here.j);
        const next = Math.abs(there.i - here.i) >= Math.abs(there.j - here.j) && di ? node(world, here.i + di, here.j) : dj ? node(world, here.i, here.j + dj) : there;
        aim = dist(car, here) < 5 ? next : (lineOfSight(world, car, next) ? next : here);
      }
    } else cop.onRoute = false;
  } else cop.onRoute = false;

  let throttle = 0, steer = 0;
  if (aim) {
    const diff = wrap(Math.atan2(aim.y - car.y, aim.x - car.x) - car.heading);
    steer = clamp(diff * 2.4, -1, 1);
    const cruise = cop.state === "patrol" ? 9 : cop.state === "search" ? 12 : 99;
    throttle = Math.abs(diff) > 1.2 ? 0.45 : 1;
    if (Math.abs(car.speed) > cruise) throttle = 0;
    if (direct && d < 7) throttle = 0.5;          // ease off when right behind, to box in rather than ram
  }
  if (car.reverseFor > 0) { car.reverseFor -= dt; throttle = -1; steer = -steer; }
  else if (throttle > 0 && Math.abs(car.speed) < 0.8) { car.stuck += dt; if (car.stuck > 1.1) { car.stuck = 0; car.reverseFor = 0.9; } }
  else car.stuck = 0;
  const before = car.health;
  stepCar(world, car, throttle, steer, false, dt, g.events);
  car.health = Math.max(before, 60);              // the police car does not wreck itself in the prototype

  // arrest: close to a player who is nearly stopped
  if (g.wanted > 0 && d < 4.6 && playerSpeed(g) < 2.5) { cop.arrest += dt; if (cop.arrest > ARREST_SECONDS) fail(g, "Busted!"); }
  else cop.arrest = Math.max(0, cop.arrest - dt * 2);
}
