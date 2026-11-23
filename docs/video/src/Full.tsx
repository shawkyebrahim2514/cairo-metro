import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { CHAPTERS } from './chapters';
import { Chapter, chapterCues, chapterFrames, type ChapterSpec } from './Chapter';
import { AMBER, Bg, Card, Cues, FONT, Pill, type Cue, useSpring, useWide } from './kit';

export const INTRO = 180;
export const OUTRO = 270;

export const Intro: React.FC = () => {
  const wide = useWide();
  const s = useSpring(0, 16);
  const s2 = useSpring(40, 14);
  const imgs = ['img/net-default.png', 'img/diagram-dark.png', 'img/arabic-dark.png'];
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: '#fff' }}>
      <Bg tone="dark" />
      <div
        style={{
          position: 'absolute',
          left: wide ? 110 : 60,
          right: wide ? 900 : 60,
          top: wide ? 260 : 130,
          textAlign: wide ? 'left' : 'center',
          opacity: s,
          transform: `translateY(${(1 - s) * 40}px)`,
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 8, color: AMBER }}>
          CAIRO METRO
        </div>
        <div
          style={{ fontSize: wide ? 104 : 108, fontWeight: 900, lineHeight: 1.04, marginTop: 20 }}
        >
          Every metro question,
          <br />
          answered.
        </div>
        <div
          style={{ fontSize: 54, fontWeight: 700, direction: 'rtl', marginTop: 26, opacity: s2 }}
        >
          كل أسئلة المترو، لها إجابة
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: wide ? 120 : undefined,
          left: wide ? undefined : 0,
          bottom: wide ? 40 : 60,
          width: wide ? 700 : '100%',
          height: wide ? 1000 : 900,
        }}
      >
        {imgs.map((src, i) => {
          const sp = useSpring(14 + i * 8, 13);
          return (
            <div
              key={src}
              style={{
                position: 'absolute',
                left: wide ? 40 + i * 190 : 140 + i * 270,
                top: wide ? 100 + Math.abs(i - 1) * 40 + (1 - sp) * 700 : 60 + (1 - sp) * 700,
                transform: `rotate(${(i - 1) * 7}deg)`,
                zIndex: i === 1 ? 2 : 1,
              }}
            >
              <Card src={src} w={wide ? 340 : 420} h={wide ? 700 : 800} pos={0.02} r={28} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Outro: React.FC<{ recap?: string[] }> = ({ recap }) => {
  const wide = useWide();
  const frame = useCurrentFrame();
  const s = useSpring(0, 14);
  const items = recap ?? [];
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: '#fff' }}>
      <Bg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          textAlign: 'center',
          opacity: s,
          transform: `scale(${0.92 + s * 0.08})`,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            justifyContent: 'center',
            maxWidth: wide ? 1500 : 900,
          }}
        >
          {items.map((t, i) => (
            <Pill key={t} delay={10 + i * 4}>
              {t}
            </Pill>
          ))}
        </div>
        <div style={{ fontSize: wide ? 150 : 130, fontWeight: 900, marginTop: 20 }}>
          Cairo Metro
        </div>
        <div style={{ fontSize: 70, fontWeight: 700, direction: 'rtl' }}>مترو القاهرة</div>
        <div style={{ fontSize: 44, opacity: 0.92 }}>Free · Offline · Open source</div>
        <div
          style={{
            fontSize: 40,
            marginTop: 14,
            padding: '16px 38px',
            borderRadius: 999,
            background: AMBER,
            color: '#1f2937',
            fontWeight: 800,
            transform: `scale(${1 + Math.sin(frame / 10) * 0.015})`,
          }}
        >
          shawkyebrahim2514.github.io/cairo-metro
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const layoutChapters = (list: ChapterSpec[], start: number, q: number) => {
  let t = start;
  return list.map((c) => {
    const from = t;
    const dur = chapterFrames(c, q);
    t += dur;
    return { c, from, dur };
  });
};

const laid = layoutChapters(CHAPTERS, INTRO, 84);
const END = laid[laid.length - 1].from + laid[laid.length - 1].dur;
export const FULL_DURATION = END + OUTRO;

const RECAP = [
  'Nearest station',
  'Trip planner',
  'Reachable',
  'Live tracking',
  'Image export',
  'QR share',
  'Walking links',
  'Offline',
  'عربي',
];

export const Full: React.FC = () => {
  const frame = useCurrentFrame();
  const vol = interpolate(frame, [0, 45, FULL_DURATION - 90, FULL_DURATION], [0, 0.35, 0.35, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cues: Cue[] = [
    { at: 4, sfx: 'whoosh' },
    { at: 30, sfx: 'pop', v: 0.5 },
    ...laid.flatMap(({ c, from }) => chapterCues(c, from, 84)),
    { at: END - 6, sfx: 'whoosh' },
    { at: END + 12, sfx: 'chime', v: 0.9, len: 90 },
  ];
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Audio src={staticFile('music.wav')} volume={vol} />
      <Cues cues={cues} />
      <Sequence from={0} durationInFrames={INTRO}>
        <Intro />
      </Sequence>
      {laid.map(({ c, from, dur }) => (
        <Sequence key={c.n} from={from} durationInFrames={dur}>
          <Chapter c={c} qFrames={84} />
        </Sequence>
      ))}
      <Sequence from={END} durationInFrames={OUTRO}>
        <Outro recap={RECAP} />
      </Sequence>
    </AbsoluteFill>
  );
};
