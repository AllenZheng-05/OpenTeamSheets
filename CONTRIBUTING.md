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
pnpm dev        # http://localhost:3000
```

Copy `.env.example` to `apps/web/.env.local` and fill it in from `pnpm supabase status`. You never need production keys: the local database is seeded with sample data, and `pnpm db:reset` rebuilds it from scratch.

| Folder          | What it is                                 |
| --------------- | ------------------------------------------ |
| `apps/web`      | The Next.js site                           |
| `apps/worker`   | Background jobs such as tournament imports |
| `packages/core` | Shared types, parsing and Champions data   |
| `supabase`      | Database config, migrations and seed data  |

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
- Add a new file in `supabase/migrations` (`pnpm supabase migration new <name>`); never edit one that has already merged. Every table needs row-level security policies.
- **No secrets in code.** Keys belong in `.env.local`, which git ignores. Never prefix a secret with `NEXT_PUBLIC_`, since those values ship to the browser.

## Regulation data

A new regulation's rules usually only become known once it goes live, so its data is filled in by the community. When adding or correcting regulation data, link a source (an in-game screenshot or an official announcement) in the pull request.

## License

Open Team Sheets is released under the [MIT License](LICENSE). By contributing, you agree that your contributions are licensed under it too. The name "Open Team Sheets" and its logo are not covered by the license.

## Questions

Open an issue, or email contact@openteamsheets.com.
