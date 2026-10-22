/**
 * Where Walker waits, and what he says (PROJECT.md §3f). Plain, friendly
 * text for young teens; upper case for the pixel font.
 */
import type { WalkerVisit } from '../logic/walker';
import { DUNGEON_1_START } from './dungeon1';
import { DUNGEON_2_START } from './dungeon2';
import { DUNGEON_3_START } from './dungeon3';
import { DUNGEON_4_START } from './dungeon4';
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
        text: 'ARROWS OR WASD WALK. SPACE STRIKES. X SWITCHES NEAR AND FAR.',
        touch: 'THE PAD WALKS. HIT STRIKES. SWAP SWITCHES NEAR AND FAR.',
      },
      {
        text: 'I OPENS YOUR BAG. 1 AND 2 DRINK POTIONS. M TURNS THE SOUND OFF AND ON.',
        touch: 'BAG OPENS YOUR BAG. HEAL AND MANA DRINK YOUR POTIONS.',
      },
      {
        text: 'THE HOUSE ON THE WEST STREET IS THE SHOP: POTIONS, AND A STRONGER SHIELD, FOR GEMS.',
      },
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
    // Outside Hollow Oak, once its shard is found: his thanks, and magic (owner
    // 2026-10-21: he teaches the Fireball), the daggers, and what's left to do.
    id: 'dungeon1-done',
    map: 'overworld',
    room: { col: 3, row: 5 },
    cell: { col: 13, row: 4 },
    after: 'dungeon1/shard',
    speech: [
      { text: 'THE FIRST SHARD! I FELT IT GLOW. SEVEN MORE TO FIND.' },
      { text: 'THANK YOU, JARRETT, FOR TAKING ON THIS QUEST. YOU HAVE EARNED A GIFT: MAGIC.' },
      { text: 'WATCH CLOSELY... THIS IS FIREBALL. NOW IT IS YOURS.', give: ['fireball'] },
      {
        text: 'C CASTS IT. EACH CAST USES MANA, THE BLUE BAR. IT FILLS AGAIN WHEN YOU PAUSE.',
        touch: 'MAGIC CASTS IT. EACH CAST USES MANA, THE BLUE BAR. IT FILLS AGAIN WHEN YOU PAUSE.',
      },
      {
        text: 'FIRE BURNS THORNS. A MANA BREW (PRESS 2) FILLS YOUR MANA FASTER FOR A WHILE.',
        touch:
          'FIRE BURNS THORNS. A MANA BREW (THE MANA BUTTON) FILLS YOUR MANA FASTER FOR A WHILE.',
      },
      {
        text: 'YOUR DAGGERS: PRESS X TO SWITCH TO THEM, THEN SPACE TO THROW. X AGAIN FOR THE SWORD.',
        touch: 'YOUR DAGGERS: SWAP SWITCHES TO THEM, THEN HIT THROWS. SWAP AGAIN FOR THE SWORD.',
      },
      {
        text: 'THE NEXT SHARD IS IN BOG GROTTO, IN THE MARSH TO THE WEST. I WILL FIND YOU THERE.',
      },
    ],
  },
  {
    // Bog Grotto's entrance: a hint about the grotto.
    id: 'dungeon2',
    map: 'dungeon2',
    room: DUNGEON_2_START,
    cell: { col: 4, row: 6 },
    speech: [
      { text: 'THIS IS BOG GROTTO. ITS GIANT FROG LEAPS AT YOU, AND NOTHING HITS IT IN THE AIR.' },
      { text: 'STRIKE WHEN IT LANDS. AND THORNS GROW DOWN HERE: YOUR FIREBALL BURNS THEM.' },
      { text: 'SOMEWHERE A MANA CRYSTAL IS HIDDEN. IT WILL MAKE YOUR MAGIC LAST LONGER.' },
    ],
  },
  {
    // Outside Bog Grotto, once its shard is found: the way on.
    id: 'dungeon2-done',
    map: 'overworld',
    room: { col: 1, row: 5 },
    cell: { col: 12, row: 3 },
    after: 'dungeon2/shard',
    speech: [
      { text: 'TWO SHARDS! SIX MORE TO FIND.' },
      {
        text: 'THE NEXT LIES IN SUNKEN CRYPT, IN THE RUINS EAST OF THE VAULT. ITS DEAD DO NOT REST.',
      },
    ],
  },
  {
    // Sunken Crypt's entrance: a hint about the crypt.
    id: 'dungeon3',
    map: 'dungeon3',
    room: DUNGEON_3_START,
    cell: { col: 4, row: 6 },
    speech: [
      { text: 'THIS IS SUNKEN CRYPT. ITS MUMMY IS WRAPPED TOO TIGHT FOR ANY BLADE.' },
      {
        text: 'LIGHTNING IS HIDDEN HERE. A BOLT STUNS ANY FOE, AND WAKES THE CRYSTAL SWITCHES IN THE WALLS.',
      },
    ],
  },
  {
    // Outside Sunken Crypt, once its shard is found: choosing spells, and the way on.
    id: 'dungeon3-done',
    map: 'overworld',
    room: { col: 5, row: 4 },
    cell: { col: 12, row: 3 },
    after: 'dungeon3/shard',
    speech: [
      { text: 'THREE SHARDS! FIVE MORE TO FIND.' },
      {
        text: 'YOU KNOW TWO SPELLS NOW. CHOOSE ONE IN YOUR BAG: PRESS I, THEN THE SPELL, THEN SPACE.',
        touch: 'YOU KNOW TWO SPELLS NOW. CHOOSE ONE IN YOUR BAG: BAG, THEN THE SPELL, THEN HIT.',
      },
      {
        text: 'THE NEXT SHARD IS IN STONECRAG MINE, IN THE MOUNTAINS TO THE NORTH. AN OGRE GUARDS IT.',
      },
    ],
  },
  {
    // Stonecrag Mine's entrance: a hint about the mine.
    id: 'dungeon4',
    map: 'dungeon4',
    room: DUNGEON_4_START,
    cell: { col: 4, row: 6 },
    speech: [
      { text: 'THIS IS STONECRAG MINE. ROCKFALLS BLOCK ITS TUNNELS.' },
      {
        text: "THE AXE HIDDEN HERE BREAKS ROCK. THE OGRE'S HIDE IS THICK: ONLY THE AXE WILL HURT IT.",
      },
    ],
  },
  {
    // Outside Stonecrag Mine, once its shard is found: secrets the Axe opens.
    id: 'dungeon4-done',
    map: 'overworld',
    room: { col: 3, row: 1 },
    cell: { col: 13, row: 4 },
    after: 'dungeon4/shard',
    speech: [
      { text: 'FOUR SHARDS: HALF THE STAR! I CAN FEEL IT GROWING WARM.' },
      {
        text: 'THE AXE BREAKS BOULDERS AND RUBBLE OUT HERE TOO. LOOK FOR SECRETS BEHIND THEM.',
      },
    ],
  },
];
