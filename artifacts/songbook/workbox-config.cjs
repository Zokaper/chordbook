module.exports = {
  globDirectory: "dist",
  globPatterns: ["**/*.{html,js,css,json,ico,png,svg,ttf,otf,woff,woff2}"],
  globIgnores: ["sw.js"],
  swDest: "dist/sw.js",
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  navigateFallback: "/index.html",
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  runtimeCaching: [
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin && url.pathname.startsWith("/assets/"),
      handler: "CacheFirst",
      options: {
        cacheName: "chordbook-assets",
        cacheableResponse: { statuses: [0, 200] },
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        },
      },
    },
  ],
};
