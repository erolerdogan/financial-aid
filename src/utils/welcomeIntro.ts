import { CATEGORY_COLORS } from '../constants/colors';

/** `app_meta` key: set once the Welcome intro has ended or was skipped. It survives "Reset". */
export const WELCOME_INTRO_SEEN_KEY = 'welcome_intro_seen';

/** How long each animated scene stays before the next one; Welcome itself is the scene after the last. */
export const INTRO_SCENE_DURATIONS_MS: readonly number[] = [4800, 2800, 3000, 2800, 3000, 2800, 3400];

/** The scene after `index`, or null when the intro is over. */
export function nextScene(index: number): number | null {
  const next = index + 1;
  return next >= 0 && next < INTRO_SCENE_DURATIONS_MS.length ? next : null;
}

export interface IntroDonutSegment {
  /** Built-in category name; only its colour is shown. */
  category: string;
  fraction: number;
  color: string;
}

const segment = (category: string, fraction: number): IntroDonutSegment => ({
  category,
  fraction,
  color: CATEGORY_COLORS[category],
});

/** Made-up split, clockwise from 12 o'clock. */
export const INTRO_DONUT_SEGMENTS: readonly IntroDonutSegment[] = [
  segment('Housing', 0.35),
  segment('Groceries', 0.2),
  segment('Transportation', 0.15),
  segment('Dining Out', 0.15),
  segment('Health & Care', 0.15),
];

export interface SegmentDash {
  /** Visible length of the stroke. */
  dash: number;
  /** `strokeDashoffset` that moves the stroke to its place on the circle. */
  offset: number;
}

/**
 * Stroke dashes that cut one circle into segments (the technique of the Home donut).
 * `gap` is left open at the end of every segment.
 */
export function donutSegmentDashes(fractions: readonly number[], circumference: number, gap = 0): SegmentDash[] {
  let before = 0;
  return fractions.map((fraction) => {
    const length = circumference * fraction;
    const dash = { dash: Math.max(0, length - gap), offset: before === 0 ? 0 : -before };
    before += length;
    return dash;
  });
}

export interface IntroDot {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

// Fixed scatter (fractions of the canvas), so every run and every test sees the same picture.
const SCATTER: readonly (readonly [number, number])[] = [
  [0.08, 0.12], [0.86, 0.07], [0.45, 0.03], [0.95, 0.42], [0.03, 0.55],
  [0.7, 0.93], [0.22, 0.9], [0.6, 0.18], [0.3, 0.3], [0.92, 0.78],
  [0.12, 0.75], [0.5, 0.97], [0.78, 0.3], [0.02, 0.3], [0.38, 0.62],
  [0.66, 0.55], [0.18, 0.45], [0.97, 0.6], [0.55, 0.75], [0.33, 0.08],
];

const segmentColorAt = (fraction: number): string => {
  let end = 0;
  for (const item of INTRO_DONUT_SEGMENTS) {
    end += item.fraction;
    if (fraction < end) return item.color;
  }
  return INTRO_DONUT_SEGMENTS[INTRO_DONUT_SEGMENTS.length - 1].color;
};

/**
 * Dot centres in a `size` x `size` canvas: scattered at the start, evenly spread on the
 * donut ring (`radius` around the centre, clockwise from 12 o'clock) at the end, each in
 * the colour of the segment it lands on.
 */
export function introDots(size: number, radius: number): IntroDot[] {
  const center = size / 2;
  return SCATTER.map(([x, y], index) => {
    const fraction = (index + 0.5) / SCATTER.length;
    const angle = fraction * 2 * Math.PI;
    return {
      startX: x * size,
      startY: y * size,
      endX: center + radius * Math.sin(angle),
      endY: center - radius * Math.cos(angle),
      color: segmentColorAt(fraction),
    };
  });
}
