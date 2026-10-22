/**
 * The Shadow Vault (PROJECT.md §3c; owner 2026-10-22: four rooms), under the
 * vault grounds at the centre of the land. Walker opens its door once Jarrett
 * holds all 8 shards (M7.1).
 *
 *   [entry hall]   where Jarrett comes in (M7.1); the trials and the
 *                  sorcerer's hall come next (M7.2)
 */
import type { RoomDef } from '../logic/world';

/** The entry hall: where Jarrett arrives and gets back up after falling. */
export const VAULT_START = { col: 1, row: 2 } as const;

export const VAULT: readonly RoomDef[] = [
  // The entry hall: the way out south, back up to the vault grounds.
  {
    col: 1,
    row: 2,
    exits: [
      {
        cells: [
          { col: 9, row: 9 },
          { col: 10, row: 9 },
        ],
        to: { map: 'overworld', room: { col: 6, row: 6 }, feet: { x: 240, y: 78 }, facing: 'down' },
      },
    ],
    lines: [
      '####################',
      '####################',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '#########..#########',
      '#########DD#########',
    ],
  },
];
