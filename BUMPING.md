# Bumping this package in the apps

The consumers pin an exact commit:

```json
"@sahaibat/anc-engine": "github:Viantra-Health/sahaibat-anc-engine#<sha>"
```

**This is deliberate, and it replaced a bare `github:Viantra-Health/sahaibat-anc-engine`
spec that broke four deploys in one day.**

With no ref in `package.json`, the resolved commit lives only in `package-lock.json`.
Pushing this repo does not update a consumer, and `npm update` does **not** re-resolve a
bare `github:` dependency — only `npm rm` followed by `npm i` does. The failure mode is
the worst available: the app builds **green locally**, because a stale `node_modules`
still satisfies `tsc`, and then fails on Vercel with
`has no exported member named '<newExport>'`. Nothing in either diff shows the version,
so there is nothing to notice in review.

With the SHA pinned, the version is a one-line diff in `package.json` — visible in review,
and a stale pin fails at install rather than silently at build.

## To ship a change here

1. Commit and push this repo. Note the new SHA.
2. In **both** `sahaibat-healthcare` and `sahaibat-bidan`, set the `#<sha>` in
   `package.json` to it, then `npm i`.
3. Confirm the lockfile actually moved — never trust a local build:

   ```sh
   grep -o 'sahaibat-anc-engine.git#[0-9a-f]\{40\}' package-lock.json | head -1
   ```

4. Build with a cold cache. A stale `.next` has reported `is not exported` for a file
   that was plainly correct: `rm -rf .next && npm run build`.
5. Commit both apps.

Steps 2 and 3 are the whole point. Skipping them is what broke the deploys.
