(() => {
  // Update 'version' if you need to refresh the cache
  const cacheVersion = 'v1.0.3';
  const baseUrl = 'https://wireshell.pw';
  const alwaysCache = [
    '/',
    '/offline/',
    `/assets/js/main.min.js`,
    `/assets/css/main.min.css`,
    '/assets/img/sprites.svg'
  ];

  const neverCache = [
    '/serviceworker.js'
  ];

  // Store core files in a cache (including a page to display when offline)
  const updateStaticCache = () => caches.open(cacheVersion)
    .then((cache) => cache.addAll(alwaysCache));


  self.addEventListener('install', (e) => {
    e.waitUntil(updateStaticCache());
  });

  self.addEventListener('activate', (e) => {
    // Remove caches whose name is no longer valid
    e.waitUntil(caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.indexOf(cacheVersion) !== 0)
          .map((key) => caches.delete(key))
        )
      )
    );
  });

  self.addEventListener('fetch', (e) => {
    let request = e.request;

    // Always fetch non-GET requests from the network
    if (request.method !== 'GET') {
      e.respondWith(fetch(request).catch(() => caches.match('/offline/')));
      return;
    }

    // if we have a reqest, that matches in neverCache, always return from network
    if (neverCache.some((item) => (new RegExp(`\\b${item}\\b`)).test(request.url.replace(baseUrl, '')))) {
      e.respondWith(fetch(request).catch(() => caches.match('/offline/')));
    }

    // For HTML requests, try the network first, fall back to the cache, finally the offline page
    if (request.headers.get('Accept').indexOf('text/html') !== -1) {
      // Fix for Chrome bug: https://code.google.com/p/chromium/issues/detail?id=573937
      if (request.mode !== 'navigate') {
        request = new Request(request.url, {
          method: 'GET',
          headers: request.headers,
          mode: request.mode === 'navigate' ? 'cors' : request.mode,
          credentials: request.credentials,
          redirect: request.redirect
        });
      }

      e.respondWith(fetch(request)
        .then(response => {
          const response2 = response.clone();

          // Stash a copy of this page in the cache
          caches.open(cacheVersion)
          .then(cache => {
            cache.put(request, response2);
          });

          return response;
        })

        .catch(() => caches.match(request)
          .then((response) => response || caches.match('/offline/'))
        )
      );
      return;
    }

    // For non-HTML requests, look in the cache first, fall back to the network
    e.respondWith(caches.match(request)
      .then((response) => response || fetch(request)
        .catch(() => {
          // If the request is for an image, show an offline placeholder
          if (request.headers.get('Accept').indexOf('image') !== -1) {
            return new Response(`
              <svg width="400" height="300" role="img" aria-labelledby="offline-title"
                viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                <title id="offline-title">Offline</title>
                <g fill="none" fill-rule="evenodd">
                  <path fill="#D8D8D8" d="M0 0h400v300H0z"/>
                  <text fill="#9B9B9B" font-family="Arial, sans-serif" font-size="72" font-weight="bold">
                    <tspan x="93" y="172">offline</tspan>
                  </text>
                </g>
              </svg>`,
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }

          return false;
        })
      )
    );
  });

})();
