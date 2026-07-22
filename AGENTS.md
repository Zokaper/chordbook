# Chordbook Agent Guide

This file is the durable working guide for coding agents and human contributors in this repository. Read it before making changes. Keep `STATUS.md` updated when work materially changes the product, architecture, known issues, or next steps.

## Product intent

Chordbook is a private, build-first personal songbook for guitarists. The primary workflow is creating a personal, playable arrangement of a song rather than downloading arrangements from a catalogue.

The app should help a guitarist capture:

- Song metadata and personal tags
- Sections such as intro, verse, chorus, bridge, solo, and outro
- Chord progressions and chords positioned above lyrics
- Strumming patterns, beat-level chord changes, and repeat cycles
- Riffs and tablature with basic guitar articulations
- Performance notes and reminders
- Personal chord diagrams and alternate fingerings

Preserve the app's local-first character. Accounts, cloud storage, public libraries, and remote song lookup are not part of the current product unless explicitly requested.

## Repository map

The repository is a pnpm monorepo. The actual product is the Expo application in `artifacts/songbook`.

- `artifacts/songbook/app/` — Expo Router screens
- `artifacts/songbook/components/StructuredEditor.tsx` — structured song editor and content serialization
- `artifacts/songbook/components/ChordViewer.tsx` — song content parser and performance view
- `artifacts/songbook/context/SongContext.tsx` — song model, CRUD, migration, and persistence
- `artifacts/songbook/context/ChordContext.tsx` — chord fingering model, CRUD, and persistence
- `artifacts/songbook/context/SettingsContext.tsx` — persisted preferences
- `artifacts/songbook/context/OnboardingContext.tsx` — first-run onboarding state
- `artifacts/songbook/components/ChordDiagram*.tsx` — chord diagram display and editing
- `artifacts/songbook/utils/transposing.ts` — capo-aware chord transposition
- `artifacts/songbook/public/` — root HTML shell and PWA manifest
- `artifacts/songbook/workbox-config.cjs` — production service worker configuration
- `DEPLOYMENT.md` — local workflow and Cloudflare Pages setup
- `replit.md` — older project notes; verify claims against current source
- `artifacts/api-server`, `lib/api-*`, and `lib/db` — workspace scaffolding, not used by the current app
- `artifacts/mockup-sandbox` — generic component preview tooling, not part of the app runtime

## Stack and commands

- Node.js 24
- pnpm workspaces
- TypeScript 5.9
- Expo SDK 54 / Expo Router 6
- React Native 0.81 / React 19
- AsyncStorage for persistence
- React Context for application state
- `react-native-svg` for chord diagrams

Use pnpm through Corepack, not npm or Yarn. Bare `pnpm` may not be available on every Windows machine, so repository documentation and root scripts use `corepack pnpm`.

Common commands from the repository root:

```sh
corepack pnpm install
corepack pnpm run dev
corepack pnpm run check
corepack pnpm run build:web
corepack pnpm run preview:web
```

The deployment target is Cloudflare Pages at `https://chordbook.zokaper.cc/`. The app is exported at the domain root, with no subpath base URL. See `DEPLOYMENT.md` for dashboard settings.

## Core data model

Songs and chord diagrams are separate local libraries connected at render time.

### Song

The `Song` interface lives in `context/SongContext.tsx` and includes:

- `id`, `title`, `artist`
- `key`, `capo`, `tempo`
- `tags: string[]`
- `content: string`
- `chordVariants: Record<string, string>` mapping chord names to chosen fingering IDs
- `createdAt`, `updatedAt`

Songs are stored under `songbook_songs_v1`. The loader migrates the legacy `genre` field into `tags` and supplies defaults for newer fields. Maintain backward compatibility when changing this model.

### Chord fingering

The `ChordFingering` interface lives in `context/ChordContext.tsx` and includes:

- A user-defined chord name
- Six string values
- A base fret
- An optional barre
- Creation and modification timestamps

For `strings`, index `0` is low E and index `5` is high e. Values mean:

- `-1` — muted
- `0` — open
- Positive integer — actual fret number, not a diagram-relative number

Chords are stored under `songbook_chords_v1`. Multiple fingerings may share the same name and are intentional.

### Other persisted state

- `songbook_settings_v1` — theme, sorting, and capo-label preferences
- `songbook_onboarding_v1` — onboarding completion
- `songbook_strum_hint_v1` — contextual strum hint dismissal

## Song content format

The structured editor uses a text serialization. Treat this as a persisted file format and preserve compatibility.

```text
[Verse]
CHORD:Am  F  C  G
STRUM:D,-,DU,-,D,-,DU,-;REPEAT:2;CHORDS:Am@0,F@4;CYCLE:Am,G
[Am]Lyrics with [F]inline chords
NOTE:Palm mute the first pass
RIFF:e|--------|:B|--------|:G|--------|:D|--------|:A|0h02----|:E|--------|
```

Supported concepts:

- `[Name]` — section header
- `CHORD:` — explicit chord line
- `STRUM:` — beats plus optional `REPEAT`, `CHORDS`, and `CYCLE` segments
- `RIFF:` — six serialized tab rows
- `NOTE:` — performance annotation
- `[Am]word` — ChordPro-style chord placement in a lyric line

The parser also accepts legacy plain chord lines, tab lines, older riff formats, and the legacy `C` strum marker. Changes to `StructuredEditor` and `ChordViewer` must remain mutually compatible.

## Product behavior to preserve

- The app works without an account or network connection.
- Songs, chords, and preferences remain local by default.
- Users build songs section by section using five line types: chords, lyrics, strum, riff, and note.
- Chord lines select names from the user's chord library.
- Lyrics may contain inline ChordPro-style chord markers.
- Strum patterns support variable beat counts, repetition, beat-level chord changes, and per-repeat chord cycles.
- Riffs support six strings, 2–32 slots, frets 0–9, and `h`, `p`, `/`, `\`, `b`, and `~` articulations.
- Multiple chord fingerings with the same name are supported.
- A song remembers which fingering variant was selected for each chord name.
- Capo labels can show played shapes, sounding pitches, both, or neither.
- Search/filter behavior includes title/artist search plus tag, key, and exact-chord filters.
- Web supports JSON backup/restore and text export; native backup/restore is currently unavailable.
- First-run content currently includes an example song and A, E, D, and F#m chord diagrams.

## Implementation conventions and pitfalls

- Generate IDs with `Date.now().toString()` plus a random base-36 suffix. Do not add the `uuid` package without a specific reason.
- Keep `SettingsProvider` above providers or components that call `useColors`.
- Do not use `pointerEvents` in a `StyleSheet` or on a `View` for the chord editor. React Native Web has previously failed or warned here. Use render order for the transparent touch layer.
- The chord diagram editor stores actual fret numbers and derives relative display positions from `baseFret`.
- Wide riffs, tabs, chord strips, and strum grids need horizontal scrolling rather than wrapping into an unreadable layout.
- Standard chord recognition is regex-based and appears in several files. If chord syntax changes, audit every parser, filter, extractor, viewer, and editor together.
- Transposition currently normalizes output to sharp spellings. Do not silently change enharmonic behavior without considering saved keys and UI expectations.
- Avoid making the API/database scaffolding part of the app accidentally. The mobile/web app currently has no backend dependency.
- Keep production URLs rooted at `/`. Do not reintroduce the old GitHub Pages `/chordbook` path rewriting, pnpm asset flattening, or `.nojekyll` handling.
- Expo's development server must not register the production service worker on `localhost`, or cached assets can interfere with Fast Refresh.
- Keep user data migrations defensive. Never discard an unknown saved field or overwrite a local library as a side effect of an unrelated change.

## Working practices

Before editing:

1. Read `STATUS.md` and inspect the current Git status.
2. Identify whether the change affects the editor, serializer, viewer, or migration path.
3. Preserve unrelated user changes in a dirty worktree.

After editing:

1. Run `corepack pnpm run check` for Chordbook changes. Run the repository-wide typecheck for cross-package changes, noting the current mockup-sandbox React-types baseline in `STATUS.md`.
2. Exercise create, edit, save, reopen, and render flows for changes to persisted song content.
3. Check light and dark themes and narrow mobile layouts for UI changes.
4. For web/export changes, run `build:web` and `preview:web`, then verify root-relative assets, the manifest, and offline/PWA output.
5. Update `STATUS.md` with completed work, validation performed, new limitations, and useful next steps.

Automated tests currently cover transposition, capo labels, and relative-time formatting. Add focused tests around parsing, serialization, and migrations next; these are the highest-value remaining regression boundaries.

## Documentation responsibilities

Use the two root documents differently:

- `AGENTS.md` contains stable product intent, architecture, invariants, and working rules.
- `STATUS.md` contains the evolving state of the project and chronological handoff notes.

Do not turn `AGENTS.md` into a session diary. Do not remove older `STATUS.md` log entries; add a dated entry and revise the current-state sections when facts change.
