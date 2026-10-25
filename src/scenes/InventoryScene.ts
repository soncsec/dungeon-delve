import Phaser from 'phaser';
import { OBJECT_FRAMES } from '../assets/manifest';
import { GAME_HEIGHT, GAME_WIDTH, HUD } from '../config/tuning';
import { Sfx } from '../audio/Sfx';
import { ITEM_ICON } from '../assets/itemIcons';
import { KeyInput } from '../input/keyboard';
import { gemLabel } from '../logic/hud';
import {
  ITEMS,
  SLOTS,
  SLOT_NAMES,
  cycle,
  moveCursor,
  ownedIn,
  type Inventory,
} from '../logic/inventory';
import type { DungeonMap } from '../logic/dungeonMap';
import type { Region } from '../logic/tiles';
import type { EntranceMark, WorldMap } from '../logic/worldMap';
import type { Potions } from '../logic/potions';

/** What the inventory screen reads from, and writes back to, the game. */
export interface InventoryHost {
  inventory(): Inventory;
  setInventory(inv: Inventory): void;
  heldPotions(): Potions;
  heldGems(): number;
  /** Shards of the Star of Power found (0–8), and small keys held. */
  heldShards(): number;
  heldKeys(): number;
  /** The map of the dungeon he's in (rooms he has been in), or null outdoors. */
  dungeonMap(): { name: string; map: DungeonMap } | null;
  /** On the overworld, the world map (screens he has been in), or null elsewhere. */
  worldMap(): WorldMap | null;
}

const OPEN_KEYS: ReadonlySet<string> = new Set(['KeyI', 'Tab', 'Escape']);
const CHANGE_KEYS: ReadonlySet<string> = new Set(['Space', 'KeyJ', 'Enter']);
const PAGE_KEYS = { left: new Set(['ArrowLeft', 'KeyA']), right: new Set(['ArrowRight', 'KeyD']) };
const KEYS = new Set([
  ...OPEN_KEYS,
  ...CHANGE_KEYS,
  ...PAGE_KEYS.left,
  ...PAGE_KEYS.right,
  'ArrowUp',
  'ArrowDown',
  'KeyW',
  'KeyS',
]);

const TEXT = { fontFamily: HUD.font, fontSize: '8px', color: '#e8f4f0' } as const;
const DIM = '#7f8ca8';
const ACCENT = '#4fd3d6';
const ROW = { y: 30, h: 22 } as const;
/** The dungeon map, under the slots: one small box per room. */
const MAP = { labelX: 26, x: 116, y: 120, w: 10, h: 6, gap: 2 } as const;
/** The world map, a page of its own (owner 2026-10-23): one box per overworld screen, 16 x 12 in 240 x 120. */
const WORLD = { y: 28, w: 14, h: 9, gap: 1, legendY: 152, unseen: 0x18233a } as const;
/** Each region's colour on the world map (owner 2026-10-23: tinted, no words). */
const REGION_COLOUR: Readonly<Record<Region, number>> = {
  village: 0x9cb85a,
  forest: 0x2f7a3e,
  marsh: 0x5f7046,
  ruins: 0x8a7a64,
  mountains: 0x7a7f8e,
  volcano: 0x9a3c2c,
  vault: 0x6a4a9a,
};
/** Where Jarrett is, and the dot on a dungeon's entrance: still to do, its shard found, the vault. */
const HERE = 0xffd166;
const ENTRANCE_DOT: Readonly<Record<EntranceMark, number>> = {
  dungeon: 0xd04040,
  done: 0xffffff,
  vault: 0xd8b0ff,
};
/** A secret cave he has found, on the world map; a secret room he has found, on the dungeon map (M10.3b). */
const CAVE_MARK = 0x4fd3d6;
const SECRET_ROOM = 0x8a5ad0;
/** The bag's pages: its items, and (on the overworld) the world map. */
type Page = 'items' | 'map';

/**
 * The inventory (I or Tab): a pause screen over the game. Up and down choose
 * a slot; the attack key switches its item when Jarrett owns more than one;
 * on the overworld, left and right turn to the world map and back; I, Tab or
 * Esc closes it.
 */
export class InventoryScene extends Phaser.Scene {
  private host!: InventoryHost;
  private keys!: KeyInput;
  private cursor = 0;
  private page: Page = 'items';
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private sfx!: Sfx;

  constructor() {
    super('Inventory');
  }

  init(data: { host: InventoryHost }): void {
    this.host = data.host;
    this.cursor = 0;
    this.page = 'items';
  }

  create(): void {
    this.keys = new KeyInput(KEYS);
    this.sfx = new Sfx(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keys.destroy());
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b1020, 0.94).setOrigin(0);
    this.add
      .rectangle(4, 4, GAME_WIDTH - 8, GAME_HEIGHT - 8)
      .setOrigin(0)
      .setStrokeStyle(1, 0x4fd3d6);
    this.draw();
  }

  override update(): void {
    for (const code of this.keys.takePresses()) {
      if (OPEN_KEYS.has(code)) {
        this.sfx.play('menu');
        this.close();
        return;
      }
      this.sfx.play('menu');
      if (PAGE_KEYS.right.has(code) && this.host.worldMap()) this.page = 'map';
      if (PAGE_KEYS.left.has(code)) this.page = 'items';
      if (this.page === 'map') {
        this.draw();
        continue;
      }
      if (code === 'ArrowUp' || code === 'KeyW') this.cursor = moveCursor(this.cursor, -1);
      if (code === 'ArrowDown' || code === 'KeyS') this.cursor = moveCursor(this.cursor, 1);
      if (CHANGE_KEYS.has(code)) {
        const slot = SLOTS[this.cursor];
        if (slot) this.host.setInventory(cycle(this.host.inventory(), slot));
      }
      this.draw();
    }
  }

  /** For the e2e test hook. */
  shows(): {
    cursor: number;
    slots: Record<string, string>;
    map: { name: string; rooms: DungeonMap['rooms'] } | null;
    world: WorldMap | null;
    page: Page;
  } {
    const inv = this.host.inventory();
    const slots: Record<string, string> = {};
    for (const slot of SLOTS) {
      const item = inv.equipped[slot];
      slots[slot] = item ? ITEMS[item].name : '';
    }
    const m = this.host.dungeonMap();
    return {
      cursor: this.cursor,
      slots,
      map: m ? { name: m.name, rooms: m.map.rooms } : null,
      world: this.host.worldMap(),
      page: this.page,
    };
  }

  private close(): void {
    this.scene.resume('Game');
    this.scene.stop();
  }

  /** The dungeon's name, and a box for each room he has been in: gold where he is, a red dot for the boss. */
  private drawMap(): void {
    const m = this.host.dungeonMap();
    if (!m) return;
    this.dynamic.push(
      this.add.text(MAP.labelX, MAP.y, m.name.toUpperCase(), { ...TEXT, color: DIM }),
    );
    for (const room of m.map.rooms) {
      const x = MAP.x + room.x * (MAP.w + MAP.gap);
      const y = MAP.y + room.y * (MAP.h + MAP.gap);
      this.dynamic.push(
        this.add
          .rectangle(x, y, MAP.w, MAP.h, room.current ? HERE : room.secret ? SECRET_ROOM : 0x3a5a8a)
          .setOrigin(0),
      );
      if (room.boss) {
        this.dynamic.push(
          this.add.rectangle(x + MAP.w / 2 - 1, y + MAP.h / 2 - 1, 2, 2, 0xd04040).setOrigin(0),
        );
      }
    }
  }

  /**
   * The map page: the whole overworld as a grid, dark where he hasn't been; each screen he
   * has been in in its region's colour, gold where he is, and a dot on each dungeon
   * entrance (red to do, white done, violet the vault), and a mark on each secret cave
   * he has found; a key to the marks beneath.
   */
  private drawWorld(m: WorldMap): void {
    const left = Math.round((GAME_WIDTH - m.cols * (WORLD.w + WORLD.gap) + WORLD.gap) / 2);
    const at = (x: number, y: number) => ({
      x: left + x * (WORLD.w + WORLD.gap),
      y: WORLD.y + y * (WORLD.h + WORLD.gap),
    });
    for (let y = 0; y < m.rows; y++) {
      for (let x = 0; x < m.cols; x++) {
        const p = at(x, y);
        this.dynamic.push(
          this.add.rectangle(p.x, p.y, WORLD.w, WORLD.h, WORLD.unseen).setOrigin(0),
        );
      }
    }
    for (const cell of m.cells) {
      const p = at(cell.x, cell.y);
      const colour = cell.current ? HERE : REGION_COLOUR[cell.region];
      this.dynamic.push(this.add.rectangle(p.x, p.y, WORLD.w, WORLD.h, colour).setOrigin(0));
      if (cell.entrance) {
        const dot = ENTRANCE_DOT[cell.entrance];
        this.dynamic.push(
          this.add.rectangle(p.x + WORLD.w / 2 - 2, p.y + 3, 4, 3, dot).setOrigin(0),
        );
      }
      if (cell.cave) {
        this.dynamic.push(
          this.add.rectangle(p.x + WORLD.w - 4, p.y + WORLD.h - 3, 3, 2, CAVE_MARK).setOrigin(0),
        );
      }
    }
    const key: [number, string][] = [
      [HERE, 'YOU'],
      [ENTRANCE_DOT.dungeon, 'DUNGEON'],
      [ENTRANCE_DOT.done, 'DONE'],
      [ENTRANCE_DOT.vault, 'VAULT'],
      [CAVE_MARK, 'CAVE'],
    ];
    let x = left;
    for (const [colour, label] of key) {
      this.dynamic.push(this.add.rectangle(x, WORLD.legendY + 2, 4, 4, colour).setOrigin(0));
      this.dynamic.push(this.add.text(x + 7, WORLD.legendY, label, { ...TEXT, color: DIM }));
      x += 7 + label.length * 8 + 10;
    }
  }

  /** The heading (with the pages, on the overworld) and the key help at the bottom. */
  private drawFrame(hasMap: boolean): void {
    if (hasMap) {
      const items = this.page === 'items';
      this.dynamic.push(this.add.text(12, 12, 'ITEMS', { ...TEXT, color: items ? ACCENT : DIM }));
      this.dynamic.push(this.add.text(64, 12, 'MAP', { ...TEXT, color: items ? DIM : ACCENT }));
    } else {
      this.dynamic.push(this.add.text(12, 12, 'INVENTORY', { ...TEXT, color: ACCENT }));
    }
    const help = !hasMap
      ? 'UP/DOWN CHOOSE  SPACE CHANGE  I CLOSE'
      : this.page === 'items'
        ? 'SPACE CHANGE  RIGHT: MAP  I CLOSE'
        : 'LEFT: ITEMS  I CLOSE';
    this.dynamic.push(this.add.text(12, GAME_HEIGHT - 16, help, { ...TEXT, color: DIM }));
  }

  /** Redraws everything that changes: the cursor, the equipped items and the counts. */
  private draw(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    const world = this.host.worldMap();
    this.drawFrame(world !== null);
    if (world && this.page === 'map') {
      this.drawWorld(world);
      return;
    }
    const inv = this.host.inventory();
    SLOTS.forEach((slot, i) => {
      const y = ROW.y + i * ROW.h;
      const chosen = i === this.cursor;
      const item = inv.equipped[slot];
      const owned = ownedIn(inv, slot).length;
      if (chosen) {
        this.dynamic.push(this.add.rectangle(10, y - 5, 232, ROW.h - 4, 0x1a2a40).setOrigin(0));
        this.dynamic.push(this.add.text(14, y, '>', { ...TEXT, color: ACCENT }));
      }
      this.dynamic.push(
        this.add.text(26, y, SLOT_NAMES[slot].toUpperCase(), { ...TEXT, color: DIM }),
      );
      const icon = item ? ITEM_ICON[item] : undefined;
      if (icon) {
        const image = this.add.image(96, y + 3, icon.texture, icon.frame);
        this.dynamic.push(icon.tint === undefined ? image : image.setTint(icon.tint));
      }
      const name = item ? ITEMS[item].name.toUpperCase() : '-';
      this.dynamic.push(this.add.text(116, y, name, TEXT));
      // Arrows show there is more than one to choose from.
      if (owned > 1) {
        this.dynamic.push(
          this.add.text(116 + name.length * 8 + 4, y, '<>', { ...TEXT, color: ACCENT }),
        );
      }
    });

    this.drawMap();

    // Right-hand column: potions, gems, keys, and the Star of Power.
    const x = 250;
    const potions = this.host.heldPotions();
    this.dynamic.push(this.add.image(x, 28, 'objects', OBJECT_FRAMES.potion).setOrigin(0, 0.5));
    this.dynamic.push(this.add.text(x + 16, 24, String(potions.health), TEXT));
    this.dynamic.push(this.add.image(x + 36, 28, 'mana-brew').setOrigin(0, 0.5));
    this.dynamic.push(this.add.text(x + 52, 24, String(potions.mana), TEXT));
    this.dynamic.push(this.add.sprite(x + 7, 50, 'gems', 2 * 53 + 4));
    this.dynamic.push(this.add.text(x + 16, 46, gemLabel(this.host.heldGems(), HUD.maxGems), TEXT));
    this.dynamic.push(this.add.text(x, 68, `KEYS ${this.host.heldKeys()}`, TEXT));
    this.dynamic.push(this.add.text(x, 90, 'STAR', { ...TEXT, color: DIM }));
    const shards = this.host.heldShards();
    for (let i = 0; i < 8; i++) {
      const bx = x + (i % 4) * 16;
      const by = 104 + Math.floor(i / 4) * 16;
      this.dynamic.push(
        this.add
          .rectangle(bx, by, 12, 12, i < shards ? 0xffd166 : 0x1a2230)
          .setOrigin(0)
          .setStrokeStyle(1, 0x7f8ca8),
      );
    }
  }
}
