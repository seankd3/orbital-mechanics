# Deploying

The game ships inside Sean's site, `seankd3/Sean-Kenneth-Doherty` (branch `legacy/master`), as a
static folder served at `seankennethdoherty.com/play/orbital-mechanics/`:

```sh
npm run build
rm -rf ../sean-kenneth-doherty/app/public/play/orbital-mechanics
cp -r dist ../sean-kenneth-doherty/app/public/play/orbital-mechanics
```

Then follow that repo's `CLAUDE.md`. Its deploys are Cloudflare Pages uploads of the whole site,
and they go live only with Sean's go-ahead. Keep every file under 25 MiB, including the trailer
in `public/trailer/`.
