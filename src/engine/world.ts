/* ── God Sim v2 — Natural Biomes + Settlements ── */

export type Terrain = "grass" | "forest" | "mountain" | "water" | "sand" | "plain";
export type Species = "tree" | "rabbit" | "deer" | "wolf" | "human";
export type GodPower = "bless" | "rain" | "smite" | "heal" | "fire" | "plague" | "terraform" | "lightning";

export interface Cell {
  terrain: Terrain; moisture: number; fertility: number;
  building: string | null; // null or "hut" | "farm" | "house" | "temple"
}

export interface Creature {
  id: number; species: Species; x: number; y: number;
  health: number; age: number; hunger: number;
  settlementId: number | null; // human's home settlement
}

export interface Settlement {
  id: number; x: number; y: number; population: number; houses: number; farms: number; level: number;
}

export interface WorldState {
  cells: Cell[][]; creatures: Creature[]; settlements: Settlement[];
  tick: number; season: number; eventLog: string[]; populationHistory: number[];
  activeEffects: { power: GodPower; x: number; y: number; tick: number }[];
  W: number; H: number;
}

const W = 100, H = 70;
let _id = 1;
const ID = () => _id++;

const rand = (n: number) => Math.floor(Math.random() * n);
const near = (v: number, r: number) => v + (Math.random() - 0.5) * r * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, b.y - b.y);

/* ── Species Config ──────── */

interface SpCfg {
  diet: "plant" | "meat" | "both"; speed: number; reproduce: number;
  offspring: number; lifespan: number; hungerRate: number; vision: number; prey: Species[];
}

const SP: Record<Species, SpCfg> = {
  tree: { diet: "plant", speed: 0, reproduce: 90, offspring: 3, lifespan: 600, hungerRate: 0, vision: 0, prey: [] },
  rabbit: { diet: "plant", speed: 2, reproduce: 70, offspring: 4, lifespan: 250, hungerRate: 0.8, vision: 8, prey: [] },
  deer: { diet: "plant", speed: 1.5, reproduce: 85, offspring: 2, lifespan: 400, hungerRate: 0.6, vision: 10, prey: [] },
  wolf: { diet: "meat", speed: 2.5, reproduce: 90, offspring: 2, lifespan: 300, hungerRate: 1.2, vision: 12, prey: ["rabbit", "deer"] },
  human: { diet: "both", speed: 1.2, reproduce: 95, offspring: 1, lifespan: 700, hungerRate: 0.5, vision: 18, prey: ["rabbit", "deer", "wolf"] },
};

/* ── Terrain Generation ──── */

import { createNoise2D } from "simplex-noise";

function genTerrain(): Cell[][] {
  const cells: Cell[][] = [];
  const elevation = createNoise2D();
  const moisture = createNoise2D();

  for (let y = 0; y < H; y++) {
    cells[y] = [];
    for (let x = 0; x < W; x++) {
      const e = elevation(x * 0.04, y * 0.04);
      const m = moisture(x * 0.05 + 10, y * 0.05 + 10);

      const terrain: Terrain =
        e > 0.5 ? "mountain" :
        e > 0.25 ? "forest" :
        e < -0.4 ? "water" :
        e < -0.15 ? "sand" :
        m > 0.3 ? "forest" : "grass";

      cells[y][x] = { terrain, moisture: Math.floor((m + 1) * 50), fertility: Math.floor((1 - Math.abs(e)) * 100), building: null };
    }
  }
  return cells;
}

/* ── World Init ────────────── */

export function createWorld(): WorldState {
  const cells = genTerrain();
  const creatures: Creature[] = [];
  const spawn = (s: Species, n: number) => {
    for (let i = 0; i < n; i++) creatures.push({ id: ID(), species: s, x: rand(W), y: rand(H), health: 80 + rand(20), age: rand(50), hunger: rand(20), settlementId: null });
  };
  spawn("tree", 30); spawn("rabbit", 25); spawn("deer", 15); spawn("wolf", 8); spawn("human", 12);

  return {
    cells, creatures, settlements: [], tick: 0, season: 0, eventLog: ["🌍 A new world takes shape. Your creatures await."], populationHistory: [], activeEffects: [], W, H,
  };
}

/* ── Creature AI ───────────── */

function act(c: Creature, world: WorldState): { c: Creature; log: string | null } {
  const cfg = SP[c.species];
  let creature = { ...c, age: c.age + 1 };

  const cell = world.cells[clamp(Math.floor(creature.y), 0, H - 1)]?.[clamp(Math.floor(creature.x), 0, W - 1)];
  const dead = creature.age > cfg.lifespan || creature.hunger >= 100 || (!cell) || (cell.terrain === "water" && c.species !== "human") || (cell.terrain === "mountain" && c.species === "rabbit");
  if (dead) return { c: creature, log: null };

  // Move
  if (cfg.speed > 0) {
    const neighbors = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = clamp(Math.floor(c.x) + dx, 0, W - 1), ny = clamp(Math.floor(c.y) + dy, 0, H - 1);
        neighbors.push({ x: nx, y: ny, cell: world.cells[ny]?.[nx] });
      }
    const best = neighbors
      .filter((n) => n.cell && n.cell.terrain !== "water")
      .sort((a, b) => (b.cell?.fertility ?? 0) - (a.cell?.fertility ?? 0))[0] ?? neighbors[0];
    creature.x = clamp(creature.x + (best.x - creature.x) * cfg.speed * 0.2, 0, W - 1);
    creature.y = clamp(creature.y + (best.y - creature.y) * cfg.speed * 0.2, 0, H - 1);
  }

  // Eat
  const preyNear = cfg.prey.length > 0 ? world.creatures.filter((o) => o.id !== c.id && cfg.prey.includes(o.species) && dist(c, o) < cfg.vision) : [];
  const canEat = preyNear.length > 0 && (cfg.diet === "meat" || cfg.diet === "both");
  const canGraze = cfg.diet === "plant" || cfg.diet === "both";

  if (canEat) { const p = preyNear[0]; world.creatures = world.creatures.filter((o) => o.id !== p.id); creature.hunger = 0; return { c: creature, log: `${c.species}#${c.id} ate ${p.species}` }; }
  if (canGraze && (cell?.fertility ?? 0) > 25) { cell!.fertility -= 15; creature.hunger = 0; return { c: creature, log: null }; }

  creature.hunger = clamp(creature.hunger + cfg.hungerRate, 0, 100);

  // Reproduce
  if (creature.health > cfg.reproduce && creature.hunger < 30) {
    const off: Creature = { id: ID(), species: c.species, x: near(creature.x, 4), y: near(creature.y, 4), health: 60, age: 0, hunger: 20, settlementId: creature.settlementId };
    world.creatures.push(off);
    creature.health = 50;
    return { c: creature, log: `${c.species} reproduced` };
  }

  return { c: creature, log: null };
}

/* ── Tick ─────────────────── */

export function tick(w: WorldState): WorldState {
  const world = { ...w, tick: w.tick + 1, eventLog: [...w.eventLog], creatures: [...w.creatures], cells: w.cells.map((r) => r.map((c) => ({ ...c }))) };
  const alive: Creature[] = [];

  for (const c of world.creatures) {
    const { c: updated, log } = act(c, world);
    if (updated.health <= 0 || updated.hunger >= 100 || updated.age > SP[updated.species].lifespan) continue;
    if (log) world.eventLog.push(log);
    alive.push(updated);
  }

  world.creatures = alive;
  world.populationHistory.push(alive.length);

  // Resources
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = world.cells[y][x];
      c.moisture = clamp(c.moisture + rand(2) - 1 + (c.terrain === "water" ? 3 : 0), 0, 100);
      c.fertility = clamp(c.fertility + rand(2) - 1, 0, 100);
    }

  // Season
  world.season = Math.floor(world.tick / 200) % 4; // spring, summer, autumn, winter

  // Settlements: humans near each other form settlements
  const humans = alive.filter((c) => c.species === "human");
  const settled = new Set<number>();
  for (const h of humans) {
    if (settled.has(h.id)) continue;
    const group = humans.filter((o) => !settled.has(o.id) && dist(h, o) < 10);
    if (group.length >= 3) {
      const sx = Math.floor(group.reduce((s, c) => s + c.x, 0) / group.length);
      const sy = Math.floor(group.reduce((s, c) => s + c.y, 0) / group.length);
      const existing = world.settlements.find((s) => dist(s, { x: sx, y: sy }) < 8);
      const settlement = existing ?? { id: ID(), x: sx, y: sy, population: 0, houses: 1, farms: 0, level: 1 };
      if (!existing) world.settlements.push(settlement);
      settlement.population = group.length;
      settlement.houses = Math.min(8, Math.floor(group.length / 3) + 1);
      settlement.farms = Math.min(6, Math.floor(group.length / 5));
      settlement.level = Math.floor(settlement.population / 10) + 1;
      for (const g of group) { g.settlementId = settlement.id; settled.add(g.id); }
      // Build on cells
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const cx = clamp(sx + dx, 0, W - 1), cy = clamp(sy + dy, 0, H - 1);
          if (Math.abs(dx) + Math.abs(dy) <= 2) world.cells[cy][cx].building = settlement.level >= 3 ? "house" : "hut";
          else if (Math.abs(dx) + Math.abs(dy) <= 4) world.cells[cy][cx].building = "farm";
          if (settlement.level >= 5) world.cells[cy][cx].building = world.cells[cy][cx].building === "hut" ? "house" : "temple";
        }
    }
  }

  // Random god events
  if (Math.random() < 0.02) {
    const p: GodPower = ["rain", "plague", "lightning"][rand(3)] as GodPower;
    const fx = rand(W), fy = rand(H);
    GOD_EFFECTS[p](world, fx, fy);
    world.activeEffects.push({ power: p, x: fx, y: fy, tick: world.tick });
  }

  // Effects fade
  world.activeEffects = world.activeEffects.filter((e) => world.tick - e.tick < 40);

  if (world.eventLog.length > 60) world.eventLog = world.eventLog.slice(-30);
  return world;
}

/* ── God Powers ────────────── */

const GOD_EFFECTS: Record<GodPower, (w: WorldState, x: number, y: number) => void> = {
  smite: (w, x, y) => { w.creatures = w.creatures.filter((c) => dist(c, { x, y }) > 5); w.eventLog.push(`⚡ SMITE!`); w.activeEffects.push({ power: "smite", x, y, tick: w.tick }); },
  rain: (w, x, y) => {
    for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) { const cx = clamp(x + dx, 0, W - 1), cy = clamp(y + dy, 0, H - 1); w.cells[cy][cx].moisture = 100; w.cells[cy][cx].fertility = clamp(w.cells[cy][cx].fertility + 40, 0, 100); }
    w.eventLog.push(`🌧️ Rain blessed the land`); w.activeEffects.push({ power: "rain", x, y, tick: w.tick });
  },
  plague: (w, x, y) => { let n = 0; w.creatures = w.creatures.map((c) => dist(c, { x, y }) < 12 && Math.random() < 0.4 ? (n++, { ...c, health: 15 }) : c); w.eventLog.push(`🦠 Plague infected ${n} creatures`); w.activeEffects.push({ power: "plague", x, y, tick: w.tick }); },
  bless: (w, x, y) => { w.creatures = w.creatures.map((c) => dist(c, { x, y }) < 10 ? { ...c, health: 100, hunger: 0 } : c); for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const cx = clamp(x + dx, 0, W - 1), cy = clamp(y + dy, 0, H - 1); w.cells[cy][cx].fertility = 100; } w.eventLog.push(`✨ Blessed`); w.activeEffects.push({ power: "bless", x, y, tick: w.tick }); },
  fire: (w, x, y) => { for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { const cx = clamp(x + dx, 0, W - 1), cy = clamp(y + dy, 0, H - 1); const cell = w.cells[cy][cx]; cell.fertility = 0; cell.moisture = 0; cell.building = null; if (cell.terrain === "forest") cell.terrain = "plain"; } w.creatures = w.creatures.filter((c) => dist(c, { x, y }) > 6 || c.species === "human"); w.eventLog.push(`🔥 FIRE!`); w.activeEffects.push({ power: "fire", x, y, tick: w.tick }); },
  terraform: (w, x, y) => { const terrains: Terrain[] = ["grass", "forest", "mountain", "water"]; for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const cx = clamp(x + dx, 0, W - 1), cy = clamp(y + dy, 0, H - 1); w.cells[cy][cx].terrain = terrains[rand(4)]; } w.eventLog.push(`🏔️ Terraformed`); w.activeEffects.push({ power: "terraform", x, y, tick: w.tick }); },
  lightning: (w, x, y) => { w.creatures = w.creatures.filter((c) => dist(c, { x, y }) > 3 || c.id < 0); const cx = clamp(x, 0, W - 1), cy = clamp(y, 0, H - 1); w.cells[cy][cx].fertility = 100; w.cells[cy][cx].terrain = "stone" as Terrain; w.eventLog.push(`⚡ Lightning!`); w.activeEffects.push({ power: "lightning", x, y, tick: w.tick }); },
  heal: (w, x, y) => { w.creatures = w.creatures.map((c) => dist(c, { x, y }) < 10 ? { ...c, health: 100 } : c); w.eventLog.push(`💚 Healed`); w.activeEffects.push({ power: "heal", x, y, tick: w.tick }); },
};

export function applyGodPower(w: WorldState, power: GodPower, x: number, y: number): WorldState {
  GOD_EFFECTS[power]?.(w, x, y);
  return { ...w };
}

export function spawnCreature(w: WorldState, species: Species, x: number, y: number): WorldState {
  const c: Creature = { id: ID(), species, x: clamp(x, 0, W - 1), y: clamp(y, 0, H - 1), health: 80, age: 20, hunger: 20, settlementId: null };
  return { ...w, creatures: [...w.creatures, c], eventLog: [...w.eventLog, `Created ${species}`] };
}
