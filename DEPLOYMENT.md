# Chordbook Deployment

Chordbook is built as a root-domain Expo single-page application and is intended to be hosted at `https://chordbook.zokaper.cc/`.

## Cloudflare Pages setup

The `zokaper.cc` nameservers already point to Cloudflare, so Pages can create the `chordbook` DNS record and TLS certificate automatically.

In Cloudflare:

1. Open **Workers & Pages** and create a Pages application connected to `Zokaper/chordbook`.
2. Select `main` as the production branch.
3. Use no framework preset.
4. Keep the repository root as the build root.
5. Set the build command to `corepack pnpm run build:web`.
6. Set the output directory to `artifacts/songbook/dist`.
7. Set `NODE_VERSION` to `24` in the build environment.
8. Deploy once to obtain the temporary `*.pages.dev` address.
9. In the Pages project, open **Custom domains**, choose **Set up a domain**, and enter `chordbook.zokaper.cc`.

Do not create the CNAME manually before associating the custom domain in Pages. Because the zone is already on Cloudflare, the dashboard should create the record and certificate as part of the custom-domain flow.

Every push to `main` will then build and deploy production. Other branches receive Pages preview deployments.

## Local development

One-time setup:

```powershell
corepack pnpm install
```

Start the browser development server with fast refresh:

```powershell
corepack pnpm run dev
```

Expo opens the app in a browser and updates it as source files change. Terminal shortcuts can also open Android or iOS targets when their local tooling is available.

To test the optimized production output locally:

```powershell
corepack pnpm run build:web
corepack pnpm run preview:web
```

The preview is HTTP-only. Browser features that require a secure context may behave differently from production HTTPS.

## Automated checks

```powershell
corepack pnpm run test
corepack pnpm run typecheck
corepack pnpm run check
```

Use `corepack pnpm run test:watch` while working on pure logic. Tests currently cover transposition, capo labels, and relative-time formatting. Parsing, serialization, and migration tests should be added next.

## PWA behavior

Expo exports the app directly at `/`; there is no `/chordbook` base path. Standard files in `artifacts/songbook/public` provide the HTML shell and manifest. Workbox generates `dist/sw.js` from revisioned production assets during `build:web`.

The service worker is not registered on `localhost`, which prevents production caching from interfering with fast refresh. Verify installability and offline behavior on the deployed HTTPS domain after each material PWA change.
