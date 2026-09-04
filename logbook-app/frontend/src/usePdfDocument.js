import { useEffect, useState } from 'react';
import client, { baseURL } from './api/client';
import pdfjsLib from './pdfWorkerSetup';

/**
 * Fetches a template's PDF bytes through the authenticated API (so access
 * control on templates is enforced the same as everywhere else) and parses
 * it with pdfjs, returning a ready-to-render document plus its page count.
 */
export default function usePdfDocument(templateId) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!templateId) return;

    async function load() {
      try {
        const token = localStorage.getItem('logbook_token');
        // pdfjs can fetch directly given a URL + auth header via httpHeaders.
        const loadingTask = pdfjsLib.getDocument({
          url: `${baseURL}/templates/${templateId}/file`,
          httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const doc = await loadingTask.promise;
        if (!cancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [templateId]);

  return { pdfDoc, numPages, error };
}
