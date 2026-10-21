import { describe, expect, it } from 'vitest';
import { buildWorld, joinProblems, roomKey } from '../../src/logic/world';
import { DUNGEON_MAPS, MAPS } from '../../src/world/maps';

describe('maps', () => {
  it.each(Object.entries(MAPS))('%s parses, joins up, and has its start room', (_id, map) => {
    const world = buildWorld(map.rooms);
    expect(joinProblems(world)).toEqual([]);
    expect(world.rooms.has(roomKey(map.start.col, map.start.row))).toBe(true);
  });

  it('every dungeon number names a dungeon map', () => {
    for (const id of Object.values(DUNGEON_MAPS)) expect(MAPS[id].theme).toBe('dungeon');
  });
});
