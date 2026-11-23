# Promo video (Remotion)

A 48 s, 1080x1920 (9:16) promo video, English with Arabic captions. It is built from the app's own output: real exported trip images and a real screen recording of the Image dialog. This folder is dev-only and separate from the app's npm workspaces, so nothing here ships.

## What is where

| Path                           | Purpose                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `scripts/capture-images.mjs`   | Drives the live site with Playwright, opens the Image dialog and saves each rendered trip image to `public/img/`. |
| `scripts/capture-clip.mjs`     | Records a screen clip: plan a trip, open the Image dialog, toggle options. Output goes to `rec-clip/`.            |
| `scripts/make-audio.mjs`       | The sound generator (see below).                                                                                  |
| `src/Demo.tsx`                 | The Remotion composition: six scenes, captions, phone frame, sound cues.                                          |
| `src/Root.tsx`, `src/index.ts` | Composition registration.                                                                                         |

Generated files (`public/`, `out/`, `rec-*/`) are git-ignored.

## Rebuild the video

```
cd docs/video
npm install
npm run images          # public/img/*.png from the live site
npm run clip            # rec-clip/*.webm
# convert the clip to mp4 (ffmpeg-static ships an ffmpeg binary):
node -e "require('child_process').execFileSync(require('ffmpeg-static'),['-y','-i',require('fs').readdirSync('rec-clip').map(f=>'rec-clip/'+f)[0],'-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-r','30','public/clip.mp4'])"
npm run audio           # public/music.wav + whoosh/pop/click/chime
npm run studio          # preview and scrub
LEN=200 npm run audio   # the full video needs 200 s of music\nnpx remotion render src/index.ts Full out/full.mp4 --browser-executable="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --concurrency=8\nnpx remotion render src/index.ts Teaser out/teaser.mp4 --browser-executable=...   # same flag
```

Optional last step, to make it louder without re-encoding the video:
`ffmpeg -i out/demo.mp4 -c:v copy -af loudnorm=I=-15:TP=-1.5:LRA=9 -c:a aac -b:a 192k final.mp4`

Timing in `Demo.tsx` is tied to the clip: the Image dialog scene starts the clip at frame 120 (4.0 s) and plays it at 2.1x. If you re-record, check the `mark(...)` timestamps that `capture-clip.mjs` prints and adjust `startFrom` and `playbackRate`.

## Storyline (v2: two videos)

Every chapter is **question, then answer, then benefit**: a big question with an Arabic line, then a real phone recording on the right with the answer headline and a "why you will like it" line on the left.

- **Full (1920x1080, about 3 min):** intro, then 10 chapters: nearest station, trip planner, reachable in 30 min, hours and last train, live tracking, **image export (6 parts, the longest chapter)**, link and QR share, walking links, offline, Arabic; then a recap outro.
- **Teaser (1080x1920, about 55 s):** the same chapters shortened and sped up (nearest, planner, tracking, image styles and themes, offline).

Chapters are data in `src/chapters.ts`; `src/Chapter.tsx` renders them in wide or tall layout; `src/Full.tsx` and `src/Teaser.tsx` assemble the timeline and sound cues; `src/kit.tsx` has the shared pieces. The 10 phone clips and image variants were recorded in parallel by separate agents; see "Capturing clips" below.

## Capturing clips

Clips are 780x1688 mp4 in `public/clips/` and trip images in `public/img/`. Recipe for each clip: Playwright with a 390x844 viewport at 2x, `recordVideo` of 780x1688, then ffmpeg `crop=390:844:0:0,scale=780:1688` (Playwright draws the page in the top-left corner), plus injected tap ripples and human pacing. Tracking uses `setGeolocation` along the real route; the "closing soon" state fakes the time with `page.clock.install`; offline uses `context.setOffline(true)`. The agent scripts lived in a temp folder and are not kept; `scripts/capture-clip.mjs` shows the pattern.

## The sound generator

`scripts/make-audio.mjs` creates every sound with ffmpeg from maths, so there are no samples and no licences to check.

- **Music:** four chords (Am, F, C, G) at 100 bpm, one chord per 2.4 s. Each is a sum of sine waves (pad), a low sine (bass) and a plucked arpeggio built from a decaying sine. A kick (a sine whose pitch drops fast) and a hi-hat (white noise, high-passed and chopped by a `volume` expression) sit on top. The pattern is looped to 52 s and limited.
- **Effects:** `whoosh` (faded pink noise, band-limited), `pop` (a quick falling-pitch sine), `click` (a very short tone) and `chime` (three decaying sines).
- `Demo.tsx` places effects with a `CUES` list of `{ at: frame, sfx, v }`: whoosh at scene changes, pops when chips and cards appear, a chime on the logo.

## Lessons from building it (failures and fixes)

1. **First attempt was rejected.** A plain screen recording with DOM captions looked flat and skipped the app's biggest feature, image export. Fix: rebuild in Remotion around image export, with the hook as a question and answer.
2. **No tools installed.** There was no ffmpeg or Playwright. Fix: `playwright-core` and `ffmpeg-static` from npm, driving the already-installed Edge through `executablePath`; Remotion uses it too via `--browser-executable`, so no Chrome download is needed.
3. **Title overlay swallowed clicks.** A faded overlay still captured pointer events, so Playwright timed out. Fix: `pointer-events: none` when hidden, or click through the DOM.
4. **First-run noise in the recording.** The tour and the install card showed up. Fix: dismiss the tour through the DOM and hide `.install-card` with injected CSS.
5. **Wrong start page.** Opening `#/plan` directly left the second search box missing. Fix: open `#/` and click the Trip planner tab, as a user would.
6. **Dialog buttons not found by role.** `getByRole(..., { exact: true })` did not match the segmented buttons. Fix: filter `[role=dialog] button` by a `^text$` regex.
7. **Screen clip looked moved and clipped.** Playwright draws the page in the top-left of the video canvas without scaling it up, so the app filled only a quarter of the frame. Fix: crop and scale in Remotion (the video element is 200% wide inside an `overflow: hidden` box). Recording at the exact viewport size would also work, at lower resolution.
8. **Almost silent video.** The first audio was one quiet drone and no effects, so it was barely audible. Fix: the generator above, volume tuning (`music` at 0.4) and a final loudness pass.
9. **Remotion `still` once failed.** A render of the video-clip frame failed, and the identical command passed on retry. Rerun before debugging.
10. **Shell and tool gotchas (Windows PowerShell 5.1).** `R` is an alias (use a different function name), ffmpeg writes to stderr so the shell shows exit code 1 on success, single-image output needs `-update 1` or a proper filtergraph, and the file-creation tool needs the parent folder to exist first.

## Ideas not done

- Click sounds timed to taps in the screen clip (the speed-up makes alignment fiddly).
- A diagonal trip such as Adly Mansour to Cairo University, to show the turned map with the north arrow.
- A voiceover with system voices.
