// Run with: npx tsx src/utils/welcomeIntro.test.ts
import {
  donutSegmentDashes,
  INTRO_DONUT_SEGMENTS,
  INTRO_SCENE_DURATIONS_MS,
  introDots,
  nextScene,
} from './welcomeIntro';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;

// Scenes
const total = INTRO_SCENE_DURATIONS_MS.reduce((sum, ms) => sum + ms, 0);
check('seven animated scenes', INTRO_SCENE_DURATIONS_MS.length === 7);
check('the intro lasts 20 to 25 seconds', total >= 20000 && total <= 25000, `${total} ms`);
check('every scene lasts two to five seconds', INTRO_SCENE_DURATIONS_MS.every((ms) => ms >= 2000 && ms <= 5000));
check('the questions scene is the longest', INTRO_SCENE_DURATIONS_MS.every((ms) => ms <= INTRO_SCENE_DURATIONS_MS[0]));
check('scenes follow each other', nextScene(0) === 1 && nextScene(5) === 6);
check('the last scene ends the intro', nextScene(6) === null);
check('an index out of range ends the intro', nextScene(7) === null && nextScene(-2) === null);

// Donut
const fractions = INTRO_DONUT_SEGMENTS.map((item) => item.fraction);
check('segment fractions sum to 1', near(fractions.reduce((sum, value) => sum + value, 0), 1));
check('every segment has a built-in category colour', INTRO_DONUT_SEGMENTS.every((item) => /^#[0-9A-F]{6}$/i.test(item.color)));
check('segment colours differ', new Set(INTRO_DONUT_SEGMENTS.map((item) => item.color)).size === INTRO_DONUT_SEGMENTS.length);

const CIRCUMFERENCE = 500;
const dashes = donutSegmentDashes(fractions, CIRCUMFERENCE);
check('dashes cover the circumference', near(dashes.reduce((sum, item) => sum + item.dash, 0), CIRCUMFERENCE));
check('the first dash starts at the top', dashes[0].offset === 0);
check(
  'each dash starts where the one before ends',
  dashes.every((item, index) => index === 0 || near(-item.offset, -dashes[index - 1].offset + dashes[index - 1].dash))
);
const gapped = donutSegmentDashes(fractions, CIRCUMFERENCE, 4);
check('a gap shortens every dash', gapped.every((item, index) => near(item.dash, dashes[index].dash - 4)));
check('a gap does not move the dashes', gapped.every((item, index) => near(item.offset, dashes[index].offset)));
check('a gap wider than a segment leaves no negative dash', donutSegmentDashes([0.01, 0.99], 100, 4)[0].dash === 0);

// Dots
const SIZE = 200;
const RADIUS = 89;
const dots = introDots(SIZE, RADIUS);
check('twenty dots', dots.length === 20);
check(
  'every dot ends on the ring',
  dots.every((dot) => near(Math.hypot(dot.endX - SIZE / 2, dot.endY - SIZE / 2), RADIUS))
);
check(
  'every dot starts and ends inside the canvas',
  dots.every((dot) => [dot.startX, dot.startY, dot.endX, dot.endY].every((value) => value >= 0 && value <= SIZE))
);
check('the first dot lands just right of 12 o\'clock', dots[0].endX > SIZE / 2 && dots[0].endY < SIZE / 2);
check('the first dot takes the first segment colour', dots[0].color === INTRO_DONUT_SEGMENTS[0].color);
check('the last dot takes the last segment colour', dots[dots.length - 1].color === INTRO_DONUT_SEGMENTS[INTRO_DONUT_SEGMENTS.length - 1].color);
check('every segment gets a dot', INTRO_DONUT_SEGMENTS.every((item) => dots.some((dot) => dot.color === item.color)));
check('same input, same dots', JSON.stringify(introDots(SIZE, RADIUS)) === JSON.stringify(dots));

console.log(failures === 0 ? '\nAll welcomeIntro tests passed.' : `\n${failures} welcomeIntro test(s) failed.`);
if (failures > 0) process.exit(1);
