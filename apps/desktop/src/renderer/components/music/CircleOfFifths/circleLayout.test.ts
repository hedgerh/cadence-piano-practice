import { describe, expect, it } from 'vitest';
import { NODE_SIZE, nodeBox, ringBox } from './circleLayout';

// Path.dc.html:104–115 (majors; A at index 3 is the 84px current node) and 117–128 (minors).
const MAJORS: ReadonlyArray<readonly [string, number, number, number]> = [
  ['C', 254, 22, 72],
  ['G', 370, 53, 72],
  ['D', 455, 138, 72],
  ['A', 480, 248, 84],
  ['E', 455, 370, 72],
  ['B', 370, 455, 72],
  ['G♭', 254, 486, 72],
  ['D♭', 138, 455, 72],
  ['A♭', 53, 370, 72],
  ['E♭', 22, 254, 72],
  ['B♭', 53, 138, 72],
  ['F', 138, 53, 72],
];
const MINORS: ReadonlyArray<readonly [string, number, number]> = [
  ['Am', 270, 120],
  ['Em', 345, 140],
  ['Bm', 400, 195],
  ['F♯m', 420, 270],
  ['C♯m', 400, 345],
  ['G♯m', 345, 400],
  ['E♭m', 270, 420],
  ['B♭m', 195, 400],
  ['Fm', 140, 345],
  ['Cm', 120, 270],
  ['Gm', 140, 195],
  ['Dm', 195, 140],
];

describe('circleLayout (docs/ui.md §2 CircleOfFifths, Path:94–129)', () => {
  it.each(MAJORS.map((m, i) => [i, ...m] as const))(
    'outer %i (%s) within 0.1px of the design',
    (i, _label, left, top, size) => {
      const box = nodeBox(i, 'outer', size);
      expect(Math.abs(box.left - left)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(box.top - top)).toBeLessThanOrEqual(0.1);
    },
  );

  it.each(MINORS.map((m, i) => [i, ...m] as const))(
    'inner %i (%s) within 0.1px of the design',
    (i, _label, left, top) => {
      const box = nodeBox(i, 'inner', NODE_SIZE.minor);
      expect(Math.abs(box.left - left)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(box.top - top)).toBeLessThanOrEqual(0.1);
    },
  );

  it('ring boxes match Path:95–96', () => {
    expect(ringBox('outer')).toEqual({ left: 58, top: 58, size: 464 });
    expect(ringBox('inner')).toEqual({ left: 140, top: 140, size: 300 });
  });
});
