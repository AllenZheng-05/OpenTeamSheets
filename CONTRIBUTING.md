# Contributing to Open Team Sheets

Thanks for helping build a free, open hub for Pokémon Champions VGC teams. This guide covers how to set up the project, how changes get made, and what reviewers look for.

By taking part, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug** with the [bug report template](https://github.com/AllenZheng-05/OpenTeamSheets/issues/new/choose).
- **Suggest a feature** with the feature request template. Check open issues first, since it may already be planned.
- **Fix data.** Wrong sets, placements or regulation data are bugs too; report them, or fix them in a pull request.
- **Write code.** Issues labeled [`good first issue`](https://github.com/AllenZheng-05/OpenTeamSheets/labels/good%20first%20issue) are small and self-contained. Comment on an issue before starting, so two people don't build the same thing.

Security problems are the exception: never report them in a public issue. See [SECURITY.md](SECURITY.md).

## Setting up

You need Node.js 22, pnpm 10 and Docker Desktop. Then:

```sh
git clone https://github.com/<your-username>/OpenTeamSheets.git
cd OpenTeamSheets
pnpm install
pnpm db:start   # local Supabase; prints the URL and keys
# copy .env.example to apps/web/.env.local and apps/worker/.env, filled in from `pnpm supabase status`
pnpm db:seed    # loads the game data into the local database
pnpm dev        # http://localhost:3000
```

You never need production keys: everything runs against the local database. `pnpm db:reset` rebuilds it from scratch; run `pnpm db:seed` again afterwards.

| Folder          | What it is                                  |
| --------------- | ------------------------------------------- |
| `apps/web`      | The Next.js site                            |
| `apps/worker`   | Background jobs such as tournament imports  |
| `packages/core` | Shared types, parsing and Champions data    |
| `tools`         | Maintainer scripts such as `pnpm data:pull` |
| `supabase`      | Database config, migrations and seed data   |

## Making a change

1. **Fork** the repo and create a branch from `main`. Name it after the change, with a prefix: `feat/box-filter`, `fix/paste-parser-megas`, `docs/contributing`, `data/reg-m-c-movepools`.
2. **Keep it focused.** One pull request should do one thing. Small PRs get reviewed faster.
3. **Run the checks** before pushing. CI runs the same ones, and a PR can't merge until they pass:

   ```sh
   pnpm format       # fixes formatting
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   pnpm db:test      # database tests; needs pnpm db:start
   ```

4. **Open a pull request** against `main` and fill in the template. Link the issue it closes (`Closes #12`).
5. **Review.** A maintainer will review, may ask for changes, and squash-merges once it's approved. Merging to `main` deploys to production.

### Commit messages

Write concise but complete commit messages detailing what changed since the previous commit. Explain the purpose
of your changes if it is not obvious.

## Code guidelines

- Write good TypeScript
- Shared logic goes in `packages/core`: parsing, legality, regulation data, etc. Also includes unit tests
- New logic in `packages/core` needs Vitest tests. Tests must pass dates in explicitly, don't use the real clock
- Follow the naming, structure and comment style of nearby files. Prettier and ESLint are used for formatting.
- Interactive UI must work with the keyboard and a screen reader, with visible focus outlines.
- Always add new files in `supabase/migrations` (`pnpm supabase migration new <name>`). Do not edit one that has already merged. Every table needs row-level security policies, and new tables, policies and functions need tests in `supabase/tests` (pgTAP).
- **No secrets in code.** Keys belong in `.env.local`, which git ignores. Never prefix a secret with `NEXT_PUBLIC_`, since those values ship to the browser.

## Game data

Champions game data (species, moves, abilities, items, type chart, and each regulation's legal Pokémon, items and learnsets) lives in `packages/core/data`. It comes from [Pokémon Showdown](https://github.com/smogon/pokemon-showdown), whose own data and team validator resolve it.

| File                     | Edited by                                           |
| ------------------------ | --------------------------------------------------- |
| `generated/`             | `pnpm data:pull` only. Never edit it by hand.       |
| `showdown-sources.json`  | Hand: the Showdown commit and format per regulation |
| `overrides.json`         | Hand: corrections where Showdown is wrong           |
| `regulation-status.json` | Hand: `pending`, `partial` or `complete`            |

- **Something wrong in the data?** Add a correction to `overrides.json`, run `pnpm data:pull`, and link a source (an in-game screenshot or an official announcement) in the pull request. Consider reporting it to Showdown too.
- **Updating from Showdown:** bump the commit in `showdown-sources.json` and run `pnpm data:pull`. The first run builds Showdown (a few minutes; it's cached in `~/.cache/openteamsheets`). Review the diff in `generated/` like any other change.
- **The team validator** (`packages/core/src/teams/validate.ts`) follows Showdown's Champions rules. Its tests run every team in `src/teams/__fixtures__/validator` and expect the same verdict as Showdown's own validator, saved in `showdown-verdicts.json` by `pnpm data:pull`. To cover a new rule, add a team there and re-run `pnpm data:pull`.
- **A new regulation:** a regulation's rules usually only become known once it goes live. Add it to `showdown-sources.json` once Showdown supports it, and keep it `partial` in `regulation-status.json` until the data has been checked.
- **Loading it locally:** `pnpm data:sync` copies the data into your local database. It needs `apps/worker/.env`; see `.env.example`.

## License

Open Team Sheets is released under the [MIT License](LICENSE). By contributing, you agree that your contributions are licensed under it too. The name "Open Team Sheets" and its logo are not covered by the license.

## Questions

Open an issue, or email contact@openteamsheets.com.
