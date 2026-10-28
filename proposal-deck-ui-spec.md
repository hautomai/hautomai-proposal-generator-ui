# Proposal Deck UI — Specification

**Short name:** `proposal-deck-ui`
**Status:** Draft (no code changes yet)
**Date:** 2026-08-29
**Design inspiration:** [zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides) (MIT)

---

## 1. One-line summary

A single, self-contained `frontend/index.html` — opened by double-click from disk — that serves as both the **control panel** for the Proposal Generator (transcript in → proposal out via the Modal endpoint) and a **live 16:9 HTML slide-deck renderer** that turns each generated proposal into a beautiful, animated, client-ready deck in the frontend-slides style.

---

## 2. Background & current state

### 2.1 The existing app

| Piece | Location | Notes |
|---|---|---|
| Backend (production) | `modal_app.py` | Modal app `proposal-generator`; FastAPI endpoint `generate_proposal` at `https://securha-n8n--proposal-generator-generate-proposal.modal.run`; Bearer-token auth; calls OpenRouter, then Google Docs API |
| n8n integration | external | Calls the same Modal endpoint; consumes `{"success": bool, "documentUrl": str}` |
| CLI caller | `generate.sh` | `./generate.sh <transcript> <company> <price>`; **bearer token hardcoded** (`aca528…`) |
| Docs template | `template_content.txt` + remote Google Doc `1dt5L_r76…` | Placeholders: `{{proposalTitle}}`, `{{companyName}}`, `{{consultantName}}`, `{{consultantEmail}}`, `{{date}}`, `{{problemSection}}`, `{{solutionSection}}`, `{{scopeSection}}`, `{{timelineSection}}`, `{{price}}`, `{{depositAmount}}` |
| Local backend | `backend/auth_setup.py` only | `backend/main.py` referenced by README does **not** exist |
| Frontend | **missing** | README step 8 says "Open `frontend/index.html`" — the file was never created |
| Sample transcripts | `transcript-dan.txt`, `transcript-rr.txt` | Real meeting transcripts used for testing |
| Sample outputs | `templates/Proposal.pdf`, `templates/SymplifyAI-LeadGen-Proposal.pdf` | Reference proposal PDFs |

### 2.2 The AI JSON (currently discarded by the endpoint)

`_analyze_transcript()` returns a rich structured object that the endpoint throws away after building the Google Doc:

- `proposalTitle`, `serviceType`
- `problemIntro`, `problemPoint1..5` + `problemDesc1..5`
- `solutionIntro`, `solutionPoint1..5` + `solutionDesc1..5`
- `scopeItems` (5–6 strings)
- `timelineItems` (3–4 strings, `"Phase: X business days"`)

**This JSON is the raw material for the slide deck.** The endpoint must be extended to return it (§5).

### 2.3 The frontend-slides system (what we borrow)

From `SKILL.md` and the repo README:

- **Zero dependencies** — single HTML file, inline CSS/JS, no build tools, no frameworks.
- **Fixed 1920×1080 stage (non-negotiable)** — slides authored at fixed size, scaled uniformly to viewport; letterbox yes, reflow no; no responsive breakpoints inside slides; `visibility/opacity/pointer-events` switching (never `display:none` toggling for slides); `prefers-reduced-motion` support.
- **Show-don't-tell style discovery** — 3 single-slide previews (1 safe preset + 1 bold template + 1 wildcard); full design system loaded only after the pick.
- **Density modes** — low density/speaker-led vs. high density/reading-first; max 4–6 bullets per slide; split instead of shrink.
- **Anti-AI-slop** — distinctive fonts, committed palettes, no purple-gradient-on-white, no Inter/Roboto defaults.
- **Rich CSS-only animations** — staggered reveals on slide activation, slide transitions.
- **Exports** — self-contained HTML; PDF via Playwright screenshots (1920×1080 per slide).
- **Verification bar** — screenshots at 1280×720 and one phone viewport after changes.

---

## 3. Goal

Make the proposal generator **demo-ready and client-presentable**: one double-clickable HTML file where the operator runs a real transcript through the generator and immediately walks the client (or a demo audience) through the resulting proposal as a polished slide deck — while the Google Doc remains the formal deliverable.

## 3.1 Non-goals

- No persistence layer, no database, no server of our own (beyond the existing Modal endpoint).
- No multi-proposal history (last generation only, in memory).
- No i18n — English only.
- No PPT/PPTX conversion (skill Mode B is out of scope).
- No changes to the n8n workflow or the Google Docs template.
- No new backend service — the only backend change is extending the existing Modal endpoint (§5).
- No user accounts, no multi-tenant anything.

---

## 4. Deliverable & file layout

```
frontend/
  index.html            # BUILT ARTIFACT — single self-contained file, opened from disk (committed)
  src/
    app.js              # State machine, view switching, event wiring, API client
    helpers.js          # Pure functions: input hashing, AI-JSON validation/normalization,
                        #   AI-JSON → slide-model mapping, deck HTML export serializer, deposit math
    styles.js           # Style registry: curated safe presets + bold templates as inline CSS strings
    sample-data.js      # Embedded sample AI JSON (failure fallback) + sample inputs
    shell.html          # HTML skeleton with {{INJECT_*}} markers
  build.py              # Stdlib-only inliner: src/* + token -> index.html
tests/
  helpers.test.js       # node:test unit tests for pure helpers
  deck-render.test.js   # slide-model mapping tests
  export.test.js        # export serializer tests (self-containment assertions)
  backend_response.test.py  # contract test for extended Modal response (mocked httpx)
  screenshots.mjs       # Playwright checks: 1280×720 + 390×844 screenshots, nav, export, print pages
```

**Build step rationale (decision):** the app must be a *single self-contained HTML file* (user requirement: "open file from disk"), but tests need importable modules. A tiny stdlib-only `build.py` inlines `src/*.js` and the token into `index.html`; the built artifact is committed. Tests import `src/*.js` directly with Node's built-in `node:test` runner — no npm dependencies. Alternative rejected: `<script src>` keeps the app multi-file and breaks "single self-contained file"; extracting scripts from index.html for tests is brittle.

**Token injection (decision):** `build.py` reads the bearer token from env `PROPOSAL_API_TOKEN` (fallback: `.env` key of the same name) and inlines it. Committed `index.html` contains a placeholder + a visible "token not configured" banner if empty. The user runs `python frontend/build.py` once after cloning. This avoids committing the secret while keeping the baked-in-token UX the user chose. (Fallback if the user prefers zero build ceremony: hardcode like `generate.sh` does — noted as acceptable given existing repo practice.)

---

## 5. Backend change: extend the Modal endpoint (small, backward-compatible)

### 5.1 Response extension

`generate_proposal` currently returns `{"success": true, "documentUrl": ...}`. It must also return the structured AI JSON:

```json
{
  "success": true,
  "documentUrl": "https://docs.google.com/document/d/…/edit",
  "proposal": { "proposalTitle": "…", "serviceType": "…", "problemIntro": "…", "problemPoint1": "…", "problemDesc1": "…", … , "scopeItems": […], "timelineItems": […] }
}
```

- **Backward compatible:** n8n and `generate.sh` ignore the extra field. Error shape `{"success": false, "error": …, "traceback": …}` (HTTP 200) is unchanged — the UI must treat HTTP 200 + `success:false` as a failure.
- `proposal` is the untouched `_analyze_transcript()` output.

### 5.2 Optional `consultant_email` in request

The deck's terms/signature slide needs the consultant email, which today only exists as a Modal env var invisible to the browser. Add an optional request field `consultant_email`; the endpoint uses `data.get("consultant_email") or os.environ.get("CONSULTANT_EMAIL", "")`. Absent → env fallback → empty string. No breaking change.

### 5.3 CORS (critical, easy to miss)

The page is opened from `file://` (Origin: `null`) and must POST to the Modal endpoint. `@modal.fastapi_endpoint` does not guarantee CORS headers, and a preflight `OPTIONS` from a `null` origin will fail silently in the browser.

- **Preferred:** wrap a full FastAPI app (with `CORSMiddleware`, `allow_origins=["null", "http://localhost:*"]`, `allow_methods=["POST","OPTIONS"]`, `allow_headers=["Authorization","Content-Type"]`) in `@modal.fastapi_endpoint` so the public URL path and auth stay **identical** (n8n + `generate.sh` keep working).
- **Fallback:** handle `OPTIONS` preflight manually inside the endpoint.
- **Verification step:** `curl -s -X OPTIONS -H "Origin: null" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type" -i "$URL"` must return the CORS headers before any UI work is considered done.

---

## 6. UI architecture

### 6.1 Two views, one file, in-page toggle

- **Panel view** — the operator's control panel (form + status + artifacts).
- **Deck view** — the rendered 16:9 deck filling the viewport (letterboxed per fixed-stage rules).
- Toggle in-page: a header button, `Escape` from the deck, and a "Back to editor" button inside the deck. No hash routing, no new tabs.

### 6.2 Flow state machine

```
IDLE ──Generate──► ANALYZING ──ok──► STYLE_DISCOVERY ──pick──► REVIEW ──Render deck──► DECK
  ▲                    │fail                                        │                      │
  └────────────────────┴── sample fallback (badged) ───────────────┘                      │
  ▲                                                                                       │
  └────────────────────────── Escape / Back to editor ────────────────────────────────────┘
                                        ▲                                                 │
                                        └────── Edit content (explicit Apply re-renders) ──┘
```

1. **IDLE / Panel** — form: transcript (paste box **and** `.txt` file upload), company name (required), consultant name (default `Consultant`), consultant email (optional), price (optional, free text like `"$4,500"`).
2. **ANALYZING** — Generate button disabled, spinner, status text ("Analyzing transcript…"). Fetch with `AbortController`, ~150 s timeout (backend AI call is 120 s).
3. **STYLE_DISCOVERY** — 3 single-slide title-slide previews rendered from the *actual* proposal content (real title/company on the preview). Pick one to continue. (§8)
4. **REVIEW** — editable form of **every** AI field (§9). "Render deck" proceeds.
5. **DECK** — full presenter controls, exports (§10–§12). "Edit content" returns to REVIEW; changes apply only via explicit **"Apply edits & re-render"**, which warns that deck state resets (returns to slide 1).

### 6.3 State & memory rules (user decisions)

| Concern | Decision |
|---|---|
| History | **Last generation only, in memory.** Refresh clears everything. No localStorage for content. |
| Style memory | **Fresh each time.** Every new Generate starts style discovery anew; no persisted style pick. (The chosen style persists only within the current generation's lifetime, including Apply-edits re-renders.) |
| Regeneration | **Reuse if unchanged.** Cache the last successful AI JSON in memory, keyed by an FNV-1a hash of `transcript + company_name + consultant_name + price + consultant_email`. If the hash matches on Generate, skip the API call, reuse the JSON, and show a subtle "reused last analysis" note. Refresh clears the cache. |
| Transcript size | **Soft warning** above 200,000 chars: visible banner "Large transcript — AI call may be slow or costly", but still allowed. Live char counter near the input. |
| Required inputs | `transcript` and `company_name` (matches backend 400). Price optional (backend tolerates empty; deposit only computed if parseable). |

---

## 7. Data contracts

### 7.1 Request (UI → Modal)

```json
{
  "transcript": "…",
  "company_name": "Acme Ltd",
  "consultant_name": "Jane Doe",
  "consultant_email": "jane@example.com",
  "price": "$4,500"
}
```

### 7.2 Response (Modal → UI)

Success: `{ "success": true, "documentUrl": "…", "proposal": { …AI JSON… } }`
Failure: `{ "success": false, "error": "…", "traceback": "…" }` (HTTP 200)

### 7.3 Embedded sample fallback (failure-only)

`sample-data.js` embeds one realistic AI JSON (modeled on the existing SymplifyAI lead-gen proposal in `templates/`) plus matching sample inputs. It is used **only** when the OpenRouter/Modal call fails — auto-applied per user decision, with:

- a clearly visible **"SAMPLE DATA"** badge on the deck (and in the panel),
- the original error message shown in the panel,
- a **Retry** button.

This reconciles the user's "real data only" demo stance (no demo-data button) with "sample fallback" (escape hatch on failure). The fallback still flows through style discovery → review → deck like a real generation.

---

## 8. Style discovery (3 previews, fresh each time)

**User decision:** draw from **safe presets + bold templates** (no custom wildcard). The skill's mix rule (1 safe + 1 bold + 1 wildcard) is satisfied with the wildcard slot filled by a **second bold template**.

### 8.1 Curated inline style registry (`styles.js`)

The full 34-template bold pack is too large to inline; curate a proposal-appropriate subset as inline CSS-string design systems (each ≈100–200 lines: CSS variables, type stack, slide-layout components, transition/accent styles). Google Fonts loaded via `<link>` (graceful fallback to system serif/sans if offline — deck must still be legible offline).

- **Safe presets (4):** Bold Signal, Electric Studio, Swiss Modern, Notebook Tabs
- **Bold templates (5):** Blue Professional, Vellum, Emerald Editorial, Editorial Forest, Signal
- Attribution comment: adapted from frontend-slides (MIT).

### 8.2 Preview behavior

- On entering STYLE_DISCOVERY, randomly sample **1 safe + 2 bold** from the registry (fresh sample each generation).
- Each preview is a single title slide at reduced scale (small fallback stage per skill rules) showing the **real** proposal title, company, consultant, date.
- Previews are keyboard-selectable and show the style name + one-line description.
- Picking a style loads its full CSS into the app for REVIEW + DECK + exports.

---

## 9. Review & edit step (full edit, explicit apply)

### 9.1 Editable fields — everything the AI produced

| Group | Fields |
|---|---|
| Title | `proposalTitle`, `serviceType` |
| Problem | `problemIntro`, `problemPoint1..5`, `problemDesc1..5` |
| Solution | `solutionIntro`, `solutionPoint1..5`, `solutionDesc1..5` |
| Scope | `scopeItems` — editable list, add/remove rows (5–6 typical) |
| Timeline | `timelineItems` — editable list, add/remove rows (3–4 typical) |
| Money | `price` (free text), auto-computed `depositAmount` (50%, recomputed live, editable override) |
| Terms | Terms & signature paragraph (pre-filled from `template_content.txt` terms block, editable textarea) |

Panel-only fields (consultant name/email, company, date) come from the form; date auto-generated, not editable.

### 9.2 Missing/malformed AI fields (user decision: render + placeholders)

- Normalization pass fills missing fields with visible placeholders — italic text `“[missing]”` inside a dashed-outline chip — so the deck shape is always intact and gaps are obvious.
- `problemPointN` present but `problemDescN` missing → desc renders as `[missing]`; vice versa the point title renders as `[missing]` and the desc still shows.
- Wrong types (e.g. `scopeItems` is a string) → coerced best-effort (split on newlines); unfixable → `[missing]`.
- The review step lists a count of placeholder-filled fields ("3 fields need attention") but does **not** block rendering.

### 9.3 Edit loop (user decision: explicit apply)

- After the deck renders, **"Edit content"** returns to REVIEW with all fields intact.
- Changes take effect only via **"Apply edits & re-render"**, which confirms: "Re-rendering resets the deck to slide 1."
- Cancel returns to the deck unchanged. No silent re-renders.

---

## 10. Deck content mapping (AI JSON → slides)

**User decisions:** the deck **is** the generated proposal; **full mirror including Terms**; **content only** (no artifacts/proof slide — doc link, deposit math provenance, timestamps stay in the panel); **text-only branding**; **English only**.

**Recommended structure (user deferred to spec): 9 slides** — respects the skill's 4–6-bullet density limit (5 titled+described points cannot fit one slide):

| # | Slide | Content |
|---|---|---|
| 1 | **Title** | `proposalTitle`, company name, consultant name, date; text-only branding |
| 2 | **Problem (1/2)** | `problemIntro` + points 1–3 (numbered title + description cards) |
| 3 | **Problem (2/2)** | points 4–5 (continuation, same layout) |
| 4 | **Solution (1/2)** | `solutionIntro` + points 1–3 |
| 5 | **Solution (2/2)** | points 4–5 |
| 6 | **Scope of Work** | 5–6 deliverable items (list/grid) |
| 7 | **Timeline** | 3–4 phase items, business-day estimates parsed into a phase label + duration chip when the `"Phase: X business days"` pattern matches; raw string fallback otherwise |
| 8 | **Investment** | `price` + `depositAmount` (deposit labeled "due at signing") |
| 9 | **Terms & Signature** | editable terms text; signature block: consultant name, email, company name, date |

**Rejected alternative (noted for the record):** compact 7-slide variant with all 5 problem points on one slide — violates the density rule for titled+described pairs; only acceptable if the user later asks for fewer slides.

- `serviceType` appears as an eyebrow/kicker label on the title slide.
- Slide count is dynamic in principle (list lengths vary 3–6 / 3–4); the mapping function (`helpers.js`) produces a slide **model** array, and the renderer is slide-count agnostic. The 9-slide shape is the expected case for well-formed AI output.

---

## 11. Deck rendering & controls

### 11.1 Fixed stage (non-negotiable, from the skill)

- 1920×1080 stage, scaled uniformly to viewport; letterbox allowed; no reflow; no responsive breakpoints inside slides; fixed internal measurements.
- Slide switching via `.active`/`.visible` with `visibility`/`opacity`/`pointer-events` (never `display` toggling).
- `prefers-reduced-motion` honored everywhere.

### 11.2 Presenter controls (user decision: full controls)

- Keyboard: `←`/`→`, `Space` (next), `Home`/`End`, `Escape` (back to panel).
- Mouse: click zones (left third = prev, right two-thirds = next).
- Progress dots (click to jump) + slide counter `"3 / 9"`.
- Buttons: prev / next / back-to-editor / download HTML / print (PDF).

### 11.3 Animation (user decision: rich)

- Staggered reveals on slide activation (per-element `animation-delay`) + slide transitions; CSS-only.
- One orchestrated entrance per slide activation, not scattered micro-interactions.
- All animation disabled under `prefers-reduced-motion` and in print.

---

## 12. Exports (user decisions: HTML download + PDF via print)

### 12.1 HTML download

- "Download deck" serializes the **current deck** (chosen style CSS + slide markup + nav JS + print CSS, all inline) into a standalone HTML file — no panel, no token, no API calls, fully offline-capable.
- Filename: `proposal-{companySlug}-{YYYYMMDD}.html` (company slug = lowercased, non-alphanumerics → `-`).
- Self-containment is asserted by `export.test.js`: no external URLs except Google Fonts `<link>` (with system-font fallbacks), no fetch/XHR, no references to the app file.

### 12.2 PDF via print

- Print stylesheet: `@page { size: 1920px 1080px; margin: 0; }` (landscape), each slide = exactly one page, `-webkit-print-color-adjust: exact`, animations off, controls/dots/counter hidden.
- Available both in-app (print the deck view) and in the exported HTML.
- Optional nice-to-have: port the skill's `scripts/export-pdf.sh` (Playwright screenshots → PDF) as `scripts/export-pdf.sh` for pixel-perfect PDFs. Not required for acceptance.

---

## 13. Edge cases & failure handling (consolidated)

| Case | Behavior |
|---|---|
| OpenRouter/Modal failure | Auto-fallback to embedded sample JSON + visible "SAMPLE DATA" badge + error message + Retry (§7.3) |
| HTTP 200 + `success:false` | Treated as failure (fallback path); error + traceback shown collapsed in panel |
| Network timeout (>150 s) | Abort → failure path |
| Missing/malformed AI fields | Visible `[missing]` placeholders; review lists count; render not blocked (§9.2) |
| Empty `scopeItems`/`timelineItems` | Slide renders with a single `[missing]` row rather than a blank slide |
| Unparseable price | Deposit chip omitted; Investment slide shows price text only |
| Transcript >200k chars | Soft warning banner, still allowed (§6.3) |
| Missing transcript/company | Generate disabled with inline field validation messages |
| Generate with unchanged inputs | Reuse cached AI JSON, skip API call, "reused last analysis" note (§6.3) |
| Apply-edits re-render | Confirm dialog; deck resets to slide 1 (§9.3) |
| Refresh | Everything clears (in-memory only) (§6.3) |
| Offline / Google Fonts unreachable | System-font fallbacks; deck remains legible (§8.1) |
| CORS preflight failure | Blocked before generation with an actionable error (backend fix per §5.3) |
| Token not baked in | Visible "token not configured" banner + build instructions (§4) |

---

## 14. Verification ("make all the tests 100% functional")

User explicitly wants thorough automated testing, not just manual QA.

### 14.1 Unit tests — Node built-in `node:test`, zero npm deps

- `helpers.test.js` — input hashing (stable, deterministic), AI-JSON validation/normalization (all §9.2 cases), deposit math (`"$4,500"` → `$2,250.00`; unparseable → empty), terms prefill.
- `deck-render.test.js` — AI JSON → slide model: exact 9-slide shape for well-formed input; dynamic counts for short lists; `[missing]` placeholder injection; timeline pattern parsing + fallback.
- `export.test.js` — export serializer: self-containment assertions (no app references, style inlined, print CSS present, filename slug).

### 14.2 Backend contract test — pytest (repo is Python)

- `backend_response.test.py` — `_analyze_transcript` with mocked `httpx` returns parsed JSON; `generate_proposal` response includes `proposal` alongside `documentUrl`; `consultant_email` request field overrides env; error shape unchanged; CORS preflight check documented as a manual curl step (§5.3).

### 14.3 Playwright checks (`screenshots.mjs`)

- Screenshots at **1280×720** and **390×844** (phone) — deck letterboxes, no overflow (skill's verification bar).
- Keyboard navigation walks all slides; progress dots + counter update.
- Export download produces a file; exported file opens standalone.
- Print CSS yields exactly N pages (N = slide count) via Playwright PDF.
- `prefers-reduced-motion` emulation disables animations.

### 14.4 Manual QA checklist

- Double-click open from disk (file://) end-to-end with real transcript (`transcript-dan.txt`).
- n8n + `generate.sh` still work after the backend change (backward compat).
- Style previews differ meaningfully; pick → review → deck → apply-edits loop.

---

## 15. Acceptance criteria

1. `frontend/index.html` opens from disk by double-click; no server, no npm, no build tools needed at runtime.
2. Full flow works end-to-end against the real Modal endpoint: paste/upload transcript → Generate → 3 style previews → pick → review/edit → deck.
3. Deck is a faithful 9-slide mirror of the proposal incl. Terms; fixed 16:9 stage; rich CSS animations; full presenter controls.
4. AI failure produces a badged sample-data deck, never a dead end.
5. Unchanged inputs reuse the last AI JSON without a network call.
6. HTML export is self-contained; print produces one page per slide.
7. All unit tests, the backend contract test, and Playwright checks pass.
8. n8n and `generate.sh` remain working (response extension is backward-compatible).
9. Bearer token is not committed to the repo; build-time injection works.

---

## 16. Interview record (decisions & rationale)

| # | Question | Decision |
|---|---|---|
| 1 | UI purpose | **Both combined** — control panel + slide deck in one app |
| 2 | Hosting | **Open file from disk** — single self-contained HTML file |
| 3 | API auth | **Baked into file** (build-time injection, §4) |
| 4 | Scope | **`frontend/index.html`** — exactly where the README already points |
| 5 | Deck data source | **Extend Modal endpoint** to return the structured AI JSON |
| 6 | Deck structure | **You recommend** → 9 slides (§10) |
| 7 | Style flow | **3-preview discovery** per generation |
| 8 | Deck output | **In-app + self-contained HTML download** |
| 9 | Deck usage | **Mainly demo showcasing the proposal generator/automation** |
| 10 | Style memory | **Fresh each time** |
| 11 | Content editing | **Editable before render** |
| 12 | History | **Last only**, in memory |
| 13 | Deck content | **The generated proposal itself** (not an explainer deck) |
| 14 | Demo data | **Real data only** — no demo-data button |
| 15 | Proof slide | **Content only** — artifacts stay in the panel |
| 16 | AI failure | **Sample fallback** (auto, badged, retry) |
| 17 | Transcript input | **Paste + file upload** |
| 18 | Deck sections | **Full mirror incl. Terms** |
| 19 | View switching | **In-page toggle** |
| 20 | Regeneration | **Reuse if unchanged** |
| 21 | Preview styles | **Safe presets + bold templates** (wildcard slot = 2nd bold) |
| 22 | Edit scope | **Full edit** — every AI field |
| 23 | Exports | **HTML download + PDF via print** (resolved from a contradictory multi-select) |
| 24 | Language | **English only** |
| 25 | Missing AI fields | **Render + visible placeholders** |
| 26 | Transcript size | **Soft warning** >200k chars |
| 27 | Branding | **Text only** |
| 28 | Verification | **All tests, 100% functional** (§14) |
| 29 | Deck controls | **Full presenter controls** |
| 30 | Animation | **Rich** (staggered reveals + transitions, reduced-motion honored) |
| 31 | Edit loop | **Explicit apply** with re-render warning |

---

## 17. Open questions (none blocking)

1. Should the exported deck include a tiny "Made with Proposal Generator" credit in the footer? (Default: no — content only.)
2. Should `scripts/export-pdf.sh` (Playwright → PDF) be ported now or later? (Default: later, optional.)
3. Should the review step also allow reordering problem/solution points? (Default: no — edit-in-place only.)

---

## 18. References

- Skill: https://github.com/zarazhangrui/frontend-slides — `SKILL.md`, `STYLE_PRESETS.md`, `viewport-base.css`, `html-template.md`, `animation-patterns.md`, `bold-template-pack/selection-index.json`, `scripts/export-pdf.sh` (MIT)
- Existing backend: `modal_app.py` (`generate_proposal`, `_analyze_transcript`, `_create_proposal_document`, `_build_replacements`)
- Template text: `template_content.txt` · Sample transcripts: `transcript-dan.txt`, `transcript-rr.txt` · Reference outputs: `templates/*.pdf`
- README setup steps 7–8 (the frontend this spec replaces)
