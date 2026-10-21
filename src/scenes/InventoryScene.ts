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
}

const OPEN_KEYS: ReadonlySet<string> = new Set(['KeyI', 'Tab', 'Escape']);
const CHANGE_KEYS: ReadonlySet<string> = new Set(['Space', 'KeyJ', 'Enter']);
const KEYS = new Set([...OPEN_KEYS, ...CHANGE_KEYS, 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS']);

const TEXT = { fontFamily: HUD.font, fontSize: '8px', color: '#e8f4f0' } as const;
const DIM = '#7f8ca8';
const ACCENT = '#4fd3d6';
const ROW = { y: 30, h: 22 } as const;
/** The dungeon map, under the slots: one small box per room. */
const MAP = { labelX: 26, x: 116, y: 120, w: 10, h: 6, gap: 2 } as const;

/**
 * The inventory (I or Tab): a pause screen over the game. Up and down choose
 * a slot; the attack key switches its item when Jarrett owns more than one;
 * I, Tab or Esc closes it.
 */
export class InventoryScene extends Phaser.Scene {
  private host!: InventoryHost;
  private keys!: KeyInput;
  private cursor = 0;
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private sfx!: Sfx;

  constructor() {
    super('Inventory');
  }

  init(data: { host: InventoryHost }): void {
    this.host = data.host;
    this.cursor = 0;
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
    this.add.text(12, 12, 'INVENTORY', { ...TEXT, color: ACCENT });
    this.add.text(12, GAME_HEIGHT - 16, 'UP/DOWN CHOOSE  SPACE CHANGE  I CLOSE', {
      ...TEXT,
      color: DIM,
    });
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
  } {
    const inv = this.host.inventory();
    const slots: Record<string, string> = {};
    for (const slot of SLOTS) {
      const item = inv.equipped[slot];
      slots[slot] = item ? ITEMS[item].name : '';
    }
    const m = this.host.dungeonMap();
    return { cursor: this.cursor, slots, map: m ? { name: m.name, rooms: m.map.rooms } : null };
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
        this.add.rectangle(x, y, MAP.w, MAP.h, room.current ? 0xffd166 : 0x3a5a8a).setOrigin(0),
      );
      if (room.boss) {
        this.dynamic.push(
          this.add.rectangle(x + MAP.w / 2 - 1, y + MAP.h / 2 - 1, 2, 2, 0xd04040).setOrigin(0),
        );
      }
    }
  }

  /** Redraws everything that changes: the cursor, the equipped items and the counts. */
  private draw(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
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
      if (icon) this.dynamic.push(this.add.image(96, y + 3, icon.texture, icon.frame));
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
