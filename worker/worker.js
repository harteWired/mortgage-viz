// Lab subproject Worker — strips the /mortgage-viz/ prefix from
// incoming request URLs before forwarding to the static-assets binding,
// so the asset paths inside ./dist can stay slug-free.
//
// Vite's `base: "/mortgage-viz/"` config means the built HTML/JS/CSS
// already references /mortgage-viz/-prefixed paths, so the Worker
// rewrites /mortgage-viz/foo → /foo before handing off to the binding.
//
// Pattern source: git-publishing/templates/lab-subproject/worker.js

const PREFIX = '/mortgage-viz';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // Bare /mortgage-viz → redirect to /mortgage-viz/ so relative
    // asset paths resolve correctly. Preserve query + hash so shared
    // links round-trip state through the redirect.
    if (url.pathname === PREFIX) {
      return Response.redirect(url.origin + PREFIX + '/' + url.search + url.hash, 301);
    }

    if (url.pathname.startsWith(PREFIX + '/')) {
      url.pathname = url.pathname.slice(PREFIX.length) || '/';
    }

    return env.ASSETS.fetch(new Request(url, req));
  },
};
