import { join } from 'node:path';

/** An unset GitHub Actions variable arrives as an empty string. */
const env = (name: string): string | undefined => process.env[name]?.trim() || undefined;

export const REPO_URL = 'https://github.com/erolerdogan/financial-aid';

/** Where the site is served; a custom domain only changes this. */
export const SITE_URL = (env('SITE_URL') ?? 'https://erolerdogan.github.io/financial-aid').replace(/\/+$/, '');
/** Where "Get Financial Aid" leads until there are store links. */
export const APP_URL = env('APP_URL') ?? REPO_URL;
export const APP_STORE_URL = env('APP_STORE_URL');
export const PLAY_STORE_URL = env('PLAY_STORE_URL');
/** Shown on the support page; without it the page points at the repository's issues. */
export const SUPPORT_EMAIL = env('SUPPORT_EMAIL');
export const ISSUES_URL = `${REPO_URL}/issues`;

export const APP_NAME = 'Financial Aid';
export const ROOT_DIR = join(__dirname, '..', '..');
export const OUT_DIR = join(ROOT_DIR, 'site-dist');
/** Images kept for the website only (screenshots, social preview); copied to the site root. */
export const STATIC_DIR = join(ROOT_DIR, 'site');

export const BASE_PATH = new URL(SITE_URL).pathname.replace(/\/+$/, '');
export const ORIGIN = new URL(SITE_URL).origin;
