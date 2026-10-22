/**
 * Walker's visits (engine-free, unit tested; PROJECT.md §3f). He waits in a
 * room until Jarrett has talked to him there, then vanishes for good. Some
 * visits wait for something first (e.g. a dungeon's shard).
 */
import type { Paragraph } from './dialogue';
import { fixtureId, isOpened, openChest, type Progress } from './progress';
import { roomKey } from './world';

export interface WalkerVisit {
  id: string;
  map: string;
  room: { col: number; row: number };
  /** The cell he stands in (feet at its bottom-centre). */
  cell: { col: number; row: number };
  /** A progress id that must be there first (none: from the start). */
  after?: string;
  speech: readonly Paragraph[];
  /** Doors in his room that he opens, for good, when the talk is done (the Shadow Vault's). */
  opens?: readonly { col: number; row: number }[];
  /** Who waits there: Walker, unless it is Princess Kira (her sprite, and her name over the text box). */
  who?: 'walker' | 'kira';
  /** A progress id before which the visit is there to see but can't be talked to (Kira, in her cell). */
  speaksAfter?: string;
  /** The talk ends the game (Kira's rescue): the ending follows. */
  ends?: boolean;
}

/** Whether Jarrett can talk to the one waiting on this visit yet. */
export function canTalk(v: WalkerVisit, p: Progress): boolean {
  return v.speaksAfter === undefined || isOpened(p, v.speaksAfter);
}

/** The progress id recording that a visit's talk has happened. */
export const talkId = (visitId: string): string => `walker/${visitId}`;

/** Records that Jarrett has talked to Walker on a visit (once). */
export function markTalked(p: Progress, visitId: string): Progress {
  return openChest(p, talkId(visitId));
}

/** A talk done: recorded, and the doors the visit opens opened for good. */
export function finishVisit(p: Progress, v: WalkerVisit): Progress {
  const key = roomKey(v.room.col, v.room.row);
  return (v.opens ?? []).reduce(
    (q, c) => openChest(q, fixtureId(v.map, key, c.col, c.row)),
    markTalked(p, v.id),
  );
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
