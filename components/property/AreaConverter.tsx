"use client";

import { useMemo, useState } from "react";

type AreaUnit = "sqft" | "sqyard" | "sqmtr" | "gaj";

function fromSqFt(value: number, unit: AreaUnit) {
  if (unit === "sqft") return value;
  if (unit === "sqyard" || unit === "gaj") return value / 9;
  return value / 10.7639104167;
}

function formatValue(value: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.00$/, "");
}

export function AreaConverter({ value }: { value: string | number | null | undefined }) {
  const baseSqFt = Number(value ?? 0);
  const [unit, setUnit] = useState<AreaUnit>("sqft");

  const converted = useMemo(() => {
    if (!Number.isFinite(baseSqFt) || baseSqFt <= 0) return null;
    return fromSqFt(baseSqFt, unit);
  }, [baseSqFt, unit]);

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={unit}
          onChange={(event) => setUnit(event.target.value as AreaUnit)}
          className="field max-w-32"
          style={{ height: 40, paddingBlock: ".55rem" }}
        >
          <option value="sqft">sq.ft</option>
          <option value="sqyard">sq.yd</option>
          <option value="sqmtr">sq.m</option>
          <option value="gaj">gaj</option>
        </select>
      </div>

      <p className="mt-3 text-sm font-black text-slate-950">
        {converted ? `Carpet area: ${formatValue(converted)} ${unitLabel(unit)}` : "Area not available."}
      </p>
    </div>
  );
}

function unitLabel(unit: AreaUnit) {
  if (unit === "sqft") return "sq.ft";
  if (unit === "sqyard") return "sq.yd";
  if (unit === "sqmtr") return "sq.m";
  return "gaj";
}
