/**
 * The small key, drawn in code (owner, 2026-10-20: the art pack has no key).
 * One character per pixel: '#' gold, 'o' dark outline, '.' see-through.
 */
export const KEY_PIXELS: readonly string[] = [
  '.ooo........',
  'o###o.......',
  'o#.#oooooooo',
  'o#.########o',
  'o#.#oooo#o#o',
  'o###o...o.o.',
  '.ooo........',
];

export const KEY_COLOURS: Readonly<Record<string, number>> = {
  '#': 0xffd166,
  o: 0x5a3a10,
};
