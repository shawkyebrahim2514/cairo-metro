// @vitest-environment jsdom
import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetroMap } from './components/MetroMap';
import { PlaceInput } from './components/PlaceInput';
import { dictionaries, I18nContext, type I18n } from './i18n';

const i18n: I18n = { lang: 'en', setLang: () => {}, t: (k) => dictionaries.en[k] };
const wrap = (ui: ReactNode) => (
  <StrictMode>
    <I18nContext.Provider value={i18n}>{ui}</I18nContext.Provider>
  </StrictMode>
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MetroMap lifecycle', () => {
  it('mounts once under StrictMode double-effects and unmounts cleanly', () => {
    const { container, unmount } = render(wrap(<MetroMap tiles={false} />));
    expect(container.querySelectorAll('.leaflet-container')).toHaveLength(1);
    expect(() => unmount()).not.toThrow();
  });
});

describe('PlaceInput GPS races', () => {
  type Ok = (p: { coords: { latitude: number; longitude: number } }) => void;

  function setup() {
    const callbacks: Ok[] = [];
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: { getCurrentPosition: (ok: Ok) => callbacks.push(ok) },
    });
    const onChange = vi.fn();
    const view = render(
      wrap(<PlaceInput label="From" endpoint={null} onChange={onChange} resolver={null} showGps />),
    );
    const locate = view.getByLabelText(dictionaries.en.useMyLocation);
    return { callbacks, onChange, locate, ...view };
  }

  it('applies a GPS fix that arrives while nothing else changed', () => {
    const { callbacks, onChange, locate } = setup();
    fireEvent.click(locate);
    act(() => callbacks[0]!({ coords: { latitude: 30, longitude: 31 } }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toMatchObject({
      kind: 'point',
      point: { lat: 30, lng: 31 },
    });
  });

  it('ignores a stale fix once the user typed something else', () => {
    const { callbacks, onChange, locate, getByRole } = setup();
    fireEvent.click(locate);
    fireEvent.change(getByRole('combobox'), { target: { value: 'sadat' } });
    act(() => callbacks[0]!({ coords: { latitude: 30, longitude: 31 } }));
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'point' }));
  });
});
