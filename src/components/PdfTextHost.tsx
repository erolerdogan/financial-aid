import {
  attachPdfHost,
  handlePdfHostMessage,
  reportPdfHostFailure,
  subscribePdfHostDemand,
} from '@/services/pdfText';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const LOCAL_PAGE = 'about:blank';

// Hidden WebView that reads the text of PDF statements with pdf.js (`extractPdfText` in
// src/services/pdfText.ts). Mounted once at the root, and only while a PDF is being read.
// The page is a bundled file with pdf.js inlined (scripts/build-pdf-host.js): nothing is loaded
// from the network, its Content-Security-Policy forbids requests, and every navigation is refused.
export function PdfTextHost() {
  const [wanted, setWanted] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => subscribePdfHostDemand(setWanted), []);

  useEffect(() => {
    if (!wanted || html) return;
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/pdf/pdfhost.html'));
        await asset.downloadAsync();
        const page = await FileSystem.readAsStringAsync(asset.localUri ?? asset.uri);
        if (!cancelled) setHtml(page);
      } catch (error) {
        console.error('Failed to load the PDF reader page:', error);
        reportPdfHostFailure('the reader page could not be loaded');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wanted, html]);

  useEffect(() => {
    attachPdfHost({
      send: (message) => webViewRef.current?.postMessage(message),
      reload: () => setGeneration((value) => value + 1),
    });
    return () => attachPdfHost(null);
  }, []);

  if (!wanted || !html) return null;

  return (
    <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <WebView
        key={generation}
        ref={webViewRef}
        source={{ html, baseUrl: LOCAL_PAGE }}
        // Every origin goes through the check below. (A URL outside the whitelist would be handed
        // to the system browser by react-native-webview instead of just being refused.)
        originWhitelist={['*']}
        // Only the bundled page itself may load; links, redirects and new windows are refused.
        onShouldStartLoadWithRequest={(request) => request.url === LOCAL_PAGE}
        onMessage={(event) => handlePdfHostMessage(event.nativeEvent.data)}
        onError={() => reportPdfHostFailure('the reader page failed to load')}
        onContentProcessDidTerminate={() => {
          reportPdfHostFailure('the reader stopped');
          setGeneration((value) => value + 1);
        }}
        onRenderProcessGone={() => {
          reportPdfHostFailure('the reader stopped');
          setGeneration((value) => value + 1);
        }}
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        allowFileAccess={false}
        allowsLinkPreview={false}
        domStorageEnabled={false}
        cacheEnabled={false}
        incognito
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        geolocationEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden' },
});
