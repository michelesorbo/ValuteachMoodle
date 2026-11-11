/**
 * Video completion rule (pure functions, no I/O): a video lesson is completed when
 * at least 90% of its duration has actually been played. What counts is the union of
 * the played time ranges, so jumping to the end does not complete the lesson and
 * watching the same part twice is not counted twice.
 */
export const VIDEO_COMPLETION_THRESHOLD = 0.9;

/** [start, end] in seconds. */
export type TimeRange = [number, number];

/**
 * Ranges closer than this are joined: players report tiny gaps around pauses.
 * Kept small on purpose, so that repeatedly skipping ahead cannot add up to unwatched time.
 */
const GAP_TOLERANCE_SECONDS = 0.25;

/** Clamps ranges to the video, drops invalid ones, sorts them and merges the ones that overlap or touch. */
export function normalizeRanges(ranges: readonly TimeRange[], duration: number): TimeRange[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];

  const valid = ranges
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end))
    .map(([start, end]): TimeRange => [Math.max(0, start), Math.min(duration, end)])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  const merged: TimeRange[] = [];
  for (const [start, end] of valid) {
    const last = merged.at(-1);
    if (last && start <= last[1] + GAP_TOLERANCE_SECONDS) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** Union of what was already stored with what a new viewing session played. */
export function mergeRanges(
  stored: readonly TimeRange[],
  played: readonly TimeRange[],
  duration: number,
): TimeRange[] {
  return normalizeRanges([...stored, ...played], duration);
}

export function watchedSeconds(ranges: readonly TimeRange[]): number {
  return ranges.reduce((total, [start, end]) => total + Math.max(0, end - start), 0);
}

/** Fraction of the video that has been played, between 0 and 1. */
export function watchedFraction(ranges: readonly TimeRange[], duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, watchedSeconds(normalizeRanges(ranges, duration)) / duration);
}

/** Whole percentage, rounded down so that 90 always means the threshold has been reached. */
export function watchedPercent(ranges: readonly TimeRange[], duration: number): number {
  // The epsilon absorbs floating point noise (e.g. 0.9 * 100 = 89.99999999999999).
  return Math.floor(watchedFraction(ranges, duration) * 100 + 1e-9);
}

export function isVideoCompleted(ranges: readonly TimeRange[], duration: number): boolean {
  return watchedFraction(ranges, duration) >= VIDEO_COMPLETION_THRESHOLD - 1e-9;
}

/** MP4 files start with a box whose type, at bytes 4-7, is "ftyp". */
export function looksLikeMp4(header: Uint8Array): boolean {
  return (
    header.length >= 8 && header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70
  );
}
