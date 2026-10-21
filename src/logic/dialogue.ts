/**
 * Talking (engine-free, unit tested): a speech is a list of paragraphs, each
 * wrapped to the text box's width and shown a few lines at a time. A page can
 * hand Jarrett items as it appears.
 */
import type { ItemId } from './inventory';

export interface Paragraph {
  text: string;
  /** Items given when this paragraph's first page shows. */
  give?: readonly ItemId[];
}

export interface Page {
  lines: string[];
  give: readonly ItemId[];
}

/** Wraps text into lines of at most `width` characters, breaking between words (a long word is split). */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    let word = raw;
    while (word.length > width) {
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Splits a speech into pages of at most `perPage` lines; a paragraph always starts a new page. */
export function paginate(speech: readonly Paragraph[], width: number, perPage: number): Page[] {
  const pages: Page[] = [];
  for (const p of speech) {
    const lines = wrap(p.text, width);
    for (let i = 0; i < lines.length; i += perPage) {
      pages.push({ lines: lines.slice(i, i + perPage), give: i === 0 ? (p.give ?? []) : [] });
    }
  }
  return pages;
}
