import type { WorldState, Terrain } from "./world";

const W = 100, H = 70, PX = 10;

const TEX: Record<Terrain, string> = {
  grass: "#6db35a", forest: "#3a7d28", plain: "#8cc96a", mountain: "#9a9a9a", water: "#4d94ff", sand: "#f0d480",
};

const SEASON_TINT: Record<number, (c: string) => string> = {
  1: (c) => c, 2: (c) => c,
  3: (c) => c.replace("5a9e4b", "#c4a44a").replace("2d6b1e", "#8b6b2e"),
  0: (c) => c.replace("5a9e4b", "#d0d0d0").replace("2d6b1e", "#909090"),
};

const FX_CLR: Record<string, string> = {
  smite: "rgba(255,255,100,0.5)", rain: "rgba(59,130,246,0.3)", plague: "rgba(139,0,255,0.25)",
  bless: "rgba(255,215,0,0.25)", fire: "rgba(255,100,0,0.4)", lightning: "rgba(255,255,255,0.7)",
  terraform: "rgba(0,255,0,0.25)", heal: "rgba(0,255,128,0.25)",
};

/* ── Creature Sprites ── */

type Sfn = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frame: number) => void;
const rect = (c: CanvasRenderingContext2D, clr: string, x: number, y: number, w: number, h: number) => { c.fillStyle = clr; c.fillRect(x, y, w, h); };
const ell = (c: CanvasRenderingContext2D, clr: string, x: number, y: number, rw: number, rh: number) => { c.fillStyle = clr; c.beginPath(); c.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2); c.fill(); };
const tri = (c: CanvasRenderingContext2D, clr: string, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => { c.fillStyle = clr; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.fill(); };

const SPRITES: Record<string, Sfn> = {
  tree: (c, x, y, s) => {
    rect(c, "#3e2a12", x + s * 3, y + s * 5, s * 2, s * 3);
    rect(c, "#1a5c12", x + s, y + s * 2, s * 6, s * 3);
    rect(c, "#2d8a1e", x + s * 1.5, y + s, s * 5, s * 2.5);
  },
  rabbit: (c, x, y, s, frame) => {
    const b = Math.sin(frame * 0.15) * s * 0.5;
    ell(c, "#d4a574", x + s * 4, y + s * 5 + b, s * 3, s * 2.5);
    ell(c, "#e8c9a0", x + s * 6, y + s * 2 + b, s * 2, s * 2);
    rect(c, "#d4a574", x + s * 5.5, y + s + b, 1, s * 2.5);
    rect(c, "#d4a574", x + s * 7, y + s + b, 1, s * 2.5);
    ell(c, "#fff", x + s * 2, y + s * 6 + b, s, s);
    ell(c, "#222", x + s * 6.5, y + s * 2 + b, 0.5, 0.5);
  },
  deer: (c, x, y, s) => {
    ell(c, "#8b6914", x + s * 4, y + s * 4, s * 3.5, s * 2.5);
    ell(c, "#8b6914", x + s * 7, y + s * 2, s * 1.8, s * 3);
    rect(c, "#a07828", x + s * 2, y + s * 6, s, s * 4);
    rect(c, "#a07828", x + s * 5, y + s * 6, s, s * 4);
    c.strokeStyle = "#5a3a10"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x + s * 6, y + s); c.lineTo(x + s * 5, y - s * 0.5); c.stroke();
    c.beginPath(); c.moveTo(x + s * 8, y + s); c.lineTo(x + s * 8.5, y - s * 0.5); c.stroke();
  },
  wolf: (c, x, y, s) => {
    ell(c, "#5a5a5a", x + s * 4, y + s * 5, s * 3.5, s * 2.5);
    ell(c, "#4a4a4a", x + s * 7, y + s * 3, s * 2, s * 2);
    tri(c, "#4a4a4a", x + s * 6, y + s, x + s * 5, y + s * 2, x + s * 7, y + s * 2);
    tri(c, "#4a4a4a", x + s * 9, y + s, x + s * 8, y + s * 2, x + s * 10, y + s * 2);
    ell(c, "#fff", x + s * 7.5, y + s * 2.5, 0.5, 0.5);
    rect(c, "#5a5a5a", x + s * 2, y + s * 7, s, s * 3);
    rect(c, "#5a5a5a", x + s * 5, y + s * 7, s, s * 3);
    ell(c, "#4a4a4a", x + s, y + s * 4, s * 1.5, s * 2);
  },
  human: (c, x, y, s, frame) => {
    const w = Math.sin(frame * 0.1) * s * 0.5;
    rect(c, "#e2a871", x + s * 3, y + s * 3, s * 2, s * 4);
    ell(c, "#f0c8a0", x + s * 4, y + s * 1.5, s * 2, s * 2);
    ell(c, "#222", x + s * 5, y + s, 0.4, 0.4);
    ell(c, "#222", x + s * 3, y + s, 0.4, 0.4);
    rect(c, "#e2a871", x + s, y + s * 3, s, s * 3.5);
    rect(c, "#e2a871", x + s * 5.5, y + s * 3, s, s * 3.5);
    rect(c, "#e2a871", x + s * 3, y + s * 7 + w, s, s * 3);
    rect(c, "#e2a871", x + s * 4.5, y + s * 7 - w, s, s * 3);
  },
};

function drawSprite(ctx: CanvasRenderingContext2D, species: string, x: number, y: number, s: number, frame: number) {
  (SPRITES[species] ?? SPRITES.rabbit)(ctx, x, y, s, frame);
}

/* ── Render ────────────────── */

export function renderWorld(canvas: HTMLCanvasElement, world: WorldState, cursor: { x: number; y: number } | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W * PX; canvas.height = H * PX;
  ctx.imageSmoothingEnabled = false;

  // Sky
  const sc = [["#1a1a3e", "#2d2d5e", "#3a5a8a"], ["#0f0f2e", "#1e3a5e", "#4a8aba"], ["#2a1a1e", "#4a3a2e", "#8a6a4a"], ["#1a1a2e", "#2a2a3e", "#6a6a8a"]][world.season % 4];
  const sky = ctx.createLinearGradient(0, 0, 0, H * PX);
  sky.addColorStop(0, sc[0]); sky.addColorStop(0.4, sc[1]); sky.addColorStop(1, sc[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W * PX, H * PX);

  const tint = SEASON_TINT[world.season % 4] ?? ((c: string) => c);

  // Terrain
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cell = world.cells[y]?.[x];
      if (!cell) continue;
      ctx.fillStyle = tint(TEX[cell.terrain] ?? "#333");
      ctx.fillRect(x * PX, y * PX, PX, PX);
      if (cell.fertility > 50 && (cell.terrain === "grass" || cell.terrain === "plain")) {
        ctx.fillStyle = "rgba(34,197,94,0.2)"; ctx.fillRect(x * PX, y * PX, PX, PX);
      }
    }

  // Buildings
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const b = world.cells[y]?.[x]?.building;
      if (!b) continue;
      const bx = x * PX, by = y * PX;
      const clr = ({ hut: "#8b6914", farm: "#5a9e4b", house: "#a07828", temple: "#e2c171" } as Record<string, string>)[b] ?? "#8b6914";
      if (b === "farm") { ctx.fillStyle = clr; ctx.fillRect(bx + 1, by + 5, PX - 2, 2); ctx.fillStyle = "#8b6914"; ctx.fillRect(bx + 3, by + 2, 2, 4); }
      else { ctx.fillStyle = clr; ctx.fillRect(bx + 1, by + 2, PX - 2, PX - 3); }
    }

  // Creatures
  for (const c of world.creatures) {
    const cx = Math.floor(c.x) * PX, cy = Math.floor(c.y) * PX;
    if (c.settlementId !== null) { ctx.fillStyle = "rgba(99,102,241,0.2)"; ctx.fillRect(cx - 1, cy - 1, PX + 2, PX + 2); }
    drawSprite(ctx, c.species, cx, cy, PX, world.tick + c.id);
    if (c.health < 80) {
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(cx, cy - 2, PX, 1);
      ctx.fillStyle = c.health > 40 ? "#22c55e" : "#ef4444"; ctx.fillRect(cx, cy - 2, PX * (c.health / 100), 1);
    }
  }

  // Effects
  for (const eff of world.activeEffects) {
    const alpha = Math.max(0, 1 - (world.tick - eff.tick) / 40);
    ctx.fillStyle = (FX_CLR[eff.power] ?? "rgba(255,255,255,0.3)").replace(/[\d.]+\)$/, `${alpha.toFixed(2)})`);
    ctx.beginPath(); ctx.arc(eff.x * PX + 4, eff.y * PX + 4, 4 + (20 - world.tick + eff.tick) * 2, 0, Math.PI * 2); ctx.fill();
  }

  // Cursor
  if (cursor) { ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(cursor.x * PX, cursor.y * PX, PX, PX); }
}
