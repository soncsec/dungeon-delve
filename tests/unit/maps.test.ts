import { describe, expect, it } from 'vitest';
import { buildWorld, joinProblems, roomKey } from '../../src/logic/world';
import { TILE } from '../../src/config/tuning';
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
});
