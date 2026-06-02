/* ── God Sim — World Engine ── */

export type Terrain = "grass" | "dirt" | "stone" | "water" | "sand";
export type Species = "tree" | "bush" | "rabbit" | "deer" | "wolf" | "human";
export type GodPower = "smite" | "rain" | "plague" | "bless" | "fire" | "terraform" | "lightning" | "heal";

export interface Cell { terrain: Terrain; moisture: number; fertility: number; }
export interface Creature { id: number; species: Species; x: number; y: number; health: number; age: number; hunger: number; }
export interface WorldState { cells: Cell[][]; creatures: Creature[]; tick: number; populationHistory: number[]; eventLog: string[]; }
export type DispatchFn = (a: WorldState) => WorldState;

const W = 100, H = 70;
let _nextId = 1;
const idGen = () => _nextId++;

/* ── Terrain helpers ──────── */

const rand = (n: number) => Math.floor(Math.random() * n);
const near = (v: number, r: number) => v + (Math.random() - 0.5) * r * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: Creature, b: Creature) => Math.hypot(a.x - b.x, b.y - b.y);

const TERRAIN_WEIGHTS: Record<Terrain, number> = { grass: 0.45, dirt: 0.25, stone: 0.1, water: 0.1, sand: 0.1 };
const TERRAIN_KEYS = Object.keys(TERRAIN_WEIGHTS) as Terrain[];

function pickTerrain(): Terrain {
  const r = Math.random();
  let acc = 0;
  for (const t of TERRAIN_KEYS) { acc += TERRAIN_WEIGHTS[t]; if (r <= acc) return t; }
  return "grass";
}

/* ── Species config ───────── */

interface SpeciesConfig {
  diet: "plant" | "meat" | "both"; speed: number; reproduceAt: number; offspring: number;
  lifespan: number; hungerRate: number; vision: number; prey: Species[];
}

const SPECIES: Record<Species, SpeciesConfig> = {
  tree: { diet: "plant", speed: 0, reproduceAt: 80, offspring: 2, lifespan: 600, hungerRate: 0, vision: 0, prey: [] },
  bush: { diet: "plant", speed: 0, reproduceAt: 60, offspring: 3, lifespan: 400, hungerRate: 0, vision: 0, prey: [] },
  rabbit: { diet: "plant", speed: 2, reproduceAt: 70, offspring: 4, lifespan: 300, hungerRate: 0.8, vision: 8, prey: [] },
  deer: { diet: "plant", speed: 1.5, reproduceAt: 85, offspring: 2, lifespan: 500, hungerRate: 0.6, vision: 10, prey: [] },
  wolf: { diet: "meat", speed: 2.5, reproduceAt: 90, offspring: 2, lifespan: 350, hungerRate: 1.2, vision: 12, prey: ["rabbit", "deer"] },
  human: { diet: "both", speed: 1.5, reproduceAt: 95, offspring: 1, lifespan: 700, hungerRate: 0.8, vision: 15, prey: ["rabbit", "deer", "wolf"] },
};

/* ── World init ────────────── */

export function createWorld(): WorldState {
  const cells: Cell[][] = [];
  for (let y = 0; y < H; y++) {
    cells[y] = [];
    for (let x = 0; x < W; x++) {
      cells[y][x] = { terrain: pickTerrain(), moisture: rand(100), fertility: rand(100) };
    }
  }
  // Rivers
  for (let x = 0; x < W; x++) {
    const y = 30 + Math.floor(Math.sin(x * 0.1) * 8) + rand(6);
    for (let dy = 0; dy < 3; dy++) cells[Math.min(H - 1, y + dy)][x].terrain = "water";
  }

  const creatures: Creature[] = [];
  const spawn = (s: Species, count: number) => {
    for (let i = 0; i < count; i++) creatures.push({ id: idGen(), species: s, x: rand(W), y: rand(H - 20), health: 100, age: rand(50), hunger: 0 });
  };
  spawn("tree", 15); spawn("bush", 25);
  spawn("rabbit", 20); spawn("deer", 10);
  spawn("wolf", 6); spawn("human", 8);

  return { cells, creatures, tick: 0, populationHistory: [], eventLog: ["World created. Your creatures await your will."] };
}

/* ── Creature behavior ────── */

function moveTowards(c: Creature, tx: number, ty: number): Creature {
  const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy) || 1;
  const cfg = SPECIES[c.species];
  const vx = (dx / d) * cfg.speed, vy = (dy / d) * cfg.speed;
  return { ...c, x: clamp(c.x + vx, 0, W - 1), y: clamp(c.y + vy, 0, H - 1) };
}

function tryEat(c: Creature, world: WorldState): { c: Creature; log?: string } {
  const cfg = SPECIES[c.species];
  const cell = world.cells[Math.floor(c.y)]?.[Math.floor(c.x)];
  const food = cfg.diet === "plant" || cfg.diet === "both" ? cell?.fertility ?? 0 : 0;
  const nearby = world.creatures.filter((o) => o.id !== c.id && cfg.prey.includes(o.species) && dist(c, o) < cfg.vision);

  const plantEat = food > 20 && (cfg.diet === "plant" || cfg.diet === "both");
  const meatEat = nearby.length > 0 && (cfg.diet === "meat" || cfg.diet === "both");

  if (plantEat) return { c: { ...c, hunger: 0 }, log: `${c.species}#${c.id} grazed` };
  if (meatEat) {
    const prey = nearby[0];
    world.creatures = world.creatures.filter((o) => o.id !== prey.id);
    return { c: { ...c, hunger: 0 }, log: `${c.species}#${c.id} hunted ${prey.species}#${prey.id}` };
  }
  return { c: { ...c, hunger: clamp(c.hunger + cfg.hungerRate, 0, 100) } };
}

/* ── Tick ─────────────────── */

export function tick(world: WorldState): WorldState {
  const newWorld = { ...world, tick: world.tick + 1, creatures: [...world.creatures], eventLog: [...world.eventLog] };
  const alive: Creature[] = [];

  for (const c of newWorld.creatures) {
    const cfg = SPECIES[c.species];
    let creature = { ...c, age: c.age + 1 };
    const cell = newWorld.cells[Math.floor(clamp(creature.y, 0, H - 1))]?.[Math.floor(clamp(creature.x, 0, W - 1))];

    // Death: old age, starvation, or hostile terrain
    const deadByAge = creature.age > cfg.lifespan;
    const deadByHunger = creature.hunger >= 100;
    const deadByTerrain = !cell || cell.terrain === "water" && creature.species !== "human";
    if (deadByAge || deadByHunger || deadByTerrain) continue;

    // Act
    if (cfg.speed > 0) creature = moveTowards(creature, near(creature.x, cfg.vision), near(creature.y, cfg.vision));
    const { c: fed, log } = tryEat(creature, newWorld);
    creature = fed;
    if (log) newWorld.eventLog.push(log);

    // Reproduce
    if (creature.health > cfg.reproduceAt && creature.hunger < 40) {
      const offspring: Creature = { id: idGen(), species: c.species, x: near(creature.x, 3), y: near(creature.y, 3), health: 60, age: 0, hunger: 20 };
      alive.push(offspring);
      creature.health = 50;
    }

    alive.push(creature);
  }

  // Resource regen
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = newWorld.cells[y][x];
      c.moisture = clamp(c.moisture + (c.terrain === "water" ? 5 : rand(2) - 1), 0, 100);
      c.fertility = clamp(c.fertility + rand(2) - (c.terrain === "sand" ? 2 : 0), 0, 100);
    }

  newWorld.creatures = alive;
  newWorld.populationHistory.push(alive.length);
  if (newWorld.eventLog.length > 50) newWorld.eventLog = newWorld.eventLog.slice(-30);

  // God events
  const events = applyGodEvents(newWorld);
  newWorld.eventLog.push(...events);

  return newWorld;
}

/* ── God Powers ────────────── */

const GOD_EFFECTS: Record<GodPower, (w: WorldState, x: number, y: number) => string[]> = {
  smite: (w, x, y) => {
    const before = w.creatures.length;
    w.creatures = w.creatures.filter((c) => dist(c, { x, y } as any) > 6);
    return [`⚡ SMITE! ${before - w.creatures.length} creatures destroyed at (${x}, ${y})`];
  },
  rain: (w, x, y) => {
    for (let dy = -8; dy <= 8; dy++)
      for (let dx = -8; dx <= 8; dx++) {
        const cx = Math.floor(x + dx), cy = Math.floor(y + dy);
        if (w.cells[cy]?.[cx]) { w.cells[cy][cx].moisture = 100; w.cells[cy][cx].fertility = clamp(w.cells[cy][cx].fertility + 30, 0, 100); }
      }
    return [`🌧️ RAIN blessed the land at (${x}, ${y})`];
  },
  plague: (w, x, y) => {
    let count = 0;
    w.creatures = w.creatures.map((c) => dist(c, { x, y } as any) < 10 && Math.random() < 0.4 ? (count++, { ...c, health: 20 }) : c);
    return [`🦠 PLAGUE infected ${count} creatures at (${x}, ${y})`];
  },
  bless: (w, x, y) => {
    w.creatures = w.creatures.map((c) => dist(c, { x, y } as any) < 10 ? { ...c, health: 100, hunger: 0 } : c);
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++) {
        const cx = Math.floor(x + dx), cy = Math.floor(y + dy);
        if (w.cells[cy]?.[cx]) { w.cells[cy][cx].fertility = 100; w.cells[cy][cx].moisture = 80; }
      }
    return [`✨ BLESS — creatures healed, land enriched at (${x}, ${y})`];
  },
  fire: (w, x, y) => {
    for (let dy = -6; dy <= 6; dy++)
      for (let dx = -6; dx <= 6; dx++) {
        const cx = Math.floor(x + dx), cy = Math.floor(y + dy);
        if (w.cells[cy]?.[cx]) { w.cells[cy][cx].fertility = 0; w.cells[cy][cx].terrain = "dirt"; }
      }
    w.creatures = w.creatures.filter((c) => dist(c, { x, y } as any) > 5 || c.species === "human");
    return [`🔥 FIRE scorched the land at (${x}, ${y})`];
  },
  terraform: (w, x, y) => {
    const terrains: Terrain[] = ["grass", "water", "stone", "sand", "dirt"];
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const cx = Math.floor(x + dx), cy = Math.floor(y + dy);
        if (w.cells[cy]?.[cx]) w.cells[cy][cx].terrain = terrains[Math.floor(Math.random() * terrains.length)];
      }
    return [`🏔️ TERRAFORM reshaped the land at (${x}, ${y})`];
  },
  lightning: (w, x, y) => {
    w.creatures = w.creatures.filter((c) => dist(c, { x, y } as any) > 3 || c.id === 0);
    if (w.cells[y]?.[x]) { w.cells[y][x].fertility = 100; w.cells[y][x].terrain = "stone"; }
    return [`⚡ LIGHTNING struck (${x}, ${y})`];
  },
  heal: (w, x, y) => {
    w.creatures = w.creatures.map((c) => dist(c, { x, y } as any) < 8 ? { ...c, health: 100 } : c);
    return [`💚 HEAL restored all nearby creatures at (${x}, ${y})`];
  },
};

function randomEvent(w: WorldState): string | null {
  const r = Math.random();
  if (r < 0.03) return applyGodEffects(w, "plague", rand(W), rand(H))[0] ?? null;
  if (r < 0.06) return applyGodEffects(w, "lightning", rand(W), rand(H))[0] ?? null;
  if (r < 0.09) return applyGodEffects(w, "rain", rand(W), rand(H))[0] ?? null;
  return null;
}

function applyGodEvents(w: WorldState): string[] {
  const logs: string[] = [];
  const event = randomEvent(w);
  if (event) logs.push(event);
  return logs;
}

export function applyGodEffects(w: WorldState, power: GodPower, x: number, y: number): string[] {
  return (GOD_EFFECTS[power] ?? GOD_EFFECTS.smite)(w, clamp(x, 0, W - 1), clamp(y, 0, H - 1));
}

export function addCreature(w: WorldState, species: Species, x: number, y: number): WorldState {
  const c: Creature = { id: idGen(), species, x: clamp(x, 0, W - 1), y: clamp(y, 0, H - 1), health: 80, age: 20, hunger: 20 };
  return { ...w, creatures: [...w.creatures, c], eventLog: [...w.eventLog, `Created ${species} at (${Math.floor(x)}, ${Math.floor(y)})`] };
}
