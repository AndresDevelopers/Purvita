/* eslint-disable */
const path = require('node:path');

const fixturesRoot = __dirname;
const fontsDirectory = path.join(fixturesRoot, 'fonts');

const interFontPath = path.join(fontsDirectory, 'mock-inter-variable.woff2').replace(/\\/g, '/');
const lexendFontPath = path.join(fontsDirectory, 'mock-lexend-variable.woff2').replace(/\\/g, '/');

const interCss = `/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(${interFontPath}) format('woff2');
  unicode-range: U+000-5FF;
}`;

const lexendCss = `/* latin */
@font-face {
  font-family: 'Lexend';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(${lexendFontPath}) format('woff2');
  unicode-range: U+000-5FF;
}`;

module.exports = {
  'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap': interCss,
  'https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap': lexendCss,
};
