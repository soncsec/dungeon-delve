/**
 * The shield (engine-free, unit tested). Jarrett holds it in front of him: an
 * enemy shot coming at his front is blocked, unless his hands are busy
 * (swinging, throwing, casting) or he is being knocked back.
 */
import type { Facing } from './hero';
import { facingVector } from './sword';
import type { Vec } from './enemies';

/**
 * Whether a shot flying along `shotDir` (unit length) is blocked. It must be
 * coming at his front: heading the opposite way to his facing, within the
 * shield's arc (`coverCos` is the cosine of the widest angle it still covers).
 */
export function shieldBlocks(
  facing: Facing,
  shotDir: Vec,
  busy: boolean,
  coverCos: number,
): boolean {
  if (busy) return false;
  const f = facingVector(facing);
  // Opposite directions have a dot product of -1.
  return f.x * shotDir.x + f.y * shotDir.y <= -coverCos;
}
