const CACHE_NAME = 'chordbook-v1778247267889';
const CACHED_URLS = [
  "/chordbook/",
  "/chordbook/_expo/static/css/native-tabs.module-1c34c93ae030da6223919552702a4e39.css",
  "/chordbook/_expo/static/js/web/entry-7d872eec2428ec3536fc3582dd992359.js",
  "/chordbook/assets/icon.png",
  "/chordbook/assets/vendor/AntDesign.3f78af31cca60105799838a1a7a59fbd.ttf",
  "/chordbook/assets/vendor/Entypo.31b5ffea3daddc69dd01a1f3d6cf63c5.ttf",
  "/chordbook/assets/vendor/EvilIcons.140c53a7643ea949007aa9a282153849.ttf",
  "/chordbook/assets/vendor/Feather.ca4b48e04dc1ce10bfbddb262c8b835f.ttf",
  "/chordbook/assets/vendor/FontAwesome.b06871f281fee6b241d60582ae9369b9.ttf",
  "/chordbook/assets/vendor/FontAwesome5_Brands.3b89dd103490708d19a95adcae52210e.ttf",
  "/chordbook/assets/vendor/FontAwesome5_Regular.1f77739ca9ff2188b539c36f30ffa2be.ttf",
  "/chordbook/assets/vendor/FontAwesome5_Solid.605ed7926cf39a2ad5ec2d1f9d391d3d.ttf",
  "/chordbook/assets/vendor/FontAwesome6_Brands.56c8d80832e37783f12c05db7c8849e2.ttf",
  "/chordbook/assets/vendor/FontAwesome6_Regular.370dd5af19f8364907b6e2c41f45dbbf.ttf",
  "/chordbook/assets/vendor/FontAwesome6_Solid.adec7d6f310bc577f05e8fe06a5daccf.ttf",
  "/chordbook/assets/vendor/Fontisto.b49ae8ab2dbccb02c4d11caaacf09eab.ttf",
  "/chordbook/assets/vendor/Foundation.e20945d7c929279ef7a6f1db184a4470.ttf",
  "/chordbook/assets/vendor/Inter_100Thin.ddbb1cd55ad509e82377bd10beed6506.ttf",
  "/chordbook/assets/vendor/Inter_100Thin_Italic.1b97f7df9b976cfe530c18c09598e6f6.ttf",
  "/chordbook/assets/vendor/Inter_200ExtraLight.e1f33daee21eb5998b13d3e05264d9a3.ttf",
  "/chordbook/assets/vendor/Inter_200ExtraLight_Italic.3d0662838915a7a16d01c262735d3d29.ttf",
  "/chordbook/assets/vendor/Inter_300Light.d2994e3dea3856e1834395ad6cce32af.ttf",
  "/chordbook/assets/vendor/Inter_300Light_Italic.17f8f23a2852bfa14ce5bf590c2a0e2c.ttf",
  "/chordbook/assets/vendor/Inter_400Regular.51b6ad87261f18b6433ec52871ddfabc.ttf",
  "/chordbook/assets/vendor/Inter_400Regular_Italic.36cad9f97595b7759264b945d64502b4.ttf",
  "/chordbook/assets/vendor/Inter_500Medium.137ab18bace28dd0bd83eb3b8ed2bc54.ttf",
  "/chordbook/assets/vendor/Inter_500Medium_Italic.155406bfbfb023eb104728edfe62c0e9.ttf",
  "/chordbook/assets/vendor/Inter_600SemiBold.a5f35888d2da465de352e0dcfaf33324.ttf",
  "/chordbook/assets/vendor/Inter_600SemiBold_Italic.a349d1ac188e1a67689432f44de99849.ttf",
  "/chordbook/assets/vendor/Inter_700Bold.6e237de4f1f413afa2fcc45c77ac343a.ttf",
  "/chordbook/assets/vendor/Inter_700Bold_Italic.3398006c80026f0508aaaf4808950d56.ttf",
  "/chordbook/assets/vendor/Inter_800ExtraBold.6016034293c084aa0c056e83938bf1cc.ttf",
  "/chordbook/assets/vendor/Inter_800ExtraBold_Italic.7ca909a56537d965feef41abe58b87e0.ttf",
  "/chordbook/assets/vendor/Inter_900Black.bcec6eda9700a81ba92c483a2f2c02c1.ttf",
  "/chordbook/assets/vendor/Inter_900Black_Italic.d5f78c24de59ce5e4bad405e10e71941.ttf",
  "/chordbook/assets/vendor/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf",
  "/chordbook/assets/vendor/MaterialCommunityIcons.6e435534bd35da5fef04168860a9b8fa.ttf",
  "/chordbook/assets/vendor/MaterialIcons.4e85bc9ebe07e0340c9c4fc2f6c38908.ttf",
  "/chordbook/assets/vendor/Octicons.871378c6eab492a3e689a9385dc45a12.ttf",
  "/chordbook/assets/vendor/SimpleLineIcons.d2285965fe34b05465047401b8595dd0.ttf",
  "/chordbook/assets/vendor/Zocial.1681f34aaca71b8dfb70756bca331eb2.ttf",
  "/chordbook/assets/vendor/arrow_down.017bc6ba3fc25503e5eb5e53826d48a8.png",
  "/chordbook/assets/vendor/back-icon-mask.0a328cd9c1afd0afe8e3b1ec5165b1b4.png",
  "/chordbook/assets/vendor/back-icon.35ba0eaec5a4f5ed12ca16fabeae451d.png",
  "/chordbook/assets/vendor/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55.png",
  "/chordbook/assets/vendor/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@2x.png",
  "/chordbook/assets/vendor/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@3x.png",
  "/chordbook/assets/vendor/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@4x.png",
  "/chordbook/assets/vendor/close-icon.808e1b1b9b53114ec2838071a7e6daa7.png",
  "/chordbook/assets/vendor/close-icon.808e1b1b9b53114ec2838071a7e6daa7@2x.png",
  "/chordbook/assets/vendor/close-icon.808e1b1b9b53114ec2838071a7e6daa7@3x.png",
  "/chordbook/assets/vendor/close-icon.808e1b1b9b53114ec2838071a7e6daa7@4x.png",
  "/chordbook/assets/vendor/error.d1ea1496f9057eb392d5bbf3732a61b7.png",
  "/chordbook/assets/vendor/file.19eeb73b9593a38f8e9f418337fc7d10.png",
  "/chordbook/assets/vendor/forward.d8b800c443b8972542883e0b9de2bdc6.png",
  "/chordbook/assets/vendor/pkg.ab19f4cbc543357183a20571f68380a3.png",
  "/chordbook/assets/vendor/search-icon.286d67d3f74808a60a78d3ebf1a5fb57.png",
  "/chordbook/assets/vendor/sitemap.412dd9275b6b48ad28f5e3d81bb1f626.png",
  "/chordbook/assets/vendor/unmatched.20e71bdf79e3a97bf55fd9e164041578.png",
  "/chordbook/index.html",
  "/chordbook/manifest.json",
  "/chordbook/metadata.json"
];

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
        if (isNavigation) return caches.match('/chordbook/');
        return new Response('', { status: 408, statusText: 'Offline' });
      });
    })
  );
});