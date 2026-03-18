const CACHE = “hl-v4”;
const ASSETS = [”./”, “./index.html”, “./manifest.json”, “./logo.png”];

self.addEventListener(“install”, function(e) {
e.waitUntil(
caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }).then(function() { return self.skipWaiting(); })
);
});

self.addEventListener(“activate”, function(e) {
e.waitUntil(
caches.keys().then(function(keys) {
return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
}).then(function() { return self.clients.claim(); })
);
});

self.addEventListener(“fetch”, function(e) {
var url = e.request.url;

// Never intercept: POST requests, API calls, CDN scripts
if (e.request.method !== “GET” ||
url.indexOf(“anthropic.com”) !== -1 ||
url.indexOf(“exchangerate-api.com”) !== -1 ||
url.indexOf(“jsdelivr.net”) !== -1 ||
url.indexOf(“cdnjs.cloudflare.com”) !== -1) {
return;
}

// Cache-first for local assets only
e.respondWith(
caches.match(e.request).then(function(cached) {
if (cached) return cached;
return fetch(e.request).then(function(res) {
if (res && res.status === 200 && res.type === “basic”) {
var clone = res.clone();
caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
}
return res;
});
})
);
});