#!/usr/bin/env node
// Post-processes the Expo web export for GitHub Pages deployment.
// Run after `expo export --platform web` from the songbook package root.

const fs = require("fs");
const path = require("path");

const BASE = "/chordbook";
const distDir = path.join(__dirname, "../dist");
const indexPath = path.join(distDir, "index.html");

// ─── 1. Fix absolute asset paths ─────────────────────────────────────────────
let html = fs.readFileSync(indexPath, "utf8");
html = html
  .replace(/href="\/_expo\//g, `href="${BASE}/_expo/`)
  .replace(/src="\/_expo\//g, `src="${BASE}/_expo/`);

// ─── 2. Inject into <head> ────────────────────────────────────────────────────
const headTags = [
  // Redirect /chordbook (no trailing slash) → /chordbook/ so expo-router routes correctly
  `<script>if(location.pathname==="${BASE}")location.replace("${BASE}/");</script>`,
  `<link rel="manifest" href="${BASE}/manifest.json">`,
  `<meta name="theme-color" content="#141010">`,
  `<meta name="apple-mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`,
  `<meta name="apple-mobile-web-app-title" content="Chordbook">`,
  `<link rel="apple-touch-icon" href="${BASE}/assets/icon.png">`,
].join("\n  ");

html = html.replace("</head>", `  ${headTags}\n</head>`);
fs.writeFileSync(indexPath, html);

// ─── 3. Copy app icon into dist/assets ───────────────────────────────────────
const srcIcon = path.join(__dirname, "../assets/images/icon.png");
const destAssetsDir = path.join(distDir, "assets");
fs.mkdirSync(destAssetsDir, { recursive: true });
fs.copyFileSync(srcIcon, path.join(destAssetsDir, "icon.png"));

// ─── 4. Write manifest.json ───────────────────────────────────────────────────
const manifest = {
  name: "Chordbook",
  short_name: "Chordbook",
  description: "Your personal songbook — chords, tabs, and lyrics.",
  start_url: `${BASE}/`,
  scope: `${BASE}/`,
  display: "standalone",
  orientation: "portrait",
  background_color: "#141010",
  theme_color: "#141010",
  icons: [
    { src: `${BASE}/assets/icon.png`, sizes: "192x192", type: "image/png" },
    { src: `${BASE}/assets/icon.png`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
};
fs.writeFileSync(
  path.join(distDir, "manifest.json"),
  JSON.stringify(manifest, null, 2)
);

// ─── 5. .nojekyll so GitHub Pages serves _expo/ ──────────────────────────────
fs.writeFileSync(path.join(distDir, ".nojekyll"), "");

console.log("✓ Post-export complete");
console.log("  - Fixed asset paths");
console.log("  - Injected PWA tags + trailing-slash redirect");
console.log("  - Wrote manifest.json");
console.log("  - Copied icon.png");
console.log("  - Added .nojekyll");
