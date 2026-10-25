/**
 * Secret rooms in the dungeons (owner 2026-10-24, M10.1): one per dungeon, off
 * a room deep inside, behind a secret wall (`u`): plain stone until two strikes
 * of the sword crumble it, the whole two-cell-thick doorway at once. Each holds
 * a reward: gems and potions, or in two dungeons a heart container. None is
 * needed to finish its dungeon.
 */
import type { Dir } from '../logic/room';
import type { ChestPlacement, RoomDef } from '../logic/world';

/** A secret room: the doorway on the side facing its neighbour, and its chests. */
export function secretRoom(
  col: number,
  row: number,
  door: Dir,
  chests: readonly ChestPlacement[],
): RoomDef {
  const lines = Array.from({ length: 10 }, (_, y) =>
    Array.from({ length: 20 }, (_, x) => {
      const inside = x >= 2 && x <= 17 && y >= 2 && y <= 7;
      const across = y === 4 || y === 5;
      const along = x === 9 || x === 10;
      const doorway =
        (door === 'west' && across && x < 2) ||
        (door === 'east' && across && x > 17) ||
        (door === 'north' && along && y < 2) ||
        (door === 'south' && along && y > 7);
      if (chests.some((c) => c.col === x && c.row === y)) return 'C';
      return inside || doorway ? '.' : '#';
    }).join(''),
  );
  return { col, row, lines, chests };
}

/**
 * A room's lines with a secret doorway cut in its side wall (rows 4 and 5, both
 * wall cells): the matching side of a `secretRoom` next door.
 */
export function withSecretDoor(lines: readonly string[], side: 'east' | 'west'): string[] {
  return lines.map((line, y) => {
    if (y !== 4 && y !== 5) return line;
    const wall = side === 'east' ? line.slice(18) : line.slice(0, 2);
    if (wall !== '##')
      throw new Error(`a secret door needs solid wall, found '${wall}' on row ${y}`);
    return side === 'east' ? `${line.slice(0, 18)}uu` : `uu${line.slice(2)}`;
  });
}
