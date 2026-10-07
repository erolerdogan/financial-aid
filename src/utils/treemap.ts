export interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Worst aspect ratio in a row of the given total area laid along `side`.
const worstRatio = (sum: number, largest: number, smallest: number, side: number): number => {
  const sideSq = side * side;
  const sumSq = sum * sum;
  return Math.max((sideSq * largest) / sumSq, sumSq / (sideSq * smallest));
};

/**
 * Squarified treemap: one rectangle per value, in the order of `values`, with an area proportional to the value.
 * Values that are zero, negative or not finite get an empty rectangle.
 */
export const layoutTreemap = (values: number[], width: number, height: number): TreemapRect[] => {
  const rects: TreemapRect[] = values.map(() => ({ x: 0, y: 0, width: 0, height: 0 }));
  if (!(width > 0) || !(height > 0)) return rects;

  const valid = values
    .map((value, index) => ({ index, value }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0);
  const total = valid.reduce((sum, item) => sum + item.value, 0);
  if (!(total > 0)) return rects;

  const items = valid
    .map((item) => ({ index: item.index, area: (item.value / total) * width * height }))
    .sort((a, b) => b.area - a.area);

  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let start = 0;

  while (start < items.length) {
    const side = Math.min(w, h);
    const largest = items[start].area;
    let end = start + 1;
    let sum = largest;
    let best = worstRatio(sum, largest, largest, side);

    // Keep adding tiles to the row while they get closer to square.
    while (end < items.length) {
      const nextSum = sum + items[end].area;
      const next = worstRatio(nextSum, largest, items[end].area, side);
      if (next > best) break;
      sum = nextSum;
      best = next;
      end++;
    }

    const thickness = sum / side;
    const vertical = w >= h;
    let offset = 0;
    for (let i = start; i < end; i++) {
      const length = items[i].area / thickness;
      rects[items[i].index] = vertical
        ? { x, y: y + offset, width: thickness, height: length }
        : { x: x + offset, y, width: length, height: thickness };
      offset += length;
    }

    if (vertical) {
      x += thickness;
      w -= thickness;
    } else {
      y += thickness;
      h -= thickness;
    }
    start = end;
  }

  return rects;
};
