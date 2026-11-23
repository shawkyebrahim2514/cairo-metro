import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { dictionaries, formatClock, useI18n, type Key, type Lang } from '../i18n';
import { endpointPoint, type Endpoint } from '../endpoint';
import type { PlaceResolver } from '../data';
import { planUrl } from '../storage';
import { resolveTheme, useSettings } from '../settings';
import {
  DEFAULT_IMAGE_OPTIONS,
  renderTripImage,
  type ImageColour,
  type ImageCrop,
  type ImageFormat,
  type ImageOptions,
  type ImageStyle,
  type ImageTheme,
} from '../tripImage';
import type { Trip } from '../trip';
import { useModal } from '../useModal';
import { Icon } from './Icon';

type UiOptions = Omit<ImageOptions, 'lang'> & { lang: 'app' | Lang };
const STORE = 'imageOptions';
const { lang: _unused, ...BASE } = DEFAULT_IMAGE_OPTIONS;
void _unused;
const DEFAULTS: UiOptions = { ...BASE, lang: 'app' };

function load(): UiOptions {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<UiOptions>;
    return { ...DEFAULTS, ...raw };
  } catch {
    return DEFAULTS;
  }
}

function Opt({ head, hint, children }: { head: ReactNode; hint: string; children?: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="opt">
      <div className="opt-head">
        {head}
        <button
          type="button"
          className="hint"
          aria-label={t('imgWhat')}
          aria-expanded={open}
          title={hint}
          onClick={() => setOpen(!open)}
        >
          i
        </button>
      </div>
      {open && (
        <p className="hint-text" role="note">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

function Seg<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const id = useMemo(() => `seg-${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <Opt head={<span id={id}>{label}</span>} hint={hint}>
      <div className="seg" role="radiogroup" aria-labelledby={id} aria-disabled={disabled}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            disabled={disabled}
            className={value === v ? 'on' : ''}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </Opt>
  );
}

function Check({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Opt
      hint={hint}
      head={
        <label className="check">
          <input
            type="checkbox"
            checked={checked && !disabled}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{label}</span>
        </label>
      }
    />
  );
}

/** Lets the user pick what the trip image looks like and includes, with a live preview. */
export function ImageDialog({
  trip,
  from,
  to,
  resolver,
  onClose,
}: {
  trip: Trip;
  from: Endpoint;
  to: Endpoint;
  resolver: PlaceResolver | null;
  onClose: () => void;
}) {
  const { t, lang: appLang } = useI18n();
  const { theme, highlightColour, timeFormat } = useSettings();
  const closeRef = useRef<HTMLButtonElement>(null);
  const modal = useModal(onClose, () => closeRef.current);
  const [ui, setUi] = useState(load);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState(false);

  const set = <K extends keyof UiOptions>(k: K, v: UiOptions[K]) => {
    setUi((cur) => {
      const next = { ...cur, [k]: v };
      localStorage.setItem(STORE, JSON.stringify(next));
      return next;
    });
  };

  const nearby = useMemo(
    () => resolver?.placesNear(endpointPoint(to), 600, 6) ?? [],
    [resolver, to],
  );
  const url = useMemo(() => planUrl(from, to), [from, to]);
  const imgLang = ui.lang === 'app' ? appLang : ui.lang;
  const options: ImageOptions = { ...ui, lang: imgLang };
  const key = JSON.stringify(options);

  useEffect(() => {
    let live = true;
    setBusy(true);
    const timer = setTimeout(() => {
      const opts = JSON.parse(key) as ImageOptions;
      const dict = dictionaries[opts.lang];
      renderTripImage({
        trip,
        from,
        to,
        options: opts,
        t: (k: Key) => dict[k],
        appTheme: resolveTheme(theme),
        accent: highlightColour,
        clock: (d) => formatClock(d, opts.lang, timeFormat),
        nearby,
        url,
      })
        .then((b) => {
          if (!live) return;
          setBlob(b);
          setFailed(false);
        })
        .catch(() => live && setFailed(true))
        .finally(() => live && setBusy(false));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key, trip, from, to, theme, highlightColour, timeFormat, nearby, url]);

  const preview = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const finish = async () => {
    if (!blob) return;
    const file = new File([blob], 'cairo-metro-trip.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: t('appName') });
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
        // share failed: fall back to a download
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  const route = ui.style === 'route';
  const themes: [ImageTheme, string][] = [
    ['app', t('imgThemeApp')],
    ['light', t('themeLight')],
    ['dark', t('themeDark')],
  ];

  return (
    <div className="tour-scrim">
      <div
        className="tour img-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="img-title"
        ref={modal.ref}
        onKeyDown={modal.onKeyDown}
        tabIndex={-1}
      >
        <h2 id="img-title">{t('imgTitle')}</h2>

        <div className="img-body">
          <div className="img-pane">
            <button
              type="button"
              className="img-preview"
              aria-label={t('imgEnlarge')}
              onClick={() => preview && setBig(true)}
            >
              {preview && <img src={preview} alt={t('imgPreviewAlt')} />}
              {(busy || !preview) && !failed && (
                <span className="img-busy">{t('imgPreviewing')}</span>
              )}
              {failed && <span className="img-busy">{t('imgFailed')}</span>}
            </button>
          </div>
          <div className="img-opts">
            <h3>{t('imgSectionLook')}</h3>
            <Seg<ImageStyle>
              label={t('imgStyle')}
              hint={t('imgHStyle')}
              value={ui.style}
              options={[
                ['network', t('imgStyleNetwork')],
                ['route', t('imgStyleRoute')],
              ]}
              onChange={(v) => set('style', v)}
            />
            <Seg<ImageCrop>
              label={t('imgCrop')}
              hint={t('imgHCrop')}
              value={ui.crop}
              disabled={route}
              options={[
                ['trip', t('imgCropTrip')],
                ['network', t('imgCropNetwork')],
              ]}
              onChange={(v) => set('crop', v)}
            />
            <Seg<ImageColour>
              label={t('imgColour')}
              hint={t('imgHColour')}
              value={ui.colour}
              options={[
                ['lines', t('imgColourLines')],
                ['accent', t('imgColourAccent')],
              ]}
              onChange={(v) => set('colour', v)}
            />
            <Seg<ImageTheme>
              label={t('theme')}
              hint={t('imgHTheme')}
              value={ui.theme}
              options={themes}
              onChange={(v) => set('theme', v)}
            />
            <Seg<'app' | Lang>
              label={t('imgLang')}
              hint={t('imgHLang')}
              value={ui.lang}
              options={[
                ['app', t('imgLangApp')],
                ['en', 'English'],
                ['ar', 'العربية'],
              ]}
              onChange={(v) => set('lang', v)}
            />
            <Seg<ImageFormat>
              label={t('imgFormat')}
              hint={t('imgHFormat')}
              value={ui.format}
              options={[
                ['portrait', t('imgFormatPortrait')],
                ['square', t('imgFormatSquare')],
                ['story', t('imgFormatStory')],
              ]}
              onChange={(v) => set('format', v)}
            />

            <h3>{t('imgSectionInclude')}</h3>
            <Check
              label={t('imgRouteNames')}
              hint={t('imgHRouteNames')}
              checked={ui.routeNames}
              onChange={(v) => set('routeNames', v)}
            />
            <Check
              label={t('imgOtherNames')}
              hint={t('imgHOtherNames')}
              checked={ui.otherNames}
              disabled={route}
              onChange={(v) => set('otherNames', v)}
            />
            <Check
              label={t('imgWalking')}
              hint={t('imgHWalking')}
              checked={ui.walking}
              disabled={ui.style === 'schematic'}
              onChange={(v) => set('walking', v)}
            />
            <Check
              label={t('imgPlaces')}
              hint={t('imgHPlaces')}
              checked={ui.places}
              disabled={nearby.length === 0 || ui.style === 'schematic'}
              onChange={(v) => set('places', v)}
            />
            <Check
              label={t('imgStats')}
              hint={t('imgHStats')}
              checked={ui.stats}
              onChange={(v) => set('stats', v)}
            />
            <Check
              label={t('imgFare')}
              hint={t('imgHFare')}
              checked={ui.fare}
              disabled={!ui.stats}
              onChange={(v) => set('fare', v)}
            />
            <Check
              label={t('imgEta')}
              hint={t('imgHEta')}
              checked={ui.eta}
              onChange={(v) => set('eta', v)}
            />
            <Check
              label={t('imgSteps')}
              hint={t('imgHSteps')}
              checked={ui.steps}
              onChange={(v) => set('steps', v)}
            />
            <Check
              label={t('imgWomen')}
              hint={t('imgHWomen')}
              checked={ui.women}
              onChange={(v) => set('women', v)}
            />
            <Check
              label={t('imgQr')}
              hint={t('imgHQr')}
              checked={ui.qr}
              onChange={(v) => set('qr', v)}
            />
            <Check
              label={t('imgBranding')}
              hint={t('imgHBranding')}
              checked={ui.branding}
              onChange={(v) => set('branding', v)}
            />
          </div>
        </div>

        <div className="tour-nav img-actions">
          <button
            type="button"
            className="primary"
            disabled={!blob || busy}
            onClick={() => void finish()}
          >
            <Icon name="image" size={16} /> {t('imgShare')}
          </button>
          <button type="button" ref={closeRef} onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>

      {big && preview && (
        <button
          type="button"
          className="img-big"
          aria-label={t('close')}
          autoFocus
          onClick={() => setBig(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setBig(false);
            }
          }}
        >
          <img src={preview} alt={t('imgPreviewAlt')} />
        </button>
      )}
    </div>
  );
}
