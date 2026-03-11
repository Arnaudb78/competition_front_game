import Phaser from "phaser";

const TILE = 32;
const MAP_W = 48;
const MAP_H = 44;
const MOVE_DURATION = 150; // ms par tile
const PLAYER_SIZE = TILE * 2.5; // taille d'affichage du sprite joueur
const NPC_SIZE = TILE * 2.5;

export interface ModuleData {
  id: number;
  name: string;
  x: number;
  y: number;
}

export interface NpcData {
  id: string;
  x: number;
  y: number;
  texture: string; // "miroka-south" | "miroka-north" | ...
  dialog: string[];
}

export const FALLBACK_MODULES: ModuleData[] = [
  { id: 1, name: "La naissance d'Enchanted Tools", x: 38, y: 18 },
  { id: 2, name: "L'histoire des Mirokaï", x: 30, y: 10 },
  { id: 3, name: "Le design", x: 34, y: 5 },
  { id: 4, name: "La table électronique", x: 5, y: 5 },
  { id: 5, name: "La combinaison des Mirokaï", x: 5, y: 9 },
  { id: 6, name: "Le pendule inversé", x: 14, y: 10 },
  { id: 7, name: "La vision du robot", x: 5, y: 14 },
  { id: 8, name: "L'IA du robot", x: 8, y: 14 },
  { id: 9, name: "Les cas d'usage", x: 5, y: 18 },
  { id: 10, name: "La salle de cyclage", x: 8, y: 28 },
  { id: 11, name: "La fresque récapitulative", x: 32, y: 28 },
];

// PNJ fixe près de l'entrée (x=5, y=27)
const NPCS: NpcData[] = [
  {
    id: "guide",
    x: 42,
    y: 24,
    texture: "mirokai-west",
    dialog: [
      "Bienvenue dans l'univers Enchanted Tools !",
      "Je suis un Mirokaï, le robot conçu ici même.",
      "Explore les modules pour en apprendre plus sur nous.",
      "Appuie sur A près d'un module violet pour l'activer !",
    ],
  },
];

const NPC_IDLE_DIRS = [
  "miroka-south",
  "miroka-west",
  "miroka-north",
  "miroka-east",
] as const;

export class MainScene extends Phaser.Scene {
  private playerSprite!: Phaser.GameObjects.Image;
  private currentDir = "south";

  private playerX = 42;
  private playerY = 22;
  private isMoving = false;
  private heldDir: { dx: number; dy: number } | null = null;
  private modules: ModuleData[] = FALLBACK_MODULES;
  private npcs: NpcData[] = NPCS;
  private npcSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private npcDirIndex = 0;
  private mirokaSpr: Phaser.GameObjects.Image | null = null;
  static readonly MIROKA_X = 24;
  static readonly MIROKA_Y = 14;

  // ── Dark mode ──────────────────────────────────────────────────────────────
  private darkMode = false;
  private zombies: { tileX: number; tileY: number; sprite: Phaser.GameObjects.Image; isMoving: boolean }[] = [];
  private lastHitTime = 0;
  private readonly I_FRAMES_MS = 1200;
  private boss: { tileX: number; tileY: number; sprite: Phaser.GameObjects.Image; hp: number; maxHp: number; isMoving: boolean } | null = null;
  private bossMaxHp = 5;

  // Grille de collision construite depuis le calque "collisions" de Tiled
  private collisionGrid: boolean[][] = [];

  onInteract?: (module: { id: number; name: string }) => void;
  onNearModule?: (module: { id: number; name: string } | null) => void;
  onNearNpc?: (npc: NpcData | null) => void;
  onInteractNpc?: (npc: NpcData) => void;
  onStartIntro?: () => void;
  onModuleInteracted?: (id: number) => void;
  onZombieKilled?: (remaining: number) => void;
  onAllZombiesKilled?: () => void;
  onPlayerHit?: () => void;
  onBossAppear?: (maxHp: number) => void;
  onBossHit?: (hpLeft: number, maxHp: number) => void;
  onBossKilled?: () => void;

  constructor(modules?: ModuleData[]) {
    super({ key: "MainScene" });
    if (modules && modules.length > 0) {
      this.modules = modules;
    }
  }

  preload() {
    // Joueur (Miroki)
    this.load.image("miroki-south", "/assets/South.png");
    this.load.image("miroki-north", "/assets/North.png");
    this.load.image("miroki-east", "/assets/East.png");
    this.load.image("miroki-west", "/assets/West.png");

    // PNJ (Miroka)
    this.load.image("miroka-south", "/assets/Miroka_south.png");
    this.load.image("miroka-north", "/assets/Miroka_north.png");
    this.load.image("miroka-east", "/assets/Miroka_east.png");
    this.load.image("miroka-west", "/assets/Miroka_west.png");

    // Image de la map exportée depuis Tiled (File → Export as Image)
    // Zombies (8 directions)
    this.load.image("zombie-south", "/assets/zombie-south.png");
    this.load.image("zombie-north", "/assets/zombie-north.png");
    this.load.image("zombie-east", "/assets/zombie-east.png");
    this.load.image("zombie-west", "/assets/zombie-west.png");
    this.load.image("zombie-south-east", "/assets/zombie-south-east.png");
    this.load.image("zombie-south-west", "/assets/zombie-south-west.png");
    this.load.image("zombie-north-east", "/assets/zombie-north-east.png");
    this.load.image("zombie-north-west", "/assets/zombie-north-west.png");

    this.load.image("map-bg", "/assets/map.png");

    // Données JSON de la map (pour le calque collisions)
    this.load.json("map-data", "/map-game.tmj");
  }

  create() {
    // ── Fond de map ────────────────────────────────────────────────────────────
    if (this.textures.exists("map-bg")) {
      this.add.image(0, 0, "map-bg").setOrigin(0, 0);
    } else {
      // Fallback damier si l'image n'est pas encore exportée
      for (let x = 0; x < MAP_W; x++) {
        for (let y = 0; y < MAP_H; y++) {
          const color = (x + y) % 2 === 0 ? 0x1a1a2e : 0x16213e;
          this.add.rectangle(
            x * TILE + TILE / 2,
            y * TILE + TILE / 2,
            TILE,
            TILE,
            color,
          );
        }
      }
    }

    // ── Grille de collision depuis le JSON Tiled ───────────────────────────────
    const mapData = this.cache.json.get("map-data");
    this.buildCollisionGrid(mapData);

    // ── Modules (PNJ) ──────────────────────────────────────────────────────────
    this.modules.forEach((mod) => {
      this.add.circle(
        mod.x * TILE + TILE / 2,
        mod.y * TILE + TILE / 2,
        TILE * 0.75,
        0x7c3aed,
        0.15,
      );
      this.add
        .rectangle(
          mod.x * TILE + TILE / 2,
          mod.y * TILE + TILE / 2,
          TILE - 6,
          TILE - 6,
          0x7c3aed,
        )
        .setStrokeStyle(2, 0xa78bfa);
      this.add
        .text(
          mod.x * TILE + TILE / 2,
          mod.y * TILE + TILE / 2,
          String(mod.id),
          { fontSize: "10px", color: "#ffffff", fontStyle: "bold" },
        )
        .setOrigin(0.5);
    });

    // ── PNJ Mirokaï ─────────────────────────────────────────────────────────────
    this.npcs.forEach((npc) => {
      const sprite = this.add.image(
        npc.x * TILE + TILE / 2,
        npc.y * TILE + TILE / 2,
        NPC_IDLE_DIRS[0],
      );
      sprite.setDisplaySize(NPC_SIZE, NPC_SIZE);
      sprite.setDepth(9);
      this.npcSprites.set(npc.id, sprite);

      // Bulle "!" au-dessus du PNJ
      this.add
        .text(npc.x * TILE + TILE / 2, npc.y * TILE - TILE * 0.8, "!", {
          fontSize: "14px",
          color: "#FFCA44",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(11);
    });

    // Animation idle : cycle entre les 4 directions toutes les 800 ms
    this.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => {
        this.npcDirIndex = (this.npcDirIndex + 1) % NPC_IDLE_DIRS.length;
        const dir = NPC_IDLE_DIRS[this.npcDirIndex];
        this.npcSprites.forEach((sprite) => {
          sprite.setTexture(NPC_IDLE_DIRS[this.npcDirIndex]);
        });
      },
    });

    // ── Sprite joueur ──────────────────────────────────────────────────────────
    this.playerSprite = this.add.image(
      this.playerX * TILE + TILE / 2,
      this.playerY * TILE + TILE / 2,
      "miroki-south",
    );
    this.playerSprite.setDisplaySize(PLAYER_SIZE, PLAYER_SIZE);
    this.playerSprite.setDepth(10);

    // ── Caméra ─────────────────────────────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.startFollow(this.playerSprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.0);

    // ── Intro : le joueur se tourne vers le PNJ puis ouvre le dialog ───────────
    this.time.delayedCall(700, () => {
      // Tourne vers le PNJ (qui est en-dessous du joueur → south)
      this.currentDir = "south";
      this.playerSprite.setTexture("miroki-south");
      this.time.delayedCall(300, () => {
        this.onStartIntro?.();
      });
    });
  }

  // ── Construction de la grille de collision ─────────────────────────────────
  private buildCollisionGrid(mapData: any) {
    // Initialise tout à false
    this.collisionGrid = Array.from({ length: MAP_H }, () =>
      new Array(MAP_W).fill(false),
    );

    // Murs périmétriques
    for (let x = 0; x < MAP_W; x++) {
      for (let y = 0; y < MAP_H; y++) {
        if (x === 0 || x === MAP_W - 1 || y === 0 || y === MAP_H - 1) {
          this.collisionGrid[y][x] = true;
        }
      }
    }

    if (!mapData) return;

    // Calque "collisions" dans le JSON Tiled
    const collisionsLayer = mapData.layers?.find(
      (l: any) => l.name === "collisions",
    );
    if (!collisionsLayer) return;

    collisionsLayer.objects.forEach((obj: any) => {
      const tileX = Math.floor(obj.x / TILE);
      const tileY = Math.floor(obj.y / TILE);
      const tileW = Math.ceil(obj.width / TILE);
      const tileH = Math.ceil(obj.height / TILE);

      for (let y = tileY; y < tileY + tileH; y++) {
        for (let x = tileX; x < tileX + tileW; x++) {
          if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) {
            this.collisionGrid[y][x] = true;
          }
        }
      }
    });
  }

  // ── Déplacement ───────────────────────────────────────────────────────────
  setHeldDir(dx: number, dy: number) {
    this.heldDir = { dx, dy };
    if (!this.isMoving) this.tryMove(dx, dy);
  }

  clearHeldDir() {
    this.heldDir = null;
  }

  private dirKey(dx: number, dy: number): string {
    if (dy < 0) return "north";
    if (dy > 0) return "south";
    if (dx < 0) return "west";
    return "east";
  }

  private tryMove(dx: number, dy: number) {
    const nx = this.playerX + dx;
    const ny = this.playerY + dy;

    // Collision grille Tiled
    if (this.collisionGrid[ny]?.[nx]) return;

    // Collision modules
    if (this.modules.some((m) => m.x === nx && m.y === ny)) return;

    // Collision PNJ
    if (this.npcs.some((n) => n.x === nx && n.y === ny)) return;

    const dir = this.dirKey(dx, dy);
    if (dir !== this.currentDir) {
      this.currentDir = dir;
      this.playerSprite.setTexture(`miroki-${dir}`);
    }

    this.isMoving = true;
    this.playerX = nx;
    this.playerY = ny;

    this.tweens.add({
      targets: this.playerSprite,
      x: this.playerX * TILE + TILE / 2,
      y: this.playerY * TILE + TILE / 2,
      duration: MOVE_DURATION,
      ease: "Linear",
      onComplete: () => {
        this.isMoving = false;
        this.checkNearby();
        if (this.heldDir) {
          this.tryMove(this.heldDir.dx, this.heldDir.dy);
        }
      },
    });
  }

  private checkNearby() {
    const nearbyModule = this.modules.find(
      (m) =>
        Math.abs(m.x - this.playerX) <= 1 && Math.abs(m.y - this.playerY) <= 1,
    );
    this.onNearModule?.(nearbyModule ?? null);

    const nearbyNpc = this.npcs.find(
      (n) =>
        Math.abs(n.x - this.playerX) <= 1 && Math.abs(n.y - this.playerY) <= 1,
    );
    this.onNearNpc?.(nearbyNpc ?? null);
  }

  interact() {
    // Priorité au PNJ
    const nearbyNpc = this.npcs.find(
      (n) =>
        Math.abs(n.x - this.playerX) <= 1 && Math.abs(n.y - this.playerY) <= 1,
    );
    if (nearbyNpc) {
      this.onInteractNpc?.(nearbyNpc);
      return;
    }

    const nearby = this.modules.find(
      (m) =>
        Math.abs(m.x - this.playerX) <= 1 && Math.abs(m.y - this.playerY) <= 1,
    );
    if (nearby) {
      this.onInteract?.(nearby);
      this.onModuleInteracted?.(nearby.id);
    }
  }

  revealMiroka() {
    // Tremblement caméra
    this.cameras.main.shake(700, 0.009);

    // Faire apparaître Miroka après le shake
    this.time.delayedCall(900, () => {
      const px = MainScene.MIROKA_X * TILE + TILE / 2;
      const py = MainScene.MIROKA_Y * TILE + TILE / 2;

      this.mirokaSpr = this.add.image(px, py, "miroka-south");
      this.mirokaSpr.setDisplaySize(NPC_SIZE, NPC_SIZE);
      this.mirokaSpr.setDepth(9);
      this.mirokaSpr.setAlpha(0);

      // Fade-in
      this.tweens.add({
        targets: this.mirokaSpr,
        alpha: 1,
        duration: 600,
        ease: "Quad.easeIn",
      });

      // Ajouter Miroka aux NPCs interactables
      this.npcs.push({
        id: "miroka",
        x: MainScene.MIROKA_X,
        y: MainScene.MIROKA_Y,
        texture: "miroka-south",
        dialog: [],
      });
    });
  }

  // ── Dark Mode ──────────────────────────────────────────────────────────────

  enableDarkMode(config: { zombieCount: number; zombieDelay: number; chaseRate: number; bossHp: number }) {
    this.darkMode = true;
    this.cameras.main.flash(600, 180, 0, 0);
    this.cameras.main.setBackgroundColor("#0a0000");

    this.bossMaxHp = config.bossHp;

    this.time.delayedCall(700, () => {
      this.cameras.main.setBackgroundColor("#110000");
      this.spawnZombies(config.zombieCount, config.chaseRate);

      this.time.addEvent({
        delay: config.zombieDelay,
        loop: true,
        callback: this.wanderZombies,
        callbackScope: this,
      });
    });
  }

  private zombieTexture(dx: number, dy: number): string {
    if (dx === 1  && dy === 1)  return "zombie-south-east";
    if (dx === -1 && dy === 1)  return "zombie-south-west";
    if (dx === 1  && dy === -1) return "zombie-north-east";
    if (dx === -1 && dy === -1) return "zombie-north-west";
    if (dy === 1)  return "zombie-south";
    if (dy === -1) return "zombie-north";
    if (dx === 1)  return "zombie-east";
    return "zombie-west";
  }

  private isTileWalkable(x: number, y: number): boolean {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
    if (this.collisionGrid[y]?.[x]) return false;
    if (this.modules.some((m) => m.x === x && m.y === y)) return false;
    if (this.npcs.some((n) => n.x === x && n.y === y)) return false;
    if (this.zombies.some((z) => z.tileX === x && z.tileY === y)) return false;
    return true;
  }

  private chaseRate = 0.8;

  private spawnZombies(count: number, chaseRate = 0.8) {
    this.chaseRate = chaseRate;
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < 500) {
      attempts++;
      const x = Math.floor(Math.random() * (MAP_W - 2)) + 1;
      const y = Math.floor(Math.random() * (MAP_H - 2)) + 1;
      // Ne pas spawner trop près du joueur
      if (Math.abs(x - this.playerX) < 6 && Math.abs(y - this.playerY) < 6) continue;
      if (!this.isTileWalkable(x, y)) continue;

      const spr = this.add.image(
        x * TILE + TILE / 2,
        y * TILE + TILE / 2,
        "zombie-south",
      );
      spr.setDisplaySize(NPC_SIZE, NPC_SIZE);
      spr.setDepth(9);

      this.zombies.push({ tileX: x, tileY: y, sprite: spr, isMoving: false });
      placed++;
    }
  }

  private wanderZombies() {
    const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    this.zombies.forEach((zombie) => {
      if (zombie.isMoving) return;

      const toPlayer = [
        { dx: Math.sign(this.playerX - zombie.tileX), dy: 0 },
        { dx: 0, dy: Math.sign(this.playerY - zombie.tileY) },
      ].filter((d) => d.dx !== 0 || d.dy !== 0);
      // 80% du temps : fonce vers le joueur
      const candidates = Math.random() < this.chaseRate
        ? [...toPlayer, ...dirs]
        : [...dirs];

      for (const { dx, dy } of candidates) {
        const nx = zombie.tileX + dx;
        const ny = zombie.tileY + dy;

        // Contact joueur → dégâts
        if (nx === this.playerX && ny === this.playerY) {
          const now = Date.now();
          if (now - this.lastHitTime >= this.I_FRAMES_MS) {
            this.lastHitTime = now;
            // Flash rouge sur le joueur
            this.tweens.add({
              targets: this.playerSprite,
              alpha: 0.2,
              duration: 80,
              yoyo: true,
              repeat: 3,
            });
            this.cameras.main.shake(200, 0.007);
            this.cameras.main.flash(100, 200, 0, 0);
            this.onPlayerHit?.();
          }
          break;
        }

        if (!this.isTileWalkable(nx, ny)) continue;
        zombie.isMoving = true;
        zombie.tileX = nx;
        zombie.tileY = ny;
        zombie.sprite.setTexture(this.zombieTexture(dx, dy));
        this.tweens.add({
          targets: zombie.sprite,
          x: nx * TILE + TILE / 2,
          y: ny * TILE + TILE / 2,
          duration: 280,
          ease: "Linear",
          onComplete: () => { zombie.isMoving = false; },
        });
        break;
      }
    });
  }

  shoot() {
    if (!this.darkMode) return;
    const dirVec: Record<string, { dx: number; dy: number }> = {
      north: { dx: 0, dy: -1 },
      south: { dx: 0, dy: 1 },
      east: { dx: 1, dy: 0 },
      west: { dx: -1, dy: 0 },
    };
    const { dx, dy } = dirVec[this.currentDir];
    const fb = this.add.circle(
      this.playerX * TILE + TILE / 2,
      this.playerY * TILE + TILE / 2,
      7, 0xff6600,
    );
    fb.setDepth(13);
    this.moveFireball(fb, this.playerX, this.playerY, dx, dy);
  }

  private moveFireball(
    fb: Phaser.GameObjects.Arc,
    fromX: number, fromY: number,
    dx: number, dy: number,
  ) {
    const nx = fromX + dx;
    const ny = fromY + dy;

    if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H || this.collisionGrid[ny]?.[nx]) {
      this.tweens.add({ targets: fb, alpha: 0, scaleX: 2, scaleY: 2, duration: 120,
        onComplete: () => fb.destroy() });
      return;
    }

    this.tweens.add({
      targets: fb,
      x: nx * TILE + TILE / 2,
      y: ny * TILE + TILE / 2,
      duration: 60,
      ease: "Linear",
      onComplete: () => {
        // Hit boss ?
        if (this.boss && this.boss.tileX === nx && this.boss.tileY === ny) {
          fb.destroy();
          this.hitBoss();
          return;
        }
        // Hit zombie ?
        const zIdx = this.zombies.findIndex((z) => z.tileX === nx && z.tileY === ny);
        if (zIdx >= 0) {
          const z = this.zombies[zIdx];
          this.tweens.add({ targets: z.sprite, alpha: 0, scaleX: 2, scaleY: 2,
            duration: 250, onComplete: () => z.sprite.destroy() });
          this.zombies.splice(zIdx, 1);
          fb.destroy();
          this.onZombieKilled?.(this.zombies.length);
          if (this.zombies.length === 0) this.spawnBoss();
          return;
        }
        this.moveFireball(fb, nx, ny, dx, dy);
      },
    });
  }

  private spawnBoss() {
    let bx = 0, by = 0;
    for (let attempts = 0; attempts < 300; attempts++) {
      bx = Math.floor(Math.random() * (MAP_W - 4)) + 2;
      by = Math.floor(Math.random() * (MAP_H - 4)) + 2;
      if (Math.abs(bx - this.playerX) < 10 && Math.abs(by - this.playerY) < 10) continue;
      if (!this.isTileWalkable(bx, by)) continue;
      break;
    }

    const BOSS_SIZE = NPC_SIZE * 2.2;
    const spr = this.add.image(bx * TILE + TILE / 2, by * TILE + TILE / 2, "zombie-south");
    spr.setDisplaySize(BOSS_SIZE, BOSS_SIZE);
    spr.setDepth(10);
    spr.setAlpha(0);

    this.boss = { tileX: bx, tileY: by, sprite: spr, hp: this.bossMaxHp, maxHp: this.bossMaxHp, isMoving: false };

    this.cameras.main.shake(800, 0.012);
    this.cameras.main.flash(400, 255, 0, 0);
    this.tweens.add({ targets: spr, alpha: 1, duration: 600, ease: "Quad.easeIn" });
    this.onBossAppear?.(this.bossMaxHp);

    this.time.addEvent({ delay: 1600, loop: true, callback: this.moveBoss, callbackScope: this });
  }

  private moveBoss() {
    if (!this.boss || this.boss.isMoving) return;
    const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    const toPlayer = [
      { dx: Math.sign(this.playerX - this.boss.tileX), dy: 0 },
      { dx: 0, dy: Math.sign(this.playerY - this.boss.tileY) },
    ].filter((d) => d.dx !== 0 || d.dy !== 0);
    const candidates = Math.random() < 0.9 ? [...toPlayer, ...dirs] : [...dirs];

    for (const { dx, dy } of candidates) {
      const nx = this.boss.tileX + dx;
      const ny = this.boss.tileY + dy;
      if (nx === this.playerX && ny === this.playerY) {
        const now = Date.now();
        if (now - this.lastHitTime >= this.I_FRAMES_MS) {
          this.lastHitTime = now;
          this.tweens.add({ targets: this.playerSprite, alpha: 0.2, duration: 80, yoyo: true, repeat: 4 });
          this.cameras.main.shake(250, 0.01);
          this.cameras.main.flash(120, 200, 0, 0);
          this.onPlayerHit?.();
        }
        break;
      }
      if (!this.isTileWalkable(nx, ny)) continue;
      this.boss.isMoving = true;
      this.boss.tileX = nx;
      this.boss.tileY = ny;
      this.boss.sprite.setTexture(this.zombieTexture(dx, dy));
      this.tweens.add({
        targets: this.boss.sprite,
        x: nx * TILE + TILE / 2,
        y: ny * TILE + TILE / 2,
        duration: 400,
        ease: "Linear",
        onComplete: () => { if (this.boss) this.boss.isMoving = false; },
      });
      break;
    }
  }

  private hitBoss() {
    if (!this.boss) return;
    this.boss.hp -= 1;
    this.tweens.add({
      targets: this.boss.sprite,
      alpha: 0.3, duration: 60, yoyo: true, repeat: 1,
      onComplete: () => { if (this.boss) this.boss.sprite.setAlpha(1); },
    });
    this.cameras.main.shake(120, 0.005);
    this.onBossHit?.(this.boss.hp, this.boss.maxHp);

    if (this.boss.hp <= 0) {
      const deadSpr = this.boss.sprite;
      this.boss = null;
      this.tweens.add({
        targets: deadSpr, alpha: 0, scaleX: 3, scaleY: 3, duration: 600, ease: "Quad.easeOut",
        onComplete: () => deadSpr.destroy(),
      });
      this.cameras.main.shake(600, 0.015);
      this.cameras.main.flash(500, 255, 100, 0);
      this.onBossKilled?.();
    }
  }
}
