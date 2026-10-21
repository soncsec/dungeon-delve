/**
 * Whether this is a phone or tablet: it has touch and its main pointer is a
 * finger (as Star Destroyer decides). Laptops with touchscreens count as
 * desktops: their main pointer is a mouse. `?touch=1` in the URL forces the
 * touch controls on, to try them on a desktop.
 */
export function isTouchDevice(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('touch') === '1') return true;
    return navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
