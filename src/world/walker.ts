/**
 * Where Walker waits, and what he says (PROJECT.md §3f). Plain, friendly
 * text for young teens; upper case for the pixel font.
 */
import type { WalkerVisit } from '../logic/walker';
import { DUNGEON_1_START } from './dungeon1';
import { START_ROOM } from './overworld';

export const WALKER_VISITS: readonly WalkerVisit[] = [
  {
    // The village (the start room, for now): the story, the sword and shield, the controls.
    id: 'village',
    map: 'overworld',
    room: START_ROOM,
    cell: { col: 13, row: 4 },
    speech: [
      { text: 'HELLO, JARRETT. I AM WALKER.' },
      {
        text: 'I MAY LOOK TEN YEARS OLD, BUT I HAVE GUARDED THE STAR OF POWER FOR A THOUSAND YEARS.',
      },
      {
        text: 'LAST NIGHT A SORCERER SHATTERED THE STAR INTO EIGHT SHARDS, AND HID THEM IN EIGHT DUNGEONS.',
      },
      {
        text: 'HE TOOK PRINCESS KIRA, TOO, AND LOCKED HER IN THE SHADOW VAULT. ONLY THE WHOLE STAR CAN OPEN IT.',
      },
      {
        text: 'I CAN NO LONGER FIGHT. BUT YOU CAN. TAKE THESE: A SWORD AND A SHIELD.',
        give: ['wooden-sword', 'wooden-shield'],
      },
      {
        text: 'ARROWS OR WASD WALK. SPACE STRIKES. X SWITCHES NEAR AND FAR. C CASTS A SPELL.',
      },
      { text: 'I OPENS YOUR BAG. 1 AND 2 DRINK POTIONS. M TURNS THE SOUND OFF AND ON.' },
      {
        text: 'THE FIRST SHARD IS IN HOLLOW OAK, A DUNGEON TO THE NORTH. GO WELL, JARRETT!',
      },
    ],
  },
  {
    // Dungeon 1's entrance: a hint about Hollow Oak.
    id: 'dungeon1',
    map: 'dungeon1',
    room: DUNGEON_1_START,
    cell: { col: 14, row: 6 },
    speech: [
      { text: 'THIS IS HOLLOW OAK. THE TREANT THAT GUARDS ITS SHARD SPITS SEEDS.' },
      { text: 'DOORS HERE ARE LOCKED. SMALL KEYS HIDE IN CHESTS, AND WORK ONLY IN THIS DUNGEON.' },
      { text: 'SOME STONES MOVE. LEAN ON ONE AND IT WILL SLIDE.' },
      {
        text: 'A PAIR OF THROWING DAGGERS IS HIDDEN HERE. WITH THEM YOU CAN STRIKE FROM AFAR.',
      },
    ],
  },
  {
    // Outside Hollow Oak, once its shard is found: the daggers, and what's left to do.
    id: 'dungeon1-done',
    map: 'overworld',
    room: { col: 1, row: 0 },
    cell: { col: 13, row: 4 },
    after: 'dungeon1/shard',
    speech: [
      { text: 'THE FIRST SHARD! I FELT IT GLOW. SEVEN MORE TO FIND.' },
      {
        text: 'YOUR DAGGERS: PRESS X TO SWITCH TO THEM, THEN SPACE TO THROW. X AGAIN FOR THE SWORD.',
      },
      { text: 'THE NEXT SHARD LIES BEYOND THE FOREST. I WILL FIND YOU THERE.' },
    ],
  },
];
