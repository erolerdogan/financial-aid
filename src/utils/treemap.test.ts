// Run with: npx tsx src/utils/treemap.test.ts
import { layoutTreemap, type TreemapRect } from './treemap';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const EPSILON = 1e-6;
const area = (rect: TreemapRect): number => rect.width * rect.height;

const overlaps = (a: TreemapRect, b: TreemapRect): boolean =>
  a.x < b.x + b.width - EPSILON &&
  b.x < a.x + a.width - EPSILON &&
  a.y < b.y + b.height - EPSILON &&
  b.y < a.y + a.height - EPSILON;

const checkLayout = (label: string, values: number[], width: number, height: number): void => {
  const rects = layoutTreemap(values, width, height);
  const total = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);

  check(`${label}: one rectangle per value`, rects.length === values.length);
  check(
    `${label}: areas proportional to values`,
    rects.every((rect, i) => Math.abs(area(rect) - (Math.max(0, values[i]) / total) * width * height) < 1e-3)
  );
  check(
    `${label}: rectangles inside the bounds`,
    rects.every(
      (rect) =>
        rect.x >= -EPSILON &&
        rect.y >= -EPSILON &&
        rect.x + rect.width <= width + EPSILON &&
        rect.y + rect.height <= height + EPSILON
    )
  );

  const filled = rects.filter((rect) => area(rect) > 0);
  let overlapping = false;
  for (let i = 0; i < filled.length; i++) {
    for (let j = i + 1; j < filled.length; j++) {
      if (overlaps(filled[i], filled[j])) overlapping = true;
    }
  }
  check(`${label}: no overlap`, !overlapping);
  check(
    `${label}: bounds fully covered`,
    Math.abs(filled.reduce((sum, rect) => sum + area(rect), 0) - width * height) < 1e-3
  );
};

checkLayout('four categories, wide', [1200, 640, 310, 95], 300, 170);
checkLayout('unsorted input', [95, 1200, 310, 640], 300, 170);
checkLayout('many categories', [900, 700, 650, 400, 380, 220, 150, 90, 60, 45, 30, 12, 8, 3], 303, 170);
checkLayout('tall area', [5, 4, 3, 2, 1], 120, 400);
checkLayout('equal values', [10, 10, 10, 10], 200, 200);
checkLayout('zero and negative values', [50, 0, 25, -10, 25], 300, 170);

const single = layoutTreemap([42], 300, 170);
check(
  'single value fills the area',
  single.length === 1 && single[0].x === 0 && single[0].y === 0 && single[0].width === 300 && Math.abs(single[0].height - 170) < EPSILON
);

const order = layoutTreemap([95, 1200], 300, 170);
check('rectangles keep the input order', area(order[1]) > area(order[0]));

const zeroes = layoutTreemap([50, 0, 25], 300, 170);
check('zero value gets an empty rectangle', area(zeroes[1]) === 0);

check('empty input', layoutTreemap([], 300, 170).length === 0);
check('all zero', layoutTreemap([0, 0], 300, 170).every((rect) => area(rect) === 0));
check('no width', layoutTreemap([1, 2], 0, 170).every((rect) => area(rect) === 0));
check('NaN value ignored', area(layoutTreemap([Number.NaN, 5], 100, 100)[1]) === 10000);

console.log(failures === 0 ? '\nAll treemap tests passed.' : `\n${failures} treemap test(s) failed.`);
if (failures > 0) process.exit(1);
