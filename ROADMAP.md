# Dungeon Delve — Roadmap

> **Status:** APPROVED by owner 2026-10-20. Every milestone ends with a build the owner can play on staging.

## Progress

| Milestone | Status |
|---|---|
| M0 Setup | Done |
| M1 Walking skeleton | Done (owner play-tested on staging 2026-10-20: "feels good") |
| M2 Combat, inventory and mana | In progress |
| M3 First dungeon, end to end | Not started |
| M4 The overworld | Not started |
| M5 Dungeons 2–4 | Not started |
| M6 Dungeons 5–8 | Not started |
| M7 Shadow Vault and ending | Not started |
| M8 Polish and balance | Not started |
| M9 v1.0 release | Not started |

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
- [x] M1.3 Movement with 4-direction walk animations and wall collision
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
- [ ] M2.8 Sound effects made in code
- [ ] M2.9 Frame-time budget test with a crowded room

**Acceptance criteria:** owner play-test; each system has unit tests; e2e covers switching weapons, casting with and without enough mana, and drinking a potion.

## M3 — First dungeon, end to end

**Playable result:** walk from the village to dungeon 1, solve it, beat the Treant, collect shard 1 and a heart container, and come back. Progress survives a page reload.

- [ ] M3.1 Dungeon tiles, doors, small keys and locked doors, pushable stones, chests
- [ ] M3.2 Dungeon 1 rooms and its item (Throwing Daggers)
- [ ] M3.3 Boss framework (phases, health bar) and the Treant
- [ ] M3.4 Shard pickup, heart container, the Star of Power display
- [ ] M3.5 Save and continue (ADR-D04); `?dungeon=n` play-test skip that counts as a cheat
- [ ] M3.6 Dungeon map in the inventory
- [ ] M3.8 Walker (PROJECT.md §3f): his sprite with paler blonde hair, a text box for talking, and his lines in the village (story, first sword and shield) and at dungeon 1's entrance and exit
- [ ] M3.7 Reachability test: every room, key and chest in dungeon 1 can be reached in a valid order

**Acceptance criteria:** owner finishes dungeon 1 on staging; reload restores progress.

## M4 — The overworld

**Playable result:** the whole map can be explored, with every dungeon entrance in place (2–8 show "coming soon" signs).

- [ ] M4.1 All five regions laid out (about 64 rooms)
- [ ] M4.2 Village: shop (potions, shield), gem prices
- [ ] M4.3 Hidden passages: cracked walls, thorn bushes, false walls; secret caves
- [ ] M4.4 Progression gates (water, thorns, boulders) tied to dungeon items
- [ ] M4.5 Overworld enemies placed by region; respawn rules
- [ ] M4.6 Reachability test for the overworld, given the items held

## M5 — Dungeons 2–4

- [ ] M5.1 Dungeon 2, Bog Grotto: Fireball, Giant Frog
- [ ] M5.2 Dungeon 3, Sunken Crypt: Iron Shield, Mummy
- [ ] M5.3 Dungeon 4, Stonecrag Mine: Axe, Ogre
- [ ] M5.4 New enemy types for these regions
- [ ] M5.5 Walker's lines at dungeons 2–4 and on the overworld

**Acceptance criteria (each dungeon):** owner play-test; reachability test passes; the boss has its own attack pattern.

## M6 — Dungeons 5–8

- [ ] M6.1 Dungeon 5, Thunder Spire: Lightning, Centaur
- [ ] M6.2 Dungeon 6, Witchwood Tower: Steel Sword and mana upgrade, Witch
- [ ] M6.3 Dungeon 7, Crimson Manor: Ward, Vampire
- [ ] M6.4 Dungeon 8, Dragon's Maw: Star Blade, Dragon
- [ ] M6.5 Walker's lines at dungeons 5–8

## M7 — Shadow Vault and ending

- [ ] M7.1 Vault door that Walker opens with all 8 shards
- [ ] M7.2 Vault rooms and the final boss
- [ ] M7.3 Princess Kira's rescue with Walker, ending screen with play time, credits
- [ ] M7.4 Fastest finish time kept in localStorage and shown on the title screen (owner 2026-10-20)

**Acceptance criteria:** the owner completes the game.

## M8 — Polish and balance

- [ ] M8.1 Difficulty pass with the owner (enemy health, damage, drop rates, prices)
- [ ] M8.2 Touch controls and phone layout
- [ ] M8.3 Title screen, controls legend, quit-to-arcade, pause menu
- [ ] M8.4 Portal card image (256×192) and `coming-soon` status (portal PR)
- [ ] M8.5 Full playthrough with no console errors in every browser project

## M9 — v1.0 release

- [ ] M9.1 Release with `scripts/release.sh deploy` (owner approval), from a clean `main` with CI and staging ZAP passed
- [ ] M9.2 games-portal `Production check` covers `dungeon-delve`; run it and report
- [ ] M9.3 Portal PR: status `live`; tag v1.0
