# Digital Logbook / Practical Record — Prototype

A working prototype that lets a college upload a blank Logbook/Practical
Record PDF, define fillable fields on top of it, and lets students fill it
in a browser (text, checkboxes, radios, dropdowns, freehand drawing), save
it under their account, reopen/edit it later, and export a flattened final
PDF.

```
logbook-app/
  backend/     Node.js + Express API (upload, save, retrieve, export)
  frontend/    React (Vite) UI
```

---

## 1. Recommended approach and why

**Frontend: React (required) + `pdfjs-dist` rendered to `<canvas>`, with an
absolutely-positioned HTML overlay for form fields and a transparent
`<canvas>` for freehand drawing.**

- `pdfjs-dist` (the engine behind Firefox's PDF viewer) gives full control
  over rendering each page to a canvas at any scale, which is what's needed
  to line up interactive fields precisely on top of the page.
- Alternative considered: `react-pdf` (a wrapper around pdfjs). It's
  convenient but adds an extra abstraction layer and version-pinning
  headaches on top of pdfjs itself; for a prototype where we need to also
  read the exact page pixel size to align an overlay, using pdfjs directly
  gave more predictable control.
- Alternative considered: rendering the *whole* PDF as one long image or
  using an `<iframe>`/native browser PDF viewer. Ruled out because neither
  gives reliable per-page pixel coordinates to place interactive fields on
  top of.
- Form fields and drawing strokes are stored as **percentages of the page
  width/height**, not pixels. That makes them resolution-independent: they
  line up correctly whether the browser renders the page at 900px or
  1900px wide, and they map directly onto `pdf-lib`'s page fractions when
  exporting server-side.

**Backend: Node.js + Express** (the task says .NET is preferred but Node is
explicitly acceptable). Node was chosen for this prototype purely for
speed of iteration and because `pdf-lib` (pure JS, no native dependencies)
made PDF flattening straightforward without extra tooling.

- **If this were being taken to production and .NET is the house
  standard**, the port is mechanical and low-risk: the API surface
  (`/api/templates`, `/api/records`) is a thin REST layer over a handful of
  simple functions (JSON read/write, JWT verify, PDF flatten via a
  `PDFSharp`/`iText`/`QuestPDF`-equivalent library). None of the frontend
  would need to change, since it only talks to the REST contract described
  below.
- **Storage: local filesystem** for the prototype (`backend/data/templates`,
  `backend/data/records/<userId>/<recordId>.json`), for zero external
  setup. It's deliberately isolated behind `backend/utils/storage.js` and a
  couple of path-building helpers in `routes/records.js` — swapping in
  S3/Azure Blob (for the PDF bytes) and a real database (Postgres/Mongo,
  for record JSON) means rewriting that one file's functions, not touching
  route logic.
- **Auth: a JWT stub**, per the task's explicit allowance. `POST
  /api/auth/login` issues a signed JWT for one of three hardcoded demo
  accounts (`admin` = the college, `student1`/`student2` = students). Every
  other endpoint requires a valid `Bearer` token; `req.userId` from the
  verified token is the only thing ever used to decide what data a request
  can see or write.

**Libraries used**

| Purpose | Library |
|---|---|
| PDF rendering (browser) | `pdfjs-dist` |
| PDF flattening/export (server) | `pdf-lib` |
| File upload | `multer` |
| Auth tokens | `jsonwebtoken` |
| Routing | `express`, `react-router-dom` |
| HTTP client | `axios` |

**Key limitation of this prototype:** field placement is done manually by
an admin clicking on the rendered PDF ("Template designer" screen) rather
than by auto-detecting a real PDF `AcroForm`. This was a deliberate scope
cut — see "What I'd build next" below — because many real-world
logbook/practical-record PDFs from colleges are scanned or flattened
images with no embedded form fields at all, so a manual field-designer is
actually the more general solution, and it doubles as the path to also
supporting true AcroForm PDFs later (auto-place fields from detected
form-field rects, then let the admin nudge them).

---

## 2. How specific requirements are handled

### Persisting edits per user (with versioning)

Each record is stored as **one JSON file per record**, under a folder
scoped to the owning user:
`backend/data/records/<userId>/<recordId>.json`.

```json
{
  "id": "…",
  "userId": "…",
  "templateId": "…",
  "currentVersion": 3,
  "versions": [
    { "version": 1, "savedAt": "…", "values": {...}, "drawings": {...} },
    { "version": 2, "savedAt": "…", "values": {...}, "drawings": {...} },
    { "version": 3, "savedAt": "…", "values": {...}, "drawings": {...} }
  ]
}
```

`PUT /api/records/:id` **appends** a new version rather than overwriting —
so the full edit history is preserved (capped at the last 25 versions to
bound file size). A dropdown in the UI lets a student reload any past
version's content back into the editor. This was chosen over a single
"last write wins" record because logbooks are often used as evidence for
assessment, where showing/auditing prior states has real value, and
append-only JSON is trivial to reason about and cheap to implement without
a database.

### Exporting a final PDF (flattened)

`POST /api/records/:id/export` loads the original template bytes, walks
the saved field schema, and for each field:

- **text / dropdown** → draws the stored string as real text at the
  field's position,
- **checkbox** → draws an "X" mark if checked,
- **radio** → draws a filled dot if that field is the selected one in its
  group,
- **freehand drawing strokes** → replayed as connected line segments in
  their stored color/width.

All of this is drawn directly onto the PDF's page content via `pdf-lib`
(`page.drawText` / `drawLine` / `drawEllipse`) and re-saved — so the
output is a normal, flattened PDF with no separate form layer, safe to
send anywhere. The generated file is also cached under
`data/records/<userId>/<recordId>/export-v<N>.pdf` so re-downloading an
already-exported version doesn't require regenerating it.

### Reopening a saved draft (not just final export)

`GET /api/records/:id` returns the full record (all versions). The Fill
page loads the **latest version's** `values`/`drawings` back into the live
form state, so a student can pick up exactly where they left off — this is
distinct from, and in addition to, the "export flattened PDF" action.

### Security basics

- **File validation on upload**: `multer`'s `fileFilter` checks both MIME
  type and extension are `application/pdf` / `.pdf`, `limits.fileSize`
  caps uploads at 20MB, and — beyond trusting those client-supplied
  headers — the server actually attempts to *parse* the uploaded bytes
  with `pdf-lib` before accepting it, rejecting anything that isn't really
  a valid PDF.
- **No client-controlled filenames or paths**: uploaded files are stored
  server-side under a freshly generated UUID, never the client's original
  filename, which rules out path traversal or overwrite attacks via a
  crafted filename.
- **Route param IDs are validated against a strict UUID regex** before
  ever being used to build a filesystem path (`utils/storage.js:
  isValidId`), so something like `GET /api/records/../../secrets` is
  rejected with 400 before it can touch the filesystem.
- **Access control / ownership**: every record lives on disk under
  `data/records/<userId>/…`, where `<userId>` always comes from the
  *verified JWT*, never from the URL or request body. A request for
  someone else's record simply can't resolve to a file that exists under
  the requesting user's folder — it 404s, and deliberately doesn't
  distinguish "doesn't exist" from "exists but isn't yours."
  Template upload / field-schema editing is further gated behind an
  `admin`-role check (`requireAdmin` middleware) — students can fill and
  export, but not redefine a college's template.
- **Auth**: JWT verified on every protected route (`requireAuth`
  middleware); no endpoint trusts a userId supplied in the request body.

Not yet done, called out explicitly as next steps: rate limiting on
login/upload, virus/malware scanning of uploaded PDFs, CSRF protections
(not usually needed for a token-in-header SPA, but worth confirming for
the eventual production deployment/domain setup), and HTTPS/secure cookie
concerns for token storage (this prototype uses `localStorage` for
simplicity — a production build should weigh that against httpOnly
cookies).

---

## 3. Setup instructions — running it locally

Requires Node.js 18+.

### Backend

```bash
cd backend
npm install
cp .env.example .env      # optional — sensible defaults exist without this
npm run dev                # or: npm start
```

Runs on `http://localhost:4000`. Data is persisted under `backend/data/`
(created automatically on first run).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # optional — defaults to http://localhost:4000/api
npm run dev
```

Runs on `http://localhost:5173`.

### Walkthrough

1. Open `http://localhost:5173`, sign in as **admin** (represents "the
   college").
2. On the Templates page, upload a PDF (any PDF works for the demo — a
   real logbook/practical-record PDF is ideal).
3. Click **Design fields** on the uploaded template. Pick a field type
   from the toolbar, then click on the PDF to drop that field; repeat for
   all fields you want, then **Save field layout**.
4. Sign out, sign back in as **student1**.
5. From Templates, click **Fill a new record** on that template. Fill in
   the fields, try freehand-drawing mode, click **Save draft**.
6. Go to **My records** — the draft is there. Reopen it, keep editing, or
   click **Export flattened PDF** to download the final filled PDF.
7. Sign in as **student2** to confirm that student's records are
   completely separate (per-user isolation).

---

## 4. What I'd build next (not yet done / would extend)

- **Real AcroForm detection**: read a template's existing PDF form fields
  (if any) via `pdf-lib`'s `getForm()` and auto-generate the field schema
  from them, falling back to today's manual click-to-place designer only
  when a PDF has no embedded fields.
- **Move record metadata into a real database** (Postgres) once record
  volume/query needs grow beyond "one JSON file per record" — the
  `utils/storage.js` abstraction is meant to make that swap contained.
  Move PDF bytes to S3/Azure Blob similarly, storing only a key/URL in the
  DB row.
- **Field validation & required fields**: mark fields required, validate
  before allowing export, surface completion percentage to the student.
- **College-side review/sign-off workflow**: right now only the student
  who owns a record can see it; a real logbook usually also needs an
  assessor/tutor to review and countersign. That's a new role and a
  read-only "review" view over another user's record, plus a signature
  field type.
- **Diffing between versions** in the UI (currently you can reload an old
  version wholesale, but can't see *what* changed between two versions).
- **Better touch/tablet support for drawing** (pressure sensitivity,
  palm rejection) — current drawing layer is pointer-events based and
  works but is basic, as scoped ("freehand drawing / annotations (basic)").
- **Automated tests**: unit tests for `pdfExport.js` coordinate math and
  an integration test hitting the record CRUD + export endpoints with a
  sample PDF.
- **Rate limiting, upload malware scanning, and audit logging** (who
  exported what, when) before this would be production-ready.
