# Dungeon Delve — Project

> **Status:** APPROVED by owner 2026-10-20 (one open question in section 8)
> **Owner:** soncsec (approves scope, merges, production releases) · **Dev lead:** Claude Code

## 1. Summary

Dungeon Delve is a single-player, top-down action adventure in the spirit of the original *Legend of Zelda*. Our hero **Jarrett** explores a large overworld, fights his way through **8 dungeons**, and wins one **shard of the Star of Power** from each. With all 8 shards he opens the **Shadow Vault**, defeats the sorcerer who kidnapped **Princess Kira**, and sets her free.

He has help: **Walker**, an ancient child with pale blonde hair who has guarded the Star of Power for a thousand years without growing a day older. Walker can't fight the sorcerer himself, so he guides Jarrett instead (section 3f).

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
| World | An **overworld 16 rooms wide and 12 tall** (192 rooms; 8×8 until the owner doubled it, 2026-10-22) across five regions (village and meadows, forest, marsh, mountains, ruins), plus caves and secret rooms |
| Dungeons | **8 dungeons**, growing from about 6 rooms (dungeon 1) to about 14 (dungeon 8). Each has small keys and locked doors, a chest with a new item, a boss behind a boss door, and a shard of the Star of Power |
| Finale | The **Shadow Vault**, opened by all 8 shards: a short final dungeon, the final boss, Princess Kira's rescue, and an ending screen with the play time |
| Player health | Hearts, starting at 3. Each boss leaves a **heart container** (+1 heart), and three more hide in secret caves: 14 at the end |
| Death | Jarrett restarts at the dungeon entrance (or the village, if on the overworld) with full hearts. Items, keys and shards are kept; gems drop by 10% |
| Story | A short title intro, Walker's lines as he guides Jarrett (section 3f), and the ending. Plain, friendly text |

### 3b. Combat, inventory and magic (the owner's requested systems)

| System | Proposal |
|---|---|
| Near and far weapons | Jarrett carries a **near** (melee) weapon and a **far** (ranged) weapon. One key **switches** which is active; the attack key uses the active one. The HUD shows which is active |
| Near weapons | Wooden Sword (start) → **Steel Sword** (Witchwood Tower's prize: twice as strong, and a swing bats enemy shots back; owner 2026-10-22) → **Star Blade** (Dragon's Maw's prize: three times as strong, it bats shots back, and with every heart full a swing also sends a golden beam ahead; owner 2026-10-22). The **Axe** also breaks cracked walls and boulders |
| Far weapons | **Throwing daggers** (cooldown, no ammo) → **Triple Daggers**, a fan of three, thrown faster (Crimson Manor's prize, owner 2026-10-21; no puzzle of their own, 2026-10-22) |
| Spells | Cost **mana**. **Fireball** (burns thorn bushes; Walker teaches it after Hollow Oak, owner 2026-10-21), **Lightning** (Sunken Crypt's prize: a fast bolt that stuns an enemy for 3 s without hurting it, and powers crystal switches, which open barred gates), **Ward** (Thunder Spire's prize, owner 2026-10-21: a bubble for 3 s that blocks all damage, and lets Jarrett through spark barriers). Cast with the spell key; the equipped spell is chosen in the inventory |
| Shields | Wooden Shield (start: blocks arrows and darts from the front while walking or standing), Iron Shield (also blocks fireballs; bought in the village shop for 80 gems) |
| Mana | A mana bar that **refills automatically** after a short pause without casting; it shows once Jarrett knows a spell. A **Mana Brew** potion makes it refill much faster for a while (about 3× for 30 s). Bog Grotto's Mana Crystal raises the maximum from 100 to 150 |
| Potions | **Health Potion** (refills hearts) and **Mana Brew**. Found in chests and pots, bought in the village shop. Up to 3 of each |
| Inventory | A pause-style **inventory screen**: equip the near weapon, far weapon, spell and shield; see potions, keys, gems, the 8-shard Star of Power, and a map of the dungeon you're in |
| Money | **Gems** dropped by enemies and found in secrets; spent in the village shop: Health Potion 10, Mana Brew 15, Iron Shield 80 |
| Hidden passages | Cracked walls and boulders (Axe), thorn bushes (Fireball), pushable stones, and false walls (a sword strike sounds hollow; a second opens them). They lead to **12 secret caves** with gems, potions, and three heart containers |

### 3c. Dungeons and bosses (proposed; art to be confirmed in M1.1)

Shards are the keys (owner 2026-10-21): dungeon *n*'s entrance opens once Jarrett holds *n*−1 shards, so the dungeons come in order. Each dungeon's item opens secrets in the overworld (thorns, boulders, cracked walls) and helps in later dungeons.

| # | Dungeon | Region | Prize item | Boss (art from the pack) |
|---|---|---|---|---|
| 1 | Hollow Oak | Forest | Throwing Daggers | Treant |
| 2 | Bog Grotto | Marsh | A bigger mana bar (the Mana Crystal) | Giant Frog |
| 3 | Sunken Crypt | Ruins | Lightning spell (moved from Thunder Spire, owner 2026-10-21) | Mummy |
| 4 | Stonecrag Mine | Mountains | Axe | Ogre |
| 5 | Thunder Spire | Mountains | Ward spell (moved from Crimson Manor; its Lightning moved to Sunken Crypt, owner 2026-10-21) | Centaur |
| 6 | Witchwood Tower | Forest | Steel Sword | Witch |
| 7 | Crimson Manor | Ruins | Triple Daggers (owner 2026-10-21) | Vampire |
| 8 | Dragon's Maw | Volcano edge | Star Blade | Dragon |
| — | Shadow Vault | Centre of the map | Princess Kira | Demon sorcerer (final boss) |

### 3d. Enemies

Around 12–15 types, each with its own movement and attack, introduced a few at a time. The first five (M1, M2.6):

| Enemy | How it moves | Health |
|---|---|---|
| Robot | Wanders the ground | 2 |
| Bird | Flutters fast and erratically, over trees and walls | 1 |
| Ghost | Drifts slowly straight at Jarrett, through walls | 3 |
| Flying eye | Keeps its distance, circling, and shoots at Jarrett | 2 |
| Wolf | Prowls, and charges when Jarrett is in line with it (a full heart if it hits) | 3 |

Three more for the marsh, ruins and mountains (M5.4):

| Enemy | Where | How it moves | Health |
|---|---|---|---|
| Snake | Marsh, Bog Grotto | Slithers about; when Jarrett is in line, spits venom along the line, then coils a moment | 2 |
| Mushroom | Ruins, Sunken Crypt | Plods slowly; every few seconds puffs a ring of six spores that drift a short way | 3 |
| Toad | Marsh, mountains, Bog Grotto, Stonecrag Mine | Sits, then hops at Jarrett | 2 |

Later regions mix these with stronger variants and new kinds. The pack's large creatures (slime, frog, mummy, ogre, fire skull…) are too big for common enemies at native size, so they serve as mini-bosses and bosses.

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

### 3f. Walker, the guide (owner request 2026-10-20)

Walker looks like a child of about ten but is ancient: the Star's guardian, bound to it since it was made. When the sorcerer shattered the Star and took Princess Kira, Walker lost the power to fight, but not his wisdom. He chooses Jarrett for the quest.

| Where | What Walker does |
|---|---|
| The village, at the start | Tells the story, gives Jarrett the Wooden Sword and Wooden Shield, explains the controls |
| Each dungeon entrance | A hint about the dungeon, and a reminder of which item helps there |
| After a dungeon | Teaches the new spell or item (e.g. how Fireball burns thorn bushes); says how many shards remain. After Hollow Oak he thanks Jarrett for taking on the quest and teaches him magic: the Fireball (owner 2026-10-21) |
| Now and then on the overworld | Points toward the next dungeon if Jarrett seems lost; hints at a nearby secret |
| The Shadow Vault door | Opens it with the 8 shards; his last words before the final fight |
| The ending | Reunited with Princess Kira and Jarrett; the Star is whole again |

- He appears and vanishes in a shimmer; he never follows Jarrett or fights.
- Talking: walk up to him and press the attack key. Text appears in a box, a few short lines at a time.
- Art: the pack's top-down "Blond_kid" sprite (same style as Jarrett and Kira), with his hair recoloured to a paler blonde by the same tool as theirs (owner 2026-10-20).
- He replaces the "village sage" in the earlier plan.

### Out of scope (v1)

- Music (sound effects only, made in code: owner 2026-10-20)
- Gamepads, multiplayer, online features, accounts, analytics
- A map editor or user-made levels
- More than one save slot

## 4. Constraints (shared by every Soncrant Arcade game)

- Browser only, single player. Current Chrome, Firefox, Safari, Edge.
- No accounts, payments, analytics, cookies or third-party requests. localStorage holds only the save game (game progress, no personal data) and the fastest finish time (owner 2026-10-20).
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
| 2026-10-20 | Jarrett's and Kira's hair recoloured to brown (`tools/art/recolor_hair.py`) |
| 2026-10-20 | **Walker**, an ancient blonde-haired child, guides Jarrett: he appears at the village, dungeon entrances and the vault to give hints, story, the first sword and shield, and spell lessons. He doesn't follow or fight. "Blond_kid" sprite with paler blonde hair (section 3f) |
| 2026-10-20 | Instead of a high score, the fastest finish time is kept in localStorage and shown on the title screen; runs that used `?dungeon=n` don't count |
| 2026-10-20 | First enemy roster: robot, bird, ghost, flying eye, wolf (the fire skull is too big for a common enemy; it may return as a mini-boss). M2.6 built before M2.4 so the shield can be tested against real shots. The Mana Brew is a recoloured blue potion |
| 2026-10-20 | Frame-rate check: every frame's work in a crowded fight within the 60 fps budget (median ≤ half a frame, 95% ≤ one frame); Linux WebKit is held to the median only, real Safari is checked on the owner's iPhone |
| 2026-10-20 | Small keys are drawn in code (the art pack has no key); keys work only in the dungeon they were found in. An opened chest vanishes in a puff and leaves its contents on the floor (the pack has no open chest). Hearts show in two rows in the status bar (seven a row since 2026-10-21) |
| 2026-10-20 | The overworld map (M4.1): 8×8 rooms. Village and meadows along the south (the start), the forest north of it (Hollow Oak close by, Witchwood deep in the west), the marsh west, the ruins east, mountains across the north with the volcano edge in the far north-east, and the Shadow Vault in the centre. Each region has its own art set: Top-Down Town (village), the forest set, Tiny RPG Mountain (mountains), forest tiles tinted murky with water from the Overworld sheet (marsh), and the dungeon's stone walls on grass (ruins) |
| 2026-10-20 | The Shadow Vault's four rooms are walkable stone grounds around the sealed vault building: a hub joining the forest, ruins and mountains (the door opens in M7.1) |
| 2026-10-20 | Village rooms draw their forest walls and props with the teal ground shadows recoloured to the village's grass and shade |
| 2026-10-20 | The marsh's ponds have shorelines: the Overworld sheet's island shores used inside out, their grass recoloured to the forest's; ponds are rectangles |
| 2026-10-21 | Enemies by region: village rooms safe; meadows a robot or bird or two; forest wolves, birds, robots; marsh ghosts and eyes; ruins ghosts, robots, eyes; mountains wolves, eyes, birds; volcano edge eyes and ghosts; vault grounds ghosts. Overworld enemies come back once Jarrett has moved a few screens away (4 rooms); dungeon enemies, once defeated, never come back (kept in the save) |
| 2026-10-21 | Progression: shards as keys. Dungeon *n*'s entrance needs *n*−1 shards; items gate only secrets. Sealed entrances of dungeons not yet built show nothing |
| 2026-10-21 | Secret art: cracked walls are the mountain set's rubble; every boulder smashes to the Axe; thorn bushes are the forest bush under a thorny runtime tint |
| 2026-10-21 | Secrets: 12 secret caves, three of them with heart containers (14 hearts at the end; the status bar shows two rows of seven). False walls sound hollow when struck with the sword and open on a second strike. Cracked walls, Axe boulders and thorn bushes are built now and placed with the item gates (M4.4, M5) |
| 2026-10-21 | The village shop: a house on the west street with a shopkeeper inside (the 'Guy' sprite recoloured: grey hair, red shirt). It sells the Health Potion (10 gems), Mana Brew (15) and the Iron Shield (80). Dungeon 3's prize becomes the bigger mana bar (moved from dungeon 6, which keeps the Steel Sword) |
| 2026-10-21 | The mountains are cliffs, dirt, rocks and caves from the Tiny RPG Mountain set; the volcano edge (the three north-east rooms) is the mountains under a red runtime tint |
| 2026-10-21 | Magic: Jarrett starts with no spell and no mana bar. After Hollow Oak, Walker thanks him for taking on the quest and teaches him the Fireball. Bog Grotto's prize becomes the bigger mana bar (a Mana Crystal: the pack's second Rocky Pass crystal recoloured blue, ADR-D05); Sunken Crypt's prize is to be decided |
| 2026-10-21 | Touch controls and the phone layout (M8.2) come right after M5.2, so the owner can play-test on a phone |
| 2026-10-21 | Sunken Crypt's prize is the Lightning spell (moved from Thunder Spire, whose prize is to be decided): a bolt that stuns enemies and powers crystal switches, which open barred gates. The bolt is the pack's "Warped shooting fx" bolt; a switch is the dungeon's pillar orb, dim until powered (runtime tint) |
| 2026-10-22 | Crimson Manor's design: the Triple Daggers are just a better throw (no puzzle of their own). The Vampire glides after Jarrett; a touch drains half a heart and heals it a little; every so often it bursts into a whirl of dark shots and re-forms elsewhere, sooner below half health; any weapon hurts it |
| 2026-10-22 | Witchwood Tower's design: the Steel Sword bats enemy shots back the way Jarrett faces; stone eye statues in the tower's walls fire orbs, and one batted back into its eye shuts it and opens its room's gates (drawn as the dungeon's pillar orb, glowing red while it watches: runtime tint). The Witch blinks from place to place throwing fire; below half health she leaves look-alike decoys, and only the real one takes hits; any weapon hurts her. The Steel Sword's icon is the small sword's, in steel blue (runtime tint) |
| 2026-10-22 | The Star Blade: three times the Wooden Sword's strength; it bats shots back like the Steel Sword; with every heart full, a swing also sends a beam flying ahead (one at a time). Its icon is the small sword's in starlit gold, and the beam is the same blade, flying (runtime tint) |
| 2026-10-22 | The Dragon (Dragon's Maw): the pack's red Gothicvania dragon, its art facing left. It prowls the top of its lair facing Jarrett; it rears, then sweeps its fire breath across him burst by burst (the Ward, or a shield held towards it, stops the fire); when he comes close its tail lashes all round it, and stepping back in time dodges it; below half health it breathes more fire, more often. Any weapon hurts it |
| 2026-10-22 | The Shadow Vault (M7): four rooms (an entry hall, two trial rooms that use the earlier items, the sorcerer's hall with Kira's cell behind it). Walker opens its door once Jarrett holds all 8 shards. The final boss has two forms: the hooded sorcerer (TinyRPG Wizard art) blinks about casting magic orbs behind a shield of dark magic, which breaks for a few seconds when one of his own orbs is batted back into him, and then any weapon hurts; at half health he becomes the horned demon (TinyRPG Demon art), which charges and throws rings of fire, with no shield |
| 2026-10-22 | One production release once all of M6 has merged (owner's approval) |
| 2026-10-22 | The Demon is the pack's horned demon scaled once to 80% (`tools/art/scale_demon.py`), so it fits the 160 px room: an exception to keeping native pixel resolution (ADR-D05) |
| 2026-10-22 | The overworld grows from 8×8 to 16 screens wide by 12 tall, before Thunder Spire is built; each screen stays 20×10 tiles |
| 2026-10-22 | A find from a chest (or a boss's heart container and shard) is held up: Jarrett faces you, the find floats over his head for about 1.5 s, a success tune plays and the game waits. The pack has no arms-up pose, so no new art |
| 2026-10-22 | No enemy may look stuck in a tree or a rock: walking enemies keep out of every cell the art hides (tree canopies and branches, the tree tops over a forest wall's upper row, roofs, archways); fliers are drawn above trees, rocks and walls; a drop that would land in a wall, under a tree, or where Jarrett can't reach goes to the nearest open spot he can reach |
| 2026-10-22 | Thunder Spire's design: spark barriers (crackling energy across doorways and closets, from the pack's waveform shot) zap Jarrett back, but he walks through inside the Ward. The Centaur gallops at Jarrett when he is in line with it and rears to call down lightning on marked spots (the pack's lightning-strike effect); below half health the storm covers most of the floor. The Ward costs 40 mana and lasts 3 s (the pack's energy-shield bubble) |
| 2026-10-21 | Thunder Spire's prize is the Ward spell, moved up from Crimson Manor; Crimson Manor's prize becomes the Triple Daggers (the daggers' upgrade to a fan of three) |
| 2026-10-21 | New enemies (M5.4): the snake in the marsh and Bog Grotto, the mushroom in the ruins and Sunken Crypt, the toad in the marsh, the mountains, Bog Grotto and Stonecrag Mine. They take the places of some birds, eyes, ghosts and robots there. The pack's small snake, mushroom and frog sprites at native size; the snake's spit is its own sprite, the spores are the eye's shot tinted green |
| 2026-10-21 | Bosses each fight their own way: the Treant shuffles and spits seeds; the Giant Frog crouches and leaps at Jarrett, out of reach in the air, and each landing throws a ring of shots; the Mummy shambles after him firing spreads, and only a Lightning bolt's stun lets blows land on it |
| 2026-10-20 | A small title screen arrives with the save game (M3.5): CONTINUE when there is a save, and NEW GAME, which asks before wiping it. `?dungeon=n` skips the title and starts a new run marked as a cheat |
| 2026-10-20 | Each beaten boss leaves a heart container and a shard of the Star of Power; a shard is the pack's crystal recoloured gold |
| 2026-10-23 | A world map (M8.6), like the Legend of Zelda's: in the bag, on its own page (Left/Right) on the overworld; the screens Jarrett has visited fill in, each in its region's colour (no words), with where he is and the dungeon entrances marked |
| 2026-10-24 | More secrets (M10): a secret room in each dungeon behind a secret wall, with gems and potions, and a heart container in two (Stonecrag Mine, Crimson Manor), so 16 hearts in all; eight more secret caves (20); a faint crack on false and secret walls; found secrets marked on the maps; Walker's hints |

## 8. Open questions

None at the moment.
