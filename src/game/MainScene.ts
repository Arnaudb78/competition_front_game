import Phaser from "phaser";

const TILE = 32;
const MAP_W = 20;
const MAP_H = 20;
const MOVE_DURATION = 150; // ms par tile

const MODULES = [
  { id: 1, name: "La naissance d'Enchanted Tools", x: 3, y: 3 },
  { id: 2, name: "L'histoire des Mirokaï", x: 8, y: 3 },
  { id: 3, name: "Le design", x: 14, y: 3 },
  { id: 4, name: "La table électronique", x: 3, y: 8 },
  { id: 5, name: "La combinaison des Mirokaï", x: 3, y: 12 },
  { id: 6, name: "Le pendule inversé", x: 8, y: 8 },
  { id: 7, name: "La vision du robot", x: 3, y: 16 },
  { id: 8, name: "L'IA du robot", x: 6, y: 16 },
  { id: 9, name: "Les cas d'usage", x: 3, y: 19 },
  { id: 10, name: "La salle de cyclage", x: 10, y: 19 },
  { id: 11, name: "La fresque récapitulative", x: 16, y: 19 },
];

export class MainScene extends Phaser.Scene {
  private playerSprite!: Phaser.GameObjects.Image;
  private currentDir = "south";

  private playerX = 10;
  private playerY = 10;
  private isMoving = false;
  private heldDir: { dx: number; dy: number } | null = null;

  onInteract?: (module: { id: number; name: string }) => void;
  onNearModule?: (module: { id: number; name: string } | null) => void;

  constructor() {
    super({ key: "MainScene" });
  }

  preload() {
    this.load.image("mirokai-south", "/assets/mirokai-south.png");
    this.load.image("mirokai-north", "/assets/mirokai-north.png");
    this.load.image("mirokai-east", "/assets/mirokai-east.png");
    this.load.image("mirokai-west", "/assets/mirokai-west.png");
  }

  create() {
    // Sol — damier léger
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

    // Murs périmétriques
    for (let x = 0; x < MAP_W; x++) {
      for (let y = 0; y < MAP_H; y++) {
        if (x === 0 || x === MAP_W - 1 || y === 0 || y === MAP_H - 1) {
          this.add
            .rectangle(
              x * TILE + TILE / 2,
              y * TILE + TILE / 2,
              TILE,
              TILE,
              0x0f3460,
            )
            .setStrokeStyle(1, 0x533483);
        }
      }
    }

    // Modules (PNJ)
    MODULES.forEach((mod) => {
      // Halo
      this.add.circle(
        mod.x * TILE + TILE / 2,
        mod.y * TILE + TILE / 2,
        TILE * 0.75,
        0x7c3aed,
        0.15,
      );
      // Corps
      this.add
        .rectangle(
          mod.x * TILE + TILE / 2,
          mod.y * TILE + TILE / 2,
          TILE - 6,
          TILE - 6,
          0x7c3aed,
        )
        .setStrokeStyle(2, 0xa78bfa);
      // Numéro
      this.add
        .text(
          mod.x * TILE + TILE / 2,
          mod.y * TILE + TILE / 2,
          String(mod.id),
          { fontSize: "10px", color: "#ffffff", fontStyle: "bold" },
        )
        .setOrigin(0.5);
    });

    // Sprite joueur
    this.playerSprite = this.add.image(
      this.playerX * TILE + TILE / 2,
      this.playerY * TILE + TILE / 2,
      "mirokai-south",
    );
    this.playerSprite.setDisplaySize(TILE, TILE);

    // Caméra
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.startFollow(this.playerSprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(2.5);
  }

  // Appelé depuis React quand un bouton est pressé
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

    if (nx <= 0 || nx >= MAP_W - 1 || ny <= 0 || ny >= MAP_H - 1) return;
    const blocked = MODULES.some((m) => m.x === nx && m.y === ny);
    if (blocked) return;

    // Changer le sprite selon la direction
    const dir = this.dirKey(dx, dy);
    if (dir !== this.currentDir) {
      this.currentDir = dir;
      this.playerSprite.setTexture(`mirokai-${dir}`);
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
    const nearby = MODULES.find(
      (m) =>
        Math.abs(m.x - this.playerX) <= 1 && Math.abs(m.y - this.playerY) <= 1,
    );
    this.onNearModule?.(nearby ?? null);
  }

  interact() {
    const nearby = MODULES.find(
      (m) =>
        Math.abs(m.x - this.playerX) <= 1 && Math.abs(m.y - this.playerY) <= 1,
    );
    if (nearby) this.onInteract?.(nearby);
  }
}
