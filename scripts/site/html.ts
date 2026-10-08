// Shared pieces for the page builders: paths, escaping, links, buttons and screenshots.
import { existsSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import type { SiteKey } from '../../src/content/site';
import type { LanguageCode, TranslationKey, TranslationParams } from '../../src/i18n';
import { APP_STORE_URL, APP_URL, BASE_PATH, ORIGIN, PLAY_STORE_URL, STATIC_DIR } from './config';

/** App strings: guides, feature names, disclaimers. */
export type Translate = (key: TranslationKey, params?: TranslationParams) => string;
/** Web-only copy from `src/content/site`. */
export type SiteTranslate = (key: SiteKey, params?: TranslationParams) => string;

export interface SiteContext {
  code: LanguageCode;
  tag: string;
  t: Translate;
  s: SiteTranslate;
}

export interface Page {
  /** Path under the language root, the same in every language so each version can point at the others. */
  path: string;
  title: string;
  description: string;
  body: string;
  jsonLd?: object;
  /** Guides are articles; everything else is a plain page. */
  article?: boolean;
  /** Wider column for pages with a grid. */
  wide?: boolean;
  /** The download block under the page; left out where it does not belong (the legal pages). */
  cta?: boolean;
}

export const PATHS = {
  home: '',
  guides: 'export-csv/',
  features: 'features/',
  faq: 'faq/',
  support: 'support/',
  privacy: 'privacy/',
  terms: 'terms/',
  disclaimer: 'disclaimer/',
  changelog: 'changelog/',
} as const;

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/** `pt` is Brazilian wording in the app. */
export const htmlLang = (code: LanguageCode): string => (code === 'pt' ? 'pt-BR' : code);

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Path of a page under the site root. */
export const pagePath = (code: LanguageCode, path: string = PATHS.home): string => `/${code}/${path}`;
export const href = (path: string): string => `${BASE_PATH}${path}`;
export const absolute = (path: string): string => `${ORIGIN}${BASE_PATH}${path}`;

export const pageLink = (ctx: SiteContext, path: string, label: string): string =>
  `<a href="${href(pagePath(ctx.code, path))}">${escapeHtml(label)}</a>`;

export const externalLink = (url: string, label: string): string =>
  `<a href="${escapeHtml(url)}" rel="noopener">${escapeHtml(label)}</a>`;

/** "ING, Rabobank and bunq", joined the way the language does it. */
export const listOf = (ctx: SiteContext, items: string[]): string =>
  new Intl.ListFormat(ctx.tag, { style: 'long', type: 'conjunction' }).format(items);

/** A translated sentence with a `{link}` placeholder, filled with ready-made HTML. */
export const withLink = (text: string, link: string): string => escapeHtml(text).replace('{link}', () => link);

/** Store buttons once there are store links; until then the one button to `APP_URL`. */
export function downloadButtons(ctx: SiteContext): string {
  const stores = [
    APP_STORE_URL ? `<a class="button" href="${escapeHtml(APP_STORE_URL)}">${escapeHtml(ctx.s('cta.appStore'))}</a>` : '',
    PLAY_STORE_URL ? `<a class="button" href="${escapeHtml(PLAY_STORE_URL)}">${escapeHtml(ctx.s('cta.playStore'))}</a>` : '',
  ].join('');
  const buttons = stores || `<a class="button" href="${escapeHtml(APP_URL)}">${escapeHtml(ctx.t('site.cta'))}</a>`;
  return `<p class="buttons">${buttons}</p>`;
}

/** Width and height from the PNG header, or null when the file is not there. */
function pngSize(file: string): { width: number; height: number } | null {
  if (!existsSync(file)) return null;
  const header = Buffer.alloc(24);
  const handle = openSync(file, 'r');
  readSync(handle, header, 0, 24, 0);
  closeSync(handle);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

/**
 * `site/screenshots/<name>.png`, with `<name>-dark.png` for dark mode when it exists.
 * Empty when there is no screenshot yet, so a page never shows a broken image.
 */
export function screenshot(name: string, alt: string): string {
  const size = pngSize(join(STATIC_DIR, 'screenshots', `${name}.png`));
  if (!size) return '';
  const dark = existsSync(join(STATIC_DIR, 'screenshots', `${name}-dark.png`))
    ? `<source media="(prefers-color-scheme:dark)" srcset="${href(`/screenshots/${name}-dark.png`)}">`
    : '';
  return `<picture class="shot">${dark}<img src="${href(`/screenshots/${name}.png`)}" alt="${escapeHtml(alt)}" width="${size.width}" height="${size.height}" loading="lazy"></picture>`;
}
