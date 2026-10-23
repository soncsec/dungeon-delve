import { describe, expect, it } from 'vitest';
import { NEW_PROGRESS, openChest } from '../../src/logic/progress';
import {
  finishVisit,
  markTalked,
  talkId,
  walkerHere,
  type WalkerVisit,
} from '../../src/logic/walker';
import { VAULT_DOOR, WALKER_VISITS } from '../../src/world/walker';
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
    expect(here('overworld', 6, 8)).toBeNull();
    expect(here('overworld', 6, 8, ['dungeon1/shard'])).toBe('dungeon1-done');
    expect(here('overworld', 6, 8, ['dungeon1/shard', 'walker/dungeon1-done'])).toBeNull();
  });
});

describe('Walker at dungeons 2 to 4 (M5.5)', () => {
  const here = (map: string, col: number, row: number, opened: string[] = []) =>
    walkerHere(WALKER_VISITS, map, { col, row }, { opened, keys: {} })?.id ?? null;

  it.each([
    [2, 'dungeon2', { col: 2, row: 8 }],
    [3, 'dungeon3', { col: 10, row: 6 }],
    [4, 'dungeon4', { col: 6, row: 2 }],
  ] as const)(
    'waits at dungeon %i’s entrance, and outside it once its shard is found',
    (_n, map, outside) => {
      expect(here(map, 1, 3)).toBe(map);
      expect(here('overworld', outside.col, outside.row)).toBeNull();
      expect(here('overworld', outside.col, outside.row, [`${map}/shard`])).toBe(`${map}-done`);
      expect(
        here('overworld', outside.col, outside.row, [`${map}/shard`, `walker/${map}-done`]),
      ).toBeNull();
    },
  );

  it.each([
    [5, 'dungeon5', { col: 4, row: 0 }],
    [6, 'dungeon6', { col: 0, row: 3 }],
    [7, 'dungeon7', { col: 12, row: 5 }],
    [8, 'dungeon8', { col: 14, row: 0 }],
  ] as const)(
    'waits at dungeon %i’s entrance, and outside it once its shard is found (M6.5)',
    (_n, map, outside) => {
      const start = MAPS[map].start;
      expect(here(map, start.col, start.row)).toBe(map);
      expect(here('overworld', outside.col, outside.row)).toBeNull();
      expect(here('overworld', outside.col, outside.row, [`${map}/shard`])).toBe(`${map}-done`);
      expect(
        here('overworld', outside.col, outside.row, [`${map}/shard`, `walker/${map}-done`]),
      ).toBeNull();
    },
  );

  it('outside each dungeon from the first to the seventh, he names the next; after the last, the vault', () => {
    const next = [
      'BOG GROTTO',
      'SUNKEN CRYPT',
      'STONECRAG MINE',
      'THUNDER SPIRE',
      'WITCHWOOD TOWER',
      'CRIMSON MANOR',
      "DRAGON'S MAW",
      'SHADOW VAULT',
    ];
    next.forEach((name, i) => {
      const done = WALKER_VISITS.find((v) => v.id === `dungeon${i + 1}-done`);
      expect(done?.speech.map((p) => p.text).join(' '), `dungeon${i + 1}-done`).toContain(name);
    });
  });

  it('names the touch buttons wherever he names keys', () => {
    for (const v of WALKER_VISITS) {
      for (const p of v.speech) {
        const keys = /\b(PRESS [A-Z0-9]\b|SPACE|WASD|ARROWS)/.test(p.text);
        expect(keys ? p.touch : 'no keys', `${v.id}: ${p.text}`).toBeDefined();
        expect(p.touch ?? '', `${v.id}: ${p.text}`).not.toMatch(/SPACE|WASD|PRESS [A-Z0-9]\b/);
      }
    }
  });
});

describe('Walker at the Shadow Vault (M7.1)', () => {
  const here = (opened: string[] = []) =>
    walkerHere(WALKER_VISITS, 'overworld', VAULT_DOOR.room, { opened, keys: {} })?.id ?? null;

  it('waits at the vault door once all 8 shards are found', () => {
    expect(here()).toBeNull();
    expect(here(['dungeon7/shard'])).toBeNull();
    expect(here(['dungeon8/shard'])).toBe('vault');
    expect(here(['dungeon8/shard', 'walker/vault'])).toBeNull();
  });

  it('when he has spoken, the vault door is open for good', () => {
    const visit = WALKER_VISITS.find((v) => v.id === 'vault');
    expect(visit).toBeDefined();
    if (!visit) return;
    const p = finishVisit({ opened: ['dungeon8/shard'], keys: {} }, visit);
    expect(p.opened).toEqual([
      'dungeon8/shard',
      'walker/vault',
      'overworld/6,6/14,3',
      'overworld/6,6/15,3',
    ]);
    // The door is the room's locked door, which no key opens out here.
    const room = buildWorld(MAPS.overworld.rooms).rooms.get(roomKey(6, 6));
    for (const c of VAULT_DOOR.cells) expect(room?.cells[c.row]?.[c.col]?.fixture).toBe('door');
    // His hint: send the sorcerer's magic back with the sword.
    expect(visit.speech.map((s) => s.text).join(' ')).toContain('SEND IT BACK');
  });

  it('a visit that opens nothing only records the talk', () => {
    const p = finishVisit({ opened: [], keys: {} }, VISITS[0] as WalkerVisit);
    expect(p.opened).toEqual(['walker/a']);
  });
});
