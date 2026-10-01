// engine.md §4 SettingsService: profile get/update, track settings, enroll, markLessonSeen.
// First run: profile with the onboarding name, timezone from Intl, enroll major chords + ear
// training (engine.md §6.15).
import { type ServiceContext, timezoneOf } from './context';
import { systemTimezone } from './dates';
import type { MeDto, MeUpdate, TrackSettingsDto, TrackSettingsInput } from './dto';
import type { ProfilePatch, ProfileRow, TrackSettingsRow, Visibility } from './ports';
import type { StreakService } from './streak.service';

export const DEFAULT_ENROLLED: readonly string[] = ['major-diatonic-chords', 'ear-training'];

export interface SettingsService {
  profile(): ProfileRow | null;
  timezone(): string;
  createProfile(input: { name: string; timezone?: string }): ProfileRow;
  me(): MeDto;
  /** `me.update`; creates the profile (and default enrolment) on first run. */
  updateMe(patch: MeUpdate): MeDto;
  trackSettings(trackId: string): TrackSettingsRow | null;
  trackSettingsDto(trackId: string): TrackSettingsDto;
  setTrackSettings(input: TrackSettingsInput): TrackSettingsDto;
  enroll(trackId: string): TrackSettingsRow;
  markLessonSeen(trackId: string): void;
  visibility(trackId: string): Visibility;
  /** Enrolled ∧ active (availability is checked by the plan). */
  isActive(trackId: string): boolean;
}

export function createSettingsService(ctx: ServiceContext, streak: StreakService): SettingsService {
  const { repos, content, clock } = ctx;

  const enroll = (trackId: string): TrackSettingsRow => {
    content.requireTrack(trackId);
    const existing = repos.trackSettings.get(trackId);
    if (existing) {
      return existing.active
        ? existing
        : (repos.trackSettings.update(trackId, { active: true }) ?? existing);
    }
    return repos.trackSettings.upsert({
      trackId,
      visibility: 'all',
      active: true,
      enrolledAt: clock.now(),
      lastNewLevelAt: null,
      lessonSeenAt: null,
    });
  };

  const createProfile = ({ name, timezone }: { name: string; timezone?: string }): ProfileRow =>
    repos.transaction(() => {
      const row = repos.profile.create({
        name: name.trim(),
        timezone: timezone ?? systemTimezone(),
        now: clock.now(),
      });
      for (const id of DEFAULT_ENROLLED) if (content.track(id)) enroll(id);
      return row;
    });

  const me = (): MeDto => {
    const p = repos.profile.get();
    const midi: MeDto['midi'] = {};
    if (p?.midiDeviceId) midi.deviceId = p.midiDeviceId;
    if (p?.midiDeviceName) midi.deviceName = p.midiDeviceName;
    return {
      name: p?.name ?? '',
      timezone: p?.timezone ?? systemTimezone(),
      xpTotal: p?.xpTotal ?? 0,
      streak: p ? streak.current() : { days: 0, keptToday: false, atRisk: false },
      midi,
      settings: { showMarkPlayedAlways: p?.showMarkPlayedAlways ?? false },
      firstRun: p === null,
    };
  };

  const toDto = (trackId: string, row: TrackSettingsRow | null): TrackSettingsDto => ({
    trackId,
    visibility: row?.visibility ?? 'all',
    active: row?.active ?? false,
    enrolled: row !== null,
    lessonSeen: row?.lessonSeenAt != null,
  });

  return {
    profile: () => repos.profile.get(),
    timezone: () => timezoneOf(ctx),
    createProfile,
    me,

    updateMe(patch) {
      repos.transaction(() => {
        if (!repos.profile.get()) {
          createProfile({
            name: patch.name ?? '',
            ...(patch.timezone === undefined ? {} : { timezone: patch.timezone }),
          });
        }
        const p: ProfilePatch = {};
        if (patch.name !== undefined) p.name = patch.name.trim();
        if (patch.timezone !== undefined) p.timezone = patch.timezone;
        if (patch.midi?.deviceId !== undefined) p.midiDeviceId = patch.midi.deviceId;
        if (patch.midi?.deviceName !== undefined) p.midiDeviceName = patch.midi.deviceName;
        if (patch.settings?.showMarkPlayedAlways !== undefined) {
          p.showMarkPlayedAlways = patch.settings.showMarkPlayedAlways;
        }
        if (Object.keys(p).length > 0) repos.profile.update(p, clock.now());
      });
      return me();
    },

    trackSettings: (trackId) => repos.trackSettings.get(trackId),
    trackSettingsDto: (trackId) => toDto(trackId, repos.trackSettings.get(trackId)),

    setTrackSettings({ trackId, visibility, active }) {
      content.requireTrack(trackId);
      return repos.transaction(() => {
        let row = repos.trackSettings.get(trackId);
        if (!row && active !== false) row = enroll(trackId);
        if (!row) return toDto(trackId, null);
        const patched = repos.trackSettings.update(trackId, {
          ...(visibility === undefined ? {} : { visibility }),
          ...(active === undefined ? {} : { active }),
        });
        return toDto(trackId, patched ?? row);
      });
    },

    enroll,

    markLessonSeen(trackId) {
      repos.transaction(() => {
        if (!repos.trackSettings.get(trackId)) enroll(trackId);
        repos.trackSettings.update(trackId, { lessonSeenAt: clock.now() });
      });
    },

    visibility: (trackId) => repos.trackSettings.get(trackId)?.visibility ?? 'all',
    isActive: (trackId) => repos.trackSettings.get(trackId)?.active ?? false,
  };
}
