# Songbook

A personal mobile songbook app where musicians create and store their own songs with custom chords, tabs, and lyrics — building up a private library over time.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Expo app runs via the `artifacts/songbook: expo` workflow

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (SDK 54) + Expo Router, React Native 0.81
- State: AsyncStorage (local persistence), React Context
- Fonts: Inter (400/500/600/700) via @expo-google-fonts/inter
- Icons: @expo/vector-icons (Feather)
- Haptics: expo-haptics

## Where things live

- `artifacts/songbook/` — Expo mobile app
- `artifacts/songbook/context/SongContext.tsx` — Song CRUD + AsyncStorage
- `artifacts/songbook/components/SongCard.tsx` — Library list item
- `artifacts/songbook/components/ChordViewer.tsx` — Chord/tab renderer
- `artifacts/songbook/app/(tabs)/index.tsx` — Library screen
- `artifacts/songbook/app/song/[id].tsx` — Song viewer
- `artifacts/songbook/app/editor.tsx` — Song create/edit screen
- `artifacts/songbook/constants/colors.ts` — Design tokens (warm amber/brown theme)

## Architecture decisions

- Frontend-only: all data persisted via AsyncStorage — no backend required
- Song content is free-form text; ChordViewer parses lines at render time (section headers, chord lines, tab lines, lyrics)
- Editor opens as a modal (presentation: "modal") for focused creation flow
- Chord line detection: a line is a chord line if every whitespace-separated token matches the chord regex
- Tab lines detected by leading string pattern (e|, A|, D|, etc.)

## Product

- Library screen with search and genre filter
- Song cards showing title, artist, key badge, genre, and tempo
- Song viewer with syntax-highlighted chord/tab display (section headers, chord lines, lyrics)
- Song editor with title, artist, key selector, tempo, genre, and free-form chord/lyric content
- Long-press to delete from library, swipe-to-delete confirmation

## User preferences

_Populate as you build._

## Gotchas

- Do not use the `uuid` package — use `Date.now().toString() + Math.random().toString(36).substring(2, 9)` for IDs
- ChordViewer uses a horizontal ScrollView wrapper to handle wide tab content without wrapping
- Web platform requires manual top/bottom insets (67px top, 34px bottom)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `expo` skill for mobile development guidelines
