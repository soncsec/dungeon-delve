/**
 * Keyboard input read straight from the browser's key events.
 *
 * Phaser queues key events and clears its queue at the end of each game step,
 * separately from when each scene reads it. When frames run unevenly the two
 * drift, and a press is occasionally lost or delivered twice (seen in the e2e
 * tests under load). Reading the browser's events directly avoids that: every
 * press is seen exactly once, and held keys can't get stuck.
 */
export class KeyInput {
  private readonly held = new Set<string>();
  private presses: string[] = [];

  private readonly onDown = (e: KeyboardEvent): void => {
    if (!this.watched.has(e.code)) return;
    // Stop arrows and Space from scrolling the page.
    e.preventDefault();
    if (!e.repeat) this.presses.push(e.code);
    this.held.add(e.code);
  };

  private readonly onUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  /** Switching windows or tabs swallows key-ups, so forget held keys then. */
  private readonly onBlur = (): void => {
    this.held.clear();
  };

  /** @param watched the key codes this game uses, e.g. 'ArrowLeft', 'KeyA', 'Space' */
  constructor(private readonly watched: ReadonlySet<string>) {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  /** Whether any of the given keys is held down. */
  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.held.has(c));
  }

  /** Keys pressed since the last call, oldest first (auto-repeat excluded). */
  takePresses(): string[] {
    const p = this.presses;
    this.presses = [];
    return p;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
    this.held.clear();
    this.presses = [];
  }
}
