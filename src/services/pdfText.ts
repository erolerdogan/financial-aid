import { toPdfPage } from '@/utils/pdfStatements/pdfItems';
import { PdfExtractError, type PdfPage, type RawPdfPage } from '@/utils/pdfStatements/types';
import * as FileSystem from 'expo-file-system/legacy';

// Reads the text of a PDF on the device: pdf.js runs in the hidden WebView of `PdfTextHost`
// (src/components/PdfTextHost.tsx), which loads a bundled page and has no network access.
// This module is the queue and the message protocol; the page is built by scripts/build-pdf-host.js.

/** base64 characters per message; a multiple of 4 so every chunk decodes on its own. */
const CHUNK_CHARS = 256 * 1024;
const READY_TIMEOUT_MS = 20_000;
/** No message from the page for this long: it hangs. */
const IDLE_TIMEOUT_MS = 20_000;
const BASE_TIMEOUT_MS = 20_000;
const PER_PAGE_TIMEOUT_MS = 2_000;
/** The WebView stays mounted this long after the last PDF, so a batch reuses it. */
const RELEASE_AFTER_MS = 30_000;

export interface PdfHostBridge {
  send: (message: string) => void;
  /** Throws the WebView away and mounts a new one. */
  reload: () => void;
}

interface Job {
  id: number;
  pages: PdfPage[];
  expected: number;
  resolve: (pages: PdfPage[]) => void;
  reject: (error: Error) => void;
  idleTimer: ReturnType<typeof setTimeout> | null;
  totalTimer: ReturnType<typeof setTimeout> | null;
}

let bridge: PdfHostBridge | null = null;
let ready = false;
let readyWaiters: { resolve: () => void; reject: (error: Error) => void }[] = [];
let wanted = false;
const demandListeners = new Set<(wanted: boolean) => void>();
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let pending = 0;
let job: Job | null = null;
let nextId = 1;
let nextSeq = 1;

function setWanted(value: boolean): void {
  if (wanted === value) return;
  wanted = value;
  if (!value) ready = false;
  demandListeners.forEach((listener) => listener(value));
}

/** `PdfTextHost` mounts its WebView only while a PDF is being read (or was, a moment ago). */
export function subscribePdfHostDemand(listener: (wanted: boolean) => void): () => void {
  demandListeners.add(listener);
  listener(wanted);
  return () => {
    demandListeners.delete(listener);
  };
}

export function attachPdfHost(next: PdfHostBridge | null): void {
  bridge = next;
  if (!next) ready = false;
}

function failJob(error: Error): void {
  const current = job;
  if (!current) return;
  job = null;
  if (current.idleTimer) clearTimeout(current.idleTimer);
  if (current.totalTimer) clearTimeout(current.totalTimer);
  current.reject(error);
}

/** The page could not be loaded, or its process died: whatever is running fails and a new page is loaded. */
export function reportPdfHostFailure(detail: string): void {
  ready = false;
  const error = new PdfExtractError('TIMEOUT', detail);
  readyWaiters.forEach((waiter) => waiter.reject(error));
  readyWaiters = [];
  failJob(error);
}

function timeOut(detail: string): void {
  ready = false;
  bridge?.reload();
  failJob(new PdfExtractError('TIMEOUT', detail));
}

function armIdleTimer(current: Job): void {
  if (current.idleTimer) clearTimeout(current.idleTimer);
  current.idleTimer = setTimeout(() => timeOut('no answer from the reader'), IDLE_TIMEOUT_MS);
}

/** Called by `PdfTextHost` for every message of the page. */
export function handlePdfHostMessage(data: string): void {
  let message: any;
  try {
    message = JSON.parse(data);
  } catch {
    return;
  }

  if (message?.t === 'ready') {
    ready = true;
    readyWaiters.forEach((waiter) => waiter.resolve());
    readyWaiters = [];
    return;
  }

  const current = job;
  if (!current || message?.id !== current.id) return;
  armIdleTimer(current);

  if (message.t === 'meta') {
    current.expected = Number(message.pages) || 0;
    if (current.totalTimer) clearTimeout(current.totalTimer);
    current.totalTimer = setTimeout(
      () => timeOut('reading took too long'),
      BASE_TIMEOUT_MS + PER_PAGE_TIMEOUT_MS * current.expected
    );
  } else if (message.t === 'page') {
    current.pages[Number(message.index)] = toPdfPage(message.page as RawPdfPage);
  } else if (message.t === 'done') {
    job = null;
    if (current.idleTimer) clearTimeout(current.idleTimer);
    if (current.totalTimer) clearTimeout(current.totalTimer);
    current.resolve(current.pages);
  } else if (message.t === 'error') {
    failJob(new PdfExtractError(message.reason === 'PASSWORD' ? 'PASSWORD' : 'DAMAGED', String(message.message ?? '')));
  }
}

function waitUntilReady(): Promise<void> {
  if (ready && bridge) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const waiter = {
      resolve: () => {
        clearTimeout(timer);
        resolve();
      },
      reject: (error: Error) => {
        clearTimeout(timer);
        reject(error);
      },
    };
    const timer = setTimeout(() => {
      readyWaiters = readyWaiters.filter((entry) => entry !== waiter);
      reject(new PdfExtractError('TIMEOUT', 'the reader did not start'));
    }, READY_TIMEOUT_MS);
    readyWaiters.push(waiter);
  });
}

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const isUri = (source: string): boolean => /^(file|content):/.test(source) || source.startsWith('/');

async function extractOne(source: string): Promise<PdfPage[]> {
  const base64 = isUri(source)
    ? await FileSystem.readAsStringAsync(source, { encoding: FileSystem.EncodingType.Base64 })
    : source.replace(/\s+/g, '');

  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
  setWanted(true);
  await waitUntilReady();

  const id = nextId++;
  const result = new Promise<PdfPage[]>((resolve, reject) => {
    job = { id, pages: [], expected: 0, resolve, reject, idleTimer: null, totalTimer: null };
    armIdleTimer(job);
  });
  // A rejection while the chunks are still being sent is picked up by the await below.
  result.catch(() => {});

  // `seq` only has to rise: a reloaded page starts again at 0.
  bridge?.send(JSON.stringify({ t: 'begin', id, seq: nextSeq++ }));
  for (let offset = 0; offset < base64.length && job?.id === id; offset += CHUNK_CHARS) {
    bridge?.send(
      JSON.stringify({ t: 'chunk', id, seq: nextSeq++, data: base64.slice(offset, offset + CHUNK_CHARS) })
    );
    // Let the WebView take the message before the next one is built.
    await nextTick();
  }
  if (job?.id === id) bridge?.send(JSON.stringify({ t: 'end', id, seq: nextSeq++ }));

  return result;
}

/**
 * The text of every page of a PDF, as positioned items. `source` is a file URI or the file as base64.
 * One PDF is read at a time; further calls wait their turn. Throws `PdfExtractError`.
 */
export function extractPdfText(source: string): Promise<PdfPage[]> {
  pending++;
  const run = queue.then(() => extractOne(source));
  queue = run
    .catch(() => {})
    .then(() => {
      pending--;
      if (pending === 0) {
        releaseTimer = setTimeout(() => setWanted(false), RELEASE_AFTER_MS);
      }
    });
  return run;
}
