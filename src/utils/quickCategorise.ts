/** Selection logic of the quick add sheet: uncategorised rows grouped per merchant, picked in bulk. */

export interface QuickRow {
  id: number;
  date: string;
  amount: number;
  merchant: string;
  rawDescription: string;
}

export interface QuickGroup {
  key: string;
  title: string;
  iban: string | null;
  keyword: string;
  transactionIds: number[];
  total: number;
  suggestion: { category: string } | null;
}

export interface QuickSection<Row extends QuickRow = QuickRow> {
  key: string;
  /** Null for the rows that belong to no merchant group; they have no header checkbox. */
  group: QuickGroup | null;
  suggested: boolean;
  data: Row[];
}

export type GroupState = 'none' | 'some' | 'all';

const UNGROUPED_KEY = '__ungrouped__';

/** One section per merchant: suggested for `category` first, then largest total; loose rows last. */
export function buildSections<Row extends QuickRow>(
  rows: Row[],
  groups: QuickGroup[],
  category: string
): QuickSection<Row>[] {
  const groupOfRow = new Map<number, string>();
  for (const group of groups) {
    for (const id of group.transactionIds) groupOfRow.set(id, group.key);
  }

  const rowsByGroup = new Map<string, Row[]>();
  const loose: Row[] = [];
  for (const row of rows) {
    const key = groupOfRow.get(row.id);
    if (key === undefined) {
      loose.push(row);
      continue;
    }
    const bucket = rowsByGroup.get(key);
    if (bucket) bucket.push(row);
    else rowsByGroup.set(key, [row]);
  }

  const sections: QuickSection<Row>[] = groups
    .filter((group) => rowsByGroup.has(group.key))
    .map((group) => ({
      key: group.key,
      group,
      suggested: group.suggestion?.category === category,
      data: rowsByGroup.get(group.key) ?? [],
    }))
    .sort((a, b) => Number(b.suggested) - Number(a.suggested) || (b.group?.total ?? 0) - (a.group?.total ?? 0));

  if (loose.length > 0) sections.push({ key: UNGROUPED_KEY, group: null, suggested: false, data: loose });
  return sections;
}

/** Keeps the rows whose merchant or description contains the query; a matching merchant keeps all its rows. */
export function filterSections<Row extends QuickRow>(
  sections: QuickSection<Row>[],
  query: string
): QuickSection<Row>[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return sections;

  const result: QuickSection<Row>[] = [];
  for (const section of sections) {
    if (section.group?.title.toLowerCase().includes(needle)) {
      result.push(section);
      continue;
    }
    const data = section.data.filter(
      (row) =>
        (row.merchant || '').toLowerCase().includes(needle) ||
        (row.rawDescription || '').toLowerCase().includes(needle)
    );
    if (data.length > 0) result.push({ ...section, data });
  }
  return result;
}

export function toggleRow(selected: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** How much of the given rows is picked. */
export function selectionState(ids: number[], selected: ReadonlySet<number>): GroupState {
  let picked = 0;
  for (const id of ids) if (selected.has(id)) picked++;
  if (picked === 0) return 'none';
  return picked === ids.length ? 'all' : 'some';
}

/** Picks every given row, or clears them when all are picked already. */
export function toggleRows(selected: ReadonlySet<number>, ids: number[]): Set<number> {
  const next = new Set(selected);
  if (selectionState(ids, selected) === 'all') {
    for (const id of ids) next.delete(id);
  } else {
    for (const id of ids) next.add(id);
  }
  return next;
}

export function visibleIds(sections: QuickSection[]): number[] {
  return sections.flatMap((section) => section.data.map((row) => row.id));
}

/**
 * Rule keywords for the merchants picked completely: every uncategorised row of the merchant,
 * also those a search hides. The IBAN wins over the name, as on the Review screen.
 */
export function ruleKeywordsFor(groups: QuickGroup[], selected: ReadonlySet<number>): string[] {
  const keywords = new Set<string>();
  for (const group of groups) {
    if (selectionState(group.transactionIds, selected) !== 'all') continue;
    const keyword = group.iban ?? group.keyword;
    if (keyword) keywords.add(keyword);
  }
  return Array.from(keywords);
}
