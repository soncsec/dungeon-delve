import { describe, expect, it } from 'vitest';
import { buildWorld, joinProblems, roomKey } from '../../src/logic/world';
import { ENEMIES, TILE } from '../../src/config/tuning';
import { isSolid } from '../../src/logic/room';
import {
  CRYPT_TINT,
  MARSH_TINT,
  MINE_TINT,
  SPIRE_TINT,
  WOOD_TINT,
  MANOR_TINT,
  coveredCells,
  dungeonArt,
  roomArt,
} from '../../src/logic/tiles';
import { DUNGEON_MAPS, MAPS, type MapId } from '../../src/world/maps';

describe('maps', () => {
  it.each(Object.entries(MAPS))('%s parses, joins up, and has its start room', (_id, map) => {
    const world = buildWorld(map.rooms);
    expect(joinProblems(world)).toEqual([]);
    expect(world.rooms.has(roomKey(map.start.col, map.start.row))).toBe(true);
  });

  it('every walking enemy starts on open ground, clear of walls, props and the art over them', () => {
    const problems: string[] = [];
    for (const [id, map] of Object.entries(MAPS)) {
      const world = buildWorld(map.rooms);
      for (const def of map.rooms) {
        const key = roomKey(def.col, def.row);
        const room = world.rooms.get(key);
        if (!room) continue;
        // Drawn as the game draws it: stone in dungeons, indoors and the vault grounds.
        const region = world.regions.get(key) ?? 'forest';
        const stone = map.theme !== 'forest' || region === 'vault';
        const covered = coveredCells(stone ? dungeonArt(room) : roomArt(room, region));
        // (Fliers cross trees and walls, and are drawn above them.)
        for (const e of (def.enemies ?? []).filter((x) => !ENEMIES[x.kind].flies)) {
          // Its body box, with its feet at the bottom middle of its cell (as the game puts it).
          const { halfWidth, height } = ENEMIES[e.kind].box;
          const x = e.col * TILE + TILE / 2;
          const y = (e.row + 1) * TILE - 1;
          const x0 = Math.floor((x - halfWidth) / TILE);
          const x1 = Math.floor((x + halfWidth - 1e-6) / TILE);
          const y0 = Math.floor((y - height) / TILE);
          const y1 = Math.floor(y / TILE);
          for (let cy = y0; cy <= y1; cy++) {
            for (let cx = x0; cx <= x1; cx++) {
              if (isSolid(room, cx, cy) || covered.has(`${cx},${cy}`)) {
                problems.push(`${id} ${key}: ${e.kind} at ${e.col},${e.row} touches ${cx},${cy}`);
              }
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
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
    expect(into).toEqual(['2,8']);
    const out = MAPS.dungeon2.rooms.flatMap((r) => r.exits ?? []).map((e) => e.to);
    expect(out).toEqual([expect.objectContaining({ map: 'overworld', room: { col: 2, row: 8 } })]);
    expect(DUNGEON_MAPS[2]).toBe('dungeon2');
  });

  it('Bog Grotto is a dungeon in the marsh’s colours, Sunken Crypt in sandy stone; the others have no tint', () => {
    expect(MAPS.dungeon2.name).toBe('Bog Grotto');
    expect(MAPS.dungeon2.tint).toBe(MARSH_TINT);
    expect(MAPS.dungeon3.name).toBe('Sunken Crypt');
    expect(MAPS.dungeon3.tint).toBe(CRYPT_TINT);
    expect(MAPS.dungeon4.name).toBe('Stonecrag Mine');
    expect(MAPS.dungeon4.tint).toBe(MINE_TINT);
    for (const id of ['overworld', 'dungeon1', 'shop', 'caves'] as const) {
      expect(MAPS[id].tint).toBeUndefined();
    }
  });

  it('the overworld and Sunken Crypt lead into each other, through the ruins archway', () => {
    const into = MAPS.overworld.rooms
      .filter((r) => (r.exits ?? []).some((e) => e.to.map === 'dungeon3'))
      .map((r) => `${r.col},${r.row}`);
    expect(into).toEqual(['10,6']);
    const out = MAPS.dungeon3.rooms.flatMap((r) => r.exits ?? []).map((e) => e.to);
    expect(out).toEqual([expect.objectContaining({ map: 'overworld', room: { col: 10, row: 6 } })]);
    expect(DUNGEON_MAPS[3]).toBe('dungeon3');
  });

  it('the overworld and Thunder Spire lead into each other, through the mountain archway', () => {
    const into = MAPS.overworld.rooms
      .filter((r) => (r.exits ?? []).some((e) => e.to.map === 'dungeon5'))
      .map((r) => `${r.col},${r.row}`);
    expect(into).toEqual(['4,0']);
    const out = MAPS.dungeon5.rooms.flatMap((r) => r.exits ?? []).map((e) => e.to);
    expect(out).toEqual([expect.objectContaining({ map: 'overworld', room: { col: 4, row: 0 } })]);
    expect(DUNGEON_MAPS[5]).toBe('dungeon5');
    expect(MAPS.dungeon5.name).toBe('Thunder Spire');
    expect(MAPS.dungeon5.tint).toBe(SPIRE_TINT);
  });

  it('the overworld and Witchwood Tower lead into each other, through the forest archway', () => {
    const into = MAPS.overworld.rooms
      .filter((r) => (r.exits ?? []).some((e) => e.to.map === 'dungeon6'))
      .map((r) => `${r.col},${r.row}`);
    expect(into).toEqual(['0,3']);
    const out = MAPS.dungeon6.rooms.flatMap((r) => r.exits ?? []).map((e) => e.to);
    expect(out).toEqual([expect.objectContaining({ map: 'overworld', room: { col: 0, row: 3 } })]);
    expect(DUNGEON_MAPS[6]).toBe('dungeon6');
    expect(MAPS.dungeon6.name).toBe('Witchwood Tower');
    expect(MAPS.dungeon6.tint).toBe(WOOD_TINT);
  });

  it('the overworld and Crimson Manor lead into each other, through the ruins archway', () => {
    const into = MAPS.overworld.rooms
      .filter((r) => (r.exits ?? []).some((e) => e.to.map === 'dungeon7'))
      .map((r) => `${r.col},${r.row}`);
    expect(into).toEqual(['12,5']);
    const out = MAPS.dungeon7.rooms.flatMap((r) => r.exits ?? []).map((e) => e.to);
    expect(out).toEqual([expect.objectContaining({ map: 'overworld', room: { col: 12, row: 5 } })]);
    expect(DUNGEON_MAPS[7]).toBe('dungeon7');
    expect(MAPS.dungeon7.name).toBe('Crimson Manor');
    expect(MAPS.dungeon7.tint).toBe(MANOR_TINT);
  });

  it('the overworld and Stonecrag Mine lead into each other, through the mountain cave', () => {
    const into = MAPS.overworld.rooms
      .filter((r) => (r.exits ?? []).some((e) => e.to.map === 'dungeon4'))
      .map((r) => `${r.col},${r.row}`);
    expect(into).toEqual(['6,2']);
    const out = MAPS.dungeon4.rooms.flatMap((r) => r.exits ?? []).map((e) => e.to);
    expect(out).toEqual([expect.objectContaining({ map: 'overworld', room: { col: 6, row: 2 } })]);
    expect(DUNGEON_MAPS[4]).toBe('dungeon4');
  });
});
