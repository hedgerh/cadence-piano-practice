// engine.md §2.3 — validateTracks: run in tests and at startup. HANDOFF §4: every chord step
// is diatonic to its level's key, every note is on the 88-key range, ids are unique, unlock
// targets exist. Each error carries a `path` like `tracks[0].levels[3].steps[1].match.notes[2]`.
import {
  CIRCLE_MAJOR,
  CIRCLE_MINOR,
  MAJOR_NUMERALS,
  MINOR_NUMERALS,
  type MatchSpec,
  PRACTICE_RANGE,
  type PitchClass,
  diatonicTriads,
  hintFor,
  inRange88,
  keyTitle,
  noteToMidi,
  pcNumber,
  scale,
} from '@cadence/music';
import { z } from 'zod';
import { type Key, type Level, type Sound, type Step, type Track, TrackSchema } from './types';

export interface ValidationError {
  path: string;
  message: string;
}

const PHRASE_NOTES = 8;

function formatPath(segments: readonly PropertyKey[]): string {
  return segments
    .map((s, i) => (typeof s === 'number' ? `[${s}]` : i === 0 ? String(s) : `.${String(s)}`))
    .join('');
}

type ChoiceSpec = Extract<MatchSpec, { type: 'choice' }>;

/** The choice a step is answered with: the match itself, or a root match's `then`. */
function choiceOf(match: MatchSpec, path: string): { choice: ChoiceSpec; path: string } | null {
  if (match.type === 'choice') return { choice: match, path };
  if (match.type === 'root' && match.then) return choiceOf(match.then, `${path}.then`);
  return null;
}

export function validateTracks(tracks: readonly Track[]): ValidationError[] {
  const parsed = z.array(TrackSchema).safeParse(tracks);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      path: formatPath(['tracks', ...issue.path]),
      message: issue.message,
    }));
  }

  const errors: ValidationError[] = [];
  const err = (path: string, message: string): void => {
    errors.push({ path, message });
  };

  // ---- rule 3 / 6: sounds anywhere
  const checkSound = (sound: Sound, path: string): void => {
    if (sound.type === 'cadence') return;
    sound.notes.forEach((note, n) => {
      if (!inRange88(noteToMidi(note))) err(`${path}.notes[${n}]`, `${note} is off the 88 keys`);
    });
    if (sound.type === 'notes' && sound.gapMs < 0) {
      err(`${path}.gapMs`, `gapMs must be ≥ 0 (got ${sound.gapMs})`);
    }
    if (sound.type === 'phrase' && sound.notes.length !== PHRASE_NOTES) {
      err(
        `${path}.notes`,
        `a phrase has exactly ${PHRASE_NOTES} notes (got ${sound.notes.length})`,
      );
    }
  };

  // ---- rules 2, 3, 6: matches
  const checkMatch = (match: MatchSpec, path: string, key: Key | undefined): void => {
    switch (match.type) {
      case 'chord':
      case 'voicing':
      case 'sequence': {
        if (match.type !== 'chord') {
          match.notes.forEach((note, n) => {
            if (!inRange88(noteToMidi(note))) {
              err(`${path}.notes[${n}]`, `${note} is off the 88 keys`);
            }
          });
        } else {
          const keys = hintFor(match)?.keys ?? [];
          if (keys.some((m) => m < PRACTICE_RANGE.low || m > PRACTICE_RANGE.high)) {
            err(path, 'chord hint placement falls outside the practice range C3..B4');
          }
        }
        if (key) {
          let names: PitchClass[];
          try {
            names = scale(key);
          } catch {
            return; // reported once at the level
          }
          const pcs = new Set(names.map(pcNumber));
          match.notes.forEach((note, n) => {
            const name = note.replace(/-?\d+$/, '') as PitchClass;
            if (!pcs.has(pcNumber(name))) {
              err(`${path}.notes[${n}]`, `${note} is not in ${keyTitle(key)}`);
            } else if (!names.includes(name)) {
              err(`${path}.notes[${n}]`, `${note} is misspelled for ${keyTitle(key)}`);
            }
          });
        }
        return;
      }
      case 'choice':
        if (!match.options.includes(match.answer)) {
          err(`${path}.answer`, `answer "${match.answer}" is not one of the options`);
        }
        return;
      case 'root':
        if (!match.then) err(`${path}.then`, 'a root match needs a `then`');
        else checkMatch(match.then, `${path}.then`, undefined);
        return;
    }
  };

  const checkStep = (step: Step, path: string, level: Level): void => {
    checkMatch(step.match, `${path}.match`, level.key);
    if (step.play) checkSound(step.play, `${path}.play`);
    if (step.context) checkSound(step.context, `${path}.context`);
    if (step.hint) checkSound(step.hint, `${path}.hint`);
  };

  // ---- rules 1, 6: levels
  const levelIds = new Set<string>();
  const checkLevel = (level: Level, path: string, ear: boolean): void => {
    if (levelIds.has(level.id)) err(`${path}.id`, `duplicate level id "${level.id}"`);
    levelIds.add(level.id);

    if (level.key) {
      try {
        scale(level.key);
      } catch {
        err(`${path}.key`, `cannot spell a scale for ${keyTitle(level.key)}`);
      }
    }

    const entries = [
      ...level.steps.map((step, k) => ({ step, path: `${path}.steps[${k}]` })),
      ...(level.pool ?? []).map((step, k) => ({ step, path: `${path}.pool[${k}]` })),
    ];
    const stepIds = new Set<string>();
    for (const { step, path: sp } of entries) {
      if (stepIds.has(step.id)) err(`${sp}.id`, `duplicate step id "${step.id}" in ${level.id}`);
      stepIds.add(step.id);
      checkStep(step, sp, level);
    }

    if (!ear) return;
    if (level.pass && (level.pass.of < 1 || level.pass.correct > level.pass.of)) {
      err(`${path}.pass`, `pass ${level.pass.correct}/${level.pass.of} is impossible`);
    }
    const pool = level.pool ?? [];
    if (pool.length === 0) err(`${path}.pool`, `ear level ${level.id} has an empty pool`);
    const active = level.activeOptions;
    if (!active) return;
    const choices = pool
      .map((step, k) => choiceOf(step.match, `${path}.pool[${k}].match`))
      .filter((c) => c !== null);
    active.forEach((option, n) => {
      if (choices.some((c) => !c.choice.options.includes(option))) {
        err(`${path}.activeOptions[${n}]`, `active option "${option}" is not an answer option`);
      }
    });
    for (const { choice, path: cp } of choices) {
      if (choice.options.includes(choice.answer) && !active.includes(choice.answer)) {
        err(`${cp}.answer`, `answer "${choice.answer}" is not active at ${level.id}`);
      }
    }
  };

  // ---- rule 4: stages and unlocks
  const checkStages = (track: Track, tp: string): void => {
    const stages = track.stages ?? [];
    const ids = new Set<string>();
    stages.forEach((stage, s) => {
      const sp = `${tp}.stages[${s}]`;
      if (ids.has(stage.id)) err(`${sp}.id`, `duplicate stage id "${stage.id}" in ${track.id}`);
      ids.add(stage.id);
      stage.levels.forEach((level, j) => {
        checkLevel(level, `${sp}.levels[${j}]`, true);
      });
      if (!stage.unlock) return;
      if (s === 0) {
        err(`${sp}.unlock`, 'the first stage cannot have an unlock');
        return;
      }
      const unlock = stage.unlock;
      const target = stages.find((t) => t.id === unlock.stage);
      if (!target) {
        err(`${sp}.unlock.stage`, `unlock target "${unlock.stage}" is not a stage of ${track.id}`);
      } else if (unlock.level < 1 || unlock.level > target.levels.length + 1) {
        err(
          `${sp}.unlock.level`,
          `unlock level ${unlock.level} is outside 1..${target.levels.length + 1}`,
        );
      }
    });
    // Each stage has at most one outgoing edge (its unlock target): follow the chain.
    stages.forEach((stage, s) => {
      const chain = [s];
      let cur = stage;
      for (;;) {
        const unlock = cur.unlock;
        const next = unlock ? stages.findIndex((t) => t.id === unlock.stage) : -1;
        const nextStage = stages[next];
        if (next < 0 || nextStage === undefined) return;
        if (next === s) break;
        if (chain.includes(next)) return; // a cycle not through s; reported from its own member
        chain.push(next);
        cur = nextStage;
      }
      if (Math.min(...chain) !== s) return; // report each cycle once
      const names = [...chain, s].map((i) => stages[i]?.id ?? '?').join(' → ');
      err(`${tp}.stages[${s}].unlock`, `unlock cycle: ${names}`);
    });
  };

  // ---- rule 5: circle tracks
  const checkCircle = (track: Track, tp: string): void => {
    const levels = track.levels;
    if (!levels) {
      err(`${tp}.levels`, 'a circle-of-fifths track needs levels');
      return;
    }
    if (levels.length !== 12) {
      err(`${tp}.levels`, `a circle-of-fifths track has 12 levels (got ${levels.length})`);
    }
    levels.forEach((level, j) => {
      const lp = `${tp}.levels[${j}]`;
      checkLevel(level, lp, false);
      if (!level.key) {
        err(`${lp}.key`, 'a circle level needs a key');
        return;
      }
      const circle = level.key.mode === 'major' ? CIRCLE_MAJOR : CIRCLE_MINOR;
      const expected = circle[j];
      if (expected !== undefined && level.key.tonic !== expected) {
        err(`${lp}.key.tonic`, `level ${j + 1} should be ${expected} (got ${level.key.tonic})`);
      }
      // Diatonic-chord levels: the seven numerals in order.
      if (level.steps.length === 0 || !level.steps.every((st) => st.match.type === 'chord')) return;
      const numerals = level.key.mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS;
      if (level.steps.length !== numerals.length) {
        err(`${lp}.steps`, `a chord level has 7 steps (got ${level.steps.length})`);
        return;
      }
      level.steps.forEach((st, k) => {
        if (st.label !== numerals[k]) {
          err(`${lp}.steps[${k}].label`, `expected "${numerals[k] ?? ''}" (got "${st.label}")`);
        }
      });
    });
  };

  // ---- rule 7: lesson chips
  const checkLesson = (track: Track, tp: string): void => {
    const lesson = track.lesson;
    if (!lesson) return;
    lesson.rows.forEach((row, r) => {
      let triads: ReturnType<typeof diatonicTriads>;
      try {
        triads = diatonicTriads(row.key);
      } catch {
        err(`${tp}.lesson.rows[${r}].key`, `cannot spell ${keyTitle(row.key)}`);
        return;
      }
      row.chips.forEach((chip, c) => {
        const cp = `${tp}.lesson.rows[${r}].chips[${c}]`;
        const triad = triads.find((t) => t.numeral === chip.numeral);
        if (!triad)
          err(`${cp}.numeral`, `"${chip.numeral}" is not a numeral of ${keyTitle(row.key)}`);
        else if (triad.quality !== chip.quality) {
          err(`${cp}.quality`, `${chip.numeral} in ${keyTitle(row.key)} is ${triad.quality}`);
        }
      });
    });
    lesson.hear?.sounds.forEach((sound, i) => {
      checkSound(sound, `${tp}.lesson.hear.sounds[${i}]`);
    });
  };

  // ---- rule 1: tracks
  const trackIds = new Set<string>();
  tracks.forEach((track, t) => {
    const tp = `tracks[${t}]`;
    if (trackIds.has(track.id)) err(`${tp}.id`, `duplicate track id "${track.id}"`);
    trackIds.add(track.id);
    if (track.map === 'circle-of-fifths') {
      checkCircle(track, tp);
    } else {
      if (!track.stages) err(`${tp}.stages`, 'a ladder track needs stages');
      (track.levels ?? []).forEach((level, j) => {
        checkLevel(level, `${tp}.levels[${j}]`, true);
      });
    }
    checkStages(track, tp);
    checkLesson(track, tp);
  });

  return errors;
}
