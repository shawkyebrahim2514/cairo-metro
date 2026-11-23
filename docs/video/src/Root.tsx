import { Composition } from 'remotion';
import { FULL_DURATION, Full } from './Full';
import { TEASER_DURATION, Teaser } from './Teaser';

export const Root = () => (
  <>
    <Composition
      id="Full"
      component={Full}
      durationInFrames={FULL_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="Teaser"
      component={Teaser}
      durationInFrames={TEASER_DURATION}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);
