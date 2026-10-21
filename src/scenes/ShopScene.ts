import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HUD, POTIONS, SHOP } from '../config/tuning';
import { Sfx } from '../audio/Sfx';
import { KeyInput } from '../input/keyboard';
import { gemLabel } from '../logic/hud';
import { moveCursor } from '../logic/inventory';
import { SHOP_ITEMS, SHOP_NAMES, buy, type Purse, type Refusal } from '../logic/shop';

/** What the shop screen reads from, and writes back to, the game. */
export interface ShopHost {
  purse(): Purse;
  setPurse(purse: Purse): void;
}

const LEAVE_KEYS: ReadonlySet<string> = new Set(['KeyI', 'Tab', 'Escape']);
const BUY_KEYS: ReadonlySet<string> = new Set(['Space', 'KeyJ', 'Enter']);
const KEYS = new Set([...LEAVE_KEYS, ...BUY_KEYS, 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS']);

const TEXT = { fontFamily: HUD.font, fontSize: '8px', color: '#e8f4f0' } as const;
const DIM = '#7f8ca8';
const ACCENT = '#ffd166';
const ROW = { y: 44, h: 20 } as const;

const SAYS: Readonly<Record<Refusal | 'thanks' | 'hello', string>> = {
  hello: 'WELCOME! WHAT WILL IT BE?',
  thanks: 'THANK YOU!',
  gems: 'NOT ENOUGH GEMS.',
  full: 'YOUR BAG IS FULL.',
  owned: 'YOU HAVE ONE ALREADY.',
};

/**
 * The shop (talk to the shopkeeper): a pause screen over the game. Up and
 * down choose; Space buys; I, Tab or Esc leaves.
 */
export class ShopScene extends Phaser.Scene {
  private host!: ShopHost;
  private keys!: KeyInput;
  private sfx!: Sfx;
  private cursor = 0;
  private message: keyof typeof SAYS = 'hello';
  private dynamic: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Shop');
  }

  init(data: { host: ShopHost }): void {
    this.host = data.host;
    this.cursor = 0;
    this.message = 'hello';
  }

  create(): void {
    this.keys = new KeyInput(KEYS);
    this.sfx = new Sfx(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keys.destroy());
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b1020, 0.94).setOrigin(0);
    this.add
      .rectangle(4, 4, GAME_WIDTH - 8, GAME_HEIGHT - 8)
      .setOrigin(0)
      .setStrokeStyle(1, 0xffd166);
    this.add.text(12, 12, 'SHOP', { ...TEXT, color: ACCENT });
    this.add.text(12, GAME_HEIGHT - 16, 'UP/DOWN CHOOSE  SPACE BUY  I LEAVE', {
      ...TEXT,
      color: DIM,
    });
    this.draw();
  }

  override update(): void {
    for (const code of this.keys.takePresses()) {
      if (LEAVE_KEYS.has(code)) {
        this.sfx.play('menu');
        this.scene.resume('Game');
        this.scene.stop();
        return;
      }
      if (code === 'ArrowUp' || code === 'KeyW') this.move(-1);
      if (code === 'ArrowDown' || code === 'KeyS') this.move(1);
      if (BUY_KEYS.has(code)) this.buy();
      this.draw();
    }
  }

  private move(by: -1 | 1): void {
    this.cursor = moveCursor(this.cursor, by, SHOP_ITEMS.length);
    this.sfx.play('menu');
  }

  private buy(): void {
    const item = SHOP_ITEMS[this.cursor];
    if (!item) return;
    const r = buy(this.host.purse(), item, SHOP.prices, POTIONS.max);
    if (r.ok) {
      this.host.setPurse(r.purse);
      this.message = 'thanks';
      this.sfx.play('chest');
    } else {
      this.message = r.reason;
      this.sfx.play('noMana');
    }
  }

  /** For the e2e test hook. */
  shows(): {
    cursor: number;
    items: { name: string; price: number; owned: boolean }[];
    gems: number;
    message: string;
  } {
    const purse = this.host.purse();
    return {
      cursor: this.cursor,
      items: SHOP_ITEMS.map((item) => ({
        name: SHOP_NAMES[item],
        price: SHOP.prices[item],
        owned: item === 'iron-shield' && purse.inventory.owned.includes(item),
      })),
      gems: purse.gems,
      message: SAYS[this.message],
    };
  }

  private draw(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    const purse = this.host.purse();
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.dynamic.push(o);
      return o;
    };
    add(this.add.text(12, 26, SAYS[this.message], TEXT));
    SHOP_ITEMS.forEach((item, i) => {
      const y = ROW.y + i * ROW.h;
      const chosen = i === this.cursor;
      if (chosen) {
        add(this.add.rectangle(10, y - 5, GAME_WIDTH - 20, ROW.h - 4, 0x2a2416).setOrigin(0));
        add(this.add.text(14, y, '>', { ...TEXT, color: ACCENT }));
      }
      add(this.add.text(26, y, SHOP_NAMES[item].toUpperCase(), TEXT));
      const owned = item === 'iron-shield' && purse.inventory.owned.includes(item);
      const held =
        item === 'health-potion'
          ? ` (${purse.potions.health}/${POTIONS.max})`
          : item === 'mana-brew'
            ? ` (${purse.potions.mana}/${POTIONS.max})`
            : '';
      add(
        this.add.text(160, y, owned ? 'OWNED' : `${SHOP.prices[item]} GEMS${held}`, {
          ...TEXT,
          color: owned ? DIM : ACCENT,
        }),
      );
    });
    add(this.add.sprite(20, ROW.y + 3 * ROW.h + 12, 'gems', 2 * 53 + 4));
    add(this.add.text(30, ROW.y + 3 * ROW.h + 8, gemLabel(purse.gems, HUD.maxGems), TEXT));
  }
}
