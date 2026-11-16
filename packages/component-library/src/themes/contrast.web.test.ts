import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// WCAG 2 contrast for the text/background pairs the mobile-shell spec names,
// read from the theme files themselves so a token change is caught here.
function readVars(file: string) {
  const css = readFileSync(join(__dirname, file), 'utf8');
  return Object.fromEntries(
    [...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim(),
    ]),
  );
}

const palette = readVars('palette.css');

function resolver(theme: string) {
  const vars = { ...palette, ...readVars(`${theme}.css`) };
  const resolve = (value: string): string => {
    const ref = value.match(/^var\(--([\w-]+)\)$/);
    return ref ? resolve(vars[ref[1]] ?? `undefined --${ref[1]}`) : value;
  };
  return (token: string) => resolve(`var(--color-${token})`);
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map(c =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: Array<[text: string, background: string]> = [
  ['pageText', 'pageBackground'],
  ['pageText', 'cardBackground'],
  ['pageTextLight', 'pageBackground'],
  ['pageTextLight', 'cardBackground'],
  ['buttonPrimaryText', 'buttonPrimaryBackground'],
  ['accentSubtleText', 'accentSubtleBackground'],
  ['toBudgetPositive', 'cardBackground'],
  ['balancePositiveText', 'balancePositiveBackground'],
  ['balanceWarningText', 'balanceWarningBackground'],
  ['balanceNegativeText', 'balanceNegativeBackground'],
  ['balanceZeroText', 'balanceZeroBackground'],
];

describe('theme contrast', () => {
  describe('text pairs', () => {
    for (const theme of ['light', 'dark', 'midnight']) {
      const color = resolver(theme);
      for (const [text, background] of PAIRS) {
        it(`${theme}: ${text} on ${background} is at least 4.5:1`, () => {
          const fg = color(text);
          const bg = color(background);
          expect(fg).toMatch(/^#[0-9a-f]{6}$/i);
          expect(bg).toMatch(/^#[0-9a-f]{6}$/i);
          expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  });
});
