# Open Team Sheets

A free hub for finding, building and sharing Pokémon Champions VGC teams.

[openteamsheets.com](https://openteamsheets.com)

**IN PROGRESS**

## Core Features

- **Search teams** from official tournaments top cut teams and community published teams
- **Match your box.** Filter teams to only include Pokémon you own
- **Team Builder** with a built-in damage calculator
- **Community shared** teams with structured write-ups (what it does, how to play it, key calcs, matchups) and community notes to tournament teams

## Tech stack

- **pnpm monorepo** in TypeScript:
  - `apps/web`: Next.js (App Router), Tailwind, shadcn/ui and `cmdk`
  - `apps/worker`: a Hono or Fastify service for tournament imports and other long jobs
  - `packages/core`: shared types, parsing and the Champions data layer
- **Supabase** (Postgres) for the database and auth, including Google and Discord login
- **[`@pkmn/dex`](https://github.com/pkmn/ps) and `@pkmn/sets`** for Pokémon data and Showdown paste parsing
- **[`@smogon/calc`](https://github.com/smogon/damage-calc)** for damage calculations, run in the browser
- **Vercel** for hosting

## Running locally

Prerequisites:

- Node.js 22
- pnpm 10: `corepack enable`, or `npm install -g pnpm@10` if corepack needs admin rights
- Docker Desktop, for the local Supabase database

```sh
git clone https://github.com/AllenZheng-05/OpenTeamSheets.git
cd OpenTeamSheets
pnpm install
pnpm db:start   # local Supabase; prints the URL and keys
pnpm dev        # http://localhost:3000
```

Then copy `.env.example` to `apps/web/.env.local` and fill it in from `pnpm supabase status`. Contributors never need production keys: the local database is seeded with sample data.

The repo is a pnpm workspace:

| Folder          | What it is                                                  |
| --------------- | ----------------------------------------------------------- |
| `apps/web`      | The Next.js site                                            |
| `apps/worker`   | Background jobs such as tournament imports (`pnpm dev:all`) |
| `packages/core` | Shared types, parsing and Champions data                    |
| `supabase`      | Database config, migrations and seed data                   |

Before opening a pull request, run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`. CI runs the same checks, plus `pnpm format:check`.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) to get started, and follow the [Code of Conduct](CODE_OF_CONDUCT.md). Issues labeled `good first issue` are good places to begin. Writing an adapter for a new tournament data source is a self-contained first task.

## Security

Please don't report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md), or email security@openteamsheets.com.

## License

- **Code** is released under the [MIT License](LICENSE).
- **The name "Open Team Sheets" and its logo** are not covered by the MIT License. Forks may not present themselves as the original site.
- **Community write-ups and notes** published on the site are shared under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Tournament data** belongs to its sources. Each imported team links back to its original teamlist and standings.

## Disclaimer

Open Team Sheets is an unofficial fan project. It is not affiliated with or endorsed by Nintendo, Game Freak, Creatures, The Pokémon Company, RK9 Labs or Limitless. Pokémon and Pokémon character names are trademarks of their respective owners.
