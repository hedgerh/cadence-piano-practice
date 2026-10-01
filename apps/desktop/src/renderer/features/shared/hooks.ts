import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, queryKey } from '../../lib/api';
import type { ChannelInput, ChannelOutput } from '@shared/ipc/contracts';

export type MeDto = ChannelOutput<'me.get'>;
export type TodayDto = ChannelOutput<'plan.getToday'>;
export type TrackSummary = ChannelOutput<'content.tracks'>[number];
export type TrackDto = ChannelOutput<'content.track'>;
export type TrackOverviewDto = ChannelOutput<'tracks.overview'>;
export type SessionDto = ChannelOutput<'sessions.start'>;
export type CompleteDto = ChannelOutput<'sessions.finish'>;
export type StartSessionInput = ChannelInput<'sessions.start'>;

/** Query-key roots used for invalidation after mutations. */
export const KEYS = {
  me: ['me.get'] as const,
  today: ['plan.getToday'] as const,
  tracks: ['content.tracks'] as const,
  overview: ['tracks.overview'] as const,
};

export function useMe() {
  return useQuery({ queryKey: queryKey('me.get'), queryFn: () => api['me.get']() });
}

export function useToday() {
  return useQuery({ queryKey: queryKey('plan.getToday'), queryFn: () => api['plan.getToday']() });
}

export function useTracks() {
  return useQuery({ queryKey: queryKey('content.tracks'), queryFn: () => api['content.tracks']() });
}

export function useTrack(trackId: string | undefined) {
  return useQuery({
    queryKey: queryKey('content.track', { trackId: trackId ?? '' }),
    queryFn: () => api['content.track']({ trackId: trackId ?? '' }),
    enabled: trackId !== undefined,
    staleTime: Infinity,
  });
}

export function useTrackOverview(trackId: string | undefined) {
  return useQuery({
    queryKey: queryKey('tracks.overview', { trackId: trackId ?? '' }),
    queryFn: () => api['tracks.overview']({ trackId: trackId ?? '' }),
    enabled: trackId !== undefined,
  });
}

/** Invalidate everything a finished/recorded step can change (XP, streak, plan, overviews). */
export function useInvalidateProgress() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: KEYS.me }),
      qc.invalidateQueries({ queryKey: KEYS.today }),
      qc.invalidateQueries({ queryKey: KEYS.overview }),
    ]);
}

export function useStartSession() {
  const invalidate = useInvalidateProgress();
  return useMutation({
    mutationFn: (input: StartSessionInput) => api['sessions.start'](input),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChannelInput<'me.update'>) => api['me.update'](input),
    onSuccess: (me) => qc.setQueryData(queryKey('me.get'), me),
  });
}

export function useSetTrackSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChannelInput<'tracks.setSettings'>) => api['tracks.setSettings'](input),
    onSuccess: () =>
      void Promise.all([
        qc.invalidateQueries({ queryKey: KEYS.today }),
        qc.invalidateQueries({ queryKey: KEYS.overview }),
        qc.invalidateQueries({ queryKey: KEYS.tracks }),
      ]),
  });
}

/** Route for a started session, by level kind (chord practice vs ear drill). */
export function sessionRoute(session: { sessionId: string; levelId: string; isEar: boolean }) {
  const base = session.isEar ? `/ear/${session.levelId}` : `/practice/${session.levelId}`;
  return `${base}?session=${encodeURIComponent(session.sessionId)}`;
}
