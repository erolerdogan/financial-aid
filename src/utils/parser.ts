import { CategoryRule, Transaction } from '@/db/database';
import Papa from 'papaparse';
import XLSX from 'xlsx';

/**
 * Normalizes merchant names by stripping noisy transaction codes, dates,
 * card IDs, and common Dutch payment processor prefixes.
 */
 export function normalizeMerchantName(rawDescription: string): string {
  if (!rawDescription) return '';
  return rawDescription
    .toUpperCase()
    // Strips third-party Dutch/EU payment aggregators
    .replace(/(STG\s+MOLLIE\s+PAYMENTS|MOLLIE|PAY\.NL|MTA\*|CCV\*|SUMUP|IZETTLE|PAYPAL|STRIPE|\*)/g, '')
    .replace(/(NL\d{2}[A-Z]{4}\d{10}|PAS\d+|NR\d+|BSK\d+)/g, '')
    .replace(/\b\d{2}[/-]\d{2}[/-]\d{2,4}\b/g, '')
    .replace(/\b\d{4}[/-]\d{2}[/-]\d{2}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Multi-Tiered Classification Engine:
 * 1. Custom User Rules (category_rules)
 * 2. Keyword Heuristics
 * 3. Fallback ('Shopping & Retail')
 */
export function classifyTransaction(description: string, customRules: CategoryRule[] = []): string {
  if (!description) return 'Shopping & Retail';
  const desc = normalizeMerchantName(description);

  // Tier 1: User-Defined Custom Category Rules
  for (const rule of customRules) {
    const cleanRuleKw = rule.keyword.toUpperCase().trim();
    if (cleanRuleKw && desc.includes(cleanRuleKw)) {
      return rule.category;
    }
  }

  // Tier 2: Built-in Keyword Heuristics
  if (/BABYPARK|BABY|PAMPERS|KINDEROPVANG|KOREIN|NURSERY/i.test(desc)) return 'Childcare';
  if (/RENT|MORTGAGE|HOA|HYPOTHEEK|VESTEDA|TULPENHUIS/i.test(desc)) return 'Housing';
  if (/CREDIT CARD|ICS|WISE|REMITLY/i.test(desc)) return 'Credit Card Payments';
  if (/ALBERT HEIJN|\bAH\b|JUMBO|LIDL|ALDI|SUPERMARKET|SPAR|PLUS|EKOPLAZA/i.test(desc)) return 'Groceries';
  if (/RESTAURANT|UBER EATS|DELIVEROO|TAKEAWAY|CAFE|BAR|MC DONALD|LS DODO/i.test(desc)) return 'Dining Out';
  if (/PHARMACY|APOTHEEK|ETOS|KRUIDVAT|HOSPITAL|DOCTOR|CATHARINA/i.test(desc)) return 'Health & Care';
  if (/TRANSFER|SAVINGS|INVESTMENT|DEGIRO|MEESMAN|CANON PRODUCTION/i.test(desc)) return 'Financial Transfers';
  if (/ELECTRICITY|GAS|WATER|ZIGGO|KPN|ENERGY|VATTENFALL|ESSENT|BRABANT WATER/i.test(desc)) return 'Utilities & Telecom';
  if (/LOAN|FINANCE|DUO|LENDING|NEDASCO|ALLIANZ/i.test(desc)) return 'Loan & Insurance';
  if (/NS|SHELL|EV|QWELLO|TANGO|CHARGE|PARKING|NS-REIZEN/i.test(desc)) return 'Transportation';
  if (/TAX|GEMEENTE|BELASTING|WATERSCHAP/i.test(desc)) return 'Taxes & Municipal Fees';

  // Tier 3: Fallback Default Category
  return 'Shopping & Retail';
}

function parseLocaleAmount(raw: any): { magnitude: number; isNegative: boolean } | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number') {
    if (isNaN(raw)) return null;
    return {
      magnitude: Math.abs(raw),
      isNegative: raw < 0,
    };
  }

  let str = String(raw).replace(/\\/g, '').replace(/["']/g, '').trim();
  if (!str) return null;

  const parenNegative = /^\(.*\)$/.test(str);
  if (parenNegative) str = str.slice(1, -1);

  let explicitNegative = false;
  if (/^-/.test(str)) {
    explicitNegative = true;
    str = str.slice(1);
  } else if (/^\+/.test(str)) {
    str = str.slice(1);
  }

  str = str.replace(/[^0-9.,]/g, '');
  if (!str) return null;

  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  let normalized: string;

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalized = str.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = str.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const decimalDigits = str.length - lastComma - 1;
    normalized = decimalDigits === 1 || decimalDigits === 2
      ? str.replace(',', '.')
      : str.replace(/,/g, '');
  } else if (lastDot !== -1) {
    const decimalDigits = str.length - lastDot - 1;
    normalized = decimalDigits === 1 || decimalDigits === 2
      ? str
      : str.replace(/\./g, '');
  } else {
    normalized = str;
  }

  const magnitude = Number(parseFloat(normalized).toFixed(2));
  if (isNaN(magnitude)) return null;

  return { magnitude, isNegative: parenNegative || explicitNegative };
}

function resolveDate(raw: any): { iso: string; ambiguous: boolean } | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).replace(/\\/g, '').replace(/["']/g, '').trim();

  if (/^\d{8}$/.test(str)) {
    const y = str.substring(0, 4);
    const m = str.substring(4, 6);
    const d = str.substring(6, 8);
    return { iso: `${y}-${m}-${d}`, ambiguous: false };
  }

  if (!isNaN(Number(str)) && Number(str) > 30000 && Number(str) < 60000) {
    const parsedDate = XLSX.SSF.parse_date_code(Number(str));
    if (parsedDate) {
      const y = parsedDate.y;
      const m = String(parsedDate.m).padStart(2, '0');
      const d = String(parsedDate.d).padStart(2, '0');
      return { iso: `${y}-${m}-${d}`, ambiguous: false };
    }
  }

  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return { iso: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, ambiguous: false };
  }

  const yearLastMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (yearLastMatch) {
    const [, a, b, y] = yearLastMatch;
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);

    if (numA > 12 && numB <= 12) {
      return { iso: `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`, ambiguous: false };
    }
    if (numB > 12 && numA <= 12) {
      return { iso: `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`, ambiguous: false };
    }
    if (numA <= 12 && numB <= 12) {
      return { iso: `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`, ambiguous: true };
    }
    return null;
  }

  return null;
}

function extractCleanDescription(rawDescription: string): { merchant: string; cleanDescription: string } {
  if (!rawDescription) return { merchant: 'Unknown', cleanDescription: 'Bank Transaction' };
  let text = String(rawDescription).replace(/\\/g, '').replace(/["']/g, '').trim();

  // 1. ISO 20022 XML Slash Tagged SEPA / Wero Strings
  if (text.includes('/') && (text.includes('/TRTP/') || text.includes('/NAME/') || text.includes('/CSID/') || text.includes('/REMI/'))) {
    const slashName = text.match(/\/NAME\/([^/]+)/i);
    if (slashName && slashName[1] && slashName[1].trim()) {
      const name = slashName[1].trim();
      return { merchant: name, cleanDescription: name };
    }

    const slashRemi = text.match(/\/REMI\/([^/]+)/i);
    if (slashRemi && slashRemi[1] && slashRemi[1].trim()) {
      const remi = slashRemi[1].trim();
      if (!/^(NOTPROVIDED|REF-|\d+$)/i.test(remi)) {
        return { merchant: remi, cleanDescription: remi };
      }
    }

    const slashTrtp = text.match(/\/TRTP\/([^/]+)/i);
    if (slashTrtp && slashTrtp[1] && slashTrtp[1].trim()) {
      const tag = slashTrtp[1].trim();
      if (!/^(SEPA|OVERBOEKING|INCASSO)/i.test(tag)) {
        return { merchant: tag, cleanDescription: tag };
      }
    }
  }

  // 2. PIN / Apple Pay transactions
  const posMatch = text.match(/(?:BEA|GEA),\s*(?:Apple Pay|Betaalpas|Google Pay|Pin)?\s+([^\d,]+)/i);
  if (posMatch && posMatch[1]) {
    const cleaned = posMatch[1].trim();
    if (cleaned && !/^(BEA|GEA)/i.test(cleaned)) {
      return { merchant: cleaned, cleanDescription: cleaned };
    }
  }

  // 3. Standard SEPA "Omschrijving:" field
  const omschrijving = text.match(/Omschrijving:\s*([^:\n\r\t]+?)(?=\s{2,}|IBAN:|BIC:|Kenmerk:|$)/i);
  if (omschrijving && omschrijving[1]) {
    const val = omschrijving[1].trim();
    if (val && !/^(NOTPROVIDED|REF-)/i.test(val)) {
      return { merchant: val, cleanDescription: val };
    }
  }

  // 4. Standard SEPA "Naam:" field
  const sepaNaam = text.match(/Naam:\s*([^:\n\r\t]+?)(?=\s{2,}|Machtiging:|Omschrijving:|IBAN:|BIC:|Kenmerk:|$)/i);
  if (sepaNaam && sepaNaam[1]) {
    const val = sepaNaam[1].trim();
    if (val) {
      return { merchant: val, cleanDescription: val };
    }
  }

  // 5. Fallback
  let cleanedText = text
    .replace(/\/[A-Z0-9]+\/[^/]+/gi, '')
    .replace(/\b(SEPA|Incasso|algemeen|doorlopend|Overboeking|BEA|GEA|Apple Pay|Betaalpas|iDEAL|Wero)\b/gi, '')
    .trim();

  const tokens = cleanedText.split(/\s+/).filter((t) => t.length > 1 && !/^NL\d+/i.test(t));
  const fallbackName = tokens.length > 0 ? tokens.slice(0, 3).join(' ') : 'Bank Transaction';

  return { merchant: fallbackName, cleanDescription: cleanedText || fallbackName };
}

function parseMatrixData(
  rows: any[][],
  customRules: CategoryRule[] = []
): Omit<Transaction, 'id'>[] {
  if (!rows || rows.length === 0) return [];

  let dateIdx = -1;
  let amountIdx = -1;
  let descIdx = -1;
  let startRowIndex = 0;

  const dateRegex = /transactiondate|trans_date|datum|date|tarih|valuta/i;
  const amountRegex = /amount|bedrag|tutar|miktar|debite|credite|bedrag_eur/i;
  const descRegex = /description|omschrijving|naam|details|açıklama|aciklama|memo|payee|merchant/i;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const rowCells = (rows[r] || []).map((c) => String(c ?? '').replace(/[\"\\]/g, '').toLowerCase().trim());

    for (let c = 0; c < rowCells.length; c++) {
      const val = rowCells[c];
      if (dateRegex.test(val) && dateIdx === -1) dateIdx = c;
      if (amountRegex.test(val) && amountIdx === -1) amountIdx = c;
      if (descRegex.test(val) && descIdx === -1) descIdx = c;
    }

    if (dateIdx !== -1 && amountIdx !== -1) {
      startRowIndex = r + 1;
      if (descIdx === -1) descIdx = rowCells.length > 2 ? 1 : 0;
      break;
    }
  }

  if (dateIdx === -1 || amountIdx === -1) {
    const maxCols = Math.max(...rows.slice(0, 10).map((r) => r?.length || 0));
    if (maxCols >= 8) {
      dateIdx = 2;
      amountIdx = 6;
      descIdx = 7;
    } else {
      dateIdx = 0;
      amountIdx = 1;
      descIdx = 2;
    }
    startRowIndex = 0;
  }

  const transactions: Omit<Transaction, 'id'>[] = [];

  for (let i = startRowIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawDate = row[dateIdx];
    const rawAmount = row[amountIdx];
    const rawDesc = row[descIdx];

    if (rawDate === undefined || rawAmount === undefined) continue;

    const cleanedHeaderCheck = String(rawDate).replace(/[\"\\]/g, '').trim();
    if (dateRegex.test(cleanedHeaderCheck) || amountRegex.test(cleanedHeaderCheck)) continue;

    const amountResult = parseLocaleAmount(rawAmount);
    if (!amountResult) continue;

    const isZero = amountResult.magnitude === 0;
    const signedAmount = amountResult.isNegative ? -amountResult.magnitude : amountResult.magnitude;

    const dateResult = resolveDate(rawDate);
    if (!dateResult) continue;

    const originalDesc = String(rawDesc ?? '').replace(/\\/g, '').replace(/\s+/g, ' ').trim();
    const { merchant } = extractCleanDescription(originalDesc);
    const monthName = dateResult.iso.substring(0, 7);
    const category = classifyTransaction(originalDesc, customRules);

    transactions.push({
      date: dateResult.iso,
      amount: Number(signedAmount.toFixed(2)),
      rawDescription: originalDesc,
      merchant,
      category,
      monthName,
      isZeroFlagged: isZero ? 1 : 0,
      dateAmbiguous: dateResult.ambiguous ? 1 : 0,
    });
  }

  return transactions;
}

export function parseExcelContent(
  fileData: ArrayBuffer | string,
  customRules: CategoryRule[] = []
): Omit<Transaction, 'id'>[] {
  if (!fileData) return [];

  let workbook: XLSX.WorkBook | null = null;

  try {
    if (fileData instanceof ArrayBuffer) {
      const dataArray = new Uint8Array(fileData);
      workbook = XLSX.read(dataArray, { type: 'array' });
    } else {
      let cleanData = String(fileData).trim();
      if (cleanData.includes(',')) {
        cleanData = cleanData.split(',')[1];
      }
      cleanData = cleanData.replace(/[\r\n\s]/g, '');
      workbook = XLSX.read(cleanData, { type: 'base64' });
    }
  } catch (e) {
    console.error('Failed to parse Excel workbook:', e);
    return [];
  }

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) return [];

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) return [];

  const rawMatrixRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: true });
  return parseMatrixData(rawMatrixRows, customRules);
}

export function parseCSVContent(
  csvText: string,
  customRules: CategoryRule[] = []
): Omit<Transaction, 'id'>[] {
  if (!csvText) return [];

  let cleaned = csvText
    .replace(/[\uFEFF\uFFFD\0]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const parsed = Papa.parse<string[]>(cleaned, {
    header: false,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });

  return parseMatrixData(parsed.data || [], customRules);
}

import * as FileSystem from 'expo-file-system';

export async function parseStatementFile(fileUri: string, customRules = []) {
  const extension = fileUri.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx' || extension === 'xls') {
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return parseExcelContent(base64Data, customRules);
  } else {
    const csvText = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return parseCSVContent(csvText, customRules);
  }
}