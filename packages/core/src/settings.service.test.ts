import { describe, expect, it } from 'vitest';
import { DEFAULT_ENROLLED } from './settings.service';
import { TZ, createHarness, onboarded } from './testing/harness';

// engine.md §4 SettingsService, §6.15 default enrolment.
describe('SettingsService', () => {
  it('first run: me() reports firstRun and empty defaults; no plan is persisted', () => {
    const { services } = createHarness();
    const me = services.settings.me();
    expect(me).toMatchObject({ firstRun: true, xpTotal: 0, name: '', midi: {} });
    expect(me.streak).toEqual({ days: 0, keptToday: false, atRisk: false });
    const today = services.plan.getToday();
    expect(today.blocks).toEqual([]);
    expect(services.repos.plans.get(today.day)).toBeNull();
  });

  it('me.update on first run creates the profile and enrolls major chords + ear training', () => {
    const { services } = createHarness();
    const me = services.settings.updateMe({ name: ' Harry ', timezone: TZ });
    expect(me).toMatchObject({ firstRun: false, name: 'Harry', timezone: TZ });
    expect(DEFAULT_ENROLLED).toEqual(['major-diatonic-chords', 'ear-training']);
    expect(
      services.repos.trackSettings
        .list()
        .map((r) => r.trackId)
        .sort(),
    ).toEqual([...DEFAULT_ENROLLED].sort());
    expect(services.repos.trackSettings.get('ear-training')).toMatchObject({
      visibility: 'all',
      active: true,
      lastNewLevelAt: null,
      lessonSeenAt: null,
    });
  });

  it('me.update patches midi device and settings', () => {
    const { services } = onboarded();
    const me = services.settings.updateMe({
      midi: { deviceId: 'fp30x', deviceName: 'Roland FP-30X' },
      settings: { showMarkPlayedAlways: true },
    });
    expect(me.midi).toEqual({ deviceId: 'fp30x', deviceName: 'Roland FP-30X' });
    expect(me.settings.showMarkPlayedAlways).toBe(true);
    expect(services.settings.updateMe({ midi: { deviceId: null, deviceName: null } }).midi).toEqual(
      {},
    );
  });

  it('tracks.setSettings enrolls on demand and persists visibility per track', () => {
    const { services } = onboarded();
    expect(services.settings.trackSettingsDto('minor-diatonic-chords').enrolled).toBe(false);
    const dto = services.settings.setTrackSettings({
      trackId: 'minor-diatonic-chords',
      active: true,
    });
    expect(dto).toEqual({
      trackId: 'minor-diatonic-chords',
      visibility: 'all',
      active: true,
      enrolled: true,
      lessonSeen: false,
    });
    services.settings.setTrackSettings({ trackId: 'major-diatonic-chords', visibility: 'num' });
    expect(services.settings.visibility('major-diatonic-chords')).toBe('num');
    expect(services.progress.startLevel('c-major', 'learn').visibility).toBe('num');
    services.settings.setTrackSettings({ trackId: 'ear-training', active: false });
    expect(services.settings.isActive('ear-training')).toBe(false);
    expect(() => services.settings.setTrackSettings({ trackId: 'nope' })).toThrow(/Unknown track/);
  });

  it('markLessonSeen stamps lesson_seen_at (enrolling if needed)', () => {
    const { services, clock } = onboarded();
    services.settings.markLessonSeen('minor-diatonic-chords');
    expect(services.repos.trackSettings.get('minor-diatonic-chords')?.lessonSeenAt).toBe(
      clock.now(),
    );
    expect(services.settings.trackSettingsDto('minor-diatonic-chords').lessonSeen).toBe(true);
  });
});
