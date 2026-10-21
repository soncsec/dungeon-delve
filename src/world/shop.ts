/**
 * The village shop (owner 2026-10-21): one room inside the house on the west
 * street, with the shopkeeper behind a counter. The doorway in the south wall
 * leads back out onto the street, by the house's steps.
 */
import type { RoomDef } from '../logic/world';

export const SHOP_START = { col: 0, row: 0 } as const;

/** Where the shopkeeper stands, behind the counter. */
export const SHOPKEEPER_CELL = { col: 9, row: 3 } as const;

export const SHOP: readonly RoomDef[] = [
  {
    col: 0,
    row: 0,
    exits: [
      {
        cells: [
          { col: 9, row: 9 },
          { col: 10, row: 9 },
        ],
        // Out onto the west street, on the path beside the house's steps.
        to: {
          map: 'overworld',
          room: { col: 3, row: 6 },
          feet: { x: 104, y: 142 },
          facing: 'down',
        },
      },
    ],
    lines: [
      '####################',
      '####################',
      '##................##',
      '##................##',
      '##.....######.....##',
      '##................##',
      '##................##',
      '##................##',
      '#########..#########',
      '#########DD#########',
    ],
  },
];
