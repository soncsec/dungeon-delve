import Phaser from 'phaser';
import { SFX, type SfxName } from '../config/tuning';
import { renderSound } from '../logic/sfx';

const cacheKey = (name: SfxName): string => `sfx:${name}`;
const NAMES = Object.keys(SFX.sounds) as SfxName[];

/**
 * The game's sounds, made in code (M2.8; the approach comes from Star Destroyer). The first time, each recipe is
 * rendered into an audio buffer and kept in Phaser's audio cache; after that
 * a sound is just played by name. Without Web Audio the game plays on silently.
 * The M key's mute (Phaser's sound manager) covers these too.
 */
export class Sfx {
  private readonly played = Object.fromEntries(NAMES.map((n) => [n, 0])) as Record<SfxName, number>;

  constructor(private readonly scene: Phaser.Scene) {
    const manager = scene.sound;
    if (!(manager instanceof Phaser.Sound.WebAudioSoundManager)) return;
    const ctx = manager.context;
    for (const name of NAMES) {
      if (scene.cache.audio.exists(cacheKey(name))) continue;
      const samples = renderSound(SFX.sounds[name], ctx.sampleRate);
      const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.getChannelData(0).set(samples);
      scene.cache.audio.add(cacheKey(name), buffer);
    }
  }

  /** Whether the sounds are ready to play (the browser has Web Audio). */
  get ready(): boolean {
    return NAMES.every((n) => this.scene.cache.audio.exists(cacheKey(n)));
  }

  play(name: SfxName): void {
    this.played[name] += 1;
    if (!this.scene.cache.audio.exists(cacheKey(name))) return;
    this.scene.sound.play(cacheKey(name), { volume: SFX.volume });
  }

  /** How many times each sound has been played, for the e2e test hook. */
  counts(): Record<SfxName, number> {
    return { ...this.played };
  }
}
