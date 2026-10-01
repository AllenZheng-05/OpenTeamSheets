import { connection } from "next/server";
import { getCurrentRegulation } from "@ots/core";
import { RegulationStatus } from "@/components/regulation-status";

export default async function Home() {
  // Render on each request, so the regulation is correct the moment it changes.
  await connection();

  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <p className="rounded-full border border-current/20 px-3 py-1 text-sm opacity-70">
          Coming soon · <RegulationStatus initial={getCurrentRegulation()} />
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Open Team Sheets
        </h1>
        <p className="max-w-xl text-lg opacity-80">
          A free hub for finding, building and sharing Pokémon Champions VGC
          teams. Search tournament and community teams, match them to your box,
          and tune them in a builder with a built-in damage calculator.
        </p>
        <a
          href="https://github.com/AllenZheng-05/OpenTeamSheets"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Follow along on GitHub
        </a>
      </main>
      <footer className="px-4 py-6 text-center text-xs opacity-60">
        Open Team Sheets is an unofficial fan project, not affiliated with or
        endorsed by Nintendo, Game Freak, Creatures or The Pokémon Company.
      </footer>
    </>
  );
}
