# Dungeon Delve — Architecture

> **Status:** ADR-D01 to ADR-D05 accepted by owner 2026-10-20.

The shared decisions for every Soncrant Arcade game (ADR-001 to ADR-011: static site, Phaser 4, TypeScript, Vite, hosting, testing, security tooling, portal, releases, HTTP, parallel games) are recorded once, in [`soncsec/star-destroyer` ARCHITECTURE.md](https://github.com/soncsec/star-destroyer/blob/main/ARCHITECTURE.md). This file records only Dungeon Delve's own decisions. **No new dependencies are proposed.**

## Game decisions

### ADR-D01: Rooms as text data — *Accepted 2026-10-20*

- **Context:** about 150 hand-made rooms (64 overworld, ~80 dungeon, secrets, the vault).
- **Decision:** each room is a 20×10 grid of characters in a TypeScript data file (`src/world/`), with a legend (`#` wall, `.` floor, `T` tree, `~` water, `B` pushable block, `C` chest, `K` locked door …). A pure function picks the right tile for edges and corners from the neighbouring cells. Rooms list their exits, enemies, secrets and items.
- **Alternatives:** the Tiled map editor with JSON exports (an extra tool, and diffs in PRs are unreadable); procedural generation (Zelda-style secrets and puzzles need hand design).
- **Tradeoffs:** a little up-front work on the tile picker. In return the maps are readable in PR diffs, and unit tests can check every door leads somewhere and every dungeon can be finished.

### ADR-D02: Screen size and camera — *Accepted 2026-10-20*

- **Decision:** a 320×180 game area (16:9), a 20-pixel status bar and a 20×10-tile room of 16-pixel tiles, scaled by whole numbers on desktop. Flip-screen rooms: the camera slides one room when the hero leaves the edge, and only the current room's enemies run.
- **Alternatives:** a scrolling camera over a big map (more like later Zeldas, but harder to design rooms and puzzles for, and more to simulate).
- **Tradeoffs:** 16:9 fits laptops and phones held sideways.

### ADR-D03: Engine-free game state — *Accepted 2026-10-20*

- **Decision:** the whole game state (hero, inventory, mana, keys, shards, opened chests, broken walls, current room) is one plain object updated by pure functions in `src/logic/` (combat, mana, inventory, doors, progression, reachability). Scenes read it and draw it. Every logic module has 100% coverage (the owner's rule).
- **Tradeoffs:** a clear line between rules and drawing; the save game is just this object, checked and versioned.

### ADR-D04: Save game — *Accepted 2026-10-20*

- **Decision:** one save in localStorage under a single key, holding only game progress (items, shards, hearts, opened chests, location, play time). No names or personal data. It is validated against a schema on load; anything invalid is discarded and the game starts fresh. Saves happen automatically on entering a room with a save point (village, dungeon entrances).
- **Alternative:** a Zelda-style password shown on screen (nothing stored; long passwords are a chore for players).

### ADR-D05: Art stand-ins by runtime tint — *Accepted 2026-10-20*

- **Decision:** the pack has one fantasy dungeon tileset and one potion sprite, so Phaser tints them at runtime to give each dungeon its own colour. Exception (owner, 2026-10-20): a tint can only darken the red potion, so the Mana Brew is a recoloured copy made by `tools/art/mana_brew.py`. The image files are unchanged. The hero's attack is the walk frame plus the pack's slash effect. Jarrett uses the "Guy" sprite and Kira the "PirateGirl" sprite. Dungeon tiles come from the pack's example dungeon image (`preview-simple-dungeon-crawler-set1.png`), used unchanged as a tile sheet. Exception (owner, 2026-10-20): the pack has no key, so the small key is a 12×7 pixel pattern drawn in code (`src/assets/keyArt.ts`); and with no open-chest art, an opened chest vanishes. Exception (owner, 2026-10-20): both have their hair recoloured from red-orange to brown. `tools/art/recolor_hair.py` makes the two PNGs from the pack originals, changing only the two hair colours above each frame's shoes or belt. Exception (owner, 2026-10-20): the shard of the Star of Power is the pack's red Rocky Pass crystal recoloured gold, to match the Star in the inventory, by `tools/art/gold_shard.py`. Exception (owner, 2026-10-20): village rooms draw their forest walls and props from a copy of the forest sheet whose teal ground shadows are recoloured to the village's grass and shade (`tools/art/village_edges.py`), so no teal patches show on the light village grass. Exception (owner, 2026-10-20): the marsh's ponds are built from the Overworld sheet's island shores, used inside out, with their grass recoloured to the forest's and a plain water tile made in its deep-water colours (`tools/art/marsh_water.py`); marsh rooms draw everything with one murky tint. Exception (owner, 2026-10-21): the Mana Crystal, Bog Grotto's prize, is the pack's second red Rocky Pass crystal recoloured to the mana bar's blue by `tools/art/mana_crystal.py`. Exception (owner, 2026-10-22): a tint could only darken the orange enemy orb, so the Vampire's dark shots are a copy of it recoloured purple by `tools/art/dark_shot.py`.

## Code structure

```
src/
├── main.ts             Phaser config, whole-number zoom, test hook in the e2e build only
├── config/tuning.ts    every gameplay number
├── logic/              rules: combat, mana, inventory, doors, progression, reachability, save
├── world/              room data: overworld, dungeons 1–8, vault, secrets
├── scenes/             Boot, Title, World, Inventory, Pause, Ending (thin; call logic/)
├── entities/           hero, enemies, bosses, projectiles (pooled)
├── audio/              sound effects made in code
├── storage/            the save game in localStorage (guarded; checked by logic/save.ts)
└── debug/testHook.ts   window.__dungeonDelve (e2e build only)
tests/
├── unit/               Vitest, 100% coverage on src/logic
├── e2e/                Playwright: Chromium, Firefox, WebKit, Pixel 7; incl. the production CSP
└── release/            release scripts against a fake server
scripts/                release.sh, release-remote.sh, smoke_test.py, zap_check.py, check_repo.py
```
