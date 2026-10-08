// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// assets/pdf/pdfhost.html: the bundled page of the PDF reader (src/components/PdfTextHost.tsx).
config.resolver.assetExts.push('html');

module.exports = config;
