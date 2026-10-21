import { describe, expect, it } from 'vitest';
import { NEW_PROGRESS, openChest } from '../../src/logic/progress';
import { markTalked, talkId, walkerHere, type WalkerVisit } from '../../src/logic/walker';
import { WALKER_VISITS } from '../../src/world/walker';
import { paginate } from '../../src/logic/dialogue';
import { MAPS } from '../../src/world/maps';
import { buildWorld, roomKey } from '../../src/logic/world';

const VISITS: WalkerVisit[] = [
  { id: 'a', map: 'overworld', room: { col: 1, row: 1 }, cell: { col: 2, row: 2 }, speech: [] },
  {
    id: 'b',
    map: 'overworld',
    room: { col: 1, row: 1 },
    cell: { col: 3, row: 3 },
    after: 'dungeon1/shard',
    speech: [],
  },
  { id: 'c', map: 'dungeon1', room: { col: 1, row: 3 }, cell: { col: 5, row: 5 }, speech: [] },
];

describe('walkerHere', () => {
  it('finds the visit waiting in a room, on the right map', () => {
    expect(walkerHere(VISITS, 'overworld', { col: 1, row: 1 }, NEW_PROGRESS)?.id).toBe('a');
    expect(walkerHere(VISITS, 'dungeon1', { col: 1, row: 3 }, NEW_PROGRESS)?.id).toBe('c');
    expect(walkerHere(VISITS, 'overworld', { col: 1, row: 3 }, NEW_PROGRESS)).toBeNull();
    expect(walkerHere(VISITS, 'overworld', { col: 0, row: 1 }, NEW_PROGRESS)).toBeNull();
  });

  it('is gone once talked to; a later visit waits for what it needs', () => {
    const talked = markTalked(NEW_PROGRESS, 'a');
    expect(talked.opened).toEqual(['walker/a']);
    expect(talkId('a')).toBe('walker/a');
    expect(markTalked(talked, 'a')).toBe(talked);
    expect(walkerHere(VISITS, 'overworld', { col: 1, row: 1 }, talked)).toBeNull();
    const shard = openChest(talked, 'dungeon1/shard');
    expect(walkerHere(VISITS, 'overworld', { col: 1, row: 1 }, shard)?.id).toBe('b');
  });
});

describe('Walker in the game', () => {
  it('stands on open ground in a real room, with ids used once', () => {
    const ids = new Set<string>();
    for (const v of WALKER_VISITS) {
      expect(ids.has(v.id)).toBe(false);
      ids.add(v.id);
      const map = MAPS[v.map as keyof typeof MAPS];
      expect(map).toBeDefined();
      const room = buildWorld(map.rooms).rooms.get(roomKey(v.room.col, v.room.row));
      expect(room?.cells[v.cell.row]?.[v.cell.col]?.solid).toBe(false);
    }
  });

  it('every line fits the text box (36 characters, 3 lines a page)', () => {
    for (const v of WALKER_VISITS) {
      for (const page of paginate(v.speech, 36, 3)) {
        expect(page.lines.length).toBeLessThanOrEqual(3);
        for (const line of page.lines) expect(line.length).toBeLessThanOrEqual(36);
      }
    }
  });

  it('in the village he hands over the sword and shield', () => {
    const village = WALKER_VISITS.find((v) => v.id === 'village');
    expect(village?.speech.flatMap((p) => p.give ?? [])).toEqual(['wooden-sword', 'wooden-shield']);
  });
});

describe('Walker after dungeon 1', () => {
  it('waits at the entrance, and outside once the shard is found', () => {
    const here = (map: string, col: number, row: number, opened: string[] = []) =>
      walkerHere(WALKER_VISITS, map, { col, row }, { opened, keys: {} })?.id ?? null;
    expect(here('dungeon1', 1, 3)).toBe('dungeon1');
    expect(here('overworld', 1, 0)).toBeNull();
    expect(here('overworld', 1, 0, ['dungeon1/shard'])).toBe('dungeon1-done');
    expect(here('overworld', 1, 0, ['dungeon1/shard', 'walker/dungeon1-done'])).toBeNull();
  });
});
