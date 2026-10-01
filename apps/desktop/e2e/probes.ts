import { expect, type Locator } from '@playwright/test';

/** camelCase CSS property → expected computed value, e.g. `{ borderBottom: '2px solid rgb(…)' }`. */
export type StyleExpectations = Record<string, string | RegExp>;

const kebab = (prop: string) => prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Read computed styles (camelCase keys) for the first element matching `locator`. */
export async function computedStyles(
  locator: Locator,
  props: readonly string[],
): Promise<Record<string, string>> {
  const pairs = props.map((p) => [p, kebab(p)] as const);
  return locator.first().evaluate((el, list) => {
    const cs = getComputedStyle(el);
    return Object.fromEntries(list.map(([camel, css]) => [camel, cs.getPropertyValue(css)]));
  }, pairs);
}

/**
 * Assert computed styles (docs/ui.md §5 fidelity probes). Strings must match exactly,
 * RegExps must match. Reports every mismatch at once.
 */
export async function expectStyle(
  locator: Locator,
  expected: StyleExpectations,
  label?: string,
): Promise<void> {
  const actual = await computedStyles(locator, Object.keys(expected));
  const mismatches = Object.entries(expected).filter(([prop, want]) => {
    const got = actual[prop] ?? '';
    return typeof want === 'string' ? got !== want : !want.test(got);
  });
  expect(
    mismatches.map(([prop, want]) => `${prop}: expected ${String(want)}, got "${actual[prop]}"`),
    label ?? 'computed styles',
  ).toEqual([]);
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function box(locator: Locator): Promise<Box> {
  const b = await locator.first().boundingBox();
  if (!b) throw new Error('element has no box (not visible?)');
  return b;
}

/** Assert a rendered size within `tolerance` px. */
export async function expectSize(
  locator: Locator,
  size: { width?: number; height?: number },
  tolerance = 0.5,
): Promise<void> {
  const b = await box(locator);
  if (size.width !== undefined)
    expect(Math.abs(b.width - size.width)).toBeLessThanOrEqual(tolerance);
  if (size.height !== undefined)
    expect(Math.abs(b.height - size.height)).toBeLessThanOrEqual(tolerance);
}
