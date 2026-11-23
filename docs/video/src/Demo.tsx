import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const DURATION = 1440;
const FONT = '"Segoe UI", system-ui, sans-serif';
const TEAL = '#0f766e';
const BLUE = '#1d4ed8';

const useSpring = (delay = 0, damping = 14) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

const Bg: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const frame = useCurrentFrame();
  const a = 150 + Math.sin(frame / 90) * 20;
  return (
    <AbsoluteFill
      style={{
        background: dark
          ? `linear-gradient(${a}deg, #0b1220, #12304f 60%, #0f766e)`
          : `linear-gradient(${a}deg, ${TEAL}, ${BLUE})`,
      }}
    />
  );
};

const Caption: React.FC<{ en: string; ar: string; top?: number; delay?: number }> = ({
  en,
  ar,
  top = 120,
  delay = 0,
}) => {
  const s = useSpring(delay);
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top,
        textAlign: 'center',
        color: '#fff',
        fontFamily: FONT,
        opacity: s,
        transform: `translateY(${(1 - s) * 40}px)`,
      }}
    >
      <div
        style={{
          fontSize: 66,
          fontWeight: 800,
          lineHeight: 1.1,
          textShadow: '0 4px 24px rgba(0,0,0,.3)',
        }}
      >
        {en}
      </div>
      <div
        style={{ fontSize: 50, fontWeight: 600, marginTop: 12, direction: 'rtl', opacity: 0.92 }}
      >
        {ar}
      </div>
    </div>
  );
};

const Chip: React.FC<{ en: string; ar?: string; delay?: number }> = ({ en, ar, delay = 0 }) => {
  const s = useSpring(delay, 12);
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 14,
        alignItems: 'center',
        padding: '14px 28px',
        borderRadius: 999,
        background: 'rgba(255,255,255,.18)',
        border: '2px solid rgba(255,255,255,.55)',
        color: '#fff',
        fontFamily: FONT,
        fontSize: 38,
        fontWeight: 700,
        transform: `scale(${0.6 + s * 0.4})`,
        opacity: s,
      }}
    >
      {en}
      {ar && <span style={{ opacity: 0.85, direction: 'rtl' }}>{ar}</span>}
    </div>
  );
};

const Phone: React.FC<{ width: number; children: React.ReactNode }> = ({ width, children }) => (
  <div
    style={{
      width,
      height: width * 2.16,
      borderRadius: 70,
      background: '#0b0f19',
      padding: 16,
      boxShadow: '0 40px 100px rgba(0,0,0,.5), inset 0 0 0 3px #2b3345',
    }}
  >
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 56,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {children}
    </div>
  </div>
);

const Card: React.FC<{ src: string; w: number; h: number; pos?: number }> = ({
  src,
  w,
  h,
  pos = 0,
}) => {
  const isStory = src.includes('story');
  const imgH = isStory ? (1920 * w) / 1080 : (2978 * w) / 1080;
  const y = -Math.max(0, imgH - h) * Math.min(1, Math.max(0, pos));
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 36,
        overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,.45)',
        background: '#fff',
      }}
    >
      <Img
        src={staticFile(src)}
        style={{ width: w, display: 'block', transform: `translateY(${y}px)` }}
      />
    </div>
  );
};

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const t = useSpring(0, 16);
  const imgs = ['img/default.png', 'img/dark.png', 'img/diagram.png'];
  return (
    <AbsoluteFill>
      <Bg />
      <div
        style={{
          position: 'absolute',
          top: 130,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: '#fff',
          fontFamily: FONT,
          opacity: t,
          transform: `scale(${0.85 + t * 0.15})`,
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 6, opacity: 0.85 }}>
          CAIRO METRO
        </div>
        <div style={{ fontSize: 118, fontWeight: 900, lineHeight: 1.02, marginTop: 20 }}>
          Your trip,
          <br />
          as a picture
        </div>
        <div style={{ fontSize: 66, fontWeight: 700, marginTop: 24, direction: 'rtl' }}>
          رحلتك في صورة
        </div>
      </div>
      {imgs.map((src, i) => {
        const s = spring({ frame: frame - 20 - i * 8, fps: 30, config: { damping: 13 } });
        return (
          <div
            key={src}
            style={{
              position: 'absolute',
              left: 540 - 220 + (i - 1) * 270,
              top: 860 + Math.abs(i - 1) * 40 + (1 - s) * 600,
              transform: `rotate(${(i - 1) * 9}deg)`,
              zIndex: i === 1 ? 2 : 1,
            }}
          >
            <Card src={src} w={440} h={880} pos={0.02 + Math.sin(frame / 40 + i) * 0.02} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const DialogClip: React.FC = () => {
  const s = useSpring(0, 16);
  return (
    <AbsoluteFill>
      <Bg />
      <Caption en="Tap Image. Make it yours." ar="اضغط على صورة واجعلها لك" top={90} />
      <div
        style={{
          position: 'absolute',
          top: 380,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          transform: `translateY(${(1 - s) * 200}px)`,
          opacity: s,
        }}
      >
        <Phone width={640}>
          <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <OffthreadVideo
              src={staticFile('clip.mp4')}
              startFrom={120}
              playbackRate={2.1}
              muted
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '200%',
                height: '200%',
                maxWidth: 'none',
              }}
            />
          </div>
        </Phone>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 50,
          display: 'flex',
          gap: 14,
          justifyContent: 'center',
          flexWrap: 'wrap',
          padding: '0 40px',
        }}
      >
        <Chip en="Style" ar="النمط" delay={20} />
        <Chip en="Theme" ar="المظهر" delay={34} />
        <Chip en="Language" ar="اللغة" delay={48} />
        <Chip en="Size" ar="الحجم" delay={62} />
        <Chip en="Content" ar="المحتوى" delay={76} />
      </div>
    </AbsoluteFill>
  );
};

const MONTAGE = [
  {
    src: 'img/default.png',
    en: 'Network map',
    ar: 'خريطة الشبكة',
    note: 'Your route, highlighted on the whole network',
  },
  {
    src: 'img/route-only.png',
    en: 'Route only',
    ar: 'المسار فقط',
    note: 'Hide the rest. Pure focus.',
  },
  {
    src: 'img/diagram.png',
    en: 'Schematic diagram',
    ar: 'مخطط المترو',
    note: 'Clean metro-map style',
  },
  { src: 'img/dark.png', en: 'Dark theme', ar: 'مظهر داكن', note: 'Light, dark or like the app' },
  {
    src: 'img/arabic-dark.png',
    en: 'Arabic version',
    ar: 'نسخة عربية',
    note: 'Right-to-left, fully translated',
  },
  { src: 'img/story.png', en: 'Story size', ar: 'حجم ستوري', note: 'Portrait, square or story' },
];
const PER = 72;

const Montage: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Bg dark />
      {MONTAGE.map((m, i) => {
        const local = frame - i * PER;
        if (local < -12 || local > PER + 12) return null;
        const inn = interpolate(local, [-12, 8], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const out = interpolate(local, [PER - 4, PER + 10], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const isStory = m.src.includes('story');
        const w = isStory ? 560 : 860;
        const h = isStory ? 996 : 1250;
        return (
          <AbsoluteFill key={m.src} style={{ opacity: Math.min(inn, out) }}>
            <Caption en={m.en} ar={m.ar} top={90} />
            <div
              style={{
                position: 'absolute',
                top: 400,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                transform: `translateY(${(1 - inn) * 120}px) scale(${0.94 + 0.06 * inn})`,
              }}
            >
              <Card src={m.src} w={w} h={h} pos={Math.max(0, local / PER) * 0.2} />
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: 70,
                left: 0,
                right: 0,
                textAlign: 'center',
                fontFamily: FONT,
                color: '#fff',
                fontSize: 40,
                fontWeight: 600,
                opacity: 0.9,
              }}
            >
              {m.note}
            </div>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

const LongTrip: React.FC = () => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [30, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s = useSpring(0, 16);
  const first = frame < 110;
  return (
    <AbsoluteFill>
      <Bg />
      <Caption
        key={first ? 'a' : 'b'}
        en={first ? 'Long trip? A tall map.' : 'Every station, listed.'}
        ar={first ? 'رحلة طويلة؟ خريطة أطول' : 'كل المحطات في قائمة'}
        top={90}
      />
      <div
        style={{
          position: 'absolute',
          top: 400,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: s,
          transform: `translateY(${(1 - s) * 150}px)`,
        }}
      >
        <Card src="img/default.png" w={860} h={1250} pos={p} />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 0,
          right: 0,
          display: 'flex',
          gap: 16,
          justifyContent: 'center',
        }}
      >
        <Chip en="35 stations" delay={10} />
        <Chip en="Turn map to fit" delay={24} />
        <Chip en="Station list" delay={38} />
      </div>
    </AbsoluteFill>
  );
};

const FEATURES = [
  { icon: '▣', en: 'QR code and share link', ar: 'رمز QR ورابط مشاركة' },
  { icon: '◉', en: 'Live trip tracking + wake alarm', ar: 'تتبع الرحلة مع منبّه' },
  { icon: '➜', en: 'Walking links: Google and Apple Maps', ar: 'مسارات المشي' },
  { icon: '☁', en: 'Works offline, installs as an app', ar: 'يعمل بدون إنترنت' },
  { icon: 'ع', en: 'English and Arabic (RTL)', ar: 'العربية والإنجليزية' },
];

const FeatureRow: React.FC<{ icon: string; en: string; ar: string; delay: number }> = ({
  icon,
  en,
  ar,
  delay,
}) => {
  const s = useSpring(delay, 13);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        padding: '30px 36px',
        borderRadius: 36,
        background: 'rgba(255,255,255,.12)',
        border: '2px solid rgba(255,255,255,.3)',
        color: '#fff',
        fontFamily: FONT,
        opacity: s,
        transform: `translateX(${(1 - s) * 300}px)`,
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          flex: 'none',
          borderRadius: 28,
          background: `linear-gradient(135deg, ${TEAL}, ${BLUE})`,
          display: 'grid',
          placeItems: 'center',
          fontSize: 52,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 42, fontWeight: 800 }}>{en}</div>
        <div style={{ fontSize: 34, opacity: 0.8, direction: 'rtl', marginTop: 4 }}>{ar}</div>
      </div>
    </div>
  );
};

const Features: React.FC = () => (
  <AbsoluteFill>
    <Bg dark />
    <Caption en="And so much more" ar="والمزيد" top={140} />
    <div
      style={{
        position: 'absolute',
        top: 420,
        left: 70,
        right: 70,
        display: 'flex',
        flexDirection: 'column',
        gap: 26,
      }}
    >
      {FEATURES.map((f, i) => (
        <FeatureRow key={f.en} {...f} delay={14 + i * 14} />
      ))}
    </div>
  </AbsoluteFill>
);

const Outro: React.FC = () => {
  const s = useSpring(0, 14);
  return (
    <AbsoluteFill>
      <Bg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          color: '#fff',
          fontFamily: FONT,
          textAlign: 'center',
          opacity: s,
          transform: `scale(${0.9 + s * 0.1})`,
        }}
      >
        <div style={{ fontSize: 130, fontWeight: 900 }}>Cairo Metro</div>
        <div style={{ fontSize: 70, fontWeight: 700, direction: 'rtl' }}>مترو القاهرة</div>
        <div style={{ fontSize: 44, opacity: 0.9, marginTop: 30 }}>
          Free · Offline · Open source
        </div>
        <div
          style={{
            fontSize: 36,
            marginTop: 20,
            padding: '16px 34px',
            borderRadius: 999,
            background: 'rgba(255,255,255,.2)',
          }}
        >
          shawkyebrahim2514.github.io/cairo-metro
        </div>
      </div>
    </AbsoluteFill>
  );
};

const T_MONTAGE = 450;
const T_LONG = T_MONTAGE + MONTAGE.length * PER;
const T_FEAT = T_LONG + 240;
const T_OUT = T_FEAT + 210;

type Cue = { at: number; sfx: 'whoosh' | 'pop' | 'click' | 'chime'; v?: number; len?: number };
const CUES: Cue[] = [
  { at: 2, sfx: 'whoosh' },
  ...[20, 28, 36].map((d): Cue => ({ at: d, sfx: 'pop', v: 0.5 })),
  { at: 120, sfx: 'whoosh' },
  ...[20, 34, 48, 62, 76].map((d): Cue => ({ at: 120 + d, sfx: 'pop' })),
  { at: T_MONTAGE - 6, sfx: 'whoosh' },
  ...[1, 2, 3, 4, 5].map((i): Cue => ({ at: T_MONTAGE + i * PER - 6, sfx: 'whoosh', v: 0.6 })),
  { at: T_LONG - 6, sfx: 'whoosh' },
  ...[10, 24, 38].map((d): Cue => ({ at: T_LONG + d, sfx: 'pop' })),
  { at: T_LONG + 108, sfx: 'whoosh', v: 0.5 },
  { at: T_FEAT - 6, sfx: 'whoosh' },
  ...[0, 1, 2, 3, 4].map((k): Cue => ({ at: T_FEAT + 14 + k * 14, sfx: 'pop' })),
  { at: T_OUT - 6, sfx: 'whoosh' },
  { at: T_OUT + 8, sfx: 'chime', v: 0.9, len: 70 },
];

export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const vol = interpolate(frame, [0, 30, DURATION - 60, DURATION], [0, 0.4, 0.4, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Audio src={staticFile('music.wav')} volume={vol} />
      {CUES.map((c, i) => (
        <Sequence key={i} from={c.at} durationInFrames={c.len ?? 60}>
          <Audio src={staticFile(c.sfx + '.wav')} volume={c.v ?? 0.8} />
        </Sequence>
      ))}
      <Sequence from={0} durationInFrames={120}>
        <Hook />
      </Sequence>
      <Sequence from={120} durationInFrames={330}>
        <DialogClip />
      </Sequence>
      <Sequence from={T_MONTAGE} durationInFrames={MONTAGE.length * PER}>
        <Montage />
      </Sequence>
      <Sequence from={T_LONG} durationInFrames={240}>
        <LongTrip />
      </Sequence>
      <Sequence from={T_FEAT} durationInFrames={210}>
        <Features />
      </Sequence>
      <Sequence from={T_OUT} durationInFrames={DURATION - T_OUT}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
