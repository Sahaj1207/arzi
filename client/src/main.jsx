import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Mukta (Ek Type): one family drawn for Devanagari and Latin together.
// Only two weights: CSS 500 uses 400 and 600/800 use 700, so fewer files load.
// Each file is split by script (unicode-range): Devanagari files load only when
// Devanagari text is on screen.
import '@fontsource/mukta/400.css';
import '@fontsource/mukta/700.css';
// Telugu script (Mukta has no Telugu glyphs; the browser falls back per character).
import '@fontsource/noto-sans-telugu/400.css';
import '@fontsource/noto-sans-telugu/700.css';
// One serif accent word in the home headline (Latin + Devanagari).
import '@fontsource/noto-serif-devanagari/500.css';
import './styles.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
