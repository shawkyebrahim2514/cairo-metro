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

export const FPS = 30;
export const FONT = '"Segoe UI", system-ui, sans-serif';
export const TEAL = '#0f766e';
export const BLUE = '#1d4ed8';
export const AMBER = '#fbbf24';

export const useSpring = (delay = 0, damping = 14) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

export const clamp01 = (frame: number, a: number, b: number) =>
  interpolate(frame, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

export const useWide = () => {
  const { width, height } = useVideoConfig();
  return width > height;
};

export const Bg: React.FC<{ tone?: 'teal' | 'dark' | 'night' }> = ({ tone = 'teal' }) => {
  const frame = useCurrentFrame();
  const a = 150 + Math.sin(frame / 90) * 20;
  const bg =
    tone === 'dark'
      ? `linear-gradient(${a}deg, #0b1220, #12304f 60%, #0f766e)`
      : tone === 'night'
        ? `linear-gradient(${a}deg, #050a14, #0b1a30 70%, #0b3b3a)`
        : `linear-gradient(${a}deg, ${TEAL}, ${BLUE})`;
  return (
    <AbsoluteFill style={{ background: bg }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: 'rgba(255,255,255,.05)',
            left: `${20 + i * 30 + Math.sin(frame / 120 + i) * 4}%`,
            top: `${10 + i * 25 + Math.cos(frame / 100 + i) * 4}%`,
            filter: 'blur(40px)',
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

export const Phone: React.FC<{
  height: number;
  children: React.ReactNode;
  glow?: boolean;
}> = ({ height, children, glow }) => {
  const inner = height - 32;
  const w = (inner * 780) / 1688;
  return (
    <div
      style={{
        width: w + 32,
        height,
        borderRadius: height * 0.065,
        background: '#0b0f19',
        padding: 16,
        boxShadow: `0 40px 100px rgba(0,0,0,.5), inset 0 0 0 3px #2b3345${
          glow ? ', 0 0 120px rgba(251,191,36,.25)' : ''
        }`,
        position: 'relative',
        flex: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: height * 0.05,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export type Clip = { src: string; from?: number; len: number; rate?: number };

export const ClipVideo: React.FC<{ clip: Clip }> = ({ clip }) => (
  <OffthreadVideo
    src={staticFile(clip.src)}
    startFrom={Math.round((clip.from ?? 0) * FPS)}
    playbackRate={clip.rate ?? 1}
    muted
    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
  />
);

export const Card: React.FC<{ src: string; w: number; h: number; pos?: number; r?: number }> = ({
  src,
  w,
  h,
  pos = 0,
  r = 36,
}) => {
  const isStory = src.includes('story');
  const imgH = isStory ? (1920 * w) / 1080 : (2978 * w) / 1080;
  const y = -Math.max(0, imgH - h) * Math.min(1, Math.max(0, pos));
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,.45)',
        background: '#fff',
        flex: 'none',
      }}
    >
      <Img
        src={staticFile(src)}
        style={{ width: w, display: 'block', transform: `translateY(${y}px)` }}
      />
    </div>
  );
};

export const Pill: React.FC<{ children: React.ReactNode; delay?: number; accent?: boolean }> = ({
  children,
  delay = 0,
  accent,
}) => {
  const s = useSpring(delay, 12);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 26px',
        borderRadius: 999,
        background: accent ? AMBER : 'rgba(255,255,255,.18)',
        border: accent ? 'none' : '2px solid rgba(255,255,255,.5)',
        color: accent ? '#1f2937' : '#fff',
        fontFamily: FONT,
        fontSize: 34,
        fontWeight: 800,
        transform: `scale(${0.6 + s * 0.4})`,
        opacity: s,
      }}
    >
      {children}
    </div>
  );
};

export type Cue = {
  at: number;
  sfx: 'whoosh' | 'pop' | 'click' | 'chime' | 'success' | 'swipe';
  v?: number;
  len?: number;
};

export const Cues: React.FC<{ cues: Cue[] }> = ({ cues }) => (
  <>
    {cues.map((c, i) => (
      <Sequence key={i} from={Math.max(0, c.at)} durationInFrames={c.len ?? 70}>
        <Audio src={staticFile(c.sfx + '.wav')} volume={c.v ?? 0.8} />
      </Sequence>
    ))}
  </>
);
