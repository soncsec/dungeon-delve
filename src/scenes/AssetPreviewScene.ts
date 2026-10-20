import Phaser from 'phaser';
import { ASSETS, ASSET_GROUPS, animKey, type SheetAsset } from '../assets/manifest';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';

const HEADER = 12;
const LABEL = 9;

interface Cell {
  asset: SheetAsset;
  /** An animation name, or null to show the whole sheet. */
  anim: string | null;
}

/**
 * Developer tool (open the game with ?scene=preview): shows every animation in
 * one group playing, and sheets without animations whole, so frame slicing can
 * be checked by eye. Left and right arrows change the group.
 */
export class AssetPreviewScene extends Phaser.Scene {
  private page = 0;
  private items: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('AssetPreview');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1b2236');
    this.input.keyboard?.on('keydown-RIGHT', () => this.show(this.page + 1));
    this.input.keyboard?.on('keydown-LEFT', () => this.show(this.page - 1));
    this.show(0);
  }

  /** The group on screen, for the e2e test hook. */
  currentGroup(): string {
    return ASSET_GROUPS[this.page] ?? '';
  }

  private show(page: number): void {
    this.page = (page + ASSET_GROUPS.length) % ASSET_GROUPS.length;
    const group = this.currentGroup();
    for (const item of this.items) item.destroy();
    this.items = [];
    this.items.push(
      this.label(
        4,
        2,
        `${group.toUpperCase()} ${this.page + 1}/${ASSET_GROUPS.length} <- ->`,
        '#4fd3d6',
      ),
    );

    const cells: Cell[] = ASSETS.filter((a) => a.group === group).flatMap((asset): Cell[] =>
      asset.anims.length > 0
        ? asset.anims.map((an) => ({ asset, anim: an.name }))
        : [{ asset, anim: null }],
    );
    const cols = Math.max(
      1,
      Math.ceil(Math.sqrt(cells.length * (GAME_WIDTH / (GAME_HEIGHT - HEADER)))),
    );
    const rows = Math.ceil(cells.length / cols);
    const cellW = GAME_WIDTH / cols;
    const cellH = (GAME_HEIGHT - HEADER) / rows;

    cells.forEach((cell, i) => {
      const x = (i % cols) * cellW;
      const y = HEADER + Math.floor(i / cols) * cellH;
      const cx = x + cellW / 2;
      const cy = y + (cellH - LABEL) / 2;
      const { asset } = cell;
      const w = cell.anim ? asset.frameWidth : asset.frameWidth * asset.columns;
      const h = cell.anim ? asset.frameHeight : asset.frameHeight * asset.rows;
      // One-shot effects loop here with a pause, so they can be watched.
      // Scale down to fit the cell, never up, so pixels stay crisp where possible.
      const scale = Math.min(1, (cellW - 4) / w, (cellH - LABEL - 4) / h);
      if (cell.anim) {
        this.items.push(
          this.add
            .sprite(cx, cy, asset.key)
            .setScale(scale)
            .play({ key: animKey(asset.key, cell.anim), repeat: -1, repeatDelay: 400 }),
        );
      } else {
        // The whole sheet: the base texture frame.
        this.items.push(this.add.image(cx, cy, asset.key, '__BASE').setScale(scale));
      }
      const name = cell.anim ? `${asset.key}:${cell.anim}` : asset.key;
      this.items.push(
        this.label(x + 2, y + cellH - LABEL, name.slice(0, Math.floor((cellW - 2) / 5)), '#c8d0e0'),
      );
    });
  }

  private label(x: number, y: number, text: string, color: string) {
    return this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: '8px', color });
  }
}
