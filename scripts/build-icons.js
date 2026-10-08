#!/usr/bin/env node

/**
 * Builds the app icon ("Treemap Cross"): writes the SVG sources into assets/icon-src/ and the
 * Icon Composer layer into assets/expo.icon/Assets/, then renders the PNGs in assets/images/.
 * Rendering uses headless Google Chrome and `sips`, so it runs on macOS only: `npm run icons`.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'assets', 'icon-src');
const imagesDir = path.join(root, 'assets', 'images');
const composerAssetsDir = path.join(root, 'assets', 'expo.icon', 'Assets');

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const SIZE = 1024;
const GAP = 14;
const RADIUS = 24;

// Aurora theme gradient (src/contexts/ThemeContext.tsx) on a night background.
const INDIGO = '#5B5FEF';
const TEAL = '#14A89A';
const MINT = '#6EF0D2';
const NIGHT_TOP = '#171A3A';
const NIGHT_BOTTOM = '#0B0C1E';

// The cross spans 192..832 with arms 220 thick; each cell is [x, y, width, height] before the gap.
const CROSS_START = 192;
const CROSS_END = 832;
const TILES = [
  // top arm
  { cell: [402, 192, 130, 210] },
  { cell: [532, 192, 90, 118] },
  { cell: [532, 310, 90, 92] },
  // centre
  { cell: [402, 402, 220, 220] },
  // right arm: the highlighted slice
  { cell: [622, 402, 210, 220], accent: true },
  // left arm
  { cell: [192, 402, 210, 98] },
  { cell: [192, 500, 98, 122] },
  { cell: [290, 500, 112, 122] },
  // bottom arm
  { cell: [402, 622, 98, 108] },
  { cell: [402, 730, 98, 102] },
  { cell: [500, 622, 122, 210] },
];

function tileRects(fill) {
  return TILES.map(({ cell: [x, y, w, h], accent }) => {
    const color = fill ?? (accent ? MINT : 'url(#tiles)');
    return `  <rect x="${x + GAP / 2}" y="${y + GAP / 2}" width="${w - GAP}" height="${h - GAP}" rx="${RADIUS}" fill="${color}"/>`;
  }).join('\n');
}

const tileGradient = `<linearGradient id="tiles" gradientUnits="userSpaceOnUse" x1="${CROSS_START}" y1="${CROSS_START}" x2="${CROSS_END}" y2="${CROSS_END}">
    <stop offset="0" stop-color="${INDIGO}"/>
    <stop offset="1" stop-color="${TEAL}"/>
  </linearGradient>`;

const nightGradient = `<linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${NIGHT_TOP}"/>
    <stop offset="1" stop-color="${NIGHT_BOTTOM}"/>
  </linearGradient>`;

function svg(defs, body) {
  const defsBlock = defs.length > 0 ? `  <defs>\n  ${defs.join('\n  ')}\n  </defs>\n` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">\n${defsBlock}${body}\n</svg>\n`;
}

const nightRect = `  <rect width="${SIZE}" height="${SIZE}" fill="url(#night)"/>`;

const sources = {
  'icon.svg': svg([nightGradient, tileGradient], `${nightRect}\n${tileRects()}`),
  'glyph.svg': svg([tileGradient], tileRects()),
  'glyph-mono.svg': svg([], tileRects('#FFFFFF')),
  'background.svg': svg([nightGradient], nightRect),
};

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error(`${path.basename(command)} failed`);
  }
}

/** Renders an SVG source to a square PNG; `scale` zooms the artwork around the centre. */
function render(source, output, size, scale = 1) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));
  const drawn = SIZE * scale;
  const offset = (SIZE - drawn) / 2;
  const page = path.join(tmp, 'page.html');
  const shot = path.join(tmp, 'shot.png');
  fs.writeFileSync(
    page,
    `<!doctype html><html><body style="margin:0;overflow:hidden;background:transparent">` +
      `<img src="file://${path.join(srcDir, source)}" width="${drawn}" height="${drawn}" ` +
      `style="position:absolute;left:${offset}px;top:${offset}px"></body></html>`,
  );
  run(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    `--window-size=${SIZE},${SIZE}`,
    `--screenshot=${shot}`,
    `file://${page}`,
  ]);
  const target = path.join(imagesDir, output);
  if (size === SIZE) fs.copyFileSync(shot, target);
  else run('sips', ['-z', String(size), String(size), shot, '--out', target]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${output} ${size}x${size}`);
}

fs.mkdirSync(srcDir, { recursive: true });
for (const [name, content] of Object.entries(sources)) fs.writeFileSync(path.join(srcDir, name), content);
fs.writeFileSync(path.join(composerAssetsDir, 'glyph.svg'), sources['glyph.svg']);

// The Android adaptive mask only guarantees the central 66 of 108 dp, so the glyph is drawn smaller there.
const ADAPTIVE_SCALE = 0.84;
// The splash image is shown at a fixed width, so the glyph fills its canvas.
const SPLASH_SCALE = 1.55;

render('icon.svg', 'icon.png', 1024);
render('icon.svg', 'favicon.png', 48);
render('glyph.svg', 'android-icon-foreground.png', 512, ADAPTIVE_SCALE);
render('background.svg', 'android-icon-background.png', 512);
render('glyph-mono.svg', 'android-icon-monochrome.png', 432, ADAPTIVE_SCALE);
render('glyph.svg', 'splash-icon.png', 1024, SPLASH_SCALE);
