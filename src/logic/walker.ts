/**
 * Walker's visits (engine-free, unit tested; PROJECT.md §3f). He waits in a
 * room until Jarrett has talked to him there, then vanishes for good. Some
 * visits wait for something first (e.g. a dungeon's shard).
 */
import type { Paragraph } from './dialogue';
import { isOpened, openChest, type Progress } from './progress';

export interface WalkerVisit {
  id: string;
  map: string;
  room: { col: number; row: number };
  /** The cell he stands in (feet at its bottom-centre). */
  cell: { col: number; row: number };
  /** A progress id that must be there first (none: from the start). */
  after?: string;
  speech: readonly Paragraph[];
}

/** The progress id recording that a visit's talk has happened. */
export const talkId = (visitId: string): string => `walker/${visitId}`;

/** Records that Jarrett has talked to Walker on a visit (once). */
export function markTalked(p: Progress, visitId: string): Progress {
  return openChest(p, talkId(visitId));
}

/** The visit waiting in this room, if any. */
export function walkerHere(
  visits: readonly WalkerVisit[],
  map: string,
  room: { col: number; row: number },
  p: Progress,
): WalkerVisit | null {
  return (
    visits.find(
      (v) =>
        v.map === map &&
        v.room.col === room.col &&
        v.room.row === room.row &&
        !isOpened(p, talkId(v.id)) &&
        (v.after === undefined || isOpened(p, v.after)),
    ) ?? null
  );
}
