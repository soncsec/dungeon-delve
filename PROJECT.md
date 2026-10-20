# Dungeon Delve — Project

> **Status:** APPROVED by owner 2026-10-20 (one open question in section 8)
> **Owner:** soncsec (approves scope, merges, production releases) · **Dev lead:** Claude Code

## 1. Summary

Dungeon Delve is a single-player, top-down action adventure in the spirit of the original *Legend of Zelda*. Our hero **Jarrett** explores a large overworld, fights his way through **8 dungeons**, and wins one **shard of the Star of Power** from each. With all 8 shards he opens the **Shadow Vault**, defeats the sorcerer who kidnapped **Princess Kira**, and sets her free.

It is aimed at young teens (cartoon fantasy, no blood, enemies vanish in a puff of smoke) but has enough depth, secrets and challenge for adults.

## 2. Users

- **Primary:** players aged about 12–16 on desktop browsers; adults are welcome too.
- **Phones and tablets** (owner 2026-10-20): touch controls, and the game fills the screen, as in Star Destroyer.
- **Secondary:** the owner, as play-tester and reviewer.

## 3. Scope — version 1.0

### 3a. Core

| Area | Proposal |
|---|---|
| Camera | Top-down, flip-screen rooms like the NES Zelda: the view slides to the next room when Jarrett walks off the edge |
| Display | 320×180 at native pixel size (16:9): a 20-pixel status bar over a 20×10-tile room of 16-pixel tiles. Scaled up by whole numbers on desktop (ADR-D02) |
| World | An **overworld of about 8×8 rooms** across five regions (village and meadows, forest, marsh, mountains, ruins), plus caves and secret rooms |
| Dungeons | **8 dungeons**, growing from about 6 rooms (dungeon 1) to about 14 (dungeon 8). Each has small keys and locked doors, a chest with a new item, a boss behind a boss door, and a shard of the Star of Power |
| Finale | The **Shadow Vault**, opened by all 8 shards: a short final dungeon, the final boss, Princess Kira's rescue, and an ending screen with the play time |
| Player health | Hearts, starting at 3. Each boss leaves a **heart container** (+1 heart; 11 at the end). Hidden heart containers may be added if play-testing calls for it |
| Death | Jarrett restarts at the dungeon entrance (or the village, if on the overworld) with full hearts. Items, keys and shards are kept; gems drop by 10% |
| Story | A short title intro, a few lines from the village sage, and the ending. Plain, friendly text |

### 3b. Combat, inventory and magic (the owner's requested systems)

| System | Proposal |
|---|---|
| Near and far weapons | Jarrett carries a **near** (melee) weapon and a **far** (ranged) weapon. One key **switches** which is active; the attack key uses the active one. The HUD shows which is active |
| Near weapons | Wooden Sword (start) → Steel Sword → Star Blade (stronger, wider swing). The **Axe** also breaks cracked walls and boulders |
| Far weapons | **Throwing daggers** (cooldown, no ammo) → later a faster triple throw |
| Spells | Cost **mana**. **Fireball** (burns thorn bushes), **Lightning** (stuns, powers crystal switches), **Ward** (a short energy shield that blocks all damage). Cast with the spell key; the equipped spell is chosen in the inventory |
| Shields | Wooden Shield (start: blocks arrows and darts from the front while walking or standing), Iron Shield (also blocks fireballs) |
| Mana | A mana bar that **refills automatically** after a short pause without casting. A **Mana Brew** potion makes it refill much faster for a while (about 3× for 30 s). A dungeon prize raises the maximum |
| Potions | **Health Potion** (refills hearts) and **Mana Brew**. Found in chests and pots, bought in the village shop. Up to 3 of each |
| Inventory | A pause-style **inventory screen**: equip the near weapon, far weapon, spell and shield; see potions, keys, gems, the 8-shard Star of Power, and a map of the dungeon you're in |
| Money | **Gems** dropped by enemies and found in secrets; spent in the village shop (potions, shield upgrade) |
| Hidden passages | Cracked walls (Axe), thorn bushes (Fireball), pushable stones, and false walls. They lead to secret caves with gems, potions and upgrades |

### 3c. Dungeons and bosses (proposed; art to be confirmed in M1.1)

Each dungeon's item is needed to reach a later dungeon, so the world opens up gradually.

| # | Dungeon | Region | Prize item | Boss (art from the pack) |
|---|---|---|---|---|
| 1 | Hollow Oak | Forest | Throwing Daggers | Treant |
| 2 | Bog Grotto | Marsh | Fireball spell | Giant Frog |
| 3 | Sunken Crypt | Ruins | Iron Shield | Mummy |
| 4 | Stonecrag Mine | Mountains | Axe | Ogre |
| 5 | Thunder Spire | Mountains | Lightning spell | Centaur |
| 6 | Witchwood Tower | Forest | Steel Sword and more mana | Witch |
| 7 | Crimson Manor | Ruins | Ward spell | Vampire |
| 8 | Dragon's Maw | Volcano edge | Star Blade | Dragon |
| — | Shadow Vault | Centre of the map | Princess Kira | Demon sorcerer (final boss) |

### 3d. Enemies

Around 12–15 types, each with its own movement and attack, introduced a few at a time: slimes, bats, ghosts, fire skulls, flying eyes, robots (the pack's one true top-down walker), plus front-facing pack creatures used as wanderers and turrets. Later regions mix earlier enemies with stronger variants.

### 3e. Controls

| Key | Action |
|---|---|
| Arrows / WASD | Move |
| Space or J | Attack with the active weapon |
| X or K | Switch between near and far weapon |
| C or L | Cast the equipped spell |
| 1 / 2 | Drink a Health Potion / Mana Brew |
| I or Tab | Inventory |
| P or Esc | Pause (shows the controls) |
| M, F, H | Mute, full screen, show/hide help |

Touch controls (owner 2026-10-20): a virtual pad on the left, attack/switch/spell buttons on the right, potion and inventory buttons along the top.

### Out of scope (v1)

- Music (sound effects only, made in code: owner 2026-10-20)
- Gamepads, multiplayer, online features, accounts, analytics
- A map editor or user-made levels
- More than one save slot

## 4. Constraints (shared by every Soncrant Arcade game)

- Browser only, single player. Current Chrome, Firefox, Safari, Edge.
- No accounts, payments, analytics, cookies or third-party requests. localStorage holds only the save game (game progress, no personal data; owner 2026-10-20) and the best finish time (Q1).
- Art comes only from the shared CC0 pack, at its native pixel size, with whole-number scaling (phones may use an in-between zoom to fill the screen). Runtime tints are allowed (owner 2026-10-20).
- Served at `games.soncrant.com/<slug>/` over HTTP (ADR-010), behind the portal's security headers.

## 5. Non-functional requirements

- Steady 60 fps on a mid-range laptop in the busiest room (a boss fight with spells).
- First load under about 3 seconds on broadband.
- No console errors during a full playthrough.
- Works under the production CSP with no third-party requests.
- A full playthrough takes roughly 3–5 hours for a first-time player.

## 6. Definition of success (v1.0)

1. A stranger opens the game from the portal and can play from the title screen to Princess Kira's rescue with no setup.
2. Every dungeon and the vault can be completed (checked by automated reachability tests on the map data, and by the owner).
3. The owner signs off that it is fun, fair and right for young teens.
4. All CI checks and pre-release security scans pass.

## 7. Decisions confirmed by the owner

| Date | Decision |
|---|---|
| 2026-10-20 | The game: a Zelda-inspired adventure, 8 dungeons each with a Star of Power shard, hero Jarrett, Princess Kira, inventory, near/far weapon switch, mana with auto-recharge and recovery potions, aimed at young teens (owner's brief) |
| 2026-10-20 | Slug `dungeon-delve`, title "Dungeon Delve" (the local folder stays `~/dev/games/dungeondelve`) |
| 2026-10-20 | Progress is saved in localStorage: one auto-save holding only game progress, validated on load (ADR-D04) |
| 2026-10-20 | Adopted from Star Destroyer: phone and touch controls (WebKit and Pixel 7 test projects, fill the screen), sound effects made in code, a frame-time budget test, a `?dungeon=n` play-test skip that counts as a cheat |
| 2026-10-20 | Art: runtime tints per dungeon and for the Mana Brew potion; "Guy" as Jarrett, "PirateGirl" as Kira; the sword swing is a walk frame plus the pack's slash effect (ADR-D05) |

## 8. Open questions

1. **Best time:** a Zelda-style game has no score. Keep the fastest finish time instead (shown on the title screen; runs that used `?dungeon=n` don't count)?
