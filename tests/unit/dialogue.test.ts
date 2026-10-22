import { describe, expect, it } from 'vitest';
import { forDevice, paginate, wrap } from '../../src/logic/dialogue';

describe('wrap', () => {
  it('breaks between words to fit the width', () => {
    expect(wrap('THE QUICK BROWN FOX JUMPS', 10)).toEqual(['THE QUICK', 'BROWN FOX', 'JUMPS']);
  });

  it('ignores extra spaces and keeps a word that fits exactly', () => {
    expect(wrap('  ONE   TWO  ', 7)).toEqual(['ONE TWO']);
    expect(wrap('ABCDEFG HI', 7)).toEqual(['ABCDEFG', 'HI']);
    expect(wrap('', 7)).toEqual([]);
  });

  it('splits a word longer than the width', () => {
    expect(wrap('A ABCDEFGHIJ B', 4)).toEqual(['A', 'ABCD', 'EFGH', 'IJ B']);
    expect(wrap('ABCDEFGH', 4)).toEqual(['ABCD', 'EFGH']);
  });
});

describe('paginate', () => {
  it('shows a few lines a page, starting each paragraph on a new page', () => {
    const pages = paginate(
      [
        { text: 'ONE TWO THREE FOUR FIVE' },
        { text: 'TAKE THESE', give: ['wooden-sword', 'wooden-shield'] },
      ],
      9,
      2,
    );
    expect(pages).toEqual([
      { lines: ['ONE TWO', 'THREE'], give: [] },
      { lines: ['FOUR FIVE'], give: [] },
      { lines: ['TAKE', 'THESE'], give: ['wooden-sword', 'wooden-shield'] },
    ]);
  });

  it('gives items only on the first page of their paragraph', () => {
    const pages = paginate([{ text: 'A B C D', give: ['daggers'] }], 1, 2);
    expect(pages.map((p) => p.give)).toEqual([['daggers'], []]);
  });
});

describe('forDevice', () => {
  const speech = [{ text: 'PRESS C.', touch: 'TAP MAGIC.' }, { text: 'HELLO.' }];

  it('keeps the words on a keyboard, and uses the touch words on a touchscreen', () => {
    expect(forDevice(speech, false)).toEqual(speech);
    expect(forDevice(speech, true).map((p) => p.text)).toEqual(['TAP MAGIC.', 'HELLO.']);
  });
});
