# Dungeon Delve — Roadmap

> **Status:** APPROVED by owner 2026-10-20. Every milestone ends with a build the owner can play on staging.

## Progress

| Milestone | Status |
|---|---|
| M0 Setup | Done |
| M1 Walking skeleton | Done (owner play-tested on staging 2026-10-20: "feels good") |
| M2 Combat, inventory and mana | Done (2026-10-20) |
| M3 First dungeon, end to end | Done (owner play-tested 2026-10-21: "looks good"; the walking direction fixed in #52) |
| M4 The overworld | Done (owner play-tested 2026-10-21) |
| M5 Dungeons 2–4 | In progress |
| M6 Dungeons 5–8 | Not started |
| M7 Shadow Vault and ending | Not started |
| M8 Polish and balance | Not started |
| M9 v1.0 release | Not started |

**In production:** first release 2026-10-21, `20261021T165122Z-fe100746` (M0–M4 and the walking fix), at http://games.soncrant.com/dungeon-delve/.

## Risks driving this order

| # | Risk | Mitigation | Addressed in |
|---|---|---|---|
| 1 | Lots of hand-made content (~150 rooms) | Rooms as text data with automatic tile edges; tests check every door and secret leads somewhere and every dungeon can be finished | M1, M3, M4 |
| 2 | The art pack has no hero attack poses, one fantasy dungeon tileset, one potion colour | Art audit first; slash effects over the walk frames; runtime tints (approved) | M1.1 |
| 3 | Game feel is subjective | Playable on staging from M1; all numbers in `tuning.ts`; owner play-tests each milestone | Every milestone |
| 4 | Long game, hard to play-test late content | `?dungeon=n` play-test skip and a save game | M3 |
| 5 | Performance with spells and many enemies | Pooled objects; frame-time budget test | M2 |
| 6 | Supply chain | No new dependencies planned beyond the template | Always |

---

## M0 — Setup

- [x] M0.1 Repo created from `soncsec/game-template`; `scripts/init-game.sh dungeon-delve "Dungeon Delve" 5184`; `npm run check` passes
- [x] M0.2 Branch protection with the four required checks; secret scanning and push protection; Dependabot alerts (done by Claude with the owner's OK, 2026-10-20)
- [x] M0.3 GitHub Pages on (Actions mode, `main` only); first staging deploy and ZAP scan pass (owner approval). Staging: https://soncsec.github.io/dungeon-delve/; ZAP: no high-risk alerts (the rest are headers GitHub Pages can't set; Apache sets them in production)
- [x] M0.4 Portal PR: `games/dungeon-delve.json` (`in-development`, devPort 5184) and the ports table in NEW-GAME.md
- [x] M0.5 Planning docs approved: PROJECT.md, ARCHITECTURE.md, ROADMAP.md (owner, 2026-10-20)
- [ ] M0.6 Coverage floor for `src/logic/` raised to 100% (the owner's rule; the template has 80%)
- [x] M0.7 WebKit and Pixel 7 Playwright projects (adopted from Star Destroyer, owner 2026-10-20)

**Acceptance criteria:** a direct push to `main` is rejected; CI is green on the first PR; staging serves the template build; the portal PR is open.

## M1 — Walking skeleton

**Playable result:** Jarrett walks around a 3×3 patch of overworld, slides from room to room, swings his sword, and defeats robots that drop gems and hearts.

- [x] M1.1 Art audit and copy: hero, Kira, overworld tiles, objects, gems, slash and hit effects, the robot enemy into `public/assets/` (dungeon tiles come with M3.1); CREDITS.md; an asset-preview scene (`?scene=preview`)
- [x] M1.2 Room data format and loader (text rooms, tile legend, automatic edges); unit tests
- [x] M1.3 Movement with 4-direction walk animations and wall collision (fixed 2026-10-21: the art's side row faces right, so it is mirrored for walking left, not right)
- [x] M1.4 Flip-screen room transitions over a 3×3 test area
- [x] M1.5 Sword swing (Space or J) with the slash effect; the area each swing covers, and overlap tests (hitting and knocking back enemies moved to M1.6, when the first enemy exists)
- [x] M1.6 Robot enemy that the sword hits and knocks back (pooled; the pack's slime is too big for a basic enemy, see M1.1), hearts, damage and brief invulnerability, gem and heart drops
- [x] M1.7 HUD bar: hearts, gems
- [x] M1.8 Playwright: boots clean with no third-party requests; walks between rooms; a sword hit defeats a robot (plus "the M1 loop": walk to the next room and defeat one of its robots)

**Acceptance criteria:** the owner plays it on staging; CI green; `src/logic/` at 100% coverage.

## M2 — Combat, inventory and mana

**Playable result:** the full combat kit in a test area: switch near/far, throw daggers, cast Fireball, block with the shield, drink potions, manage mana, use the inventory.

- [x] M2.1 Near/far weapon switch (X or K) and throwing daggers (pooled); for M2 Jarrett has them from the start, M3 makes them dungeon 1's prize
- [x] M2.2 Mana bar with auto-recharge after a pause; Fireball spell (C or L)
- [x] M2.3 Health Potion and Mana Brew (faster recharge for a while); potion keys 1 and 2
- [x] M2.4 Shield: blocks projectiles from the front while not attacking (Wooden Shield, ±60°)
- [x] M2.5 Inventory screen (I or Tab): equip near weapon, far weapon, spell, shield; shows potions, gems, keys, shards
- [x] M2.6 Four more enemy types: bird, ghost, flying eye (shoots), wolf (charges); built before M2.4 (owner 2026-10-20)
- [x] M2.7 Death and respawn rules (back in the start room until the village exists; keeps items and potions; loses 10% of gems)
- [x] M2.8 Sound effects made in code (14 sounds; M mutes)
- [x] M2.9 Frame-time budget test with a crowded room (WebKit: median only, owner 2026-10-20)

**Acceptance criteria:** owner play-test; each system has unit tests; e2e covers switching weapons, casting with and without enough mana, and drinking a potion.

## M3 — First dungeon, end to end

**Playable result:** walk from the village to dungeon 1, solve it, beat the Treant, collect shard 1 and a heart container, and come back. Progress survives a page reload.

- [x] M3.1 Dungeon tiles, doors, small keys and locked doors, pushable stones, chests, in three PRs:
  - [x] M3.1a Dungeon walls and floors drawn automatically; maps (overworld, dungeon 1); `?dungeon=n` starts in a dungeon
  - [x] M3.1b Small keys, locked doors and chests (fixed 2026-10-21: a key, item or heart container left in an opened chest waits there for Jarrett to come back)
  - [x] M3.1c Pushable stones
- [x] M3.2 Dungeon 1 rooms and its item (Throwing Daggers)
  - [x] M3.2a Doorways between maps: the stone archway into dungeon 1, and the way back out
  - [x] M3.2b Six rooms (entrance, hub, west, east, great hall, boss room), two keys, the daggers behind a stone; Jarrett no longer starts with the daggers
- [x] M3.3 Boss framework (phases, health bar) and the Treant: the boss room shuts while it lives; beaten bosses stay beaten
- [x] M3.4 Shard pickup, heart container, the Star of Power display: the beaten boss leaves both; a message says how many shards are left
- [x] M3.5 Save and continue (ADR-D04); `?dungeon=n` play-test skip that counts as a cheat. A small title screen (CONTINUE / NEW GAME, with a confirm before wiping a save) came forward from M8.3 (owner 2026-10-20)
- [x] M3.6 Dungeon map in the inventory: the rooms he has been in (kept in the save), where he is, and the boss room
- [x] M3.8 Walker (PROJECT.md §3f), in two PRs:
  - [x] M3.8a His sprite with paler blonde hair, a text box for talking, and the village: the story, the first sword and shield, the controls
  - [x] M3.8b His lines at dungeon 1's entrance and after it
- [x] M3.7 Reachability test: every room, key and chest in dungeon 1 can be reached in a valid order (`src/logic/reach.ts`; also every overworld room and the archway)

**Acceptance criteria:** owner finishes dungeon 1 on staging; reload restores progress.

## M4 — The overworld

**Playable result:** the whole map can be explored, with every dungeon entrance in place (2–8 sealed until built).

- [x] M4.1 All five regions laid out (about 64 rooms; map and region art: owner 2026-10-20, see PROJECT.md decisions), one PR per region:
  - [x] M4.1a The 8×8 map, regions per room, and the village and meadows (Top-Down Town set); the start moves to the village
  - [x] M4.1b The forest (around Hollow Oak, and Witchwood's corner), and the Shadow Vault's grounds in the centre (a hub; owner 2026-10-20)
  - [x] M4.1c The marsh (tinted forest tiles, ponds with shorelines; Bog Grotto's sealed archway)
  - [x] M4.1d The ruins (dungeon stone on grass; Sunken Crypt's and Crimson Manor's sealed archways)
  - [x] M4.1e The mountains and the volcano edge (Tiny RPG Mountain set; the sealed caves of Stonecrag Mine and Dragon's Maw, Thunder Spire's archway)
- [x] M4.2 Village shop: a house on the west street with a recoloured shopkeeper; Health Potion 10, Mana Brew 15, Iron Shield 80 gems (owner 2026-10-21)
- [ ] M4.3 Hidden passages and 12 secret caves (owner 2026-10-21), in two PRs:
  - [x] M4.3a Secret caves (gems, potions, three heart containers), false walls (sword), holes under pushable stones; the caves that need no item placed
  - [x] M4.3b Cracked walls and boulders (Axe) and thorn bushes (Fireball), built and tested; placed with M4.4 and M5
- [x] M4.4 Progression gates: dungeon *n*'s entrance needs *n*−1 shards (owner 2026-10-21); the last five secret caves placed behind thorns, boulders and cracked walls
- [x] M4.5 Overworld enemies placed by region; respawn rules: overworld enemies return after 4 rooms away, dungeon enemies never (owner 2026-10-21)
- [x] M4.6 Reachability test for the overworld, given the items held: every room and dungeon doorway with no items; 7, 9 and 12 secret caves with nothing, Fireball, and the Axe too

## M5 — Dungeons 2–4

- [x] M5.1 Dungeon 2, Bog Grotto: its prize, Giant Frog, in three PRs:
  - [x] M5.1a Seven rooms under the marsh (in the marsh's colours), two keys, thorns that only its prize gets past; the Fireball in a closet behind a stone, and no longer in the starting kit; the marsh archway opens with one shard
  - [x] M5.1b The Giant Frog: it crouches, leaps at Jarrett (out of reach in the air), and each landing throws a ring of shots (four, then eight below half health); beaten, it leaves the second shard and a heart container
  - [x] M5.1c Magic from Walker (owner 2026-10-21): no spell or mana bar at the start; after Hollow Oak, Walker thanks Jarrett and teaches him the Fireball. Bog Grotto's prize becomes a Mana Crystal (mana 100 → 150, a longer bar)
- [x] M5.2 Dungeon 3, Sunken Crypt: Lightning (moved from Thunder Spire, owner 2026-10-21), Mummy (the Iron Shield is sold in the village shop: owner 2026-10-21), in three PRs:
  - [x] M5.2a The Lightning spell: a bolt that stuns an enemy (3 s; it can't move, shoot or hurt by touch) and powers crystal switches (`z`), which open their room's gates (`g`); the reachability test knows them
  - [x] M5.2b Seven rooms under the ruins (in sandy stone; the archway needs two shards): Lightning in a closet behind a stone, crystal switches that open the way to the tomb hall and a caged key, thorns before the first key; a found item goes straight into Jarrett's hand
  - [x] M5.2c The Mummy: it shambles after Jarrett firing spreads; wrapped tight, sword, daggers and fire glance off until a Lightning bolt stuns it (3 s); beaten, it leaves the third shard and a heart container
- [x] Touch controls and the phone layout (M8.2), brought forward to here (owner 2026-10-21): a pad, HIT, SWAP and MAGIC, the potions and the bag; the game fills the screen, at the top when the phone is upright
- [x] M5.3 Dungeon 4, Stonecrag Mine: Axe, Ogre, in two PRs:
  - [x] M5.3a Seven tunnels under the mountains (in earthy stone; the cave needs three shards): the Axe behind thorns, rubble across the hub's way north and a boulder before key 2 (the Axe), key 1 caged behind a crystal switch (Lightning)
  - [x] M5.3b The Ogre: it lumbers side to side, raises its club and slams down a ring of shockwaves (eight, then twelve); only the Axe gets through its hide; beaten, it leaves the fourth shard and a heart container
- [x] M5.4 New enemy types for these regions: the snake (spits venom), the mushroom (puffs spores) and the toad (hops)
- [x] M5.5 Walker's lines at dungeons 2–4 and on the overworld: a hint at each entrance (the boss, and what the dungeon's item does), and outside each once its shard is found (the way on; choosing spells; secrets the Axe opens). On a phone he names the touch buttons, not the keys
- [x] M5.6 No enemy looks stuck in a tree or a rock (owner 2026-10-22): walking enemies keep out from under the art of trees, tree tops, houses and archways, and start clear of them; fliers are drawn over trees, rocks and walls; a drop lands where Jarrett can reach and see it
- [ ] M5.7 Holding up a find (owner 2026-10-22): from a chest, or a boss's heart container and shard, Jarrett turns to face you with the find over his head while a success tune plays, and the game waits a moment
- [x] M5.8 A bigger overworld (owner 2026-10-22): 16 screens wide by 12 tall (from 8×8). The first 64 rooms spread out (dungeons, village, caves and Walker with them), and 128 new rooms between them in each region's style, made by `tools/map/grow_overworld.py` and edited by hand from then on

**Acceptance criteria (each dungeon):** owner play-test; reachability test passes; the boss has its own attack pattern.

## M6 — Dungeons 5–8

- [x] M6.1 Dungeon 5, Thunder Spire: Ward (moved from Crimson Manor: owner 2026-10-21), Centaur, in three PRs:
  - [x] M6.1a The Ward spell: a bubble (40 mana, 3 s) that blocks every hit, from every side, and can't be cast again while up; it breaks up as a warning just before it drops. Spark barriers (`e`, owner 2026-10-22): crackling energy that zaps Jarrett back (half a heart), but he walks through inside the Ward; the reachability test knows them
  - [x] M6.1b Seven rooms up the Spire (in stormy blue stone; the archway needs four shards): the Ward caged past thorns (Fireball) and a crystal switch (Lightning), key 1 behind rubble (the Axe), sparks across the way up to the boss's door and before key 2
  - [x] M6.1c The Centaur (owner 2026-10-22): it gallops at Jarrett when he is in line with it, and rears to call down lightning on marked spots (one under Jarrett), 0.8 s after the marks appear; below half health the storm covers most of the floor, so the Ward or the one safe gap saves him. Any weapon hurts it; beaten, it leaves the fifth shard and a heart container
- [x] M6.2 Dungeon 6, Witchwood Tower: Steel Sword, Witch (the mana upgrade moved to dungeon 3: owner 2026-10-21), in three PRs:
  - [x] M6.2a The Steel Sword (owner 2026-10-22): twice the Wooden Sword's blow, and a swing bats enemy shots back the way Jarrett faces. Eye statues (`y`) in walls fire orbs; one batted back into its eye shuts it for good and opens its room's gates (Lightning does nothing to them); the reachability test knows them
  - [x] M6.2b Seven rooms up the tower (in mossy green stone; the archway needs five shards): the Steel Sword behind sparks (the Ward), key 1 behind thorns (Fireball), eye statues barring the way up and key 2's cage (the Steel Sword)
  - [x] M6.2c The Witch (owner 2026-10-22): she blinks from place to place throwing fire; below half health she leaves look-alike decoys, and only the real Witch takes hits. Any weapon hurts her
- [x] M6.3 Dungeon 7, Crimson Manor: Triple Daggers (owner 2026-10-21), Vampire, in three PRs:
  - [x] M6.3a The Triple Daggers (owner 2026-10-22: just a better throw): a fan of three, thrown faster, up to six in the air
  - [x] M6.3b Seven rooms of the manor (in old-blood red; the archway needs six shards): a foyer and two wings, a gallery with a library and a chapel above; key 1 behind sparks (the Ward), the Triple Daggers behind rubble (the Axe), key 2 caged by an eye statue (the Steel Sword), a Mana Brew behind a crystal switch (Lightning)
  - [x] M6.3c The Vampire (owner 2026-10-22): it glides after Jarrett; a touch drains half a heart and heals it a little; every so often it bursts into a whirl of dark shots and re-forms elsewhere, sooner below half health. Any weapon hurts it
  - [x] M6.3d The Vampire's dark shots in purple (owner 2026-10-22): the enemy orb recoloured by `tools/art/dark_shot.py`, since a tint could only darken its orange
- [x] M6.4 Dungeon 8, Dragon's Maw: Star Blade, Dragon, in three PRs:
  - [x] M6.4a The Star Blade (owner 2026-10-22: a beam at full hearts): three times the Wooden Sword's strength, it bats shots back like the Steel Sword, and with every heart full a swing also sends a golden beam flying ahead
  - [x] M6.4b Seven caverns of the Maw (in ember red; the cave needs seven shards): key 1 behind a boulder (the Axe), the Star Blade caged by an eye statue (the Steel Sword), key 2 behind sparks (the Ward), a Health Potion behind a crystal switch (Lightning)
  - [x] M6.4c The Dragon (owner 2026-10-22: fire breath and tail): it prowls the top of its lair facing Jarrett; it rears, then sweeps its fire across him burst by burst (the Ward, or a shield held towards it, stops it); when he comes close its tail lashes all round it, and stepping back in time dodges it. Fierce: more fire, more often. Any weapon hurts it
- [x] M6.5 Walker's lines at dungeons 5–8: a hint at each entrance (the boss, and the item hidden there), and outside each once its shard is found (how to use what was found, and the way on; after the last, the Shadow Vault)

## M7 — Shadow Vault and ending

- [x] M7.1 Vault door that Walker opens with all 8 shards: his last words (with a hint at the sorcerer's shield), then the Star opens the door for good; behind it, the vault's entry hall. The vault counts as the ninth dungeon (`?dungeon=9` starts there)
- [ ] M7.2 Vault rooms and the final boss (owner 2026-10-22: four rooms; the sorcerer, then the demon), in three PRs:
  - [x] M7.2a The vault's rooms (in shadowy violet): the entry hall, with a crystal switch (Lightning) opening the way east; the west trial (sparks, thorns and a boulder: the Ward, the Fireball, the Axe) and the east trial (a stone to push, and an eye statue: the Steel Sword), each holding a key; two locked doors up to the sorcerer's hall, with Kira's cell behind a gate at its top
  - [ ] M7.2b The Sorcerer: he blinks about casting magic orbs behind a shield of dark magic; one of his orbs batted back into him (Steel Sword or Star Blade) breaks it for a few seconds, and then any weapon hurts him
  - [ ] M7.2c The Demon: at half health the sorcerer shows his true shape, a horned demon that charges at Jarrett and throws rings of fire, with no shield
- [ ] M7.3 Princess Kira's rescue with Walker, ending screen with play time, credits
- [ ] M7.4 Fastest finish time kept in localStorage and shown on the title screen (owner 2026-10-20)

**Acceptance criteria:** the owner completes the game.

## M8 — Polish and balance

- [ ] M8.1 Difficulty pass with the owner (enemy health, damage, drop rates, prices)
- [x] M8.2 Touch controls and phone layout (done after M5.2, owner 2026-10-21)
- [ ] M8.3 Title screen (the intro, art and the rest; the CONTINUE / NEW GAME menu came with M3.5), controls legend, quit-to-arcade, pause menu
- [ ] M8.4 Portal card image (256×192) and `coming-soon` status (portal PR)
- [ ] M8.5 Full playthrough with no console errors in every browser project

## M9 — v1.0 release

- [ ] M9.1 Release with `scripts/release.sh deploy` (owner approval), from a clean `main` with CI and staging ZAP passed
- [ ] M9.2 games-portal `Production check` covers `dungeon-delve`; run it and report
- [ ] M9.3 Portal PR: status `live`; tag v1.0
