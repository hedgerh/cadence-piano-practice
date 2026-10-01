// docs/ui.md §2 CircleOfFifths — nodes placed by trig, verified against Path:94–129.
//   cx = 290 + R·cos θ, cy = 290 + R·sin θ, θ = i·30° − 90°, R = 232 outer / 150 inner.

export const CIRCLE = {
  /** Path:94 — 580×580 container. */
  size: 580,
  center: 290,
  outerRadius: 232,
  innerRadius: 150,
  /** Path:95 — outer dashed ring 464 at 58,58. */
  outerRing: 464,
  /** Path:96 — inner dashed ring 300 at 140,140. */
  innerRing: 300,
} as const;

export type CircleNodeState = 'done' | 'current' | 'upcoming';

/** Path:104 (done 72), Path:107 (current 84), Path:108 (upcoming 72), Path:117 (minor 40). */
export const NODE_SIZE = { done: 72, current: 84, upcoming: 72, minor: 40 } as const;

export type Ring = 'outer' | 'inner';

export interface Point {
  cx: number;
  cy: number;
}

export interface NodeBox {
  left: number;
  top: number;
  size: number;
}

/** Centre of slot `i` (0 = top, clockwise) on the given ring. */
export function circlePoint(i: number, ring: Ring): Point {
  const r = ring === 'outer' ? CIRCLE.outerRadius : CIRCLE.innerRadius;
  const theta = ((i * 30 - 90) * Math.PI) / 180;
  return { cx: CIRCLE.center + r * Math.cos(theta), cy: CIRCLE.center + r * Math.sin(theta) };
}

/** Absolute box for a node of `size` centred on slot `i`. */
export function nodeBox(i: number, ring: Ring, size: number): NodeBox {
  const { cx, cy } = circlePoint(i, ring);
  return { left: cx - size / 2, top: cy - size / 2, size };
}

/** Ring boxes (left/top/size) derived from the ring diameters: 58/464 and 140/300. */
export function ringBox(ring: Ring): NodeBox {
  const size = ring === 'outer' ? CIRCLE.outerRing : CIRCLE.innerRing;
  return { left: CIRCLE.center - size / 2, top: CIRCLE.center - size / 2, size };
}
