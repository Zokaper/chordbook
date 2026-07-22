# Chordbook Project Status

Last updated: 2026-07-22

## Product summary

Chordbook is a local-first personal songbook for guitarists. Its focus is creating a personal arrangement from scratch—sections, chords, lyrics, strumming, riffs, and performance notes—rather than downloading songs from a public catalogue.

The product currently runs as an Expo/React Native application targeting web/PWA, Android, and iOS. The web target is being migrated from GitHub Pages to Cloudflare Pages at `https://chordbook.zokaper.cc/`.

## Current implementation

### Library

- Create, edit, view, and delete songs
- Search by title or artist
- Filter by tags, key, and exact chords used
- Sort by recently edited, title, or artist
- Song cards display metadata, capo, tags, tempo, relative edit time, and content line count
- Long-press deletion with confirmation

### Song builder

- Phone-first arrangement editor with title and artist first, plus collapsible key, capo, tempo, and tags
- Local autosaved drafts with visible save status, library badges, resume-on-tap, and explicit completion
- A ready first Verse for new arrangements and a single contextual Add block sheet
- Named, reorderable, duplicable sections
- Five structured line types: chords, lyrics, strum, riff, and note
- Directly typed chord progressions with personal-library suggestions and support for custom names
- Reorder, duplicate, and delete individual lines
- Contextual section and line action sheets keep arrangement controls off the main canvas
- ChordPro-style chord placement inside lyrics
- Contextual chord palette while editing lyrics
- Editor guide and first-use strumming hint

### Strumming and riffs

- Variable-length strum grids
- Down, up, down/up, muted, and empty strokes
- Pattern repetition
- Beat-level chord-change labels
- Chord cycles across repeat passes
- Six-string riff grid with 2–32 slots
- Frets 0–9 and hammer-on, pull-off, slide, bend, and vibrato annotations

### Chord library

- Interactive six-string chord diagram builder
- Open and muted string states
- Movable fret position
- Optional barre
- Multiple fingerings per chord name
- Usage count by song
- Per-song selection of a preferred fingering variant

### Viewer

- Rendered section, chord, lyric, strum, riff, tab, and note blocks
- Inline chords above lyric fragments
- Pairing of a chord line with the following strum pattern
- Pinned or inline chord-diagram strip
- Fingering variant cycling
- Capo-aware sounding-pitch labels
- Warnings for custom chord names that cannot be transposed
- Web text export for individual songs

### Settings and data

- System, light, and dark themes
- Default library sort preference
- Capo-label display and location preferences
- Web JSON export/import for songs, chords, or the complete library
- Destructive actions for songs, chords, or all data, with confirmation
- Replayable onboarding
- Local persistence through AsyncStorage
- Automatic migration from legacy `genre` to `tags`
- First-run example song and seed chord diagrams

### Web/PWA

- Root-domain Expo export with no `/chordbook` base path
- Cloudflare Pages build and custom-domain instructions
- Installable web-app manifest
- Workbox-generated service worker, revisioned application shell, and runtime asset cache
- Persistent-storage request when supported by the browser
- Fast Refresh development server and production-preview commands for local testing

### Automated checks

- Cross-platform pnpm setup through Corepack
- Windows-compatible install and package scripts
- App-level `check` command combining typechecking and tests
- Node test runner in normal and watch modes
- Thirteen passing tests covering chord transposition, relative time, structured content round trips, legacy formats, and defensive song migration

## Architecture status

The working product is under `artifacts/songbook` and is frontend-only.

The following workspace areas are scaffolding and are not used by the app:

- Express API server, except for a basic health endpoint
- Drizzle database package, which has no application tables
- Generated API client/schema packages
- Generic mockup preview sandbox

No backend, authentication system, cloud synchronization, or downloadable song catalogue is connected to Chordbook.

## Persisted formats and compatibility

Songs and chords use versioned AsyncStorage keys, but the structured `Song.content` value is also effectively a persisted format. The editor and viewer currently support:

- Explicit `CHORD:`, `STRUM:`, `RIFF:`, and `NOTE:` records
- Section headers in square brackets
- ChordPro-style inline chords
- Older plain chord and tab lines
- Legacy strum and riff encodings

Any changes to these formats should include migration or backward-compatible parsing.

## Known limitations and risks

- UI-level autosave and editor interaction flows are still validated manually; pure parsing and migration boundaries now have automated coverage.
- All user data remains device/browser-local. Users should export backups before clearing application or browser storage.
- JSON import validation is permissive and malformed files fail without a visible error message.
- JSON backup/restore and song text export are web-only.
- Automatic chord transposition emits sharp spellings and does not preserve flat-key notation.
- Several files maintain their own chord-recognition regular expressions, creating a risk of parser behavior drifting between screens.
- The visible product name is often `Songbook`, while the repository, Expo slug, and intended identity are `Chordbook`.
- `StructuredEditor.tsx` is large and mixes serialization, state mutations, and UI. It is functional but a likely maintenance hotspot.
- The example song is automatically seeded on first run, so the onboarding action to add that same example may already show it as added.
- Some statements in `replit.md` lag behind the current implementation. Source code is the current authority.
- The full monorepo typecheck currently fails in the unused `artifacts/mockup-sandbox` because two installed React type versions produce incompatible `ref` types. The Chordbook app typecheck passes.
- The production Pages deployment is live at `https://chordbook.pages.dev`. The custom hostname is associated with the project but remains pending until a proxied `chordbook` CNAME targeting `chordbook.pages.dev` is created; the available OAuth grants do not include DNS write access.

## High-value next steps

These are observations, not committed priorities:

1. Add the pending `chordbook` CNAME in Cloudflare DNS, verify `https://chordbook.zokaper.cc`, and confirm Pages finishes TLS activation.
2. Add component-level tests for autosave timing, draft finalization, and editor interaction flows.
3. Consolidate chord-token parsing into a shared utility used by the library, chord screen, editor, and viewer.
4. Add visible backup-import errors and stronger runtime validation.
5. Decide whether the user-facing name should consistently be Chordbook or Songbook.
6. Consider native backup/share support so local data is recoverable outside the web build.
7. Continue breaking the structured editor into smaller behavior-focused modules without changing the persisted format.

## Collaboration log

### 2026-07-22 — Repository setup and context review

- Cloned `https://github.com/Zokaper/chordbook` into the local workspace.
- Verified `main` was clean and tracking `origin/main` at commit `e5cbdbc`.
- Reviewed the full repository structure and the complete Chordbook application source.
- Traced song, chord, settings, and onboarding persistence.
- Reviewed the structured editor format, legacy parsing, viewer rendering, capo behavior, alternate chord fingerings, backup/restore, PWA deployment, and workspace scaffolding.
- Confirmed the current product direction: a private, build-first personal guitar songbook rather than a song-download service.
- Added root `AGENTS.md` and `STATUS.md` to support future Codex, Claude, or human handoffs.
- No application behavior or production source files were changed during this review.

### 2026-07-22 — Root-domain deployment and local test workflow

- Reconfigured the Expo web app from the GitHub Pages `/chordbook` subpath to the root-domain origin `https://chordbook.zokaper.cc`.
- Removed `gh-pages`, `/chordbook` base URL settings, GitHub asset rewriting, asset flattening, and `.nojekyll` generation.
- Added an Expo-supported public HTML template and PWA manifest.
- Replaced the custom service worker with a Workbox-generated service worker and runtime caching for Expo assets.
- Added Cloudflare Pages build and custom-domain instructions in `DEPLOYMENT.md`.
- Replaced the Replit-only development command with local Expo web Fast Refresh.
- Added production build and local preview commands.
- Replaced the Unix-only preinstall check and Replit Linux-only native-package exclusions with cross-platform configuration.
- Installed the locked workspace dependencies on Windows using pnpm 10.14.0 through Corepack.
- Added eight Node tests for transposition, capo labels, and relative-time formatting, plus watch mode.
- Verified the Chordbook app typecheck and all eight tests pass.
- Verified the root-domain production export completes and Workbox emits the service worker.
- Smoke-tested both the Fast Refresh server and production preview over local HTTP.
- Confirmed the existing full-workspace typecheck issue is confined to the unused mockup sandbox's duplicate React types.

### 2026-07-22 — V2 phone-first arrangement builder

- Reworked song creation around a title-first, ready-to-edit Verse with optional details collapsed by default.
- Replaced persistent block and arrangement controls with contextual phone-friendly action sheets.
- Added directly typed chord progressions with suggestions from the personal chord library while preserving custom chord names.
- Added local autosaved drafts, draft badges, resume-on-tap behavior, title validation on completion, and save flushing on navigation or backgrounding.
- Made song persistence writes sequential and defensive, including preservation of unknown imported fields and migration of the new draft flag.
- Extracted pure structured-content and song-migration utilities and expanded the automated suite from eight to thirteen tests.
- Verified the app typecheck, all thirteen tests, the live Expo development bundle, and the root-domain production PWA build.

### 2026-07-22 — Cloudflare Pages production deployment

- Installed Cloudflare's official Codex skills and MCP integrations and authenticated both Codex and Wrangler.
- Added Wrangler 4.113.0, a root `wrangler.jsonc`, and a repeatable `corepack pnpm run deploy:web` direct-upload workflow.
- Made direct upload the canonical deployment path so Cloudflare never invokes npm against pnpm `catalog:` dependencies.
- Created the `chordbook` Pages project and deployed the production Expo PWA to `https://chordbook.pages.dev`.
- Associated `chordbook.zokaper.cc` with Pages and removed the obsolete Hello-world Worker custom-domain binding that previously owned the hostname; the Worker service itself was retained.
- Verified the deployed root page, manifest, and service worker return HTTP 200 from `chordbook.pages.dev`.
- Re-ran the Chordbook typecheck, all thirteen tests, and the production PWA build successfully.
- Custom-domain activation remains pending on a proxied `chordbook` CNAME to `chordbook.pages.dev`; the authenticated automation grants have Pages and Workers write access but DNS read-only access.

## How to update this file

When completing material work:

1. Update the relevant current-state section.
2. Move resolved limitations out of the known-limitations list.
3. Add newly discovered risks or decisions.
4. Add a dated collaboration-log entry describing what changed and how it was validated.
5. Record the current commit or branch when that information is useful for handoff.

Keep entries factual. Separate completed work from proposals and uncommitted ideas.
