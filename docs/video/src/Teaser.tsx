import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { CHAPTERS } from './chapters';
import { Chapter, chapterCues, type ChapterSpec } from './Chapter';
import { Cues, type Cue } from './kit';
import { Intro, Outro, layoutChapters } from './Full';

const find = (n: number) => CHAPTERS.find((c) => c.n === n)!;
const Q = 48;
const quick = (
  c: ChapterSpec,
  part: number,
  len: number,
  rate: number,
  qAr?: string,
): ChapterSpec => {
  const p = c.parts[part];
  return {
    ...c,
    qAr: qAr ?? c.qAr,
    parts: [{ ...p, clip: p.clip ? { ...p.clip, len, rate } : undefined }],
  };
};

const RAW: ChapterSpec[] = [
  quick(find(1), 0, 10, 1.6),
  quick(find(2), 0, 12, 2),
  quick(find(5), 0, 10, 1.7),
  {
    ...find(6),
    parts: [find(6).parts[1], find(6).parts[2], { ...find(6).parts[5], frames: 90 }],
  },
  quick(find(9), 0, 10, 1.7),
];
const SHORT = RAW.map((c, i) => ({ ...c, n: i + 1 }));
SHORT[3].parts[0] = {
  ...SHORT[3].parts[0],
  clip: { ...SHORT[3].parts[0].clip!, len: 11, rate: 1.9 },
};
SHORT[3].parts[1] = {
  ...SHORT[3].parts[1],
  clip: { ...SHORT[3].parts[1].clip!, len: 11, rate: 1.9 },
};

const INTRO_T = 90;
const OUTRO_T = 150;
const laid = layoutChapters(SHORT, INTRO_T, Q);
const END = laid[laid.length - 1].from + laid[laid.length - 1].dur;
export const TEASER_DURATION = END + OUTRO_T;

export const Teaser: React.FC = () => {
  const frame = useCurrentFrame();
  const vol = interpolate(frame, [0, 30, TEASER_DURATION - 60, TEASER_DURATION], [0, 0.4, 0.4, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cues: Cue[] = [
    { at: 2, sfx: 'whoosh' },
    ...laid.flatMap(({ c, from }) => chapterCues(c, from, Q)),
    { at: END - 6, sfx: 'whoosh' },
    { at: END + 10, sfx: 'chime', v: 0.9, len: 90 },
  ];
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Audio src={staticFile('music.wav')} volume={vol} />
      <Cues cues={cues} />
      <Sequence from={0} durationInFrames={INTRO_T}>
        <Intro />
      </Sequence>
      {laid.map(({ c, from, dur }) => (
        <Sequence key={c.n} from={from} durationInFrames={dur}>
          <Chapter c={c} qFrames={Q} />
        </Sequence>
      ))}
      <Sequence from={END} durationInFrames={OUTRO_T}>
        <Outro recap={['Nearest', 'Planner', 'Tracking', 'Image export', 'Offline', 'عربي']} />
      </Sequence>
    </AbsoluteFill>
  );
};
