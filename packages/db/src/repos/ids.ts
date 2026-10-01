import { nanoid } from 'nanoid';

/** Text primary keys (docs/engine.md §3). */
export const newId = (): string => nanoid();
