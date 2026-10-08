#!/usr/bin/env node

/**
 * Builds assets/pdf/pdfhost.html: the page the hidden WebView (src/components/PdfTextHost.tsx)
 * loads to read the text of a PDF statement. pdf.js and its worker are inlined from pdfjs-dist,
 * so the page needs no network; its Content-Security-Policy forbids every request.
 * Run after changing the pdfjs-dist version or the page script below: `npm run pdfhost`.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pdfjsDir = path.join(root, 'node_modules', 'pdfjs-dist');
const outFile = path.join(root, 'assets', 'pdf', 'pdfhost.html');

const { version } = JSON.parse(fs.readFileSync(path.join(pdfjsDir, 'package.json'), 'utf8'));

// An inline script ends at the first "</script" and treats "<!--" specially.
const inline = (file) =>
  fs
    .readFileSync(path.join(pdfjsDir, 'legacy', 'build', file), 'utf8')
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '<\\!--');

// Protocol (JSON strings):
//   in:  { t: 'begin', id, seq } · { t: 'chunk', id, seq, data: base64 } · { t: 'end', id, seq }
//        `seq` rises with every message; one that was already seen is dropped.
//   out: { t: 'ready' } · { t: 'meta', id, pages } · { t: 'page', id, index, page: RawPdfPage }
//        · { t: 'done', id } · { t: 'error', id, reason: 'DAMAGED' | 'PASSWORD', message }
const hostScript = `
(function () {
  var send = function (message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  };
  var job = null;
  var lastSeq = 0;

  function decode(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function join(parts) {
    var length = 0;
    for (var i = 0; i < parts.length; i++) length += parts[i].length;
    var data = new Uint8Array(length);
    var offset = 0;
    for (var j = 0; j < parts.length; j++) {
      data.set(parts[j], offset);
      offset += parts[j].length;
    }
    return data;
  }

  async function read(id, data) {
    var task = pdfjsLib.getDocument({
      data: data,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      useWorkerFetch: false,
      disableAutoFetch: true,
      disableStream: true,
      disableRange: true,
    });
    var doc = null;
    try {
      doc = await task.promise;
      send({ t: 'meta', id: id, pages: doc.numPages });
      for (var n = 1; n <= doc.numPages; n++) {
        var page = await doc.getPage(n);
        var viewport = page.getViewport({ scale: 1 });
        var content = await page.getTextContent();
        var items = [];
        for (var i = 0; i < content.items.length; i++) {
          var item = content.items[i];
          if (typeof item.str !== 'string') continue;
          items.push({
            str: item.str,
            transform: item.transform,
            width: item.width,
            height: item.height,
            fontName: item.fontName,
          });
        }
        send({
          t: 'page',
          id: id,
          index: n - 1,
          page: { width: viewport.width, height: viewport.height, transform: viewport.transform, items: items },
        });
        page.cleanup();
      }
      send({ t: 'done', id: id });
    } catch (error) {
      send({
        t: 'error',
        id: id,
        reason: error && error.name === 'PasswordException' ? 'PASSWORD' : 'DAMAGED',
        message: String((error && error.message) || error),
      });
    } finally {
      if (doc) doc.destroy();
      else task.destroy();
    }
  }

  function onMessage(event) {
    var message;
    try {
      message = JSON.parse(event.data);
    } catch (e) {
      return;
    }
    if (!message || typeof message.id !== 'number' || typeof message.seq !== 'number') return;
    // Old Android WebViews deliver a message to document and, bubbling, to window as well.
    if (message.seq <= lastSeq) return;
    lastSeq = message.seq;
    if (message.t === 'begin') {
      job = { id: message.id, parts: [] };
    } else if (job && job.id === message.id && message.t === 'chunk') {
      job.parts.push(decode(message.data));
    } else if (job && job.id === message.id && message.t === 'end') {
      var data = join(job.parts);
      job = null;
      read(message.id, data);
    }
  }

  // React Native WebView delivers messages on document (Android) or window (iOS).
  document.addEventListener('message', onMessage);
  window.addEventListener('message', onMessage);
  send({ t: 'ready' });
})();
`;

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'">
<meta name="generator" content="scripts/build-pdf-host.js, pdfjs-dist ${version}">
</head>
<body>
<script>${inline('pdf.min.js')}</script>
<script>${inline('pdf.worker.min.js')}</script>
<script>${hostScript}</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
console.log(`Wrote ${path.relative(root, outFile)} (pdfjs-dist ${version}, ${(html.length / 1024).toFixed(0)} KB)`);
