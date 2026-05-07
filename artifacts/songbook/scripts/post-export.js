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
  // Strip trailing slash from base path so expo-router's stripBaseUrl returns "" (root) not "/" (unmatched)
  `<script>if(location.pathname==="${BASE}/")history.replaceState(null,'','${BASE}'+location.search+location.hash);</script>`,
  `<link rel="manifest" href="${BASE}/manifest.json">`,
  `<meta name="theme-color" content="#141010">`,
  `<meta name="apple-mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`,
  `<meta name="apple-mobile-web-app-title" content="Chordbook">`,
  `<link rel="apple-touch-icon" href="${BASE}/assets/icon.png">`,
  // Register service worker for PWA installability
  `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('${BASE}/sw.js',{scope:'${BASE}/'}).catch(function(e){console.warn('SW reg failed',e);});});}</script>`,
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

// ─── 5. Write service worker ──────────────────────────────────────────────────
// Collects every file in dist so the SW can cache them all.
function listFiles(dir, base) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue; // skip .nojekyll etc
    const full = path.join(dir, e.name);
    const rel = BASE + "/" + path.relative(distDir, full).replace(/\\/g, "/");
    if (e.isDirectory()) {
      files = files.concat(listFiles(full, base));
    } else {
      files.push(rel);
    }
  }
  return files;
}

const cachedFiles = listFiles(distDir);
const CACHE_NAME = `chordbook-v${Date.now()}`;

const swContent = `
const CACHE_NAME = '${CACHE_NAME}';
const CACHED_URLS = ${JSON.stringify([BASE + "/", ...cachedFiles], null, 2)};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHED_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Only handle same-origin requests under our scope
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    }).catch(() => caches.match('${BASE}/'))
  );
});
`.trim();

fs.writeFileSync(path.join(distDir, "sw.js"), swContent);

// ─── 6. .nojekyll so GitHub Pages serves _expo/ ──────────────────────────────
fs.writeFileSync(path.join(distDir, ".nojekyll"), "");

console.log("✓ Post-export complete");
console.log(`  - Fixed asset paths`);
console.log(`  - Injected PWA tags + SW registration`);
console.log(`  - Wrote manifest.json`);
console.log(`  - Wrote sw.js (${cachedFiles.length} files cached)`);
console.log(`  - Copied icon.png`);
console.log(`  - Added .nojekyll`);
