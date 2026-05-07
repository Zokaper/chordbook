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

// ─── 4. Patch JS bundle: replace /.pnpm/ → /_pnpm/ ──────────────────────────
// The SW rewrites URLs at runtime, but on the *first* load the SW isn't yet
// active so the bundle's hardcoded font URLs go straight to GitHub Pages —
// which refuses to serve dot-directories. Patching the bundle text means fonts
// load correctly on every load without depending on the SW.
const jsStaticDir = path.join(distDir, "_expo", "static", "js", "web");
if (fs.existsSync(jsStaticDir)) {
  for (const file of fs.readdirSync(jsStaticDir)) {
    if (!file.endsWith(".js")) continue;
    const filePath = path.join(jsStaticDir, file);
    const original = fs.readFileSync(filePath, "utf8");
    const patched = original.split("/__node_modules/.pnpm/").join("/__node_modules/_pnpm/");
    if (patched !== original) {
      fs.writeFileSync(filePath, patched);
      console.log(`  - Patched bundle: ${file}`);
    }
  }
}

// ─── 4b. Rename .pnpm → _pnpm inside dist/assets/__node_modules ──────────────
// GitHub Pages refuses to serve files inside directories whose names start with
// a dot, even with .nojekyll. Renaming to _pnpm (underscore) makes them
// accessible. The service worker rewrites all request URLs at runtime so the
// bundle's hardcoded /.pnpm/ paths still resolve correctly.
const nodeModulesDir = path.join(distDir, "assets", "__node_modules");
const dotPnpmDir = path.join(nodeModulesDir, ".pnpm");
const underPnpmDir = path.join(nodeModulesDir, "_pnpm");
if (fs.existsSync(dotPnpmDir)) {
  if (fs.existsSync(underPnpmDir)) fs.rmSync(underPnpmDir, { recursive: true });
  fs.renameSync(dotPnpmDir, underPnpmDir);
}

// ─── 5. Write manifest.json ───────────────────────────────────────────────────
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

// ─── 6. Write service worker ──────────────────────────────────────────────────
// Lists every file in dist that GitHub Pages will actually serve.
// Skips dot-files/dirs at root (e.g. .nojekyll) and sw.js itself.
// After the rename above, .pnpm no longer exists so _pnpm is listed instead.
function listFiles(dir, isRoot = false) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    if (isRoot && e.name.startsWith(".")) continue; // skip .nojekyll etc at root
    if (e.name === "sw.js") continue;
    const full = path.join(dir, e.name);
    const rel = BASE + "/" + path.relative(distDir, full).replace(/\\/g, "/");
    if (e.isDirectory()) {
      files = files.concat(listFiles(full, false));
    } else {
      files.push(rel);
    }
  }
  return files;
}

const cachedFiles = listFiles(distDir, true);
const CACHE_NAME = `chordbook-v${Date.now()}`;

const swContent = `
const CACHE_NAME = '${CACHE_NAME}';
const CACHED_URLS = ${JSON.stringify([BASE + "/", ...cachedFiles], null, 2)};

// GitHub Pages doesn't serve dot-directories, so .pnpm was renamed to _pnpm.
// Rewrite all asset URLs that reference /.pnpm/ → /_pnpm/ so the bundle's
// hardcoded paths resolve to the actually-served files.
function rewritePnpm(url) {
  return url.includes('/__node_modules/.pnpm/')
    ? url.replace('/__node_modules/.pnpm/', '/__node_modules/_pnpm/')
    : url;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHED_URLS))
      .then(() => self.skipWaiting())
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
  const rawUrl = event.request.url;
  const rewritten = rewritePnpm(rawUrl);
  const isNavigation = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  // Build the request we'll actually use (rewritten URL if needed)
  const req = rewritten !== rawUrl ? new Request(rewritten, event.request) : event.request;

  // Only handle same-origin requests
  if (!rawUrl.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        return response;
      }).catch(() => {
        if (isNavigation) return caches.match('${BASE}/');
        return new Response('', { status: 408, statusText: 'Offline' });
      });
    })
  );
});
`.trim();

fs.writeFileSync(path.join(distDir, "sw.js"), swContent);

// ─── 7. .nojekyll so GitHub Pages serves _expo/ and _pnpm/ ──────────────────
fs.writeFileSync(path.join(distDir, ".nojekyll"), "");

console.log("✓ Post-export complete");
console.log(`  - Fixed asset paths`);
console.log(`  - Injected PWA tags + SW registration`);
console.log(`  - Renamed .pnpm → _pnpm (GitHub Pages dot-dir fix)`);
console.log(`  - Wrote manifest.json`);
console.log(`  - Wrote sw.js (${cachedFiles.length} files cached, with URL rewriting)`);
console.log(`  - Copied icon.png`);
console.log(`  - Added .nojekyll`);
