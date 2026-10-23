/**
 * Where Walker waits, and what he says (PROJECT.md §3f). Plain, friendly
 * text for young teens; upper case for the pixel font.
 */
import type { WalkerVisit } from '../logic/walker';
import { DUNGEON_1_START } from './dungeon1';
import { DUNGEON_2_START } from './dungeon2';
import { DUNGEON_3_START } from './dungeon3';
import { DUNGEON_4_START } from './dungeon4';
import { DUNGEON_5_START } from './dungeon5';
import { DUNGEON_6_START } from './dungeon6';
import { DUNGEON_7_START } from './dungeon7';
import { DUNGEON_8_START } from './dungeon8';
import { START_ROOM } from './overworld';

/** The Shadow Vault's door: two cells in the vault grounds' south-west room. */
export const VAULT_DOOR = {
  room: { col: 6, row: 6 },
  cells: [
    { col: 14, row: 3 },
    { col: 15, row: 3 },
  ],
} as const;

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
    room: { col: 6, row: 8 },
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
    room: { col: 2, row: 8 },
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
    room: { col: 10, row: 6 },
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
    room: { col: 6, row: 2 },
    cell: { col: 13, row: 4 },
    after: 'dungeon4/shard',
    speech: [
      { text: 'FOUR SHARDS: HALF THE STAR! I CAN FEEL IT GROWING WARM.' },
      {
        text: 'THE AXE BREAKS BOULDERS AND RUBBLE OUT HERE TOO. LOOK FOR SECRETS BEHIND THEM.',
      },
      {
        text: 'THE NEXT SHARD IS IN THUNDER SPIRE, IN THE MOUNTAINS TO THE NORTH-WEST. STORMS CIRCLE IT.',
      },
    ],
  },
  {
    // Thunder Spire's entrance: the Centaur, and the Ward.
    id: 'dungeon5',
    map: 'dungeon5',
    room: DUNGEON_5_START,
    cell: { col: 4, row: 6 },
    speech: [
      {
        text: 'THIS IS THUNDER SPIRE. ITS CENTAUR GALLOPS AT YOU WHEN YOU STAND IN LINE WITH IT.',
      },
      { text: 'IT CALLS DOWN LIGHTNING, TOO. DARK MARKS ON THE FLOOR SHOW WHERE BOLTS WILL FALL.' },
      {
        text: 'THE WARD IS HIDDEN HERE: A SPELL THAT GUARDS YOU ALL ROUND, AND CARRIES YOU THROUGH SPARKS.',
      },
    ],
  },
  {
    // Outside Thunder Spire, once its shard is found: raising the Ward, and the way on.
    id: 'dungeon5-done',
    map: 'overworld',
    room: { col: 4, row: 0 },
    cell: { col: 12, row: 3 },
    after: 'dungeon5/shard',
    speech: [
      { text: 'FIVE SHARDS! THREE MORE TO FIND.' },
      {
        text: 'CHOOSE THE WARD IN YOUR BAG, THEN PRESS C. FOR A MOMENT, NOTHING CAN HURT YOU.',
        touch: 'CHOOSE THE WARD IN YOUR BAG, THEN TAP MAGIC. FOR A MOMENT, NOTHING CAN HURT YOU.',
      },
      {
        text: 'THE NEXT SHARD IS IN WITCHWOOD TOWER, DEEP IN THE FOREST TO THE SOUTH-WEST.',
      },
    ],
  },
  {
    // Witchwood Tower's entrance: the Witch, and the Steel Sword.
    id: 'dungeon6',
    map: 'dungeon6',
    room: DUNGEON_6_START,
    cell: { col: 4, row: 6 },
    speech: [
      {
        text: 'THIS IS WITCHWOOD TOWER. ITS WITCH BLINKS FROM PLACE TO PLACE, THROWING FIRE.',
      },
      { text: 'HURT, SHE MAKES COPIES OF HERSELF. ONLY THE REAL WITCH CAN BE HARMED.' },
      {
        text: 'THE STEEL SWORD IS HIDDEN HERE. IT STRIKES HARDER, AND SENDS SHOTS BACK THE WAY YOU FACE.',
      },
    ],
  },
  {
    // Outside Witchwood Tower, once its shard is found: eye statues, and the way on.
    id: 'dungeon6-done',
    map: 'overworld',
    room: { col: 0, row: 3 },
    cell: { col: 12, row: 3 },
    after: 'dungeon6/shard',
    speech: [
      { text: 'SIX SHARDS! TWO MORE TO FIND.' },
      {
        text: 'STONE EYES WATCH FROM SOME WALLS. SEND AN ORB BACK INTO ONE, AND IT SHUTS FOR GOOD.',
      },
      {
        text: 'THE NEXT SHARD IS IN CRIMSON MANOR, IN THE RUINS FAR EAST OF THE VAULT.',
      },
    ],
  },
  {
    // Crimson Manor's entrance: the Vampire, and the Triple Daggers.
    id: 'dungeon7',
    map: 'dungeon7',
    room: DUNGEON_7_START,
    cell: { col: 4, row: 6 },
    speech: [
      {
        text: 'THIS IS CRIMSON MANOR. ITS VAMPIRE GLIDES AFTER YOU. ITS TOUCH DRAINS YOU, AND HEALS IT.',
      },
      { text: 'NOW AND THEN IT BURSTS INTO DARK SHOTS, AND FORMS AGAIN SOMEWHERE ELSE.' },
      { text: 'THE TRIPLE DAGGERS ARE HIDDEN HERE: THREE BLADES AT A THROW.' },
    ],
  },
  {
    // Outside Crimson Manor, once its shard is found: the way to the last dungeon.
    id: 'dungeon7-done',
    map: 'overworld',
    room: { col: 12, row: 5 },
    cell: { col: 12, row: 3 },
    after: 'dungeon7/shard',
    speech: [
      { text: 'SEVEN SHARDS! ONLY ONE MORE.' },
      {
        text: "THE LAST SHARD IS IN DRAGON'S MAW, ON THE VOLCANO'S EDGE IN THE FAR NORTH-EAST.",
      },
      { text: 'A DRAGON GUARDS IT. REST, FILL YOUR POTIONS, AND BE READY.' },
    ],
  },
  {
    // Dragon's Maw's entrance: the Dragon, and the Star Blade.
    id: 'dungeon8',
    map: 'dungeon8',
    room: DUNGEON_8_START,
    cell: { col: 4, row: 6 },
    speech: [
      {
        text: "THIS IS DRAGON'S MAW. ITS DRAGON SWEEPS FIRE ACROSS ITS LAIR: HOLD UP YOUR SHIELD, OR RAISE THE WARD.",
      },
      { text: 'STAND TOO CLOSE AND ITS TAIL LASHES OUT. WHEN IT TURNS, STEP BACK.' },
      {
        text: 'THE STAR BLADE IS HIDDEN HERE. WITH EVERY HEART FULL, ITS SWING SENDS OUT A BEAM.',
      },
    ],
  },
  {
    // Outside Dragon's Maw, once the last shard is found: on to the Shadow Vault.
    id: 'dungeon8-done',
    map: 'overworld',
    room: { col: 14, row: 0 },
    cell: { col: 12, row: 3 },
    after: 'dungeon8/shard',
    speech: [
      { text: 'ALL EIGHT SHARDS! THE STAR OF POWER IS WHOLE AGAIN. I CAN FEEL IT SHINE.' },
      { text: 'NOW, THE SHADOW VAULT, IN THE MIDDLE OF THE LAND. MEET ME AT ITS DOOR.' },
      { text: 'KIRA IS WAITING, JARRETT. AND SO IS THE SORCERER.' },
    ],
  },
  {
    // The Shadow Vault's door, once all 8 shards are found: his last words, and the Star opens it.
    id: 'vault',
    map: 'overworld',
    room: VAULT_DOOR.room,
    cell: { col: 12, row: 4 },
    after: 'dungeon8/shard',
    opens: VAULT_DOOR.cells,
    speech: [
      {
        text: 'HERE IT IS: THE SHADOW VAULT. KIRA IS INSIDE, AND SO IS THE SORCERER WHO TOOK HER.',
      },
      {
        text: 'A SHIELD OF DARK MAGIC GUARDS HIM. SWING YOUR SWORD AT HIS OWN MAGIC TO SEND IT BACK, AND THE SHIELD WILL BREAK.',
      },
      { text: 'HURT HIM BADLY, AND HE WILL SHOW HIS TRUE SHAPE. DO NOT BE AFRAID.' },
      { text: 'I CANNOT GO IN WITH YOU. BUT THE STAR GOES WITH YOU, AND SO DO I.' },
      { text: 'STAR OF POWER... OPEN THE WAY!' },
    ],
  },
  {
    // Princess Kira, in her cell at the top of the sorcerer's hall. Once the sorcerer is
    // beaten, his gates open and she is free; Walker comes, the Star is whole, and the
    // ending follows.
    id: 'kira',
    map: 'vault',
    room: { col: 1, row: 1 },
    cell: { col: 10, row: 3 },
    who: 'kira',
    speaksAfter: 'vault/1,1/boss',
    ends: true,
    speech: [
      {
        who: 'KIRA',
        text: 'YOU BEAT HIM! I HEARD EVERY BLOW FROM IN HERE. YOU MUST BE JARRETT. WALKER SAID YOU WOULD COME.',
      },
      { who: 'KIRA', text: 'THANK YOU. I THOUGHT NO ONE WOULD EVER OPEN THAT GATE.' },
      {
        who: 'WALKER',
        text: 'WELL DONE, JARRETT. THE SORCERER IS GONE FOR GOOD, AND KIRA IS FREE.',
      },
      {
        who: 'WALKER',
        text: 'THE EIGHT SHARDS ARE ONE AGAIN. THE STAR OF POWER SHINES OVER THE WHOLE LAND.',
      },
      { who: 'KIRA', text: 'THEN LET US GO HOME, ALL THREE OF US.' },
    ],
  },
];
