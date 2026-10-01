// Test harness: real content + in-memory repos + FakeClock.
import { type Track, buildTracks } from '@cadence/content';
import { FakeClock } from '../clock';
import { type ContentService, createContentService } from '../content.service';
import { type Services, createServices } from '../services';
import { createMemoryRepos } from './memoryRepos';

export const TZ = 'America/Los_Angeles';
/** 2026-10-01 19:00 in Los Angeles (PDT, UTC−7): "Good evening". */
export const EVENING = '2026-10-02T02:00:00Z';

let tracks: Track[] | null = null;
let content: ContentService | null = null;

export function testContent(): ContentService {
  tracks ??= buildTracks();
  content ??= createContentService(tracks);
  return content;
}

export interface TestHarness {
  services: Services;
  clock: FakeClock;
}

export function createHarness(start: string | number = EVENING): TestHarness {
  const clock = new FakeClock(start);
  const services = createServices({ repos: createMemoryRepos(), content: testContent(), clock });
  return { services, clock };
}

/** Harness with a profile (timezone America/Los_Angeles) and the default enrolment. */
export function onboarded(start: string | number = EVENING, name = 'Harry'): TestHarness {
  const h = createHarness(start);
  h.services.settings.createProfile({ name, timezone: TZ });
  return h;
}
