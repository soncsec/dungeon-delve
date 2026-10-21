import { describe, expect, it } from 'vitest';
import { buildWorld, joinProblems, roomKey } from '../../src/logic/world';
import { TILE } from '../../src/config/tuning';
import { CRYPT_TINT, MARSH_TINT } from '../../src/logic/tiles';
import { DUNGEON_MAPS, MAPS, type MapId } from '../../src/world/maps';

describe('maps', () => {
  it.each(Object.entries(MAPS))('%s parses, joins up, and has its start room', (_id, map) => {
    const world = buildWorld(map.rooms);
    expect(joinProblems(world)).toEqual([]);
    expect(world.rooms.has(roomKey(map.start.col, map.start.row))).toBe(true);
  });

  it('every dungeon number names a dungeon map', () => {
    for (const id of Object.values(DUNGEON_MAPS)) expect(MAPS[id].theme).toBe('dungeon');
  });

  it('every doorway leads to a real map and room, landing on open ground off the doorway', () => {
    for (const [id, map] of Object.entries(MAPS)) {
      for (const def of map.rooms) {
        for (const exit of def.exits ?? []) {
          const where = `${id} room ${def.col},${def.row}`;
          const target = MAPS[exit.to.map as MapId];
          expect(target, where).toBeDefined();
          const world = buildWorld(target.rooms);
          const room = world.rooms.get(roomKey(exit.to.room.col, exit.to.room.row));
          expect(room, where).toBeDefined();
          const cx = Math.floor(exit.to.feet.x / TILE);
          const cy = Math.floor((exit.to.feet.y - 1) / TILE);
          const cell = room?.cells[cy]?.[cx];
          expect(cell?.solid, where).toBe(false);
          expect(cell?.exit, where).toBe(false);
        }
      }
    }
  });

  it('the overworld and dungeon 1 lead into each other', () => {
    const into = MAPS.overworld.rooms.flatMap((r) => r.exits ?? []).map((e) => e.to.map);
    const out = MAPS.dungeon1.rooms.flatMap((r) => r.exits ?? []).map((e) => e.to.map);
    expect(into).toContain('dungeon1');
    expect(out).toContain('overworld');
  });

  it('the overworld and Bog Grotto lead into each other, through the marsh archway', () => {
    const into = MAPS.overworld.rooms
      .filter((r) => (r.exits ?? []).some((e) => e.to.map === 'dungeon2'))
      .map((r) => `${r.col},${r.row}`);
    expect(into).toEqual(['1,5']);
    const out = MAPS.dungeon2.rooms.flatMap((r) => r.exits ?? []).map((e) => e.to);
    expect(out).toEqual([expect.objectContaining({ map: 'overworld', room: { col: 1, row: 5 } })]);
    expect(DUNGEON_MAPS[2]).toBe('dungeon2');
  });

  it('Bog Grotto is a dungeon in the marsh’s colours, Sunken Crypt in sandy stone; the others have no tint', () => {
    expect(MAPS.dungeon2.name).toBe('Bog Grotto');
    expect(MAPS.dungeon2.tint).toBe(MARSH_TINT);
    expect(MAPS.dungeon3.name).toBe('Sunken Crypt');
    expect(MAPS.dungeon3.tint).toBe(CRYPT_TINT);
    for (const id of ['overworld', 'dungeon1', 'shop', 'caves'] as const) {
      expect(MAPS[id].tint).toBeUndefined();
    }
  });

  it('the overworld and Sunken Crypt lead into each other, through the ruins archway', () => {
    const into = MAPS.overworld.rooms
      .filter((r) => (r.exits ?? []).some((e) => e.to.map === 'dungeon3'))
      .map((r) => `${r.col},${r.row}`);
    expect(into).toEqual(['5,4']);
    const out = MAPS.dungeon3.rooms.flatMap((r) => r.exits ?? []).map((e) => e.to);
    expect(out).toEqual([expect.objectContaining({ map: 'overworld', room: { col: 5, row: 4 } })]);
    expect(DUNGEON_MAPS[3]).toBe('dungeon3');
  });
});
