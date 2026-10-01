import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { MidiHubContext } from '../midi/hooks';
import { createMidiHub } from '../midi/midiStore';
import { FakeMidiInput } from '../midi/FakeMidiInput';
import { CircleOfFifths } from './music/CircleOfFifths/CircleOfFifths';
import { keyStates, PianoKeyboard, resolveKeyState } from './music/PianoKeyboard/PianoKeyboard';
import { Callout } from './ui/Callout';
import { MidiPill, midiPillLabel } from './ui/MidiPill';
import { RomanChip } from './ui/RomanChip';

afterEach(cleanup);

describe('PianoKeyboard state (docs/ui.md §2)', () => {
  it('priority is correct > home > hint > held > tried', () => {
    expect(resolveKeyState('tried', true)).toBe('held');
    expect(resolveKeyState('hint', true)).toBe('hint');
    expect(resolveKeyState('home', true)).toBe('home');
    expect(resolveKeyState('correct', true)).toBe('correct');
    expect(resolveKeyState(undefined, true)).toBe('held');
    expect(resolveKeyState(undefined, false)).toBe('idle');
  });

  it('keyStates maps spelled notes to MIDI numbers', () => {
    expect(keyStates(['A3', 'C#4', 'Db4'], 'hint')).toEqual({ 57: 'hint', 61: 'hint' });
  });

  it('renders 14 whites + 10 blacks with live held notes from the MIDI hub', () => {
    const hub = createMidiHub();
    const device = new FakeMidiInput();
    hub.attach(device, 'device');
    device.press(64);
    const { container } = render(
      <MidiHubContext.Provider value={hub}>
        <PianoKeyboard variant="two-octave" live states={keyStates(['A3'], 'hint')} />
      </MidiHubContext.Provider>,
    );
    expect(container.querySelectorAll('[data-key="white"]')).toHaveLength(14);
    expect(container.querySelectorAll('[data-key="black"]')).toHaveLength(10);
    expect(container.querySelector('[data-midi="64"]')?.getAttribute('data-state')).toBe('held');
    expect(container.querySelector('[data-midi="57"]')?.getAttribute('data-state')).toBe('hint');
    const firstBlack = container.querySelector<HTMLElement>('[data-key="black"]');
    expect(firstBlack?.style.left).toBe('34.5px');
  });
});

describe('CircleOfFifths', () => {
  it('done and current nodes are buttons; upcoming are not', () => {
    const { container } = render(
      <CircleOfFifths
        keys={[
          { label: 'C', state: 'done' },
          { label: 'G', state: 'current' },
          { label: 'Gb', state: 'upcoming' },
        ]}
        minors={['Am']}
        complete={1}
      />,
    );
    const nodes = container.querySelectorAll('[data-node="key"]');
    expect([...nodes].map((n) => n.tagName)).toEqual(['BUTTON', 'BUTTON', 'DIV']);
    expect(nodes[2]?.textContent).toBe('G♭');
  });
});

describe('MidiPill (docs/ui.md §4 copy)', () => {
  it('labels every status', () => {
    const connected = { kind: 'connected', deviceName: 'Roland FP-30X', deviceId: 'x' } as const;
    expect(midiPillLabel(connected, 'app')).toBe('Roland FP-30X connected');
    expect(midiPillLabel(connected, 'task')).toBe('Roland FP-30X');
    expect(midiPillLabel({ kind: 'no-device' }, 'app')).toBe('No keyboard found');
    expect(midiPillLabel({ kind: 'requesting' }, 'app')).toBe('Looking for keyboards…');
    expect(midiPillLabel({ kind: 'denied' }, 'app')).toBe('MIDI access blocked');
  });

  it('reads the live status when none is passed', () => {
    const hub = createMidiHub();
    hub.attach(new FakeMidiInput({ kind: 'no-device' }), 'device');
    const { getByTestId } = render(
      <MemoryRouter>
        <MidiHubContext.Provider value={hub}>
          <MidiPill />
        </MidiHubContext.Provider>
      </MemoryRouter>,
    );
    expect(getByTestId('midi-pill').textContent).toBe('No keyboard found');
  });
});

describe('RomanChip / Callout', () => {
  it('fills quality chips via qualityColor', () => {
    const { container } = render(
      <RomanChip mode="quality" size={48} numeral="vii°" quality="diminished" />,
    );
    expect(container.querySelector('span')?.getAttribute('style')).toContain('var(--lavender)');
  });

  it('renders **bold** markup', () => {
    const { container } = render(<Callout text="Start on **vi** and keep going." />);
    expect(container.querySelector('strong')?.textContent).toBe('vi');
  });
});
