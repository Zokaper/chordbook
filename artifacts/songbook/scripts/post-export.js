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
  .replace(/src="\/_expo\//g, `src="${BASE}/_expo/`)
  // Restrict zoom in PWA/mobile browser — replaces whatever viewport tag Expo emits
  .replace(
    /<meta name="viewport"[^>]*>/,
    `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no" />`
  );

// ─── 2. Inject into <head> ────────────────────────────────────────────────────
const headTags = [
  `<script>if(location.pathname==="${BASE}/")history.replaceState(null,'','${BASE}'+location.search+location.hash);</script>`,
  `<link rel="manifest" href="${BASE}/manifest.json">`,
  `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#faf6f2">`,
  `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#141010">`,
  `<meta name="apple-mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-status-bar-style" content="default">`,
  `<meta name="apple-mobile-web-app-title" content="Chordbook">`,
  `<link rel="apple-touch-icon" href="${BASE}/assets/icon.png">`,
  `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('${BASE}/sw.js',{scope:'${BASE}/'}).catch(function(e){console.warn('SW reg failed',e);});});}</script>`,
].join("\n  ");

const bgStyle = `<style>html,body{background-color:#faf6f2}@media(prefers-color-scheme:dark){html,body{background-color:#141010}}</style>`;
html = html.replace("</head>", `  ${headTags}\n  ${bgStyle}\n</head>`);
fs.writeFileSync(indexPath, html);

// ─── 3. Copy app icon into dist/assets ───────────────────────────────────────
const srcIcon = path.join(__dirname, "../assets/images/icon.png");
const destAssetsDir = path.join(distDir, "assets");
fs.mkdirSync(destAssetsDir, { recursive: true });
fs.copyFileSync(srcIcon, path.join(destAssetsDir, "icon.png"));

// ─── 4. Flatten __node_modules assets → assets/vendor/ ───────────────────────
// The pnpm asset paths look like:
//   assets/__node_modules/.pnpm/@expo+vector-icons@15.1.1_.../Fonts/Feather.ca4b.ttf
// GitHub Pages fails to serve these because:
//   - Directories starting with "." are hidden (e.g. .pnpm)
//   - "+" in URL paths is decoded as a space by some CDN layers
// Fix: copy every asset file to a flat assets/vendor/<filename> directory.
// Since Expo names assets with a content hash in the filename, there are no collisions.

const nodeModulesDir = path.join(distDir, "assets", "__node_modules");
const vendorDir = path.join(distDir, "assets", "vendor");
fs.mkdirSync(vendorDir, { recursive: true });

let flattenedCount = 0;
function flattenAssets(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      flattenAssets(full);
    } else {
      fs.copyFileSync(full, path.join(vendorDir, entry.name));
      flattenedCount++;
    }
  }
}

if (fs.existsSync(nodeModulesDir)) {
  flattenAssets(nodeModulesDir);
  fs.rmSync(nodeModulesDir, { recursive: true });
}

// ─── 5. Patch JS bundle: rewrite __node_modules asset URLs → /assets/vendor/ ──
// The bundle references fonts/images with long pnpm paths. Replace all of them
// with the flat vendor path using the filename (which contains the content hash).
const jsStaticDir = path.join(distDir, "_expo", "static", "js", "web");
if (fs.existsSync(jsStaticDir)) {
  for (const file of fs.readdirSync(jsStaticDir)) {
    if (!file.endsWith(".js")) continue;
    const filePath = path.join(jsStaticDir, file);
    const original = fs.readFileSync(filePath, "utf8");
    // Match:  /assets/__node_modules/<any path>/<filename>.<hash>[optional @Nx].<ext>
    // The regex matches the /assets/__node_modules/.../ prefix and the filename separately.
    // Replace: /assets/vendor/<filename>
    const patched = original.replace(
      /\/assets\/__node_modules\/[^\s"'`()]+\/([\w.\-@%]+\.(?:ttf|otf|woff2?|png|jpg|jpeg|gif|webp|svg))/gi,
      (_match, filename) => `/assets/vendor/${filename}`
    );
    if (patched !== original) {
      fs.writeFileSync(filePath, patched);
      console.log(`  - Patched bundle: ${file}`);
    }
  }
}

// ─── 6. Write manifest.json ───────────────────────────────────────────────────
const manifest = {
  name: "Chordbook",
  short_name: "Chordbook",
  description: "Your personal songbook — chords, tabs, and lyrics.",
  start_url: `${BASE}/`,
  scope: `${BASE}/`,
  display: "standalone",
  orientation: "portrait",
  background_color: "#faf6f2",
  theme_color: "#faf6f2",
  icons: [
    { src: `${BASE}/assets/icon.png`, sizes: "192x192", type: "image/png" },
    { src: `${BASE}/assets/icon.png`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
};
fs.writeFileSync(
  path.join(distDir, "manifest.json"),
  JSON.stringify(manifest, null, 2)
);

// ─── 7. Write service worker ──────────────────────────────────────────────────
function listFiles(dir, isRoot = false) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    if (isRoot && e.name.startsWith(".")) continue;
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
  const isNavigation = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  if (!rawUrl.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
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

// ─── 8. .nojekyll so GitHub Pages serves _expo/ ──────────────────────────────
fs.writeFileSync(path.join(distDir, ".nojekyll"), "");

console.log("✓ Post-export complete");
console.log(`  - Fixed asset paths`);
console.log(`  - Injected PWA tags + SW registration`);
console.log(`  - Flattened ${flattenedCount} assets to assets/vendor/`);
console.log(`  - Patched bundle asset URLs`);
console.log(`  - Wrote manifest.json`);
console.log(`  - Wrote sw.js (${cachedFiles.length} files cached)`);
console.log(`  - Copied icon.png`);
console.log(`  - Added .nojekyll`);
