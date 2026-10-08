import type { SiteKey } from './en';

export interface ChangelogEntry {
  version: string;
  /** `YYYY-MM-DD` of the release; left out until the version is in the stores. */
  date?: string;
  items: SiteKey[];
}

/** Newest first. A new entry needs its `changelog.*` keys in all nine site copy files. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.0',
    items: [
      'changelog.v100.1',
      'changelog.v100.2',
      'changelog.v100.3',
      'changelog.v100.4',
      'changelog.v100.5',
      'changelog.v100.6',
      'changelog.v100.7',
    ],
  },
];
