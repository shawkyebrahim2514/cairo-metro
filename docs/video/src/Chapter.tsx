import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  AMBER,
  Bg,
  Card,
  ClipVideo,
  FONT,
  FPS,
  Phone,
  type Clip,
  type Cue,
  clamp01,
  useSpring,
  useWide,
} from './kit';

export type Part = {
  a: string;
  aAr: string;
  b?: string;
  bAr?: string;
  clip?: Clip;
  images?: string[];
  frames?: number;
};

export type ChapterSpec = {
  n: number;
  q: string;
  qAr: string;
  tone?: 'teal' | 'dark' | 'night';
  parts: Part[];
};

export const Q_FRAMES = 84;
export const partFrames = (p: Part) =>
  p.frames ?? Math.round((p.clip!.len / (p.clip!.rate ?? 1)) * FPS);
export const chapterFrames = (c: ChapterSpec, qFrames = Q_FRAMES) =>
  qFrames + c.parts.reduce((s, p) => s + partFrames(p), 0);

export const chapterCues = (c: ChapterSpec, start: number, qFrames = Q_FRAMES): Cue[] => {
  const cues: Cue[] = [
    { at: start - 6, sfx: 'whoosh' },
    { at: start + 8, sfx: 'pop', v: 0.6 },
    { at: start + qFrames - 4, sfx: 'swipe', v: 0.5 },
  ];
  let t = start + qFrames;
  c.parts.forEach((p, i) => {
    if (i > 0) cues.push({ at: t - 4, sfx: 'swipe', v: 0.45 });
    if (p.b) cues.push({ at: t + 36, sfx: i === c.parts.length - 1 ? 'success' : 'pop', v: 0.55 });
    t += partFrames(p);
  });
  return cues;
};

const QScene: React.FC<{ c: ChapterSpec; wide: boolean }> = ({ c, wide }) => {
  const frame = useCurrentFrame();
  const s = useSpring(0, 16);
  const out = interpolate(frame, [Q_FRAMES - 8, Q_FRAMES], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const words = c.q.split(' ');
  return (
    <AbsoluteFill style={{ opacity: out, fontFamily: FONT, color: '#fff' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: wide ? '0 220px' : '0 70px',
          gap: 28,
        }}
      >
        <div
          style={{
            fontSize: wide ? 34 : 38,
            fontWeight: 800,
            letterSpacing: 6,
            padding: '8px 26px',
            borderRadius: 999,
            background: AMBER,
            color: '#1f2937',
            transform: `scale(${0.7 + s * 0.3})`,
            opacity: s,
          }}
        >
          {String(c.n).padStart(2, '0')}
        </div>
        <div
          style={{
            fontSize: wide ? 120 : 112,
            fontWeight: 900,
            lineHeight: 1.05,
            textShadow: '0 6px 30px rgba(0,0,0,.3)',
          }}
        >
          {words.map((w, i) => {
            const ws = useSpring(6 + i * 4, 13);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  marginRight: '0.28em',
                  opacity: ws,
                  transform: `translateY(${(1 - ws) * 50}px)`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
        <div
          style={{
            fontSize: wide ? 62 : 58,
            fontWeight: 700,
            direction: 'rtl',
            opacity: Math.min(1, clamp01(frame, 24, 40)) * 0.92,
          }}
        >
          {c.qAr}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Visual: React.FC<{ part: Part; h: number }> = ({ part, h }) => {
  const frame = useCurrentFrame();
  if (part.images) {
    const n = part.images.length;
    const w = h * 0.36;
    return (
      <div style={{ position: 'relative', width: w * (1 + (n - 1) * 0.8), height: h }}>
        {part.images.map((src, i) => {
          const s = useSpring(6 + i * 7, 13);
          const mid = (n - 1) / 2;
          return (
            <div
              key={src}
              style={{
                position: 'absolute',
                left: i * w * 0.8,
                top: Math.abs(i - mid) * 24 + (1 - s) * 500,
                transform: `rotate(${(i - mid) * 5}deg)`,
                zIndex: 10 - Math.round(Math.abs(i - mid)),
              }}
            >
              <Card
                src={src}
                w={w}
                h={h * 0.94}
                pos={0.02 + Math.sin(frame / 45 + i) * 0.02}
                r={28}
              />
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <Phone height={h} glow>
      <ClipVideo clip={part.clip!} />
    </Phone>
  );
};

const PartScene: React.FC<{ c: ChapterSpec; part: Part; wide: boolean; frames: number }> = ({
  c,
  part,
  wide,
  frames,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const inn = useSpring(0, 16);
  const out = interpolate(frame, [frames - 6, frames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hs = useSpring(12, 14);
  const bs = useSpring(36, 12);
  const phoneH = wide ? 960 : 1180;
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: '#fff', opacity: out }}>
      <div
        style={
          wide
            ? { position: 'absolute', left: 110, top: 0, bottom: 0, width: 880 }
            : { position: 'absolute', left: 60, right: 60, top: 70, textAlign: 'center' }
        }
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: wide ? 'center' : 'flex-start',
            height: wide ? '100%' : undefined,
            gap: 22,
            alignItems: wide ? 'flex-start' : 'center',
          }}
        >
          <div
            style={{
              fontSize: wide ? 34 : 36,
              fontWeight: 700,
              opacity: 0.75 * inn,
              display: 'flex',
              gap: 14,
              alignItems: 'center',
            }}
          >
            <span
              style={{
                background: AMBER,
                color: '#1f2937',
                borderRadius: 999,
                padding: '2px 16px',
                fontWeight: 800,
                fontSize: 28,
              }}
            >
              {String(c.n).padStart(2, '0')}
            </span>
            {c.q}
          </div>
          <div
            style={{
              fontSize: wide ? 86 : 78,
              fontWeight: 900,
              lineHeight: 1.04,
              opacity: hs,
              transform: `translateY(${(1 - hs) * 40}px)`,
              textShadow: '0 6px 30px rgba(0,0,0,.3)',
            }}
          >
            {part.a}
          </div>
          <div
            style={{
              fontSize: wide ? 48 : 46,
              fontWeight: 700,
              direction: 'rtl',
              opacity: 0.9 * hs,
            }}
          >
            {part.aAr}
          </div>
          {part.b && (
            <div
              style={{
                marginTop: wide ? 20 : 4,
                display: 'flex',
                gap: 18,
                alignItems: 'center',
                padding: '16px 30px 16px 20px',
                borderRadius: 999,
                background: 'rgba(255,255,255,.16)',
                border: '2px solid rgba(255,255,255,.4)',
                fontSize: wide ? 38 : 36,
                fontWeight: 700,
                opacity: bs,
                transform: `scale(${0.85 + bs * 0.15})`,
                transformOrigin: wide ? 'left center' : 'center',
              }}
            >
              <span
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: AMBER,
                  color: '#1f2937',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 32,
                  fontWeight: 900,
                  flex: 'none',
                }}
              >
                ✓
              </span>
              <span>
                {part.b}
                {part.bAr && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: 28,
                      opacity: 0.8,
                      direction: 'rtl',
                      fontWeight: 600,
                    }}
                  >
                    {part.bAr}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
      <div
        style={
          wide
            ? {
                position: 'absolute',
                left: 1040,
                right: 0,
                top: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }
            : {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 70,
                display: 'flex',
                justifyContent: 'center',
              }
        }
      >
        <div
          style={{
            transform: `translate${wide ? 'X' : 'Y'}(${(1 - inn) * (wide ? width * 0.3 : 500)}px)`,
            opacity: inn,
          }}
        >
          <Visual part={part} h={phoneH} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Chapter: React.FC<{ c: ChapterSpec; qFrames?: number }> = ({
  c,
  qFrames = Q_FRAMES,
}) => {
  const wide = useWide();
  let t = qFrames;
  return (
    <AbsoluteFill>
      <Bg tone={c.tone ?? 'teal'} />
      <Sequence from={0} durationInFrames={qFrames}>
        <QScene c={c} wide={wide} />
      </Sequence>
      {c.parts.map((p, i) => {
        const f = partFrames(p);
        const from = t;
        t += f;
        return (
          <Sequence key={i} from={from} durationInFrames={f}>
            <PartScene c={c} part={p} wide={wide} frames={f} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
