/**
 * On-screen controls for phones and tablets (PROJECT.md §3e; owner 2026-10-20,
 * brought forward 2026-10-21): a pad on the left, attack, switch and spell
 * buttons on the right, and the potions and the bag above them.
 *
 * Each control sends the key the keyboard would (as a browser key event), so
 * every scene's KeyInput sees it: the title menu, the game, the bag, the
 * shop and Walker's talks all work by touch without knowing about it.
 */
import { TOUCH } from '../config/tuning';
import { NO_KEYS, padChanges, padKeys, type PadKeys } from '../logic/touchPad';

/** Sends a key event as the keyboard would. */
function send(type: 'keydown' | 'keyup', code: string): void {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
}

/** The buttons: the key each sends, its label, and its look (a CSS class). */
const BUTTONS: readonly { code: string; label: string; kind: string }[] = [
  { code: 'Space', label: 'HIT', kind: 'attack' },
  { code: 'KeyX', label: 'SWAP', kind: 'switch' },
  { code: 'KeyC', label: 'MAGIC', kind: 'spell' },
  { code: 'Digit1', label: 'HEAL', kind: 'health' },
  { code: 'Digit2', label: 'MANA', kind: 'mana' },
  { code: 'KeyI', label: 'BAG', kind: 'bag' },
];

/** Adds the controls to the page. */
export function installTouchControls(): HTMLElement {
  const root = document.createElement('div');
  root.id = 'touch';

  // The pad: a finger anywhere on it holds the arrows it points to.
  const pad = document.createElement('div');
  pad.className = 'pad';
  const knob = document.createElement('div');
  knob.className = 'knob';
  pad.append(knob);
  let held: PadKeys = NO_KEYS;
  let finger: number | null = null;
  const steer = (e: PointerEvent): void => {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const now = padKeys(dx, dy, (r.width / 2) * TOUCH.deadZone);
    const { press, release } = padChanges(held, now);
    for (const code of release) send('keyup', code);
    for (const code of press) send('keydown', code);
    held = now;
    // The knob follows the finger, as far as the pad's rim.
    const reach = r.width / 2;
    const len = Math.hypot(dx, dy);
    const k = len > reach ? reach / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  const letGo = (): void => {
    for (const code of padChanges(held, NO_KEYS).release) send('keyup', code);
    held = NO_KEYS;
    finger = null;
    knob.style.transform = '';
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    finger = e.pointerId;
    // Keep following this finger even when it slides off the pad.
    try {
      pad.setPointerCapture(e.pointerId);
    } catch {
      // A made-up pointer (no real finger behind it) can't be captured; nothing is lost.
    }
    steer(e);
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === finger) steer(e);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    pad.addEventListener(type, (e) => {
      if (e.pointerId === finger) letGo();
    });
  }

  // The buttons: down while a finger is on one, like holding a key.
  const actions = document.createElement('div');
  actions.className = 'actions';
  const extras = document.createElement('div');
  extras.className = 'extras';
  for (const b of BUTTONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `button ${b.kind}`;
    button.textContent = b.label;
    button.dataset.key = b.code;
    let down = false;
    const release = (): void => {
      if (!down) return;
      down = false;
      button.classList.remove('down');
      send('keyup', b.code);
    };
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (down) return;
      down = true;
      button.classList.add('down');
      send('keydown', b.code);
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      button.addEventListener(type, release);
    }
    (b.kind === 'attack' || b.kind === 'switch' || b.kind === 'spell' ? actions : extras).append(
      button,
    );
  }

  root.append(pad, actions, extras);
  // Long presses must not open the page's context menu or select text.
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  document.body.append(root);
  return root;
}
