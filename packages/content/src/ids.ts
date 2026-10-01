// engine.md §2.1 — progress key for a step = `${levelId}/${stepId}`.

/** The progress-row key of a step: stepKey("a-major", "d2") === "a-major/d2". */
export function stepKey(levelId: string, stepId: string): string {
  return `${levelId}/${stepId}`;
}

/** ASCII form of a roman numeral for use in ids: "vii°" → "viidim", "ii°" → "iidim". */
export function numeralAscii(numeral: string): string {
  return numeral.replace(/°/g, 'dim');
}

/** ASCII slug of a pitch class for ids: "F#" → "fs", "Bb" → "bb". */
export function pcSlug(pc: string): string {
  return pc.replace(/#/g, 's').toLowerCase();
}
