import type { StatId } from "@ots/core/game-data";
import { STAT_IDS, type FormView } from "@/lib/pokemon-details";

const LABELS: Record<StatId, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

/** Bars fill at this value; few base stats go higher. */
const BAR_MAX = 200;

/**
 * Base stats and their total, with a column for each form (before and after
 * Mega Evolving). The stat the nature raises is red and the one it lowers
 * is blue.
 */
export function BaseStats({
  forms,
  plus,
  minus,
}: {
  forms: FormView[];
  plus: StatId | null;
  minus: StatId | null;
}) {
  const color = (stat: StatId) =>
    stat === plus ? "text-red-600" : stat === minus ? "text-blue-600" : "";
  return (
    <table className="w-full table-fixed text-xs">
      <caption className="sr-only">Base stats</caption>
      {forms.length > 1 && (
        <thead>
          <tr className="text-neutral-500">
            <th className="w-10" />
            {forms.map((form, i) => (
              <th
                key={form.name}
                scope="col"
                className="truncate pb-1 text-left font-medium"
              >
                {i === 0 ? "Base" : "Mega"}
                <span className="sr-only">: {form.name}</span>
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {STAT_IDS.map((stat) => (
          <tr key={stat} className={color(stat)}>
            <th scope="row" className="w-10 py-0.5 text-left font-medium">
              {LABELS[stat]}
              {stat === plus && (
                <span className="sr-only"> (raised by nature)</span>
              )}
              {stat === minus && (
                <span className="sr-only"> (lowered by nature)</span>
              )}
            </th>
            {forms.map((form) => (
              <td key={form.name} className="py-0.5 pr-2">
                <span className="flex items-center gap-2">
                  <span className="w-7 text-right font-medium tabular-nums">
                    {form.stats[stat]}
                  </span>
                  <span
                    aria-hidden
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100"
                  >
                    <span
                      className={`block h-full rounded-full ${
                        stat === plus
                          ? "bg-red-400"
                          : stat === minus
                            ? "bg-blue-400"
                            : "bg-neutral-400"
                      }`}
                      style={{
                        width: `${Math.min(form.stats[stat] / BAR_MAX, 1) * 100}%`,
                      }}
                    />
                  </span>
                </span>
              </td>
            ))}
          </tr>
        ))}
        <tr className="border-t border-neutral-100">
          <th
            scope="row"
            className="pt-1 text-left font-medium text-neutral-500"
          >
            Total
          </th>
          {forms.map((form) => (
            <td key={form.name} className="pt-1">
              <span className="block w-7 text-right font-semibold tabular-nums">
                {form.total}
              </span>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
