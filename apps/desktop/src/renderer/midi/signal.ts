/** A readable value with change notifications (the `$` fields on MidiInput). */
export interface Readable<T> {
  get(): T;
  subscribe(listener: (value: T) => void): () => void;
}

/** A stream of events with no current value. */
export interface Stream<T> {
  subscribe(listener: (value: T) => void): () => void;
}

export interface Writable<T> extends Readable<T> {
  set(value: T): void;
}

export interface Emitter<T> extends Stream<T> {
  emit(value: T): void;
}

export function writable<T>(initial: T): Writable<T> {
  let value = initial;
  const listeners = new Set<(value: T) => void>();
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const l of [...listeners]) l(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function emitter<T>(): Emitter<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    emit(value) {
      for (const l of [...listeners]) l(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
