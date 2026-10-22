# Credits

## Art

From the **Ansimuz Legacy Collection** (CC0 1.0, public domain): https://ansimuz.itch.io/

List every file copied into `public/assets/` here, one per line, as its path from `public/` in backticks, for example assets/ships/player.png. The repo check fails on unlisted or missing files.

### Characters (TinyRPG, Top-Down 16-bit fantasy, Characters pack 1)

- `assets/characters/jarrett.png` — "Guy" (`TinyRPG/Characters/Top-Down-16-bit-fantasy/Characters pack 1/Guy/aseprite.png`), our hero Jarrett, with his hair recoloured from red-orange to brown by `tools/art/recolor_hair.py` (owner request 2026-10-20)
- `assets/characters/kira.png` — "PirateGirl" (`.../PirateGirl/spritesheet.png`), Princess Kira, with her hair recoloured from red-orange to brown by `tools/art/recolor_hair.py` (owner request 2026-10-20)
- `assets/characters/walker.png` — "Blond_kid" (`.../Blond_kid/aseprite.png`), Walker the guide, with his hair recoloured from orange-gold to a paler blonde by `tools/art/recolor_hair.py` (owner request 2026-10-20)
- `assets/characters/shopkeeper.png` — "Guy" (`.../Guy/aseprite.png`), the village shopkeeper, with his hair recoloured grey and his shirt red by `tools/art/recolor_hair.py` (owner request 2026-10-21)

### Enemies

- `assets/enemies/robot-front.png`, `assets/enemies/robot-side.png`, `assets/enemies/robot-back.png` — `TinyRPG/Characters/top-down-dungeon-enemy-robot/Spritesheets/robot-walk-*.png`
- `assets/enemies/bird.png` — `Gothicvania/Characters/flying-bird/spritesheets/flying-creature-cycle-skin.png`
- `assets/enemies/eye.png` — `Gothicvania/Characters/flying-eye-demon/Spritesheet.png`
- `assets/enemies/ghost.png` — `Gothicvania/Characters/enemy-ghost/Spritesheets/no-particles.png`
- `assets/enemies/wolf.png` — `Gothicvania/Characters/wolf-runing-cycle/spritesheets/wolf-runing-cycle-skin.png`
- `assets/enemies/snake.png` — `Warped/Characters/Grotto-escape-2-snake/spritesheets/walk.png`
- `assets/enemies/mushroom.png` — `Misc/Characters/sunny-mushroom/spritesheets/sunny-mushroom-walk.png`
- `assets/enemies/toad.png` — `Misc/Characters/sunny-froggy/Spritesheets/sunny-froggy-walk.png`

### Bosses

- `assets/bosses/treant.png` — `TinyRPG/Characters/Battle Sprites/Monster Pack Files/spritesheets/Treant.png`
- `assets/bosses/frog.png` — `TinyRPG/Characters/Battle Sprites/Living Pack 1/Frog/Frog-sheet.png`
- `assets/bosses/mummy.png` — `TinyRPG/Characters/Battle Sprites/Living Pack 1/Mummy/Mummy-sheet.png`
- `assets/bosses/ogre.png` — `TinyRPG/Characters/Battle Sprites/Living Pack 1/Ogre/Ogre-sheet.png`

### Tiles

- `assets/tiles/forest.png` — `TinyRPG/Environments/Top-Down-Forest/PNG/top-down-forest-tileset.png`
- `assets/tiles/forest-village.png` — a copy of `forest.png` with the teal ground shadows (and bits of forest grass in the props) recoloured to the village's grass and shade by `tools/art/village_edges.py`, for walls and props in village rooms (owner decision 2026-10-20)
- `assets/tiles/marsh-water.png` — pond pieces from `TinyRPG/Environments/Overworld/Overworld 16x16/Tileset/overworld.png`: the islands' shore pieces used inside out (the lower corners flipped), their grass recoloured to the forest's, and a plain water tile in the sheet's own deep-water colours; made by `tools/art/marsh_water.py` (owner decision 2026-10-20)
- `assets/tiles/mountain.png` — `TinyRPG/Environments/Tiny RPG Mountain Files/png/tileset.png` (unchanged)
- `assets/tiles/town.png` — `TinyRPG/Environments/Top-Down-Town/PNG/top-down-town-tileset.png`
- `assets/tiles/dungeon.png` — `TinyRPG/Environments/single-dungeon-crawler/PNG/preview-simple-dungeon-crawler-set1.png` (the pack's example dungeon, used unchanged as a tile sheet)

### Effects

- `assets/effects/slash-horizontal.png`, `assets/effects/slash-upward.png` — `Explosions and Magic/Grotto-escape-2-FX/spritesheets/`
- `assets/effects/puff.png` — `Explosions and Magic/Grotto-escape-2-FX/spritesheets/enemy-death.png`
- `assets/effects/hit.png` — `Explosions and Magic/Hit/hit.png`
- `assets/effects/fire-ball.png` — `Explosions and Magic/Grotto-escape-2-FX/spritesheets/fire-ball.png`
- `assets/effects/bolt.png` — `Explosions and Magic/Warped shooting fx/Bolt/spritesheet.png`
- `assets/effects/enemy-shot.png` — `Gothicvania/Misc/EnemyProjectile/spritesheet.png`
- `assets/effects/snake-spit.png` — `Warped/Characters/Grotto-escape-2-snake/spritesheets/spit.png`
- `assets/effects/ward.png` — `Explosions and Magic/Grotto-escape-2-FX/spritesheets/energy-shield.png`, the Ward spell's bubble
- `assets/effects/spark.png` — a spark barrier: 16×16 tiles cut, unchanged, from the middle of `Explosions and Magic/Warped shooting fx/waveform/spritesheet.png` by `tools/art/spark_barrier.py` (owner decision 2026-10-21)

### Items

- `assets/items/gems.png` — `Misc/gems/spritesheets/gems-spritesheet.png`
- `assets/items/objects.png` — `TinyRPG/Environments/single-dungeon-crawler-objects/PNG/dungeon-crawler-objects-transparent.png`
- `assets/items/dagger.png` — `Gothicvania/Misc/Dagger/dagger.png`
- `assets/items/sword-icon.png` — `Gothicvania/Misc/fantasy weapons set/PNG/3.png`
- `assets/items/mana-brew.png` — the potion from `TinyRPG/Environments/single-dungeon-crawler-objects/PNG/dungeon-crawler-objects-transparent.png` (x 208, y 48), its liquid recoloured from red to blue by `tools/art/mana_brew.py` (owner request 2026-10-20)
- `assets/items/shard.png` — `Gothicvania/Environments/Rocky Pass Files/PNG/Props/crystal-1.png`, a shard of the Star of Power, recoloured from red to gold by `tools/art/gold_shard.py` (owner decision 2026-10-20)
- `assets/items/mana-crystal.png` — `Gothicvania/Environments/Rocky Pass Files/PNG/Props/crystal-2.png`, the Mana Crystal, recoloured from red to blue by `tools/art/mana_crystal.py` (owner decision 2026-10-21)

## Font

- **Press Start 2P** by CodeMan38 (Copyright 2012 The Press Start 2P Project Authors), SIL Open Font License 1.1, used for the status bar. The same file as the games portal and Star Destroyer (source: `google/fonts` repo, `ofl/pressstart2p/`, commit `e06fe11c39051bddaef73ec338a9d1c8175723f1`; SHA-256 `034c77f1f05ec89421e4a63f0e3a4ca1ecf852cc6d2bf611f126f275728e017d`). License text: `src/assets/fonts/PressStart2P-OFL.txt`.
