# Awesome Game Security — multilingual resource directory

A structured website for [gmh5225/awesome-game-security](https://github.com/gmh5225/awesome-game-security), published at [gs.awesome.rip](https://gs.awesome.rip). It combines the original catalog with task-oriented topic notes, search and filters, visible observation history, RSS, and a reading list.

## Content and languages

The catalog passively indexes the source README’s catalog sections: source links, descriptions, and category associations are retained, including resources listed under multiple categories. Canonical URLs merge duplicates without losing those associations. Each resource’s stable ID is derived from its canonical `url`; an optional `sourceUrl` preserves a meaningful original documentation anchor for display and navigation. Source links open `sourceUrl || url`, so preserving an anchor does not invalidate saved resource IDs. Indexing a source entry does not mean it has been selected, tested, or endorsed.

The authored topic collection is a separate layer. Three topics contain 10 resources each: game testing and performance observation, engine foundations, and multiplayer foundations. Each resource has a short purpose, selection rationale, experience level, and a specific limitation. These notes are based on public project information; they are not hands-on tool evaluations or security audits. Multiplayer transport and replication libraries do not replace application authorization or validation of game rules.

All interface dictionaries and all topic notes are provided in these ten locales:

| Language | Route prefix |
| --- | --- |
| English | `/en` |
| 简体中文 | `/zh-CN` |
| 繁體中文 | `/zh-TW` |
| 日本語 | `/ja` |
| 한국어 | `/ko` |
| Deutsch | `/de` |
| Français | `/fr` |
| Español | `/es` |
| Italiano | `/it` |
| Русский | `/ru` |

The directory lives directly at `/[locale]` (for example `/zh-CN`), not at `/[locale]/resources`. Resource detail pages use `/[locale]/resources/[id]`. Topic lists and guides use `/[locale]/topics` and `/[locale]/topics/[slug]`; the reading list and project information use `/[locale]/saved` and `/[locale]/about`. The root `/` redirects to `/en`, preserving supported legacy search/category links.

Original project names and URLs remain searchable. Available multilingual descriptions are imported from the source repository for eligible development and conceptual resources. Upstream machine-generated descriptions are labelled as source descriptions and have not been individually fact-checked or editorially vetted. Where no localized description exists, the interface labels its English or original-description fallback. Ten interface languages do not imply that every linked third-party page is translated.

## Local development

Install Node.js for the Next.js runtime and [Bun](https://bun.sh/) for package installation, tests, and data jobs. Source synchronization also requires Git. Install the checked-in lockfile:

```sh
bun install --frozen-lockfile
bun run dev
```

`bun run dev`, `bun run build`, and `bun run start` invoke the Next.js CLI with its Node.js runtime; these scripts do not force Next.js to run under Bun. Tests and the catalog scripts run under Bun. A checked-in catalog snapshot lets the site start and render without requesting GitHub from the browser.

| Command | Purpose |
| --- | --- |
| `bun run sync:data` | Resolve the source commit, import its README and available descriptions, validate, and replace the catalog snapshot atomically. |
| `bun run check:links --limit 40 --concurrency 3` | Check a bounded rotation of links, prioritizing never-checked or oldest-checked entries. |
| `bun run check:metadata --limit 40 --concurrency 2` | Read a bounded rotation of GitHub repositories’ archive status and last-push timestamp. |
| `bun run test` | Run parser, search, observation history, dictionary, and editorial integrity tests. |
| `bun run typecheck` | Check TypeScript without emitting application files. |
| `bun run build` | Produce the production Next.js build. |
| `bun run start` | Serve an existing production build locally. |

Run `bun run typecheck`, `bun run test`, and `bun run build` before deploying a change. Tests require the actual checked-in `src/data/catalog.json`, so missing snapshot data fails rather than silently skipping editorial membership checks.

## Snapshot and update model

`scripts/sync-catalog.ts` pins every import to a full upstream Git commit. The README and selected description files come from that same commit. A temporary partial Git clone and sparse checkout retrieve the exact selected description paths; the source repository’s large archive tree is not checked out. The temporary checkout is removed after use. `src/data/catalog.json` stores the source commit, import observation time, baseline, resources, and observed changes. The application renders this snapshot; page visits do not initiate an upstream sync.

The initial import establishes an observation baseline and starts with an empty change feed. Later successful imports record additions, changed entries, and removals. “First observed here” means the first time this index observed an entry, **not the resource’s publication date**. “Entry updated” means the indexed content changed; it does not establish a new upstream software release. Observation history retains up to 1,000 changes from the last 180 days.

Date and status fields have distinct meanings:

| Field | Meaning |
| --- | --- |
| `syncedAt` | Observation timestamp assigned at the start of the successful catalog import. |
| `firstSeenAt` | When this index first observed the resource. |
| `contentChangedAt` | When indexed content last changed. |
| `upstreamUpdatedAt` | GitHub’s repository `pushed_at` timestamp, when successfully retrieved. This is not necessarily a release date. |
| `lastCheckedAt` / `linkStatus` | Latest bounded availability check and its result. |
| `metadataCheckedAt` / `metadataStatus` | Latest repository-metadata check attempt and its result. |
| `metadataVerifiedAt` | Last successful repository-metadata verification. A later failed attempt does not advance this timestamp. |
| `maintenance` | Known GitHub archive status: `archived`, `active` (displayed as “Not archived”), or `unknown`. “Not archived” does not prove active maintenance. |

Displayed dates use UTC. Missing metadata and `unknown` mean **unverified**, never “inactive,” “safe,” or “zero activity.” HTTP reachability does not prove project maintenance, compatibility, quality, or safety. Access restrictions and inconclusive network checks are recorded separately from unavailable responses. Platform, engine, and type labels inferred from source text are navigation aids rather than compatibility guarantees.

Failed downloads, invalid source data, incomplete description imports, and unexpected large removals leave the previous snapshot intact. A failed sync exits unsuccessfully so automation can report it; the published site continues serving its last deployed snapshot. For a deliberate source-version reproduction, use `bun run sync:data --commit FULL_40_CHARACTER_SHA`. Review unexpected removals before using the script’s explicit large-removal override.

The daily and manually triggered workflow in `.github/workflows/sync-catalog.yml` imports data, checks bounded batches of links and GitHub repository metadata, runs validation and a production build, then commits the validated snapshot. This requires GitHub Actions write access to repository contents. Checks rotate through the catalog; a daily workflow does not mean every resource is checked daily.

The metadata job reads public GitHub repository metadata only. Failed or restricted checks preserve previously retrieved archive and push-date values and their successful verification time, while recording the latest attempt status separately. Resource details explicitly mark that retained evidence when a newer check fails. Link and metadata checks do not rewrite the catalog’s import time or create invented content-update events.

## Following, saving, and RSS

Bookmarks and followed-topic preferences are stored only in the current browser’s `localStorage` (`ags:saved` and `ags:topics`). They need no account, do not sync between devices, and do not send email or push notifications. Clearing browser storage removes them. Following a topic filters the on-site updates view.

Use an RSS reader for subscriptions outside the browser:

- All observed changes: `/en/feed.xml`
- A topic: `/en/feed.xml?topic=testing-observability`
- Another language: `/zh-CN/feed.xml?topic=multiplayer-foundations`

The general form is `/[locale]/feed.xml?topic=[slug]`; omit `topic` for all changes. RSS reports index observations and can be empty at the initial baseline. It does not reinterpret the initial collection as newly published resources.

## Architecture and deployment

| Location | Responsibility |
| --- | --- |
| `src/app` | Localized Next.js pages, metadata, sitemap, robots, and RSS routes. |
| `src/lib/i18n.ts` | Ten complete interface dictionaries. |
| `src/lib/search.ts` | Search relevance, token matching, combined filters, and sorting. |
| `src/lib/catalog.ts` | Read-only access to the pinned catalog snapshot. |
| `src/components/MetadataFacts.tsx` | Display index dates, repository evidence, and link results with explicit unknown or stale states. |
| `src/lib/content.ts` / `src/lib/editorial.ts` | Assemble display resources and resolve authored notes and source-description fallbacks. |
| `src/lib/local-state.ts` | Browser-local saved resources and followed topics. |
| `src/data/topics.ts` | Authored multilingual topic collection. |
| `scripts/catalog-core.ts` | README parsing, canonical URLs, stable resource IDs, and observation history. |
| `scripts/sync-catalog.ts` / `scripts/check-links.ts` / `scripts/check-metadata.ts` | Explicit import, link-availability, and repository-metadata jobs. |

`NEXT_PUBLIC_SITE_URL` controls absolute canonical, alternate-language, sitemap, and RSS URLs. It defaults to `https://gs.awesome.rip`; set it to the intended public origin when deploying elsewhere. `GITHUB_TOKEN` is optional for local source synchronization and is supplied by GitHub Actions in the scheduled workflow. Do not place a token in a `NEXT_PUBLIC_` variable.

Production deployment continues through the existing Git repository and Vercel project. Push validated changes through that project’s existing branch/preview/production workflow, and preserve the current domain and environment configuration. This implementation does not create a new hosting project or migrate the site to a different provider. A successful local build or snapshot commit alone is not proof that the production deployment completed; check the existing Vercel deployment and the live localized pages.

Source authors retain credit for their projects. Report catalog mistakes to this site’s repository, and use the original project’s documentation for its current requirements and licensing.
