import * as pdfjsLib from 'pdfjs-dist';

// Vite-friendly way to point pdfjs at its worker bundle from node_modules
// (no CDN dependency, works fully offline once `npm install` has run).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export default pdfjsLib;
