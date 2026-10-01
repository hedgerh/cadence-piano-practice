import { describe, expect, it, vi } from 'vitest';
import type { ChannelOutput } from '@shared/ipc/contracts';
import { chooseMidiDevice, preferenceOf, restoreMidiPreference } from './devicePreference';
import { createFakeMidiAccess } from './fakeMidiAccess';
import { FakeMidiInput } from './FakeMidiInput';
import type { NoteEvent } from './MidiInput';
import { createMidiHub } from './midiStore';
import { WebMidiInput } from './WebMidiInput';

// Task 16 — MIDI device picker, hot-plug and preference (docs/ui.md §4).

const FP30 = { id: 'fp30x', name: 'Roland FP-30X' };
const KEYSTEP = { id: 'keystep', name: 'Arturia KeyStep' };

async function webInput(devices = [FP30, KEYSTEP], preference = null as null | typeof FP30) {
  const access = createFakeMidiAccess(devices);
  const input = new WebMidiInput(access.navigator, { preference });
  await input.start();
  return { access, input };
}

describe('WebMidiInput device selection', () => {
  it('lists every connected port and listens to the first one by default', async () => {
    const { access, input } = await webInput();
    expect(input.devices$.get()).toEqual([FP30, KEYSTEP]);
    expect(input.status$.get()).toEqual({
      kind: 'connected',
      deviceName: FP30.name,
      deviceId: FP30.id,
    });
    expect(access.listening()).toEqual([FP30.id]);
    access.send(KEYSTEP.id, [0x90, 60, 100]);
    expect(input.held$.get().size).toBe(0);
    access.send(FP30.id, [0x90, 60, 100]);
    expect([...input.held$.get()]).toEqual([60]);
  });

  it('select() switches to a specific input id and releases held notes', async () => {
    const { access, input } = await webInput();
    const events: NoteEvent[] = [];
    input.events$.subscribe((e) => events.push(e));
    access.send(FP30.id, [0x90, 64, 90]);
    input.select({ id: KEYSTEP.id, name: KEYSTEP.name });
    expect(input.held$.get().size).toBe(0);
    expect(events.map((e) => e.type)).toEqual(['on', 'off']);
    expect(input.status$.get()).toMatchObject({ kind: 'connected', deviceId: KEYSTEP.id });
    expect(access.listening()).toEqual([KEYSTEP.id]);
    access.send(KEYSTEP.id, [0x90, 67, 80]);
    expect([...input.held$.get()]).toEqual([67]);
  });

  it('honours a preference given at construction, matching by name when the id changed', async () => {
    const byId = await webInput([FP30, KEYSTEP], KEYSTEP);
    expect(byId.input.status$.get()).toMatchObject({ deviceId: KEYSTEP.id });
    const byName = await webInput([FP30, { id: 'new-port-id', name: KEYSTEP.name }], {
      id: 'stale-id',
      name: KEYSTEP.name,
    });
    expect(byName.input.status$.get()).toMatchObject({ deviceId: 'new-port-id' });
  });

  it('hot-plug: unplugging the chosen keyboard falls back, clears held notes, and returns', async () => {
    const { access, input } = await webInput([FP30, KEYSTEP], KEYSTEP);
    access.send(KEYSTEP.id, [0x90, 60, 100]);
    access.send(KEYSTEP.id, [0x90, 64, 100]);
    access.unplug(KEYSTEP.id);
    expect(input.held$.get().size).toBe(0);
    expect(input.devices$.get()).toEqual([FP30]);
    expect(input.status$.get()).toMatchObject({ deviceId: FP30.id });
    access.plug(KEYSTEP);
    expect(input.status$.get()).toMatchObject({ deviceId: KEYSTEP.id });
    expect(input.devices$.get()).toEqual([FP30, KEYSTEP]);
  });

  it('hot-plug: the last keyboard leaving reports no-device; plugging one back reconnects', async () => {
    const { access, input } = await webInput([FP30]);
    access.send(FP30.id, [0x90, 60, 100]);
    access.unplug(FP30.id);
    expect(input.held$.get().size).toBe(0);
    expect(input.status$.get()).toEqual({ kind: 'no-device' });
    expect(input.devices$.get()).toEqual([]);
    access.plug(FP30);
    expect(input.status$.get()).toMatchObject({ kind: 'connected', deviceId: FP30.id });
    access.send(FP30.id, [0x90, 62, 100]);
    expect([...input.held$.get()]).toEqual([62]);
  });

  it('stop() detaches the port and clears the device list', async () => {
    const { access, input } = await webInput();
    input.stop();
    expect(access.listening()).toEqual([]);
    expect(input.devices$.get()).toEqual([]);
  });
});

describe('midiStore with a selectable device', () => {
  it('exposes the device list and forwards selectDevice to the device input', async () => {
    const hub = createMidiHub();
    const access = createFakeMidiAccess([FP30, KEYSTEP]);
    hub.attach(new WebMidiInput(access.navigator), 'device');
    await hub.start();
    expect(hub.store.getState().devices).toEqual([FP30, KEYSTEP]);
    hub.selectDevice({ id: KEYSTEP.id, name: KEYSTEP.name });
    expect(hub.store.getState().status).toMatchObject({ deviceId: KEYSTEP.id });
    expect(hub.store.getState().preference).toEqual({ id: KEYSTEP.id, name: KEYSTEP.name });
    access.unplug(KEYSTEP.id);
    expect(hub.store.getState().devices).toEqual([FP30]);
    hub.stop();
  });

  it('a preference chosen before the device attaches is applied to it', async () => {
    const hub = createMidiHub();
    hub.selectDevice({ id: KEYSTEP.id, name: KEYSTEP.name });
    hub.attach(new WebMidiInput(createFakeMidiAccess([FP30, KEYSTEP]).navigator), 'device');
    await hub.start();
    expect(hub.store.getState().status).toMatchObject({ deviceId: KEYSTEP.id });
    hub.stop();
  });

  it('the computer-keyboard fallback is heard only while no device is connected', async () => {
    const hub = createMidiHub();
    const access = createFakeMidiAccess([FP30]);
    const keyboard = new FakeMidiInput();
    hub.attach(new WebMidiInput(access.navigator), 'device');
    hub.attach(keyboard, 'fallback');
    await hub.start();
    expect(hub.store.getState().keyboardActive).toBe(false);
    keyboard.press(60);
    expect(hub.store.getState().held.size).toBe(0);
    keyboard.release(60);
    access.unplug(FP30.id);
    expect(hub.store.getState().keyboardActive).toBe(true);
    keyboard.press(62);
    expect([...hub.store.getState().held]).toEqual([62]);
    hub.stop();
  });

  it('replaceDevice swaps the device input and releases what the old one held', async () => {
    const hub = createMidiHub();
    const first = createFakeMidiAccess([FP30]);
    hub.attach(new WebMidiInput(first.navigator), 'device');
    await hub.start();
    first.send(FP30.id, [0x90, 60, 100]);
    expect([...hub.store.getState().held]).toEqual([60]);
    hub.replaceDevice(new WebMidiInput(createFakeMidiAccess([]).navigator));
    await vi.waitFor(() => expect(hub.store.getState().status).toEqual({ kind: 'no-device' }));
    expect(hub.store.getState().held.size).toBe(0);
    expect(first.listening()).toEqual([]);
    hub.stop();
  });
});

type MeDto = ChannelOutput<'me.get'>;

function me(over: Partial<MeDto> = {}): MeDto {
  return {
    name: 'Harry',
    timezone: 'UTC',
    xpTotal: 0,
    streak: { days: 0, keptToday: false, atRisk: true },
    midi: {},
    settings: { showMarkPlayedAlways: false, autoContinue: true },
    firstRun: false,
    ...over,
  };
}

function fakeIo(profile: MeDto) {
  const updates: unknown[] = [];
  let cached: MeDto | undefined = profile;
  return {
    updates,
    io: {
      getMe: () => Promise.resolve(profile),
      updateMe: (input: unknown) => {
        updates.push(input);
        return Promise.resolve(profile);
      },
      cachedMe: () => cached,
      setMe: (m: MeDto) => {
        cached = m;
      },
    },
  };
}

describe('device preference (me.update {midi})', () => {
  it('preferenceOf reads me.midi; empty means no preference', () => {
    expect(preferenceOf(me())).toBeNull();
    expect(preferenceOf(me({ midi: { deviceId: 'a', deviceName: 'A' } }))).toEqual({
      id: 'a',
      name: 'A',
    });
  });

  it('restores the saved keyboard on launch', async () => {
    const hub = createMidiHub();
    hub.attach(new WebMidiInput(createFakeMidiAccess([FP30, KEYSTEP]).navigator), 'device');
    await hub.start();
    const { io } = fakeIo(me({ midi: { deviceId: KEYSTEP.id, deviceName: KEYSTEP.name } }));
    await restoreMidiPreference(hub, io);
    expect(hub.store.getState().status).toMatchObject({ deviceId: KEYSTEP.id });
    hub.stop();
  });

  it('choosing switches at once and saves deviceId + deviceName', async () => {
    const hub = createMidiHub();
    hub.attach(new WebMidiInput(createFakeMidiAccess([FP30, KEYSTEP]).navigator), 'device');
    await hub.start();
    const { io, updates } = fakeIo(me());
    await chooseMidiDevice(hub, KEYSTEP, io);
    expect(hub.store.getState().status).toMatchObject({ deviceId: KEYSTEP.id });
    expect(updates).toEqual([{ midi: { deviceId: KEYSTEP.id, deviceName: KEYSTEP.name } }]);
    hub.stop();
  });

  it('never writes the profile before onboarding (first run)', async () => {
    const hub = createMidiHub();
    const { io, updates } = fakeIo(me({ firstRun: true }));
    await chooseMidiDevice(hub, FP30, io);
    await restoreMidiPreference(hub, io);
    expect(updates).toEqual([]);
    expect(hub.store.getState().preference).toEqual({ id: FP30.id, name: FP30.name });
  });
});
