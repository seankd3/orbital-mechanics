// Serves the game at seankennethdoherty.com/play/orbital-mechanics/ from its
// own Pages project, so the photography site's deployment never carries it.
// Route: seankennethdoherty.com/play/orbital-mechanics*
const ORIGIN = 'https://orbital-mechanics.pages.dev'; // the game's Pages project
const PREFIX = '/play/orbital-mechanics';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // Relative asset paths need the trailing slash.
    if (url.pathname === PREFIX) return Response.redirect(`${url.origin}${PREFIX}/${url.search}`, 301);
    if (!url.pathname.startsWith(`${PREFIX}/`)) return fetch(request);

    const target = new URL(url.pathname.slice(PREFIX.length) + url.search, ORIGIN);
    const response = await fetch(new Request(target, request), { redirect: 'manual' });

    // Pages redirects (e.g. /trailer → /trailer/) come back root-relative: keep them under the prefix.
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      const to = new URL(location, target);
      if (to.origin === new URL(ORIGIN).origin) {
        const headers = new Headers(response.headers);
        headers.set('location', `${url.origin}${PREFIX}${to.pathname}${to.search}`);
        return new Response(null, { status: response.status, headers });
      }
    }
    return response;
  },
};
