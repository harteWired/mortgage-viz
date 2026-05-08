// Lab subproject Worker — strips the /mortgage-viz/ prefix from
// incoming request URLs before forwarding to the static-assets binding,
// so the asset paths inside ./dist can stay slug-free.
//
// Vite's `base: "/mortgage-viz/"` config means the built HTML/JS/CSS
// already references /mortgage-viz/-prefixed paths, so the Worker has
// to keep that prefix in mind: the asset binding holds files like
// /index.html, /assets/index-*.js — the Worker rewrites
// /mortgage-viz/foo → /foo before handing off to the binding.
//
// Pattern source: git-publishing/templates/lab-subproject/worker.js

const PREFIX = '/mortgage-viz';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // Bare /mortgage-viz → redirect to /mortgage-viz/ so relative
    // asset paths resolve correctly in the served index.html.
    if (url.pathname === PREFIX) {
      return Response.redirect(url.origin + PREFIX + '/', 301);
    }

    // Strip the prefix; everything else routes to the static asset
    // binding, which falls back to index.html on miss (SPA mode).
    if (url.pathname.startsWith(PREFIX + '/')) {
      url.pathname = url.pathname.slice(PREFIX.length) || '/';
    }

    return env.ASSETS.fetch(new Request(url, req));
  },
};
