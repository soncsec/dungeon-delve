import type { BossKind, BossStats } from '../logic/boss';
import type { EnemyKind, EnemyStats } from '../logic/enemies';
import type { SoundRecipe } from '../logic/sfx';

/** All gameplay numbers live here so they can be tuned in one place. */

/** The screen (ADR-D02): a status bar over one room of 20×10 tiles of 16 px = 320×180. */
export const TILE = 16;
export const ROOM_COLS = 20;
export const ROOM_ROWS = 10;
export const HUD_HEIGHT = 20;
export const GAME_WIDTH = ROOM_COLS * TILE;
export const GAME_HEIGHT = HUD_HEIGHT + ROOM_ROWS * TILE;
/** How long the view takes to slide to the next room, in ms. */
export const ROOM_SLIDE_MS = 500;

/** Jarrett. */
export const HERO = {
  /** Walking speed, pixels per second (about 3.6 s to cross a room). */
  speed: 88,
  /** Collision box at the feet: 10 px wide, 6 px tall, so his head can overlap walls above. */
  box: { halfWidth: 5, height: 6 },
  /** The walk sheet's 32×32 frames have the feet at y = 30. */
  frameHeight: 32,
  feetY: 30,
  /** First frame of each walk row: what he shows standing still. */
  standFrame: { down: 0, right: 4, up: 8 },
  /** Start position in the start room: feet on the line between columns 9 and 10, in row 5. */
  start: { col: 10, row: 5, lift: 2 },
} as const;

/** The sword: how far it reaches from Jarrett's body, and how long a swing lasts. */
export const SWORD = {
  reach: 16,
  sweep: 20,
  bodyHeight: 20,
  bodyHalfWidth: 4,
  durationMs: 250,
  /** Health a hit takes from an enemy. */
  damage: 1,
} as const;

/** The throwing dagger, Jarrett's first far weapon. */
export const DAGGER = {
  /** Pixels per second, and how far it flies before dropping out of sight. */
  speed: 220,
  range: 150,
  /** Hit box: long along its flight, thin across it. */
  length: 12,
  thickness: 6,
  /** At most this many in the air at once, and this long between throws (ms). */
  maxInFlight: 2,
  cooldownMs: 300,
  /** Jarrett stands still this long after a throw (ms). */
  throwPauseMs: 120,
  /** Health a hit takes from an enemy. */
  damage: 1,
} as const;

/** Potions: the most of each Jarrett can carry, and what he starts with. */
export const POTIONS = {
  max: 3,
  /** M2 only, so they can be tried before chests and the shop exist (M3, M4). */
  start: { health: 1, mana: 1 },
} as const;

/** Mana for spells: refills by itself after a pause; a Mana Brew speeds it up (M2.3). */
export const MANA = {
  max: 100,
  /** Mana per second while refilling (empty to full in about 8 s). */
  perSecond: 12,
  /** Refilling starts this long after the last cast (ms). */
  delayMs: 1200,
  /** A Mana Brew makes refilling this many times faster, for this long (ms). */
  boostFactor: 3,
  boostMs: 30_000,
  /** Each Mana Crystal (Bog Grotto's prize) raises the most mana he can hold by this much. */
  crystalBonus: 50,
} as const;

/** The Fireball spell. */
export const FIREBALL = {
  cost: 25,
  speed: 160,
  range: 200,
  length: 16,
  thickness: 10,
  /** Two damage: one fireball defeats a robot, a bird or a flying eye. */
  damage: 2,
  /** One in the air at a time. */
  maxInFlight: 1,
  cooldownMs: 0,
  /** Jarrett stands still this long while casting (ms). */
  castPauseMs: 200,
} as const;

/**
 * The Lightning spell (Sunken Crypt's prize, owner 2026-10-21): a fast bolt that
 * stuns the enemy it hits instead of hurting it, and powers crystal switches.
 */
export const LIGHTNING = {
  cost: 30,
  speed: 240,
  range: 240,
  length: 16,
  thickness: 10,
  damage: 0,
  maxInFlight: 1,
  cooldownMs: 0,
  castPauseMs: 200,
  /** How long a struck enemy stands stunned (ms): it can't move, shoot or hurt by touch. */
  stunMs: 3000,
  /** A stunned enemy flickers pale blue, on and off this often (ms). */
  flickerMs: 120,
} as const;

/**
 * The Ward spell (Thunder Spire's prize, owner 2026-10-21): a bubble round
 * Jarrett that blocks all damage for a few seconds, and lets him walk through
 * spark barriers. It can't be cast again while it is up.
 */
export const WARD = {
  cost: 40,
  /** How long it lasts (ms). */
  ms: 3000,
  /** For its last part it breaks up, as a warning that it is about to drop (ms). */
  breakMs: 400,
  castPauseMs: 200,
  /** The bubble's middle sits this far above his feet, round his body (px). */
  bubbleLift: 14,
  /** Where the bubble's middle is in its 51×47 frame (it isn't the frame's middle), as origin fractions. */
  bubbleOrigin: { x: 23.5 / 51, y: 26.5 / 47 },
  /** Drawn see-through, so he shows inside it (the art flashes solid once a cycle). */
  bubbleAlpha: 0.6,
} as const;

/** A spark barrier: touching one without the Ward zaps Jarrett (half hearts). */
export const SPARK = { damage: 1 } as const;

/**
 * The Triple Daggers (Crimson Manor's prize, owner 2026-10-22): a fan of
 * three daggers (each flies as a dagger does), thrown faster.
 */
export const TRIPLE_DAGGERS = {
  spreadDeg: 14,
  maxInFlight: 6,
  cooldownMs: 220,
  throwPauseMs: 100,
} as const;

/**
 * Near weapons: what a blow costs an enemy, and whether a swing bats enemy
 * shots back the way Jarrett faces (the Steel Sword: owner 2026-10-22).
 */
export const BLADES = {
  'wooden-sword': { damage: 1, bats: false, beam: false },
  'steel-sword': { damage: 2, bats: true, beam: false },
  'star-blade': { damage: 3, bats: true, beam: true },
  axe: { damage: 1, bats: false, beam: false },
} as const;

/** The Star Blade's beam (owner 2026-10-22): with every heart full, a swing also sends one flying ahead. */
export const BEAM = {
  speed: 240,
  range: 200,
  length: 14,
  thickness: 8,
  damage: 2,
  maxInFlight: 1,
  cooldownMs: 0,
} as const;

/** A shot batted back: it flies the way Jarrett faces, and hurts what it hits (or shuts an eye statue). */
export const BATTED = {
  speed: 170,
  range: 240,
  length: 10,
  thickness: 10,
  damage: 1,
  maxInFlight: 99,
  cooldownMs: 0,
} as const;

/** Eye statues (Steel Sword puzzles): each fires an orb straight out this often (ms), the first a little later. */
export const EYE_STATUE = { everyMs: 1800, firstMs: { min: 600, max: 1400 } } as const;

/** Jarrett's health, in half hearts (2 per heart). */
export const HEALTH = {
  startHearts: 3,
  /** After a hit, further damage is ignored for this long (ms); he blinks meanwhile. */
  invulnerableMs: 1000,
  /** A hit pushes him away from the enemy. */
  knockback: { speed: 140, ms: 150 },
} as const;

/** Every enemy kind: how it moves, how tough it is, and what it does to Jarrett (PROJECT.md §3d). */
export const ENEMIES: Readonly<Record<EnemyKind, EnemyStats>> = {
  // Wanders the forest floor. Two sword hits.
  robot: {
    behaviour: 'wander',
    health: 2,
    contactDamage: 1,
    speed: 30,
    box: { halfWidth: 7, height: 10 },
    flies: false,
    turnMs: { min: 600, max: 1600 },
    knockback: { speed: 160, ms: 150 },
  },
  // Flutters fast and erratically over trees and walls. One hit.
  bird: {
    behaviour: 'flutter',
    health: 1,
    contactDamage: 1,
    speed: 55,
    box: { halfWidth: 9, height: 14 },
    flies: true,
    turnMs: { min: 300, max: 800 },
    knockback: { speed: 160, ms: 120 },
  },
  // Drifts slowly straight at Jarrett, through walls. Three hits.
  ghost: {
    behaviour: 'drift',
    health: 3,
    contactDamage: 1,
    speed: 18,
    box: { halfWidth: 10, height: 22 },
    flies: true,
    turnMs: { min: 1000, max: 1000 },
    knockback: { speed: 120, ms: 150 },
  },
  // Keeps its distance, circling, and shoots at Jarrett every 2–3 s. Two hits.
  eye: {
    behaviour: 'hover',
    health: 2,
    contactDamage: 1,
    speed: 26,
    box: { halfWidth: 10, height: 18 },
    flies: true,
    turnMs: { min: 1000, max: 1000 },
    knockback: { speed: 160, ms: 150 },
    keep: { near: 64, far: 112 },
    shootMs: { min: 2000, max: 3000 },
  },
  // Prowls, and charges when Jarrett is in line with it; a full heart if it hits. Three hits.
  wolf: {
    behaviour: 'charge',
    health: 3,
    contactDamage: 2,
    speed: 28,
    box: { halfWidth: 14, height: 12 },
    flies: false,
    turnMs: { min: 600, max: 1600 },
    knockback: { speed: 140, ms: 150 },
    charge: { speed: 130, ms: 900, sight: 140, inLine: 8, restMs: 900 },
  },
  // The marsh: slithers about, and when Jarrett is in line, spits venom along it, then coils
  // a moment. Two hits.
  snake: {
    behaviour: 'spit',
    health: 2,
    contactDamage: 1,
    speed: 24,
    box: { halfWidth: 7, height: 10 },
    flies: false,
    turnMs: { min: 600, max: 1600 },
    knockback: { speed: 160, ms: 150 },
    spit: { sight: 128, inLine: 8, restMs: 1400 },
    shotKind: 'venom',
  },
  // The ruins: plods about, and every few seconds puffs a ring of spores that drift a little
  // way. Three hits.
  mushroom: {
    behaviour: 'puff',
    health: 3,
    contactDamage: 1,
    speed: 14,
    box: { halfWidth: 9, height: 14 },
    flies: false,
    turnMs: { min: 900, max: 2000 },
    knockback: { speed: 120, ms: 150 },
    shootMs: { min: 2600, max: 3600 },
    puff: { shots: 6 },
    shotKind: 'spore',
  },
  // The marsh and the mountains: sits, then hops at Jarrett. Two hits.
  toad: {
    behaviour: 'leap',
    health: 2,
    contactDamage: 1,
    speed: 0,
    box: { halfWidth: 9, height: 14 },
    flies: false,
    turnMs: { min: 1000, max: 1000 },
    knockback: { speed: 140, ms: 150 },
    leap: { speed: 120, ms: 350, restMs: { min: 700, max: 1300 } },
  },
};

/** Falling (out of hearts): the screen fades out and back in, and he drops a share of his gems. */
export const DEATH = {
  gemLossPercent: 10,
  fadeOutMs: 600,
  /** How long the dark screen and the message stay. */
  darkMs: 1400,
  fadeInMs: 400,
} as const;

/** Travelling through a doorway to another map: the fade out, and in again (ms each). */
export const TRAVEL = { fadeMs: 250 } as const;

/** Pushable stones: lean on one this long (ms) to slide it a cell, taking this long to slide. */
export const STONE = { pushMs: 350, slideMs: 180 } as const;

/** The Wooden Shield: blocks shots arriving within 60° of straight at Jarrett's front. */
export const SHIELD = {
  /** Cosine of the widest angle it still covers (cos 60° = 0.5). */
  coverCos: 0.5,
} as const;

/** Bosses (PROJECT.md §3c). Their shots are the flying eye's (ENEMY_SHOT). */
export const BOSSES: Readonly<Record<BossKind, BossStats>> = {
  // Dungeon 1: a rooted plant that shuffles and spits seeds. Ten hits of the sword; a full heart on touch.
  treant: {
    health: 10,
    contactDamage: 2,
    box: { halfWidth: 18, height: 60 },
    moves: { style: 'shuffle', speed: 14, range: 48 },
    calm: { shots: 3, spreadDeg: 18, everyMs: { min: 2200, max: 2800 } },
    fierce: { shots: 5, spreadDeg: 16, everyMs: { min: 1500, max: 1900 } },
  },
  // Dungeon 2: a spear-carrying frog that leaps at Jarrett; each landing throws a ring of
  // shots (four, then eight). Twelve hits, none while it is in the air; a full heart on touch.
  frog: {
    health: 12,
    contactDamage: 2,
    box: { halfWidth: 14, height: 40 },
    moves: {
      style: 'hop',
      crouchMs: 500,
      leapMs: 700,
      reach: 96,
      peak: 28,
      // Its feet stay two cells clear of the walls, with its body below the top wall.
      arena: {
        x: 2 * TILE + 14,
        y: 2 * TILE + 40,
        w: ROOM_COLS * TILE - 4 * TILE - 28,
        h: 8 * TILE - (2 * TILE + 40),
      },
    },
    calm: { shots: 4, spreadDeg: 90, everyMs: { min: 1400, max: 2000 } },
    fierce: { shots: 8, spreadDeg: 45, everyMs: { min: 900, max: 1300 } },
  },
  // Dungeon 3: a Mummy, wrapped tight, that shambles after Jarrett firing spreads. Sword,
  // daggers and fire glance off until a Lightning bolt stuns it (3 s); then ten hits beat it.
  mummy: {
    health: 10,
    contactDamage: 2,
    box: { halfWidth: 14, height: 44 },
    moves: {
      style: 'shamble',
      speed: 16,
      arena: {
        x: 2 * TILE + 14,
        y: 2 * TILE + 44,
        w: ROOM_COLS * TILE - 4 * TILE - 28,
        h: 8 * TILE - (2 * TILE + 44),
      },
    },
    calm: { shots: 3, spreadDeg: 20, everyMs: { min: 2000, max: 2600 } },
    fierce: { shots: 5, spreadDeg: 18, everyMs: { min: 1400, max: 1800 } },
    wrapped: { stunMs: 3000 },
  },
  // Dungeon 4: a two-headed Ogre that lumbers side to side, raises its club, and slams it
  // down in a ring of shockwaves (eight, then twelve). Its hide stops all but the Axe.
  ogre: {
    health: 10,
    contactDamage: 2,
    box: { halfWidth: 24, height: 64 },
    moves: { style: 'shuffle', speed: 10, range: 48 },
    windUpMs: 700,
    ring: true,
    calm: { shots: 8, spreadDeg: 45, everyMs: { min: 2400, max: 3000 } },
    fierce: { shots: 12, spreadDeg: 30, everyMs: { min: 1600, max: 2000 } },
    hide: 'axe',
  },
  // Dungeon 5: paces, gallops at Jarrett when he is level with it, and rears to call down a
  // storm of lightning (STORM; owner 2026-10-22). Any weapon hurts it.
  centaur: {
    health: 12,
    contactDamage: 2,
    box: { halfWidth: 22, height: 64 },
    moves: {
      style: 'gallop',
      speed: 18,
      dashSpeed: 140,
      dashMs: 1000,
      sight: 220,
      inLine: 12,
      restMs: 900,
      arena: { x: 52, y: 72, w: 216, h: 52 },
    },
    windUpMs: 900,
    storm: true,
    calm: { shots: 0, spreadDeg: 0, everyMs: { min: 2600, max: 3400 } },
    fierce: { shots: 0, spreadDeg: 0, everyMs: { min: 1800, max: 2400 } },
  },
  // Dungeon 6: blinks from spot to spot throwing fire; below half health two look-alike decoys
  // appear with her (owner 2026-10-22). Any weapon hurts her; a blow pops a decoy.
  witch: {
    health: 10,
    contactDamage: 2,
    box: { halfWidth: 14, height: 60 },
    moves: {
      style: 'blink',
      stayMs: { min: 2200, max: 3200 },
      goneMs: 600,
      // Five spots across the room, 52 px apart (her body is 28 wide), so no two figures overlap.
      spots: [
        { x: 56, y: 96 },
        { x: 108, y: 120 },
        { x: 160, y: 96 },
        { x: 212, y: 120 },
        { x: 264, y: 96 },
      ],
      decoys: 2,
    },
    shotKind: 'fire',
    calm: { shots: 3, spreadDeg: 20, everyMs: { min: 1400, max: 2000 } },
    fierce: { shots: 3, spreadDeg: 25, everyMs: { min: 1100, max: 1600 } },
  },
  // Dungeon 7: glides after Jarrett, draining him on touch (and healing itself); now and then it
  // bursts into a ring of dark shots and re-forms elsewhere, sooner below half health
  // (owner 2026-10-22). Any weapon hurts it. `everyMs` is how long it stays before bursting.
  vampire: {
    health: 12,
    contactDamage: 1,
    drain: 1,
    box: { halfWidth: 20, height: 56 },
    moves: {
      style: 'swarm',
      speed: 26,
      goneMs: 700,
      spots: [
        { x: 64, y: 96 },
        { x: 160, y: 80 },
        { x: 256, y: 96 },
        { x: 96, y: 124 },
        { x: 224, y: 124 },
      ],
      arena: { x: 52, y: 72, w: 216, h: 52 },
    },
    shotKind: 'dark',
    calm: { shots: 8, spreadDeg: 45, everyMs: { min: 3600, max: 4400 } },
    fierce: { shots: 12, spreadDeg: 30, everyMs: { min: 2200, max: 2800 } },
  },
  // Dungeon 8: the Dragon (owner 2026-10-22: fire breath and tail). It prowls the top of its lair
  // facing Jarrett; it rears, then sweeps its fire across him (the Ward, or the Iron Shield from the
  // front, stops it), and close by, its tail lashes all round it. Fierce: more fire, more often.
  // Any weapon hurts it: six blows of the Star Blade.
  dragon: {
    health: 18,
    contactDamage: 2,
    box: { halfWidth: 30, height: 34 },
    moves: {
      style: 'prowl',
      speed: 16,
      gapMs: 90,
      tail: { reach: 28, ms: 700, hurtFromMs: 350, restMs: 1200, damage: 2 },
      arena: { x: 72, y: 80, w: 176, h: 0 },
    },
    windUpMs: 600,
    shotKind: 'fire',
    mouth: { ahead: 32, up: 26 },
    calm: { shots: 5, spreadDeg: 14, everyMs: { min: 2600, max: 3400 } },
    fierce: { shots: 8, spreadDeg: 11, everyMs: { min: 1500, max: 2100 } },
  },
  // The Shadow Vault: the Sorcerer (owner 2026-10-22). He blinks between four spots along the foot
  // of his hall (his art is 118 px tall, so he stands low to stay in view), casting orbs of magic
  // at Jarrett from behind a shield of dark magic that turns every blow. One of his orbs batted
  // back into him (the Steel Sword or the Star Blade) breaks it for 4 s; then any weapon hurts him.
  sorcerer: {
    health: 24,
    contactDamage: 2,
    box: { halfWidth: 14, height: 64 },
    moves: {
      style: 'blink',
      stayMs: { min: 2600, max: 3600 },
      goneMs: 700,
      // 52 px apart or more (his body is 28 wide).
      spots: [
        { x: 48, y: 126 },
        { x: 100, y: 126 },
        { x: 220, y: 126 },
        { x: 272, y: 126 },
      ],
      decoys: 0,
    },
    shotKind: 'magic',
    shield: { bareMs: 4000 },
    // At half his health he shows his true shape (below), so he is never fierce himself.
    becomes: { kind: 'demon', atHealth: 12 },
    calm: { shots: 1, spreadDeg: 0, everyMs: { min: 1300, max: 1900 } },
    fierce: { shots: 1, spreadDeg: 0, everyMs: { min: 1300, max: 1900 } },
  },
  // The Sorcerer's true shape (owner 2026-10-22), taking over at half his health with what he has
  // left (the bar goes on). Its art, the pack's horned demon, is scaled to 80% so it stays in view
  // (owner 2026-10-22; tools/art/scale_demon.py): it roams the foot of the hall, charging at Jarrett
  // when he is level with it, and crouches, then throws a ring of fire. No shield: any weapon hurts.
  demon: {
    health: 24,
    contactDamage: 2,
    box: { halfWidth: 20, height: 84 },
    moves: {
      style: 'gallop',
      speed: 24,
      dashSpeed: 150,
      dashMs: 900,
      sight: 240,
      inLine: 14,
      restMs: 900,
      // Its 115 px art stays in view with its feet at y 117 or lower.
      arena: { x: 56, y: 118, w: 208, h: 8 },
    },
    windUpMs: 600,
    shotKind: 'fire',
    // It starts at half health, so it is always fierce.
    calm: { shots: 10, spreadDeg: 36, everyMs: { min: 2200, max: 3000 } },
    fierce: { shots: 10, spreadDeg: 36, everyMs: { min: 2200, max: 3000 } },
  },
};

/**
 * The Centaur's storm (logic/storm.ts): bolts strike 2×2-cell patches of its
 * room's floor (cells 2-17 across, 2-7 down) this long after their marks
 * appear, each costing this many half hearts. Calm, the patch under Jarrett
 * and `others` more; fierce, all but one.
 */
export const STORM = {
  delayMs: 800,
  damage: 2,
  others: 3,
  arena: { x: 2, y: 2, across: 8, down: 3 },
  /** The marks are shadows on the floor, not holes in it. */
  markAlpha: 0.55,
} as const;

/** Overworld enemies come back once Jarrett has been through this many other rooms (owner 2026-10-21). */
export const RESPAWN = { roomsAway: 4 } as const;

/** The village shop's prices, in gems (owner 2026-10-21). */
export const SHOP = {
  prices: { 'health-potion': 10, 'mana-brew': 15, 'iron-shield': 80 },
} as const;

/** Talking (Walker): the text box holds this many characters a line, and lines a page. */
export const DIALOGUE = { width: 36, lines: 3 } as const;

/** The Star of Power: one shard per dungeon. The message on finding one stays up this long (ms). */
export const STAR = { shards: 8, messageMs: 2500 } as const;

/** Where a beaten boss's heart container and shard appear, from where it stood (px). */
export const BOSS_REWARDS = { heart: { dx: -24, dy: 24 }, shard: { dx: 24, dy: 24 } } as const;

/** A boss flashes this long (ms) when hit; its health bar sits along the bottom of the room. */
export const BOSS_FX = {
  flashMs: 150,
  barWidth: 120,
  barHeight: 4,
  /** A leaper squats this much while it crouches, and casts this shadow while in the air. */
  crouch: { x: 1.08, y: 0.9 },
  shadow: { height: 8, alpha: 0.35 },
  /** A storm-caller rears up this much while it winds up (the warning). */
  rear: { x: 0.95, y: 1.08 },
  /** A shielded boss's shield: the Ward's bubble at three times its size, see-through, its middle this far above the boss's feet (px). */
  shield: { scale: 3, alpha: 0.55, lift: 60 },
} as const;

/** The flying eye's shot. */
export const ENEMY_SHOT = {
  speed: 110,
  range: 240,
  size: 6,
  /** Half hearts. */
  damage: 1,
} as const;

/** Each kind of enemy shot: the eye's orb, the snake's venom (fast), the mushroom's spores (slow, short), the Witch's fire, the Vampire's dark shots, the Sorcerer's magic. */
export const ENEMY_SHOTS = {
  orb: ENEMY_SHOT,
  venom: { speed: 150, range: 160, size: 6, damage: 1 },
  spore: { speed: 40, range: 44, size: 8, damage: 1 },
  fire: { speed: 120, range: 260, size: 10, damage: 2 },
  dark: { speed: 90, range: 220, size: 8, damage: 1 },
  // The Sorcerer's magic: slow enough to meet with the sword and send back.
  magic: { speed: 80, range: 280, size: 8, damage: 2 },
} as const;

/**
 * Holding up a find (owner 2026-10-22): from a chest, or a boss's heart
 * container and shard. He faces you with it over his head while the game waits.
 */
export const HOLD_UP = {
  ms: 1500,
  /** The find's middle sits this far above his feet, just over his head (px; he is about 27 tall). */
  lift: 36,
} as const;

/** What a defeated enemy drops, in whole percent (the rest drops nothing). */
export const DROPS = { gem: 40, heart: 20 } as const;

/** Pickups: what they're worth. A small heart restores this many half hearts. */
export const PICKUPS = { gemValue: 1, heartHeals: 2 } as const;

/** The status bar along the top. */
export const HUD = {
  /** CSS font family; Press Start 2P is drawn at 8 px, its native size. */
  font: '"Press Start 2P"',
  /** First heart's left edge, and the distance between hearts (the small heart art is 11 px wide). */
  heartX: 1,
  heartSpacing: 12,
  /** Hearts per row; a second row starts below (all 14 hearts fit in 84 × 20 px). */
  heartsPerRow: 7,
  /** Where each row of hearts sits: the top of the 16-px heart frame (the art is 9 px tall). */
  heartRowY: [-4, 6],
  /** The small-key count, shown in dungeons only, right of the hearts. */
  keyX: 92,
  /** Left edges of the mana bar, the potion counts and the weapon box. */
  manaBarX: 142,
  manaBarWidth: 44,
  healthPotionX: 189,
  manaPotionX: 213,
  weaponBoxX: 240,
  /** The most gems the bar shows. */
  maxGems: 999,
} as const;

/** The on-screen pad (phones and tablets): no arrow is held within this share of its radius. */
export const TOUCH = { deadZone: 0.25 } as const;

/** Every sound effect, by name. */
export type SfxName =
  | 'swing'
  | 'hit'
  | 'defeat'
  | 'hurt'
  | 'gem'
  | 'heart'
  | 'potion'
  | 'throw'
  | 'cast'
  | 'block'
  | 'enemyShot'
  | 'fall'
  | 'noMana'
  | 'menu'
  | 'unlock'
  | 'chest'
  | 'push'
  | 'shard'
  | 'hollow'
  | 'crumble'
  | 'burn'
  | 'zap'
  | 'switch'
  | 'ward'
  | 'spark'
  | 'found'
  | 'rumble'
  | 'thunder'
  | 'bat';

/** Sound effects made in code (owner 2026-10-20; engine from Star Destroyer, no sound files). */
export const SFX: { volume: number; sounds: Readonly<Record<SfxName, SoundRecipe>> } = {
  /** Master volume, under the browser's own. */
  volume: 0.5,
  sounds: {
    // A quick airy swish.
    swing: { wave: 'noise', seconds: 0.12, from: 4000, to: 1200, attack: 0.01, volume: 0.3 },
    // Blade meets enemy: a short bright knock.
    hit: { wave: 'square', seconds: 0.1, from: 520, to: 260, attack: 0.002, volume: 0.35 },
    // The puff: a burst of noise falling away.
    defeat: { wave: 'noise', seconds: 0.3, from: 2600, to: 300, attack: 0.002, volume: 0.45 },
    hurt: { wave: 'sawtooth', seconds: 0.25, from: 300, to: 90, attack: 0.003, volume: 0.4 },
    // Pickups climb: a two-note blip for gems, a soft chime for hearts, a bubbly rise for potions.
    gem: {
      wave: 'square',
      seconds: 0.12,
      from: 988,
      to: 988,
      attack: 0.002,
      volume: 0.3,
      steps: [1, 1.5],
    },
    heart: {
      wave: 'sine',
      seconds: 0.3,
      from: 587,
      to: 587,
      attack: 0.005,
      volume: 0.4,
      steps: [1, 1.26, 1.5, 2],
    },
    potion: { wave: 'triangle', seconds: 0.35, from: 300, to: 900, attack: 0.01, volume: 0.4 },
    throw: { wave: 'noise', seconds: 0.1, from: 6000, to: 2500, attack: 0.005, volume: 0.28 },
    // A whooshing roar rising, then gone.
    cast: { wave: 'sawtooth', seconds: 0.3, from: 120, to: 420, attack: 0.03, volume: 0.35 },
    // A metallic clink.
    block: { wave: 'square', seconds: 0.11, from: 1500, to: 1400, attack: 0.001, volume: 0.3 },
    enemyShot: { wave: 'triangle', seconds: 0.14, from: 700, to: 350, attack: 0.004, volume: 0.3 },
    // A long sad slide down.
    fall: { wave: 'triangle', seconds: 0.9, from: 440, to: 110, attack: 0.01, volume: 0.45 },
    // Not enough mana: a dull low buzz.
    noMana: { wave: 'square', seconds: 0.15, from: 110, to: 100, attack: 0.005, volume: 0.25 },
    // Inventory open, close and cursor.
    menu: { wave: 'square', seconds: 0.1, from: 660, to: 880, attack: 0.002, volume: 0.25 },
    // A door unlocking: a low clunk then a lift.
    unlock: {
      wave: 'square',
      seconds: 0.25,
      from: 180,
      to: 360,
      attack: 0.003,
      volume: 0.35,
      steps: [1, 1.5],
    },
    // A stone scraping across the floor.
    push: { wave: 'noise', seconds: 0.2, from: 900, to: 300, attack: 0.02, volume: 0.35 },
    // A chest opening, or a key or item found: a bright little fanfare.
    chest: {
      wave: 'triangle',
      seconds: 0.45,
      from: 523,
      to: 523,
      attack: 0.005,
      volume: 0.4,
      steps: [1, 1.26, 1.5, 2, 2.52],
    },
    // A shard of the Star of Power: a longer, rising fanfare.
    shard: {
      wave: 'square',
      seconds: 1.2,
      from: 392,
      to: 392,
      attack: 0.005,
      volume: 0.35,
      steps: [1, 1.26, 1.5, 2, 1.5, 2, 2.52, 3],
    },
    // A false wall struck with the sword: a hollow wooden tok.
    hollow: { wave: 'triangle', seconds: 0.12, from: 260, to: 180, attack: 0.002, volume: 0.45 },
    // A false wall crumbling open: a rumble of noise falling away.
    crumble: { wave: 'noise', seconds: 0.45, from: 1200, to: 120, attack: 0.005, volume: 0.45 },
    // Thorns burning: a crackling rush of noise rising.
    burn: { wave: 'noise', seconds: 0.5, from: 500, to: 3000, attack: 0.05, volume: 0.4 },
    // Lightning: a crackling buzz as the bolt flies, and a rising chime when a crystal switch lights.
    zap: { wave: 'sawtooth', seconds: 0.3, from: 1800, to: 300, attack: 0.005, volume: 0.25 },
    switch: {
      wave: 'triangle',
      seconds: 0.45,
      from: 660,
      to: 660,
      attack: 0.01,
      volume: 0.35,
      steps: [1, 1.5, 2],
    },
    // The Ward going up: a soft shimmering rise; a spark barrier's zap: a harsh crackle.
    ward: {
      wave: 'sine',
      seconds: 0.5,
      from: 440,
      to: 880,
      attack: 0.02,
      volume: 0.35,
      steps: [1, 1.5, 2, 1.5, 2],
    },
    spark: { wave: 'noise', seconds: 0.25, from: 5000, to: 1500, attack: 0.002, volume: 0.35 },
    // A find held up: a bright rising jingle, its last note held (owner 2026-10-22).
    found: {
      wave: 'square',
      seconds: 1.1,
      from: 523,
      to: 523,
      attack: 0.005,
      volume: 0.3,
      steps: [1, 1.26, 1.5, 1.68, 2, 2],
    },
    // The Centaur's storm: a low rumble as the marks go down, a sharp crack as the bolts strike.
    rumble: { wave: 'noise', seconds: 0.7, from: 180, to: 90, attack: 0.15, volume: 0.4 },
    thunder: { wave: 'noise', seconds: 0.45, from: 3500, to: 200, attack: 0.002, volume: 0.45 },
    // A shot batted back with the Steel Sword: a bright ringing ping.
    bat: { wave: 'square', seconds: 0.16, from: 1300, to: 2100, attack: 0.002, volume: 0.3 },
  },
};

/**
 * The automated frame-rate check (M2.9): the work for one frame (update and
 * render) must fit in a 60 fps frame. The median gets half the frame, leaving
 * room for the browser, and 95% of frames must fit in a whole one.
 */
export const FRAME_BUDGET = {
  frameMs: 1000 / 60,
  medianMs: 1000 / 60 / 2,
  p95Ms: 1000 / 60,
  /**
   * Linux WebKit (Safari's engine in the tests) has slow-frame spikes that say
   * little about Safari itself (64–100 ms for its slowest 5% even on GitHub's
   * runners), so it is held to the median only (owner, 2026-10-20). Real Safari
   * is checked on the owner's iPhone.
   */
  webkit: { medianMs: 1000 / 60 / 2, p95Ms: Number.POSITIVE_INFINITY },
} as const;

/** Seed for the random number generator; override with ?seed= in the URL. */
export const DEFAULT_SEED = 1;

/**
 * The ending (M7.3): Jarrett between Kira and Walker at twice their size, the
 * time the quest took beneath them, then the credits, a card at a time.
 */
export const ENDING = {
  background: '#101018',
  cast: [
    { key: 'kira', dx: -48 },
    { key: 'jarrett', dx: 0 },
    { key: 'walker', dx: 48 },
  ],
  castScale: 2,
  feetY: 100,
  timeY: 108,
  creditY: 134,
  cardMs: 3000,
  fadeMs: 500,
  /** A moment before a key or tap leaves it, so a key still held from the game doesn't skip it. */
  promptAfterMs: 1500,
} as const;
