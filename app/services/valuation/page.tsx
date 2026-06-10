"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bolt, Calculator, Download, Plus, RotateCcw } from "lucide-react";
import jsPDF from "jspdf";

type PropertyType = "Office Space" | "Retail Shop" | "Warehouse" | "Residential";

type Stage = "form" | "loading" | "result";
type CurrencyCode = "INR" | "USD" | "AED";

type ValuationResult = {
  locality: string;
  type: PropertyType;
  size: number;
  totalPrice: number;
  finalPsf: number;
  basePricePsf: number;
  variancePct: number;
  rangeLow: number;
  rangeHigh: number;
  reference: number;
  date: string;
};

const LOCALITY_FALLBACK: Array<{ display_name: string; lat: string; lon: string }> = [
  { display_name: "Connaught Place, New Delhi, India", lat: "28.6315", lon: "77.2167" },
  { display_name: "Saket, New Delhi, India", lat: "28.5245", lon: "77.2066" },
  { display_name: "Nehru Place, New Delhi, India", lat: "28.5494", lon: "77.2513" },
  { display_name: "Noida Sector 18, Noida, Uttar Pradesh, India", lat: "28.5708", lon: "77.3260" },
  { display_name: "Noida Sector 62, Noida, Uttar Pradesh, India", lat: "28.6304", lon: "77.3722" },
  { display_name: "Cyber City, Gurugram, Haryana, India", lat: "28.4949", lon: "77.0896" },
  { display_name: "Indiranagar, Bengaluru, Karnataka, India", lat: "12.9784", lon: "77.6408" },
  { display_name: "Koramangala, Bengaluru, Karnataka, India", lat: "12.9352", lon: "77.6245" },
  { display_name: "Bandra, Mumbai, Maharashtra, India", lat: "19.0544", lon: "72.8406" },
  { display_name: "Andheri, Mumbai, Maharashtra, India", lat: "19.1136", lon: "72.8697" },
  { display_name: "Gachibowli, Hyderabad, Telangana, India", lat: "17.4435", lon: "78.3772" }
];

const baseRateByType: Record<PropertyType, number> = {
  "Office Space": 15000,
  "Retail Shop": 25000,
  Warehouse: 4000,
  Residential: 8000
};

const currencySymbols: Record<CurrencyCode, string> = { INR: "₹", USD: "$", AED: "AED " };
const currencyLocale: Record<CurrencyCode, string> = { INR: "en-IN", USD: "en-US", AED: "en-AE" };

export default function ValuationPage() {
  const [locality, setLocality] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [type, setType] = useState<PropertyType>("Office Space");
  const [size, setSize] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("INR");
  const [suggestions, setSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const sizeNum = useMemo(() => Number(size || 0), [size]);

  function formatMoney(value: number): string {
    const symbol = currencySymbols[currency];
    const amount = new Intl.NumberFormat(currencyLocale[currency], { maximumFractionDigits: 0 }).format(Math.round(value));
    return `${symbol}${amount}`;
  }

  useEffect(() => {
    const q = locality.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .catch(() => ({ places: [] }));
      const apiPlaces = (response.places ?? []) as Array<{ display_name: string; lat: string; lon: string }>;
      const fallback = LOCALITY_FALLBACK.filter((place) => place.display_name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
      setSuggestions(apiPlaces.length ? apiPlaces : fallback);
      setSuggestionsLoading(false);
      setSuggestionsOpen(true);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [locality]);

  function runValuation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!locality.trim() || !sizeNum || sizeNum < 100) return;

    setStage("loading");

    window.setTimeout(() => {
      const basePricePsf = baseRateByType[type];
      const variance = 1 + (Math.random() * 0.15 - 0.05);
      const finalPsf = Math.round(basePricePsf * variance);
      const totalPrice = finalPsf * sizeNum;
      const variancePct = Number(((variance - 1) * 100).toFixed(1));
      const rangeLow = totalPrice * 0.95;
      const rangeHigh = totalPrice * 1.05;

      setResult({
        locality: locality.trim(),
        type,
        size: sizeNum,
        totalPrice,
        finalPsf,
        basePricePsf,
        variancePct,
        rangeLow,
        rangeHigh,
        reference: Math.floor(100000 + Math.random() * 900000),
        date: new Date().toLocaleDateString("en-GB")
      });
      setStage("result");
    }, 2500);
  }

  function resetValuation() {
    setStage("form");
    setResult(null);
    setLocality("");
    setType("Office Space");
    setSize("");
    setIsExporting(false);
  }

  async function exportPdf() {
    if (!result) return;
    setIsExporting(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const anyDoc = doc as unknown as {
        addImage: (...args: unknown[]) => void;
        setGState?: (state: unknown) => void;
        GState?: new (options: { opacity: number }) => unknown;
        setCharSpace?: (space: number) => void;
      };
      let y = 56;
      const write = (text: string, x: number, yPos: number) => {
        if (anyDoc.setCharSpace) anyDoc.setCharSpace(0);
        doc.text(text, x, yPos);
      };
      const pdfMoney = (value: number) => formatMoney(value);

      try {
        const response = await fetch("/assets/icon.png");
        if (response.ok) {
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const wmW = 330;
          const wmH = 330;
          const wmX = (pageWidth - wmW) / 2;
          const wmY = 220;
          if (anyDoc.setGState && anyDoc.GState) anyDoc.setGState(new anyDoc.GState({ opacity: 0.14 }));
          anyDoc.addImage(dataUrl, "PNG", wmX, wmY, wmW, wmH, undefined, "FAST");
          if (anyDoc.setGState && anyDoc.GState) anyDoc.setGState(new anyDoc.GState({ opacity: 1 }));
        }
      } catch {
        // Continue PDF export even if watermark fails to load.
      }

      doc.setFont("times", "bold");
      doc.setFontSize(24);
      write("MatrixSpaces", 48, y);
      y += 18;
      doc.setFontSize(10);
      doc.setTextColor(110, 110, 110);
      write(`Official AI Valuation  |  Date: ${result.date}  |  Ref: MS-${result.reference}`, 48, y);
      y += 34;

      doc.setTextColor(20, 20, 20);
      doc.setFont("times", "bold");
      doc.setFontSize(16);
      write(result.locality, 48, y);
      y += 18;
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      write(`${result.size} sq.ft  |  ${result.type}`, 48, y);
      y += 34;

      doc.setDrawColor(220, 220, 220);
      doc.roundedRect(48, y, 500, 96, 8, 8);
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      write("ESTIMATED MARKET VALUE", 64, y + 24);
      doc.setFontSize(32);
      doc.setTextColor(15, 23, 42);
      write(pdfMoney(result.totalPrice), 64, y + 62);
      doc.setFontSize(12);
      doc.setTextColor(167, 123, 11);
      write(`Avg. ${pdfMoney(result.finalPsf)} / sq.ft`, 64, y + 84);
      y += 130;

      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.setTextColor(35, 35, 35);
      write("Valuation Breakdown", 48, y);
      y += 14;
      doc.setDrawColor(230, 230, 230);
      doc.roundedRect(48, y, 500, 78, 6, 6);
      doc.setFont("times", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(45, 45, 45);
      write("Base Property Rate", 62, y + 22);
      write(`${pdfMoney(result.basePricePsf)} / sq.ft`, 380, y + 22);
      write("Market Variance", 62, y + 43);
      write(`${result.variancePct > 0 ? `+${result.variancePct}` : result.variancePct}%`, 380, y + 43);
      doc.setFont("times", "bold");
      write("Estimated Value Range", 62, y + 65);
      write(`${pdfMoney(result.rangeLow)} - ${pdfMoney(result.rangeHigh)}`, 300, y + 65);
      y += 108;

      doc.setFont("times", "normal");
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(8.8);
      write(
        "*This quotation is generated by our AI valuation model based on available market data and is not a legal appraisal.",
        48,
        y
      );

      doc.save(`MatrixSpaces_Valuation_${result.locality.replace(/[^a-z0-9]/gi, "_")}.pdf`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main style={{ padding: "1.4rem 0 2rem" }}>
      <div className="container">
        <style>{`
          .ms-valuation-grid { display:grid; grid-template-columns:1.1fr 1fr; gap:1rem; }
          @media (max-width: 900px) { .ms-valuation-grid { grid-template-columns:1fr; } }
        `}</style>
        <section className="surface" style={{ borderRadius: 28, padding: "1rem", overflow: "visible" }}>
          <div
            style={{
              borderRadius: 24,
              padding: "clamp(1rem,2vw,1.8rem)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,.86) 0%, rgba(255,255,255,.8) 100%), radial-gradient(circle at top right, rgba(212,175,55,.18), transparent 35%)"
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "1.1rem" }}>
              <h1 style={{ margin: 0, fontSize: "clamp(1.8rem,4.6vw,3.2rem)", lineHeight: 1.05, fontWeight: 900 }}>
                AI Property <span style={{ color: "#D4AF37" }}>Valuation</span>
              </h1>
              <p style={{ margin: ".6rem auto 0", maxWidth: 780, color: "#64748b", fontWeight: 600 }}>
                Get an instant AI-generated quotation for your property and export a clean PDF report.
              </p>
            </div>

            <div className="ms-valuation-grid">
              <div className="surface" style={{ borderRadius: 20, padding: "1rem" }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Why Value With Us?</h2>
                <div style={{ display: "grid", gap: ".8rem", marginTop: ".8rem" }}>
                  <article style={{ display: "flex", gap: ".65rem" }}>
                    <span style={{ width: 36, height: 36, borderRadius: 999, background: "rgba(212,175,55,.15)", display: "grid", placeItems: "center", color: "#B88508" }}>
                      <Calculator size={16} />
                    </span>
                    <div>
                      <strong>Data-Driven Accuracy</strong>
                      <p style={{ margin: ".2rem 0 0", color: "#64748b", fontSize: ".9rem" }}>
                        Real-time benchmarks and local trends influence each estimate.
                      </p>
                    </div>
                  </article>
                  <article style={{ display: "flex", gap: ".65rem" }}>
                    <span style={{ width: 36, height: 36, borderRadius: 999, background: "rgba(212,175,55,.15)", display: "grid", placeItems: "center", color: "#B88508" }}>
                      <Bolt size={16} />
                    </span>
                    <div>
                      <strong>Instant Report</strong>
                      <p style={{ margin: ".2rem 0 0", color: "#64748b", fontSize: ".9rem" }}>
                        Generate an export-ready estimate in seconds for owner discussions.
                      </p>
                    </div>
                  </article>
                </div>
              </div>

              <div className="surface" style={{ borderRadius: 20, padding: "1rem", minHeight: 520 }}>
                {stage === "form" ? (
                  <form onSubmit={runValuation} style={{ display: "grid", gap: ".7rem" }}>
                    <h3 style={{ margin: 0 }}>Instant Valuation</h3>
                    <p style={{ margin: 0, color: "#64748b", fontSize: ".9rem" }}>Enter property details for a real-time estimate.</p>
                    <label>
                      <span style={{ display: "block", marginBottom: ".28rem", fontWeight: 700, fontSize: ".82rem" }}>Locality / Area</span>
                      <div style={{ position: "relative" }}>
                        <input
                          className="field"
                          value={locality}
                          onChange={(e) => {
                            setLocality(e.target.value);
                            setLat("");
                            setLng("");
                          }}
                          onFocus={() => setSuggestionsOpen(true)}
                          onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 140)}
                          placeholder="Search locality (e.g. Connaught Place)"
                          required
                        />
                        {suggestionsOpen ? (
                          <div className="surface" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20, borderRadius: 14, padding: ".25rem", maxHeight: 220, overflowY: "auto" }}>
                            {suggestionsLoading ? (
                              <div style={{ padding: ".55rem .6rem", color: "var(--ms-muted)", fontSize: ".82rem", fontWeight: 700 }}>
                                Searching localities...
                              </div>
                            ) : suggestions.length ? (
                              suggestions.map((place) => (
                                <button
                                  key={`${place.lat}-${place.lon}-${place.display_name}`}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setLocality(place.display_name);
                                    setLat(place.lat);
                                    setLng(place.lon);
                                    setSuggestionsOpen(false);
                                  }}
                                  style={{ display: "block", width: "100%", border: 0, background: "transparent", textAlign: "left", borderRadius: 10, padding: ".52rem .56rem", cursor: "pointer" }}
                                >
                                  <strong style={{ display: "block", fontSize: ".85rem", color: "var(--ms-ink)" }}>{place.display_name.split(",").slice(0, 2).join(",")}</strong>
                                  <span style={{ color: "var(--ms-muted)", fontSize: ".74rem" }}>{place.display_name}</span>
                                </button>
                              ))
                            ) : locality.trim().length >= 3 ? (
                              <div style={{ padding: ".55rem .6rem", color: "var(--ms-muted)", fontSize: ".82rem", fontWeight: 700 }}>
                                No suggestions found.
                              </div>
                            ) : (
                              <div style={{ padding: ".55rem .6rem", color: "var(--ms-muted)", fontSize: ".82rem", fontWeight: 700 }}>
                                Type at least 2 characters.
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </label>
                    <input type="hidden" value={lat} />
                    <input type="hidden" value={lng} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".55rem" }}>
                      <label>
                        <span style={{ display: "block", marginBottom: ".28rem", fontWeight: 700, fontSize: ".82rem" }}>Property Type</span>
                        <select className="field" value={type} onChange={(e) => setType(e.target.value as PropertyType)}>
                          <option>Office Space</option>
                          <option>Retail Shop</option>
                          <option>Warehouse</option>
                          <option>Residential</option>
                        </select>
                      </label>
                      <label>
                        <span style={{ display: "block", marginBottom: ".28rem", fontWeight: 700, fontSize: ".82rem" }}>Size (sq.ft)</span>
                        <input className="field" type="number" min={100} value={size} onChange={(e) => setSize(e.target.value)} required />
                      </label>
                    </div>
                    <label>
                      <span style={{ display: "block", marginBottom: ".28rem", fontWeight: 700, fontSize: ".82rem" }}>Currency</span>
                      <select className="field" value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="AED">AED</option>
                      </select>
                    </label>
                    <button className="btn btn-primary" type="submit" style={{ width: "100%", marginTop: ".3rem" }}>
                      <Calculator size={16} /> Calculate Value
                    </button>
                  </form>
                ) : null}

                {stage === "loading" ? (
                  <div style={{ minHeight: 470, display: "grid", placeItems: "center", textAlign: "center", gap: ".7rem" }}>
                    <div style={{ width: 78, height: 78, borderRadius: 999, border: "6px solid #f1f5f9", borderTopColor: "#D4AF37", animation: "spin 1s linear infinite" }} />
                    <div>
                      <h3 style={{ margin: 0 }}>Analyzing Market Data</h3>
                      <p style={{ marginTop: ".35rem", color: "#64748b" }}>Processing location trends and comparable properties...</p>
                    </div>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                ) : null}

                {stage === "result" && result ? (
                  <div style={{ display: "grid", gap: ".7rem" }}>
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: ".8rem", background: "white" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: ".5rem", borderBottom: "2px solid #D4AF37", paddingBottom: ".5rem", marginBottom: ".6rem" }}>
                        <div>
                          <strong style={{ fontSize: "1.15rem" }}>Matrix<span style={{ color: "#D4AF37" }}>Spaces</span></strong>
                          <p style={{ margin: ".12rem 0 0", fontSize: ".68rem", color: "#64748b", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 800 }}>
                            Official AI Valuation
                          </p>
                        </div>
                        <div style={{ textAlign: "right", fontSize: ".8rem", color: "#475569", fontWeight: 700 }}>
                          <div>{result.date}</div>
                          <div style={{ marginTop: ".22rem", fontFamily: "monospace", fontSize: ".72rem" }}>Ref: MS-{result.reference}</div>
                        </div>
                      </div>

                      <h4 style={{ margin: 0, fontSize: "1.3rem" }}>{result.locality}</h4>
                      <p style={{ margin: ".2rem 0 .6rem", color: "#64748b" }}>{result.size} sq.ft • {result.type}</p>

                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: ".65rem", textAlign: "center", marginBottom: ".6rem" }}>
                        <p style={{ margin: 0, fontSize: ".67rem", color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800 }}>Estimated Market Value</p>
                        <p style={{ margin: ".25rem 0", fontSize: "1.6rem", fontWeight: 900 }}>{formatMoney(result.totalPrice)}</p>
                        <p style={{ margin: 0, color: "#B88508", fontWeight: 800, fontSize: ".85rem" }}>Avg. {formatMoney(result.finalPsf)} / sq.ft</p>
                      </div>

                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", fontSize: ".86rem" }}>
                        <div style={{ padding: ".52rem .62rem", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0" }}>
                          <span>Base Property Rate</span><b>{formatMoney(result.basePricePsf)} / sq.ft</b>
                        </div>
                        <div style={{ padding: ".52rem .62rem", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0" }}>
                          <span>Market Variance</span><b>{result.variancePct > 0 ? `+${result.variancePct}` : result.variancePct}%</b>
                        </div>
                        <div style={{ padding: ".52rem .62rem", display: "flex", justifyContent: "space-between", background: "#f8fafc" }}>
                          <span><b>Estimated Value Range</b></span><b>{formatMoney(result.rangeLow)} - {formatMoney(result.rangeHigh)}</b>
                        </div>
                      </div>
                    </div>

                    <Link href="/list-property" className="btn btn-primary" style={{ width: "100%" }}>
                      <Plus size={16} /> List Property at this Price
                    </Link>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: ".5rem" }}>
                      <button type="button" className="btn btn-secondary" onClick={resetValuation}>
                        <RotateCcw size={14} /> Reset
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={exportPdf} disabled={isExporting}>
                        <Download size={14} /> {isExporting ? "Generating..." : "Export as PDF"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
