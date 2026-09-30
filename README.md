# Open Team Sheets

A free hub for finding, building and sharing Pokémon Champions VGC teams.

[openteamsheets.com](https://openteamsheets.com)

**IN PROGRESS**

## Core Features

- **Search teams** from official tournaments and the community
- **Match your box.** Filter teams to only include Pokémon you own
- **Team Builder** with a built-in damage calculator
- **Community shared** teams with structured write-ups (what it does, how to play it, key calcs, matchups), or add community notes to tournament teams

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

**IN PROGRESS**

The planned setup:

Prerequisites: Node.js 22, pnpm (via `corepack enable`) and Docker Desktop (for the local Supabase database).

```sh
git clone https://github.com/AllenZheng-05/OpenTeamSheets.git
cd OpenTeamSheets
pnpm install
pnpm db:start   # local Supabase with migrations and sample teams
pnpm dev
```

Contributors never need production keys: the local database comes with a seed script that loads sample teams.

## Roadmap

1. Admin import tool, database schema and team pages, filled with top cut teams from official tournaments
2. Team search
3. Team builder with Showdown-style keyboard navigation
4. Damage calculator in-line integration into team builder
5. Accounts, My teams, publishing with write-ups, and community notes

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
