# Deploying

The game lives at `seankennethdoherty.com/play/orbital-mechanics/` but deploys
on its own, so the photography site's Pages project (a Direct Upload) never
has to carry it:

1. **Pages project `orbital-mechanics`**, connected to this repo: production
   branch `main`, build command `npm run build`, output directory `dist`.
   Every merge to `main` deploys it to `orbital-mechanics.pages.dev`.
2. **Worker `orbital-route`** (`route-worker.js`) on the route
   `seankennethdoherty.com/play/orbital-mechanics*`. It serves that path from
   the Pages project. If Cloudflare gave the project a different
   `*.pages.dev` name, set `ORIGIN` to it.

Worker routes run before the photography site, so the old copy of the game
inside its upload is simply shadowed.
