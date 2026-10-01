import type { ComponentType } from 'react';

/**
 * Each feature may export `devScreens: Record<string, ComponentType>` from
 * `features/<feature>/dev.tsx`; the entries are collected here so screen tasks never
 * edit a shared file. Knobs come from the URL search params (read them inside the screen).
 */
const modules = import.meta.glob<{ devScreens?: Record<string, ComponentType> }>(
  '../features/*/dev.tsx',
  { eager: true },
);

export const devScreens: Record<string, ComponentType> = Object.assign(
  {},
  ...Object.values(modules).map((m) => m.devScreens ?? {}),
) as Record<string, ComponentType>;
