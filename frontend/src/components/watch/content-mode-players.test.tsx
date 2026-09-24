import { createRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import KaraokePlayer from './KaraokePlayer';
import PodcastPlayer from './PodcastPlayer';
import DramaPlayer from './DramaPlayer';

afterEach(cleanup);

it.each([KaraokePlayer, PodcastPlayer, DramaPlayer])('forwards progress lifecycle events and does not intercept typing spaces', (Player) => {
  const ref = createRef<HTMLVideoElement>();
  const onSeeking = vi.fn(); const onPause = vi.fn(); const onLoadedMetadata = vi.fn();
  const { container } = render(<><textarea /><Player src="/test.mp4" title="Test" cues={[]} currentMs={0} durationSeconds={120}
    videoRef={ref} onSeeking={onSeeking} onPause={onPause} onLoadedMetadata={onLoadedMetadata} /></>);
  fireEvent.seeking(ref.current!); fireEvent.pause(ref.current!); fireEvent.loadedMetadata(ref.current!);
  expect(onSeeking).toHaveBeenCalledOnce(); expect(onPause).toHaveBeenCalledOnce(); expect(onLoadedMetadata).toHaveBeenCalledOnce();
  const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
  container.querySelector('textarea')!.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});

it('podcast mute changes the media element and chapter navigation seeks it', () => {
  const ref = createRef<HTMLVideoElement>();
  const { container, getByText } = render(<PodcastPlayer src="/test.mp4" title="Podcast" cues={[]} durationSeconds={1800}
    videoRef={ref} chapters={[{ chapterId: 'c1', title: 'Chapter one', startMs: 60000, endMs: 120000 }]} />);
  getByText('Chapter one').click();
  expect(ref.current!.currentTime).toBe(60);
  const mute = container.querySelector('svg.lucide-volume2, svg.lucide-volume-2')?.closest('button');
  expect(mute).toBeTruthy();
  fireEvent.click(mute!);
  expect(ref.current!.muted).toBe(true);
});
