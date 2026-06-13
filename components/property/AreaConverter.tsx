"use client";

import { Ruler } from "lucide-react";
import { useMemo, useState } from "react";

type AreaUnit = "sqft" | "sqyard" | "sqmtr" | "gaj" | "acre" | "hectare" | "ground" | "kottah";

function fromSqFt(value: number, unit: AreaUnit) {
  if (unit === "sqft") return value;
  if (unit === "sqyard" || unit === "gaj") return value / 9;
  if (unit === "sqmtr") return value / 10.7639104167;
  if (unit === "acre") return value / 43560;
  if (unit === "hectare") return value / 107639.104167;
  if (unit === "ground") return value / 2400;
  return value / 720;
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
    <div className="h-full min-h-[128px] rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
          <Ruler className="h-4 w-4" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-500">Area</p>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">
              Built-up Area
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-[1.45rem] font-black leading-none text-slate-950">
              {converted ? formatValue(converted) : "--"}
            </span>
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value as AreaUnit)}
              aria-label="Select area unit"
              className="rounded-md border-0 bg-transparent p-0 pr-6 text-[1.45rem] font-black leading-none text-slate-950 outline-none"
            >
              <option value="sqft">Sq.Ft.</option>
              <option value="sqyard">Sq.yards</option>
              <option value="sqmtr">Sq.metre</option>
              <option value="gaj">Gaj</option>
              <option value="acre">Acres</option>
              <option value="hectare">Hectares</option>
              <option value="ground">Grounds</option>
              <option value="kottah">Kottah</option>
            </select>
          </div>

          <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
            {converted ? `Auto-converted from ${formatValue(baseSqFt)} sq.ft` : "Area not available."}
          </p>
        </div>
      </div>
    </div>
  );
}

function unitLabel(unit: AreaUnit) {
  if (unit === "sqft") return "sq.ft";
  if (unit === "sqyard") return "sq.yd";
  if (unit === "sqmtr") return "sq.m";
  if (unit === "gaj") return "gaj";
  if (unit === "acre") return "acres";
  if (unit === "hectare") return "hectares";
  if (unit === "ground") return "grounds";
  return "kottah";
}
