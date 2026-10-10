import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundControl } from './SoundControl';

afterEach(cleanup);

// decisions.md 2026-10-11 "Sound setting".
describe('SoundControl', () => {
  it('shows the three voices, marks the current one, and reports picks', () => {
    const onChange = vi.fn();
    render(<SoundControl value="samples" onChange={onChange} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Tone', 'Synth piano', 'Recorded piano']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    expect(screen.getByRole('group').getAttribute('aria-labelledby')).toBeTruthy();
    fireEvent.click(screen.getByTestId('sound-synth'));
    expect(onChange).toHaveBeenCalledWith('synth');
  });
});
