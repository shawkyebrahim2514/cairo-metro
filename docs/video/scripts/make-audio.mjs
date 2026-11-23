import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import ffmpegPath from 'ffmpeg-static';

// Run from docs/video. Writes the music and sound effects into public/.
fs.mkdirSync('public', { recursive: true });
const out = 'public/';
const run = (...a) => execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', ...a]);

// --- music: Am F C G, 100 bpm, one chord per 2.4 s (4 beats of 0.6 s)
const chords = [
  { n: [220, 261.63, 329.63], b: 110 },
  { n: [174.61, 220, 261.63], b: 87.31 },
  { n: [261.63, 329.63, 392], b: 130.81 },
  { n: [196, 246.94, 293.66], b: 98 },
];
const parts = [];
chords.forEach((c, i) => {
  const pad = c.n.map((f) => `0.12*sin(2*PI*${f}*t)`).join('+');
  const arp = `0.22*exp(-9*mod(t,0.3))*sin(2*PI*2*if(lt(mod(t,0.9),0.3),${c.n[0]},if(lt(mod(t,0.9),0.6),${c.n[1]},${c.n[2]}))*t)`;
  const bass = `0.30*sin(2*PI*${c.b}*t)*(0.6+0.4*exp(-5*mod(t,0.6)))`;
  const env = 'min(1,t/0.25)*min(1,(2.4-t)/0.25)';
  run(
    '-f',
    'lavfi',
    '-i',
    `aevalsrc='(${pad})*${env}+${arp}+${bass}*${env}':d=2.4:s=44100`,
    `${out}chord${i}.wav`,
  );
  parts.push(`${out}chord${i}.wav`);
});
const cwd = process.cwd().replace(/\\/g, '/');
fs.writeFileSync('chords.txt', parts.map((p) => `file '${cwd}/${p}'`).join('\n'));
run('-f', 'concat', '-safe', '0', '-i', 'chords.txt', '-c', 'copy', `${out}prog.wav`);
// loop to 52 s
run('-stream_loop', '6', '-i', `${out}prog.wav`, '-t', '52', `${out}prog52.wav`);
// kick every 0.6 s (from beat 1), hat on off-beats
run(
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='0.9*sin(2*PI*(48+90*exp(-30*mod(t,0.6)))*mod(t,0.6))*exp(-7*mod(t,0.6))':d=52:s=44100`,
  `${out}kick.wav`,
);
run(
  '-f',
  'lavfi',
  '-i',
  'anoisesrc=d=52:c=white:a=0.3:r=44100',
  '-af',
  "highpass=f=7000,volume='pow(abs(sin(PI*t/0.3)),30)':eval=frame",
  `${out}hat.wav`,
);
run(
  '-i',
  `${out}prog52.wav`,
  '-i',
  `${out}kick.wav`,
  '-i',
  `${out}hat.wav`,
  '-filter_complex',
  '[0]volume=1.0[a];[1]volume=0.55[k];[2]volume=0.35[h];[a][k][h]amix=inputs=3:duration=first:normalize=0,lowpass=f=9000,alimiter=limit=0.9[m]',
  '-map',
  '[m]',
  `${out}music.wav`,
);

// --- sound effects
run(
  '-f',
  'lavfi',
  '-i',
  'anoisesrc=d=0.8:c=pink:a=0.8:r=44100',
  '-af',
  'highpass=f=300,lowpass=f=4500,afade=t=in:d=0.4,afade=t=out:st=0.4:d=0.4,volume=8dB,alimiter=limit=0.9',
  `${out}whoosh.wav`,
);
run(
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='sin(2*PI*(520+900*exp(-28*t))*t)*exp(-22*t)':d=0.25:s=44100`,
  `${out}pop.wav`,
);
run(
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='0.8*sin(2*PI*1900*t)*exp(-110*t)':d=0.1:s=44100`,
  `${out}click.wav`,
);
run(
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='0.35*(sin(2*PI*880*t)+0.7*sin(2*PI*1318.5*t)+0.5*sin(2*PI*1760*t))*exp(-2.5*t)':d=2.2:s=44100`,
  `${out}chime.wav`,
);
for (const f of ['chord0', 'chord1', 'chord2', 'chord3', 'prog', 'prog52', 'kick', 'hat'])
  fs.rmSync(`${out}${f}.wav`, { force: true });
fs.rmSync('chords.txt', { force: true });
console.log('ok');
