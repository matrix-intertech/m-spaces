"use client";

import { useEffect, useMemo, useState } from "react";
import { backendBaseUrl } from "@/lib/config";
import { getClientCsrfToken } from "@/lib/csrf-client";

type DashboardRecord = Record<string, unknown>;

type ColumnDef = {
  key: string;
  label: string;
  read: (item: DashboardRecord) => string;
};

const ADMIN_SEARCH_PLACEHOLDER = "Search systems, users, or properties...";
const ADMIN_TOOLBAR_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "680px 236px",
  gap: ".7rem",
  alignItems: "center",
  minHeight: 52,
  justifyContent: "space-between"
};
const ADMIN_SEARCH_GROUP_STYLE: React.CSSProperties = {
  display: "flex",
  gap: ".7rem",
  flexWrap: "nowrap",
  alignItems: "center",
  width: 680
};
const ADMIN_SEARCH_INPUT_STYLE: React.CSSProperties = {
  width: 460,
  flex: "0 0 460px",
  minHeight: 46,
  borderRadius: 18
};
const ADMIN_FILTER_SELECT_STYLE: React.CSSProperties = {
  width: 220,
  flex: "0 0 220px",
  minHeight: 46,
  borderRadius: 18
};
const ADMIN_ACTION_GROUP_STYLE: React.CSSProperties = {
  display: "flex",
  gap: ".4rem",
  flexWrap: "nowrap",
  alignItems: "center",
  width: 236,
  justifyContent: "flex-end"
};
const ADMIN_PAGE_SIZE = 25;

function humanize(key: string): string {
  if (key === "id") return "User ID";
  return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readValue(record: DashboardRecord, key: string): string {
  const value = record[key];
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} items` : "Available";
  return String(value);
}

function csvCell(text: string): string {
  return `"${String(text).replace(/"/g, '""')}"`;
}

function parseComparable(value: string): { rank: number; n: number | string } {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return { rank: 3, n: "" };

  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) return { rank: 0, n: date.getTime() };

  const numeric = Number(trimmed.replace(/[^0-9.-]+/g, ""));
  if (Number.isFinite(numeric) && /[0-9]/.test(trimmed)) return { rank: 1, n: numeric };

  return { rank: 2, n: trimmed.toLowerCase() };
}

function compareText(a: string, b: string): number {
  const pa = parseComparable(a);
  const pb = parseComparable(b);
  if (pa.rank !== pb.rank) return pa.rank - pb.rank;
  if (typeof pa.n === "number" && typeof pb.n === "number") return pa.n - pb.n;
  return String(pa.n).localeCompare(String(pb.n), undefined, { numeric: true, sensitivity: "base" });
}

function adminSortParam(sort: { key: string; dir: "asc" | "desc" }) {
  if (sort.key === "title") return `title_${sort.dir}`;
  if (sort.key === "owner_name") return `owner_${sort.dir}`;
  if (sort.key === "final_price") return `price_${sort.dir}`;
  if (sort.key === "status") return `status_${sort.dir}`;
  if (sort.key === "created_at") return `created_at_${sort.dir}`;
  if (sort.key === "verification_status") return `verification_${sort.dir}`;
  if (sort.key === "type") return `type_${sort.dir}`;
  if (sort.key === "listing_type") return `listing_type_${sort.dir}`;
  return undefined;
}

export function AdminDataTable({
  sectionKey,
  title,
  items,
  fields
}: {
  sectionKey: string;
  title: string;
  items: DashboardRecord[];
  fields: string[];
}) {
  const [query, setQuery] = useState("");
  const [filterField, setFilterField] = useState<"all" | string>("all");
  const [activeSort, setActiveSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "created_at", dir: "desc" });
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [columnFilterSearch, setColumnFilterSearch] = useState<Record<string, string>>({});
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [serverRows, setServerRows] = useState<DashboardRecord[]>(items);
  const [serverPagination, setServerPagination] = useState({ total: items.length, page: 1, totalPages: 1, limit: ADMIN_PAGE_SIZE });
  const [serverLoading, setServerLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  const isServerBacked = sectionKey === "active";

  useEffect(() => {
    void getClientCsrfToken().then(setCsrfToken).catch(() => {});
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [sectionKey, query, filterField, activeSort.key, activeSort.dir]);

  useEffect(() => {
    if (!isServerBacked) {
      setServerRows(items);
      setServerPagination({ total: items.length, page: 1, totalPages: 1, limit: ADMIN_PAGE_SIZE });
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      ajax_active_listings: "1",
      page: String(currentPage),
      limit: String(ADMIN_PAGE_SIZE)
    });
    const trimmedQuery = query.trim();
    if (trimmedQuery) params.set("search", trimmedQuery);
    const sortParam = adminSortParam(activeSort);
    if (sortParam) params.set("sort", sortParam);

    setServerLoading(true);
    void fetch(`${backendBaseUrl}/admin?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load admin listings");
        return response.json() as Promise<{
          active?: DashboardRecord[];
          pagination?: { total?: number; page?: number; totalPages?: number; limit?: number };
        }>;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setServerRows(payload.active ?? []);
        setServerPagination({
          total: Number(payload.pagination?.total ?? payload.active?.length ?? 0),
          page: Number(payload.pagination?.page ?? currentPage),
          totalPages: Number(payload.pagination?.totalPages ?? 1),
          limit: Number(payload.pagination?.limit ?? ADMIN_PAGE_SIZE)
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setServerRows(items);
        setServerPagination({ total: items.length, page: 1, totalPages: 1, limit: ADMIN_PAGE_SIZE });
      })
      .finally(() => {
        if (!controller.signal.aborted) setServerLoading(false);
      });

    return () => controller.abort();
  }, [isServerBacked, items, query, activeSort, currentPage, sectionKey]);

  const columns = useMemo<ColumnDef[]>(() => {
    if (sectionKey === "active") {
      return [
        { key: "created_at", label: "Date/Time", read: (item) => String(item.listed_at ?? item.created_at ?? "") },
        { key: "title", label: "Property", read: (item) => `${readValue(item, "id")} ${readValue(item, "title")} ${readValue(item, "locality")}` },
        { key: "owner_name", label: "Listed By", read: (item) => readValue(item, "owner_name") },
        { key: "type", label: "Type", read: (item) => readValue(item, "type") },
        { key: "listing_type", label: "Listing", read: (item) => readValue(item, "listing_type") },
        { key: "final_price", label: "Price", read: (item) => readValue(item, "final_price") },
        { key: "verification_status", label: "Verification", read: (item) => readValue(item, "verification_status") }
      ];
    }

    return fields.map((field) => ({ key: field, label: humanize(field), read: (item) => readValue(item, field) }));
  }, [sectionKey, fields]);

  const sourceItems = isServerBacked ? serverRows : items;

  const columnFilterOptions = useMemo(() => {
    const result: Record<string, string[]> = {};
    columns.forEach((column) => {
      const values = Array.from(new Set(sourceItems.map((item) => column.read(item)).filter((v) => v && v !== "-")));
      result[column.key] = values.sort((a, b) => a.localeCompare(b)).slice(0, 200);
    });
    return result;
  }, [columns, sourceItems]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = !q
      ? sourceItems
      : sourceItems.filter((item) => {
          if (filterField !== "all") return readValue(item, filterField).toLowerCase().includes(q);
          return fields.some((field) => readValue(item, field).toLowerCase().includes(q));
        });

    return searched.filter((item) =>
      columns.every((column) => {
        const selected = columnFilters[column.key] ?? [];
        if (!selected.length) return true;
        const value = column.read(item).trim().toLowerCase();
        return selected.some((option) => option.trim().toLowerCase() === value);
      })
    );
  }, [sourceItems, fields, query, filterField, columns, columnFilters]);

  const sortedItems = useMemo(() => {
    const sortColumn = columns.find((column) => column.key === activeSort.key);
    if (!sortColumn) return filteredItems;

    const next = [...filteredItems];
    next.sort((a, b) => {
      const cmp = compareText(sortColumn.read(a), sortColumn.read(b));
      return activeSort.dir === "asc" ? cmp : -cmp;
    });
    return next;
  }, [filteredItems, activeSort, columns]);

  const pageCount = isServerBacked ? Math.max(1, serverPagination.totalPages || 1) : Math.max(1, Math.ceil(sortedItems.length / ADMIN_PAGE_SIZE));
  const displayRows = isServerBacked
    ? sortedItems
    : sortedItems.slice((currentPage - 1) * ADMIN_PAGE_SIZE, currentPage * ADMIN_PAGE_SIZE);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  async function resolveExportRows() {
    if (!isServerBacked) return sortedItems;

    const params = new URLSearchParams({
      ajax_active_listings: "1",
      page: "1",
      limit: "1000"
    });
    const trimmedQuery = query.trim();
    if (trimmedQuery) params.set("search", trimmedQuery);
    const sortParam = adminSortParam(activeSort);
    if (sortParam) params.set("sort", sortParam);

    const response = await fetch(`${backendBaseUrl}/admin?${params.toString()}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error("Could not export active listings");
    }
    const payload = (await response.json()) as { active?: DashboardRecord[] };
    const exportItems = payload.active ?? [];
    return exportItems.filter((item) =>
      columns.every((column) => {
        const selected = columnFilters[column.key] ?? [];
        if (!selected.length) return true;
        const value = column.read(item).trim().toLowerCase();
        return selected.some((option) => option.trim().toLowerCase() === value);
      })
    );
  }

  const exportCsv = async () => {
    const rowsToExport = await resolveExportRows();
    const header = ["S.No.", ...fields.map(humanize)];
    const rows = rowsToExport.map((item, index) => [String(index + 1), ...fields.map((field) => readValue(item, field))]);
    const csv = [header.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sectionKey}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    const rowsToExport = await resolveExportRows();
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const autoTable = autoTableModule.default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(12);
    doc.text(title, 40, 36);
    autoTable(doc, {
      startY: 52,
      head: [["S.No.", ...fields.map(humanize)]],
      body: rowsToExport.map((item, index) => [String(index + 1), ...fields.map((field) => readValue(item, field))]),
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [15, 23, 42] }
    });
    doc.save(`${sectionKey}.pdf`);
  };

  const formatInr = (value: unknown): string => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return `Rs ${n.toLocaleString("en-IN")}`;
  };

  const formatDate = (value: unknown): string => {
    if (!value) return "-";
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("en-IN");
  };

  const activeSortHeader = (label: string, key: string) => (
    <button
      type="button"
      onClick={() => setActiveSort((prev) => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }))}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, color: "inherit" }}
    >
      {label}
      <span style={{ opacity: activeSort.key === key ? 1 : 0.45 }}>{activeSort.key === key ? (activeSort.dir === "asc" ? "^" : "v") : "<>"}</span>
    </button>
  );

  const renderFilterDropdown = (key: string, label: string) => {
    const options = columnFilterOptions[key] ?? [];
    const selected = columnFilters[key] ?? [];
    const search = (columnFilterSearch[key] ?? "").trim().toLowerCase();
    const visibleOptions = search ? options.filter((option) => option.toLowerCase().includes(search)) : options;
    const isOpen = openFilterKey === key;
    return (
      <div key={`filter-${key}`} style={{ position: "relative" }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpenFilterKey((prev) => (prev === key ? null : key))}
          style={{ minHeight: 34, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {label}
          {selected.length ? ` (${selected.length})` : ""}
        </button>
        {isOpen ? (
          <div
            style={{
              position: "absolute",
              zIndex: 200,
              top: "calc(100% + 6px)",
              left: 0,
              width: 320,
              maxHeight: 320,
              overflow: "auto",
              border: "1px solid var(--ms-line)",
              borderRadius: 8,
              background: "#fff",
              boxShadow: "0 12px 30px rgba(15,23,42,.12)",
              padding: ".6rem"
            }}
          >
            <input
              className="field"
              placeholder={`Type to search ${label}`}
              value={columnFilterSearch[key] ?? ""}
              onChange={(event) => setColumnFilterSearch((prev) => ({ ...prev, [key]: event.target.value }))}
              style={{ minHeight: 34, width: "100%", marginBottom: ".45rem" }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setColumnFilters((prev) => ({ ...prev, [key]: [] }))}
              style={{ width: "100%", minHeight: 30, marginBottom: ".45rem" }}
            >
              Clear Selection
            </button>
            <div style={{ display: "grid", gap: ".35rem" }}>
              {visibleOptions.length ? (
                visibleOptions.map((option) => {
                  const checked = selected.includes(option);
                  return (
                    <label key={`${key}-${option}`} style={{ display: "flex", alignItems: "center", gap: ".5rem", fontSize: ".85rem" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setColumnFilters((prev) => {
                            const current = prev[key] ?? [];
                            if (event.target.checked) return { ...prev, [key]: [...current, option] };
                            return { ...prev, [key]: current.filter((item) => item !== option) };
                          })
                        }
                      />
                      <span>{option}</span>
                    </label>
                  );
                })
              ) : (
                <span style={{ fontSize: ".82rem", color: "var(--ms-muted)" }}>No options found</span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderFiltersPanel = (filterKeys: string[]) => (
    <div style={{ position: "relative", zIndex: 20, overflow: "visible", border: "1px solid var(--ms-line)", borderRadius: 8, padding: ".6rem", background: "rgba(15,23,42,.02)" }}>
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
        {filterKeys.map((key) => renderFilterDropdown(key, humanize(key)))}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setColumnFilters({})}
          style={{ minHeight: 34 }}
        >
          Clear All Filters
        </button>
      </div>
    </div>
  );

  const renderPagination = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".75rem", flexWrap: "wrap" }}>
      <span style={{ fontSize: ".82rem", color: "var(--ms-muted)", fontWeight: 700 }}>
        {isServerBacked ? `Showing page ${serverPagination.page} of ${pageCount}` : `Showing ${displayRows.length} of ${sortedItems.length} rows`}
        {serverLoading ? " • Refreshing…" : ""}
      </span>
      <div style={{ display: "flex", gap: ".45rem" }}>
        <button type="button" className="btn btn-secondary" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1 || serverLoading}>
          Previous
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage >= pageCount || serverLoading}>
          Next
        </button>
      </div>
    </div>
  );

  if (sectionKey === "active") {
    return (
      <div style={{ display: "grid", gap: ".7rem" }}>
        <div style={ADMIN_TOOLBAR_STYLE}>
          <div style={ADMIN_SEARCH_GROUP_STYLE}>
            <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ADMIN_SEARCH_PLACEHOLDER} style={ADMIN_SEARCH_INPUT_STYLE} />
            <select className="field" value={filterField} onChange={(event) => setFilterField(event.target.value)} style={ADMIN_FILTER_SELECT_STYLE}>
              <option value="all">All fields</option>
              {fields.map((field) => (
                <option key={field} value={field}>{humanize(field)}</option>
              ))}
            </select>
          </div>
          <div style={ADMIN_ACTION_GROUP_STYLE}>
            <button type="button" className="btn btn-secondary" onClick={() => void exportCsv()}>Export CSV</button>
            <button type="button" className="btn btn-secondary" onClick={() => void exportPdf()}>Export PDF</button>
          </div>
        </div>
        {renderFiltersPanel(["created_at", "title", "owner_name", "type", "listing_type", "final_price", "verification_status"])}
        {renderPagination()}

        <div style={{ position: "relative", zIndex: 1, overflowX: "auto", border: "1px solid var(--ms-line)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
            <thead style={{ background: "rgba(15,23,42,.05)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>S.No.</th>
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{activeSortHeader("Date/Time", "created_at")}</th>
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{activeSortHeader("Property", "title")}</th>
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{activeSortHeader("Listed By", "owner_name")}</th>
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{activeSortHeader("Type", "type")}</th>
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{activeSortHeader("Listing", "listing_type")}</th>
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{activeSortHeader("Price", "final_price")}</th>
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{activeSortHeader("Verification", "verification_status")}</th>
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length ? displayRows.map((item, index) => {
                const id = Number(item.id);
                const safeId = Number.isFinite(id) ? id : null;
                return (
                  <tr key={String(item.id ?? `active-${index}`)}>
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{(currentPage - 1) * ADMIN_PAGE_SIZE + index + 1}</td>
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{formatDate(item.listed_at ?? item.created_at)}</td>
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}><div style={{ display: "grid", gap: 2 }}><strong>{`#${readValue(item, "id")} - ${readValue(item, "title")}`}</strong><span style={{ color: "var(--ms-muted)", fontSize: ".85rem" }}>{readValue(item, "locality")}</span></div></td>
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{readValue(item, "owner_name")}</td>
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{readValue(item, "type")}</td>
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{String(readValue(item, "listing_type")).toUpperCase()}</td>
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{formatInr(item.final_price)}</td>
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{safeId ? <form action={`${backendBaseUrl}/admin/property/${safeId}/verify-status`} method="POST"><input type="hidden" name="_csrf" value={csrfToken} /><select className="field" name="verification_status" defaultValue={readValue(item, "verification_status")} style={{ minWidth: 168 }}><option value="Unverified">Unverified</option><option value="Under Review">Under Review</option><option value="Verified">Verified</option><option value="Premium Verified">Premium Verified</option><option value="Rejected">Rejected</option></select><button type="submit" className="btn btn-secondary" style={{ marginTop: 6, width: "100%" }}>Update</button></form> : "-"}</td>
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}><div style={{ display: "grid", gap: 6, minWidth: 170 }}>{safeId ? <a href={`/property/${safeId}`} className="btn btn-secondary" style={{ textAlign: "center" }}>View Details</a> : null}{safeId ? <form action={`${backendBaseUrl}/property/delete`} method="POST" onSubmit={(e) => (!window.confirm("Delete this property permanently?") ? e.preventDefault() : undefined)}><input type="hidden" name="id" value={String(safeId)} /><input type="hidden" name="_csrf" value={csrfToken} /><button type="submit" className="btn btn-secondary" style={{ width: "100%", borderColor: "#fecaca", color: "#dc2626" }}>Delete</button></form> : null}{safeId ? <a href={`/admin?tab=sales&property_id=${safeId}`} className="btn btn-primary" style={{ textAlign: "center" }}>Schedule Visit</a> : null}</div></td>
                  </tr>
                );
              }) : <tr><td colSpan={9} style={{ padding: "1rem", textAlign: "center", color: "var(--ms-muted)" }}>No matching records</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (sectionKey === "partnerManagement") {
    return (
      <div style={{ display: "grid", gap: ".7rem" }}>
        <div style={ADMIN_TOOLBAR_STYLE}>
          <div style={ADMIN_SEARCH_GROUP_STYLE}>
            <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ADMIN_SEARCH_PLACEHOLDER} style={ADMIN_SEARCH_INPUT_STYLE} />
            <select className="field" value={filterField} onChange={(event) => setFilterField(event.target.value)} style={ADMIN_FILTER_SELECT_STYLE}><option value="all">All fields</option>{fields.map((field) => <option key={field} value={field}>{humanize(field)}</option>)}</select>
          </div>
          <div style={ADMIN_ACTION_GROUP_STYLE}><button type="button" className="btn btn-secondary" onClick={() => void exportCsv()}>Export CSV</button><button type="button" className="btn btn-secondary" onClick={() => void exportPdf()}>Export PDF</button></div>
        </div>
        {renderFiltersPanel(fields)}
        {renderPagination()}

        <div style={{ position: "relative", zIndex: 1, overflowX: "auto", border: "1px solid var(--ms-line)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
            <thead style={{ background: "rgba(15,23,42,.05)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>S.No.</th>
                {fields.map((field) => <th key={field} style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{activeSortHeader(humanize(field), field)}</th>)}
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length ? displayRows.map((item, index) => {
                const id = Number(item.id);
                const safeId = Number.isFinite(id) ? id : null;
                const currentRole = readValue(item, "role");
                const isActiveRaw = String(item.is_active ?? "").toLowerCase();
                const nextActive = isActiveRaw === "true" || isActiveRaw === "1" ? "false" : "true";
                return (
                  <tr key={String(item.id ?? `partner-${index}`)}>
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{(currentPage - 1) * ADMIN_PAGE_SIZE + index + 1}</td>
                    {fields.map((field) => <td key={field} style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{readValue(item, field)}</td>)}
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{safeId ? <div style={{ display: "grid", gap: 6, minWidth: 210 }}><form action={`${backendBaseUrl}/admin/user/update-role`} method="POST" style={{ display: "grid", gap: 6 }}><input type="hidden" name="id" value={String(safeId)} /><input type="hidden" name="_csrf" value={csrfToken} /><select className="field" name="role" defaultValue={currentRole} style={{ minHeight: 34 }}><option value="owner">Owner</option><option value="builder">Builder</option><option value="broker">Broker</option><option value="corporate">Corporate</option><option value="external_sales">External Sales</option><option value="support">Support</option><option value="admin">Admin</option></select><button type="submit" className="btn btn-secondary" style={{ minHeight: 34 }}>Update Role</button></form><form action={`${backendBaseUrl}/admin/user/toggle-status`} method="POST" style={{ display: "grid", gap: 6 }}><input type="hidden" name="id" value={String(safeId)} /><input type="hidden" name="is_active" value={nextActive} /><input type="hidden" name="_csrf" value={csrfToken} /><button type="submit" className="btn btn-secondary" style={{ minHeight: 34 }}>{nextActive === "true" ? "Enable" : "Disable"}</button></form><form action={`${backendBaseUrl}/admin/user/delete`} method="POST" onSubmit={(e) => (!window.confirm("Delete this partner user permanently?") ? e.preventDefault() : undefined)}><input type="hidden" name="id" value={String(safeId)} /><input type="hidden" name="_csrf" value={csrfToken} /><button type="submit" className="btn btn-secondary" style={{ width: "100%", minHeight: 34, borderColor: "#fecaca", color: "#dc2626" }}>Delete User</button></form></div> : "-"}</td>
                  </tr>
                );
              }) : <tr><td colSpan={fields.length + 2} style={{ padding: "1rem", textAlign: "center", color: "var(--ms-muted)" }}>No matching records</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (sectionKey === "propertyManagementRequests") {
    return (
      <div style={{ display: "grid", gap: ".7rem" }}>
        <div style={ADMIN_TOOLBAR_STYLE}>
          <div style={ADMIN_SEARCH_GROUP_STYLE}>
            <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ADMIN_SEARCH_PLACEHOLDER} style={ADMIN_SEARCH_INPUT_STYLE} />
            <select className="field" value={filterField} onChange={(event) => setFilterField(event.target.value)} style={ADMIN_FILTER_SELECT_STYLE}><option value="all">All fields</option>{fields.map((field) => <option key={field} value={field}>{humanize(field)}</option>)}</select>
          </div>
          <div style={ADMIN_ACTION_GROUP_STYLE}><button type="button" className="btn btn-secondary" onClick={() => void exportCsv()}>Export CSV</button><button type="button" className="btn btn-secondary" onClick={() => void exportPdf()}>Export PDF</button></div>
        </div>
        {renderFiltersPanel(fields)}
        {renderPagination()}

        <div style={{ position: "relative", zIndex: 1, overflowX: "auto", border: "1px solid var(--ms-line)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
            <thead style={{ background: "rgba(15,23,42,.05)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>S.No.</th>
                {fields.map((field) => <th key={field} style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{activeSortHeader(humanize(field), field)}</th>)}
                <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length ? displayRows.map((item, index) => {
                const requestId = Number(item.id);
                const isPending = readValue(item, "status").toLowerCase() === "pending";
                return (
                  <tr key={String(item.id ?? `request-${index}`)}>
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{(currentPage - 1) * ADMIN_PAGE_SIZE + index + 1}</td>
                    {fields.map((field) => <td key={field} style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{readValue(item, field)}</td>)}
                    <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>
                      {Number.isFinite(requestId) && isPending ? (
                        <div style={{ display: "flex", gap: ".4rem", minWidth: 180 }}>
                          <form action={`${backendBaseUrl}/external-sales/management-request/respond`} method="POST">
                            <input type="hidden" name="request_id" value={String(requestId)} />
                            <input type="hidden" name="status" value="accepted" />
                            <input type="hidden" name="_csrf" value={csrfToken} />
                            <button type="submit" className="btn btn-primary" style={{ minHeight: 34 }}>Accept</button>
                          </form>
                          <form action={`${backendBaseUrl}/external-sales/management-request/respond`} method="POST">
                            <input type="hidden" name="request_id" value={String(requestId)} />
                            <input type="hidden" name="status" value="rejected" />
                            <input type="hidden" name="_csrf" value={csrfToken} />
                            <button type="submit" className="btn btn-secondary" style={{ minHeight: 34 }}>Reject</button>
                          </form>
                        </div>
                      ) : (
                        <span style={{ color: "var(--ms-muted)", fontWeight: 700 }}>No action</span>
                      )}
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={fields.length + 2} style={{ padding: "1rem", textAlign: "center", color: "var(--ms-muted)" }}>No matching records</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: ".7rem" }}>
      <div style={ADMIN_TOOLBAR_STYLE}>
        <div style={ADMIN_SEARCH_GROUP_STYLE}>
          <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ADMIN_SEARCH_PLACEHOLDER} style={ADMIN_SEARCH_INPUT_STYLE} />
          <select className="field" value={filterField} onChange={(event) => setFilterField(event.target.value)} style={ADMIN_FILTER_SELECT_STYLE}><option value="all">All fields</option>{fields.map((field) => <option key={field} value={field}>{humanize(field)}</option>)}</select>
        </div>
        <div style={ADMIN_ACTION_GROUP_STYLE}><button type="button" className="btn btn-secondary" onClick={() => void exportCsv()}>Export CSV</button><button type="button" className="btn btn-secondary" onClick={() => void exportPdf()}>Export PDF</button></div>
      </div>
      {renderFiltersPanel(fields)}
      {renderPagination()}

      <div style={{ position: "relative", zIndex: 1, overflowX: "auto", border: "1px solid var(--ms-line)", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
          <thead style={{ background: "rgba(15,23,42,.05)" }}>
            <tr>
              <th style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>S.No.</th>
              {fields.map((field) => <th key={field} style={{ textAlign: "left", padding: ".65rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{activeSortHeader(humanize(field), field)}</th>)}
            </tr>
          </thead>
          <tbody>
            {displayRows.length ? displayRows.map((item, index) => (
              <tr key={String(item.id ?? `${sectionKey}-${index}`)}>
                <td style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{(currentPage - 1) * ADMIN_PAGE_SIZE + index + 1}</td>
                {fields.map((field) => <td key={field} style={{ padding: ".6rem .75rem", borderBottom: "1px solid var(--ms-line)" }}>{readValue(item, field)}</td>)}
              </tr>
            )) : <tr><td colSpan={fields.length + 1} style={{ padding: "1rem", textAlign: "center", color: "var(--ms-muted)" }}>No matching records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
