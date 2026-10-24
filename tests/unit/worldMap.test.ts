import { describe, expect, it } from 'vitest';
import { worldMap, type WorldRoom } from '../../src/logic/worldMap';

// A small world: the village at the bottom, a forest above with Hollow Oak's
// archway, the marsh beside it with Bog Grotto's, and the vault grounds.
const WORLD: readonly WorldRoom[] = [
  { col: 0, row: 0, region: 'forest', leadsTo: ['dungeon1'] },
  { col: 1, row: 0, region: 'vault', leadsTo: ['vault'] },
  { col: 2, row: 0, region: 'marsh', leadsTo: ['caves', 'dungeon2'] },
  { col: 0, row: 1, region: 'forest', leadsTo: [] },
  { col: 1, row: 1, region: 'village', leadsTo: ['shop'] },
  { col: 2, row: 1, region: 'marsh', leadsTo: ['caves'] },
];
const noneDone = () => false;

describe('worldMap', () => {
  it('shows only the screen he is in, at first, on a grid the whole world fits', () => {
    const m = worldMap(WORLD, () => false, { col: 1, row: 1 }, noneDone);
    expect(m).toEqual({
      cols: 3,
      rows: 2,
      cells: [{ x: 1, y: 1, region: 'village', current: true, entrance: null }],
    });
  });

  it('adds every screen he has been in, top to bottom, each in its region', () => {
    const seen = new Set(['0,0', '0,1', '1,1']);
    const m = worldMap(WORLD, (c, r) => seen.has(`${c},${r}`), { col: 0, row: 1 }, noneDone);
    expect(m.cells).toEqual([
      { x: 0, y: 0, region: 'forest', current: false, entrance: 'dungeon' },
      { x: 0, y: 1, region: 'forest', current: true, entrance: null },
      { x: 1, y: 1, region: 'village', current: false, entrance: null },
    ]);
  });

  it('marks a dungeon done once its shard is found, and the vault as the vault', () => {
    const m = worldMap(
      WORLD,
      () => true,
      { col: 1, row: 1 },
      (map) => map === 'dungeon1',
    );
    const marks = m.cells.map((c) => c.entrance);
    expect(marks).toEqual(['done', 'vault', 'dungeon', null, null, null]);
  });

  it('a doorway into a cave, the shop or nowhere is no entrance', () => {
    const m = worldMap(WORLD, () => true, { col: 1, row: 1 }, noneDone);
    expect(m.cells.filter((c) => c.y === 1).map((c) => c.entrance)).toEqual([null, null, null]);
  });

  it('measures from the top-left screen, wherever the world sits', () => {
    const shifted = WORLD.map((r) => ({ ...r, col: r.col + 4, row: r.row + 2 }));
    const m = worldMap(shifted, () => false, { col: 5, row: 3 }, noneDone);
    expect(m.cols).toBe(3);
    expect(m.cells).toEqual([{ x: 1, y: 1, region: 'village', current: true, entrance: null }]);
  });
});
