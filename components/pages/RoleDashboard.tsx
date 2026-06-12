"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CircleEllipsis,
  Database,
  Download,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Plus,
  PlusCircle,
  Search,
  Settings,
  TableProperties,
  X,
  Users
} from "lucide-react";
import { backendBaseUrl } from "@/lib/config";
import { getClientCsrfToken } from "@/lib/csrf-client";
import { assetPath, formatDateTime, parsePhotos } from "@/lib/format";
import type { User } from "@/types";
import { AdminDataTable } from "@/components/pages/AdminDataTable";

type DashboardRecord = Record<string, unknown>;

export interface DashboardMetric {
  label: string;
  value?: string | number;
  sourceKey?: string;
  sectionKey?: string;
}

export interface DashboardSection {
  key: string;
  title: string;
  description?: string;
  emptyLabel?: string;
  fields?: string[];
  linkBase?: string;
  linkIdKey?: string;
  permission?: string;
}

export interface DashboardAction {
  href: string;
  label: string;
  external?: boolean;
  primary?: boolean;
  permission?: string;
}

export interface DashboardFormField {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "password" | "number" | "datetime-local" | "textarea" | "select" | "hidden";
  value?: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  rows?: number;
}

export interface DashboardForm {
  title: string;
  description?: string;
  action: string;
  submitLabel: string;
  encType?: string;
  fields: DashboardFormField[];
  permission?: string;
}

interface PermissionItem {
  id: string;
  name: string;
  description: string;
}

function expandCsvPermissions(form: HTMLFormElement): void {
  const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement>('[name="permissions"]');
  if (!input) return;
  if (input instanceof HTMLInputElement && input.type === "checkbox") return;
  const raw = input.value.trim();
  if (!raw) return;
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length <= 1) return;
  input.value = values[0];
  values.slice(1).forEach((value) => {
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "permissions";
    hidden.value = value;
    hidden.setAttribute("data-generated", "permissions");
    form.appendChild(hidden);
  });
}

export interface RoleDashboardProps {
  kind?: string;
  title: string;
  subtitle: string;
  user: User | null;
  payload: DashboardRecord;
  metrics: DashboardMetric[];
  sections: DashboardSection[];
  actions?: DashboardAction[];
  forms?: DashboardForm[];
}

const STABLE_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabelFromParts(year: string, month: string) {
  const monthIndex = Number(month) - 1;
  const yearToken = year.slice(-2);
  return `${STABLE_MONTH_LABELS[monthIndex] ?? month}-${yearToken}`;
}

function asArray(payload: DashboardRecord, key: string): DashboardRecord[] {
  const value = payload[key];
  return Array.isArray(value) ? value.filter((item): item is DashboardRecord => item !== null && typeof item === "object" && !Array.isArray(item)) : [];
}

function readField(record: DashboardRecord, key: string): string {
  const value = record[key];
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return formatDateTime(value);
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} items` : "Available";
  return String(value);
}

function rawString(record: DashboardRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : "";
}

function recordImage(record: DashboardRecord): string {
  const directImage = [
    rawString(record, "avatar_url"),
    rawString(record, "company_logo"),
    rawString(record, "cover_url"),
    rawString(record, "image_url"),
    rawString(record, "photo"),
    rawString(record, "logo_url")
  ].find(Boolean);
  const firstPhoto = parsePhotos(record.photos as string[] | string | null | undefined, directImage)[0];
  return firstPhoto ? assetPath(firstPhoto, "") : "";
}

function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function recordTitle(record: DashboardRecord, fallback: string): string {
  return readField(record, "title") !== "-"
    ? readField(record, "title")
    : readField(record, "name") !== "-"
      ? readField(record, "name")
      : readField(record, "username") !== "-"
        ? readField(record, "username")
        : readField(record, "property_title") !== "-"
          ? readField(record, "property_title")
          : fallback;
}

function metricValue(metric: DashboardMetric, payload: DashboardRecord): string | number {
  if (metric.value !== undefined) return metric.value;
  if (!metric.sourceKey) return 0;
  const value = payload[metric.sourceKey];
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number" || typeof value === "string") return value;
  return 0;
}

function defaultFields(record: DashboardRecord): string[] {
  const preferred = ["status", "role", "locality", "email", "phone", "created_at", "scheduled_at", "amount", "type"];
  const available = preferred.filter((key) => record[key] !== undefined);
  return available.length ? available.slice(0, 4) : Object.keys(record).filter((key) => key !== "id").slice(0, 4);
}

function itemHref(section: DashboardSection, record: DashboardRecord): string | null {
  if (!section.linkBase) return null;
  const id = readField(record, section.linkIdKey ?? "id");
  return id === "-" ? null : `${section.linkBase}/${id}`;
}

function FormField({ field }: { field: DashboardFormField }) {
  if (field.type === "hidden") {
    return <input type="hidden" name={field.name} value={field.value ?? ""} />;
  }

  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      <span>{field.label}</span>
      {field.type === "textarea" ? (
        <textarea className="field" name={field.name} placeholder={field.placeholder} required={field.required} rows={field.rows ?? 3} defaultValue={field.value} />
      ) : field.type === "select" ? (
        <select className="field" name={field.name} required={field.required} defaultValue={field.value ?? field.options?.[0]?.value ?? ""}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="field"
          name={field.name}
          type={field.type ?? "text"}
          placeholder={field.placeholder}
          required={field.required}
          defaultValue={field.value}
        />
      )}
    </label>
  );
}

function prettifyPermission(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PermissionSelector({
  mode,
  payload,
  roleFieldName = "role_name"
}: {
  mode: "role" | "user";
  payload: DashboardRecord;
  roleFieldName?: string;
}) {
  const permissions = useMemo<PermissionItem[]>(() => {
    const rows = asArray(payload, "allPermissions");
    return rows
      .map((row) => {
        const id = row.id;
        const name = row.name;
        if (id === undefined || id === null || typeof name !== "string" || !name.trim()) return null;
        return {
          id: String(id),
          name: name.trim(),
          description: typeof row.description === "string" ? row.description : ""
        };
      })
      .filter((item): item is PermissionItem => Boolean(item));
  }, [payload]);

  const roles = useMemo(() => {
    const fromUsers = new Set(
      asArray(payload, "users")
        .map((row) => (typeof row.role === "string" ? row.role.trim().toLowerCase() : ""))
        .filter(Boolean)
    );
    const fromRolePerms = new Set(
      asArray(payload, "rolePermissions")
        .map((row) => (typeof row.role_name === "string" ? row.role_name.trim().toLowerCase() : ""))
        .filter(Boolean)
    );
    const defaults = ["admin", "support", "owner", "builder", "broker", "corporate", "external_sales"];
    return Array.from(new Set([...defaults, ...Array.from(fromUsers), ...Array.from(fromRolePerms)]));
  }, [payload]);
  const userDirectory = useMemo(
    () =>
      asArray(payload, "users")
        .map((row) => {
          const id = row.id;
          if (id === undefined || id === null) return null;
          return {
            id: String(id),
            name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : typeof row.username === "string" ? row.username : "User",
            email: typeof row.email === "string" ? row.email : ""
          };
        })
        .filter((item): item is { id: string; name: string; email: string } => Boolean(item)),
    [payload]
  );

  const baselineByRole = useMemo(() => {
    const map = new Map<string, Set<string>>();
    asArray(payload, "rolePermissions").forEach((row) => {
      const role = typeof row.role_name === "string" ? row.role_name.trim().toLowerCase() : "";
      const permId = row.permission_id === undefined || row.permission_id === null ? "" : String(row.permission_id);
      if (!role || !permId) return;
      if (!map.has(role)) map.set(role, new Set<string>());
      map.get(role)?.add(permId);
    });
    return map;
  }, [payload]);

  const [selectedRole, setSelectedRole] = useState(roles[0] ?? "admin");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [userSearchValue, setUserSearchValue] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const selectedSet = new Set(selectedPermissions);
  const rolePreviewSet = baselineByRole.get(selectedRole) ?? new Set<string>();

  const permissionMatrix = useMemo(() => {
    const actions: Array<"view" | "edit" | "create" | "delete"> = ["view", "edit", "create", "delete"];
    const rowMap = new Map<string, { label: string; cells: Record<string, PermissionItem | null> }>();

    const parsePermission = (name: string): { action: "view" | "edit" | "create" | "delete"; resource: string } => {
      const token = name.trim().toLowerCase();
      if (token.startsWith("view_")) return { action: "view", resource: token.slice(5) };
      if (token.startsWith("create_")) return { action: "create", resource: token.slice(7) };
      if (token.startsWith("add_")) return { action: "create", resource: token.slice(4) };
      if (token.startsWith("delete_")) return { action: "delete", resource: token.slice(7) };
      if (token.startsWith("remove_")) return { action: "delete", resource: token.slice(7) };
      if (token.startsWith("manage_")) return { action: "edit", resource: token.slice(7) };
      if (token.startsWith("update_")) return { action: "edit", resource: token.slice(7) };
      if (token.startsWith("assign_")) return { action: "edit", resource: token.slice(7) };
      if (token.startsWith("approve_")) return { action: "edit", resource: token.slice(8) };
      if (token.startsWith("toggle_")) return { action: "edit", resource: token.slice(7) };
      if (token.startsWith("export_")) return { action: "view", resource: token.slice(7) };
      if (token.startsWith("pay_")) return { action: "edit", resource: token.slice(4) };
      return { action: "edit", resource: token };
    };

    permissions.forEach((permission) => {
      const parsed = parsePermission(permission.name);
      const resourceKey = parsed.resource || "general";
      if (!rowMap.has(resourceKey)) {
        rowMap.set(resourceKey, {
          label: prettifyPermission(resourceKey),
          cells: { view: null, edit: null, create: null, delete: null }
        });
      }
      const row = rowMap.get(resourceKey);
      if (row) row.cells[parsed.action] = permission;
    });

    return {
      actions,
      rows: Array.from(rowMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, value]) => value)
    };
  }, [permissions]);

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) => (prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]));
  };

  const applyRoleBaseline = () => setSelectedPermissions(Array.from(rolePreviewSet));
  const resolveUserId = (raw: string): string => {
    const value = raw.trim();
    if (!value) return "";
    const direct = userDirectory.find((u) => value === `${u.id} - ${u.name}` || value === u.id);
    if (direct) return direct.id;
    const leading = value.match(/^(\d+)/);
    return leading?.[1] ?? "";
  };

  if (!permissions.length) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
        Permissions list is not available from project data right now.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:col-span-2">
      <div className="grid gap-3 md:grid-cols-2">
        {mode === "role" ? (
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">
            <span>Role Name</span>
            <select className="field" name={roleFieldName} value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} required>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">
          <span>{mode === "user" ? "User ID" : "Selected permissions"}</span>
          {mode === "user" ? (
            <div className="grid gap-1.5">
              <input
                className="field"
                list="permission-user-options"
                placeholder="Search by account no or name (e.g. 40 - Amit)"
                value={userSearchValue}
                onChange={(event) => {
                  const value = event.target.value;
                  setUserSearchValue(value);
                  setSelectedUserId(resolveUserId(value));
                }}
                onBlur={() => setSelectedUserId(resolveUserId(userSearchValue))}
                required
              />
              <datalist id="permission-user-options">
                {userDirectory.map((user) => (
                  <option key={user.id} value={`${user.id} - ${user.name}`}>
                    {user.email}
                  </option>
                ))}
              </datalist>
              <input type="hidden" name="user_id" value={selectedUserId} />
            </div>
          ) : (
            <input className="field" value={selectedPermissions.length ? selectedPermissions.join(", ") : "None selected"} readOnly />
          )}
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={applyRoleBaseline} style={{ minHeight: 32, padding: ".25rem .6rem" }}>
          Use {selectedRole} baseline
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setSelectedPermissions(permissions.map((p) => p.id))} style={{ minHeight: 32, padding: ".25rem .6rem" }}>
          Select all
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setSelectedPermissions([])} style={{ minHeight: 32, padding: ".25rem .6rem" }}>
          Clear
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          className="field w-full text-left"
          onClick={() => setIsPickerOpen((prev) => !prev)}
          aria-expanded={isPickerOpen}
          style={{ minHeight: 38 }}
        >
          {selectedPermissions.length ? `${selectedPermissions.length} permission(s) selected` : "Click to select permissions"}
        </button>
        {isPickerOpen ? (
          <div
            className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg"
            style={{ maxHeight: 380, overflow: "hidden" }}
          >
            <div className="grid grid-cols-[minmax(160px,1.3fr)_repeat(4,minmax(70px,.5fr))] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-600">
              <span>Module</span>
              {permissionMatrix.actions.map((action) => (
                <span key={action} className="text-center">
                  {action}
                </span>
              ))}
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {permissionMatrix.rows.map((row) => {
                return (
                  <div
                    key={row.label}
                    className="grid grid-cols-[minmax(160px,1.3fr)_repeat(4,minmax(70px,.5fr))] items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">{row.label}</p>
                    </div>
                    {permissionMatrix.actions.map((action) => {
                      const permission = row.cells[action];
                      const permissionId = permission?.id ?? "";
                      const checked = permissionId ? selectedSet.has(permissionId) : false;
                      const baseline = permissionId ? rolePreviewSet.has(permissionId) : false;
                      return (
                        <div key={`${row.label}-${action}`} className="grid place-items-center">
                          <input
                            type="checkbox"
                            checked={mode === "role" ? checked : checked || baseline}
                            disabled={!permission}
                            onChange={() => {
                              if (!permissionId) return;
                              togglePermission(permissionId);
                            }}
                            aria-label={`${row.label} ${action}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-3 py-2">
              <button type="button" className="btn btn-secondary" onClick={() => setIsPickerOpen(false)} style={{ minHeight: 30, padding: ".2rem .6rem" }}>
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {selectedPermissions.map((permId) => (
        <input key={permId} type="hidden" name="permissions" value={permId} />
      ))}
    </div>
  );
}

function ActionLink({ action }: { action: DashboardAction }) {
  const className = action.primary ? "btn btn-primary" : "btn btn-secondary";
  const style = action.primary
    ? ({
        borderRadius: 999,
        minHeight: 42,
        padding: ".45rem 1.15rem",
        background: "#7a6200",
        border: "none",
        boxShadow: "0 8px 20px rgba(122,98,0,.26)"
      } as const)
    : ({
        borderRadius: 999,
        minHeight: 42,
        padding: ".45rem 1.1rem",
        border: "1px solid #c8bda3",
        background: "#f2ede1",
        color: "#3b3220"
      } as const);
  if (action.external) {
    return (
      <a className={className} href={action.href} target="_blank" rel="noopener noreferrer" style={style}>
        {action.label}
        <ArrowUpRight size={16} aria-hidden />
      </a>
    );
  }

  return (
    <Link className={className} href={action.href} style={style}>
      {action.label}
    </Link>
  );
}

function shouldShowAdminCreateSpecialField(role: string, fieldName: string): boolean {
  const normalizedRole = role.toLowerCase();
  if (fieldName === "agency_name") {
    return ["builder", "broker", "corporate", "external_sales"].includes(normalizedRole);
  }
  if (fieldName === "corporate_type") {
    return normalizedRole === "corporate";
  }
  if (fieldName === "parent_id") {
    return normalizedRole === "external_sales";
  }
  return true;
}

function resolveFormAction(action: string, fields: DashboardFormField[]): string {
  if (!action.includes(":")) return action;
  let resolved = action;
  for (const field of fields) {
    const token = `:${field.name}`;
    if (resolved.includes(token) && field.value) {
      resolved = resolved.replace(token, encodeURIComponent(field.value));
    }
  }
  return resolved;
}

function isPermissionFormAction(action: string): action is "/admin/permissions/role" | "/admin/permissions/user" {
  return action === "/admin/permissions/role" || action === "/admin/permissions/user";
}

function MiniTrendChart({
  points,
  mode
}: {
  points: Array<{ key: string; label: string; count: number }>;
  mode: "line" | "histogram";
}) {
  if (!points.length) {
    return <p className="mt-3 text-xs font-semibold text-slate-500">No trend data.</p>;
  }
  const width = 260;
  const height = 84;
  const max = Math.max(...points.map((p) => p.count), 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i * step : width / 2;
    const y = height - (p.count / max) * (height - 10) - 5;
    return { ...p, x, y };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");

  if (mode === "histogram") {
    const barWidth = Math.max(12, Math.floor(width / Math.max(points.length, 1)) - 6);
    return (
      <div style={{ marginTop: ".65rem" }}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Histogram trend" style={{ width: "100%", height: 92 }}>
          {coords.map((c) => {
            const h = height - c.y - 4;
            return <rect key={c.key} x={Math.max(0, c.x - barWidth / 2)} y={c.y} width={barWidth} height={Math.max(2, h)} rx={3} fill="#ef4444" />;
          })}
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span className="text-[10px] font-bold text-slate-500">{points[0].label}</span>
          <span className="text-[10px] font-bold text-slate-500">{points[points.length - 1].label}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: ".65rem" }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line trend" style={{ width: "100%", height: 92 }}>
        <path d={path} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c) => (
          <circle key={c.key} cx={c.x} cy={c.y} r="3" fill="#b91c1c" />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span className="text-[10px] font-bold text-slate-500">{points[0].label}</span>
        <span className="text-[10px] font-bold text-slate-500">{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

function menuIconFor(itemId: string) {
  if (itemId === "dashboard-overview") return LayoutDashboard;
  if (itemId === "dashboard-metrics") return BarChart3;
  if (itemId === "dashboard-actions") return CircleEllipsis;
  if (itemId === "dashboard-actions-roles-permissions") return Users;
  if (itemId === "section-botResponses") return Bot;
  if (itemId.includes("lead") || itemId.includes("customer")) return Users;
  if (itemId.includes("schedule") || itemId.includes("task")) return Bell;
  if (itemId.includes("project") || itemId.includes("requirement") || itemId.includes("suggestion")) return FolderKanban;
  if (itemId.includes("property") || itemId.includes("inventory")) return TableProperties;
  if (itemId.includes("user")) return Users;
  if (itemId.includes("visit")) return ListChecks;
  if (itemId.includes("corporate")) return Building2;
  if (itemId.includes("pending") || itemId.includes("active")) return TableProperties;
  return Database;
}

export function RoleDashboard({ title, subtitle, user, payload, metrics, sections, actions = [], forms = [] }: RoleDashboardProps) {
  const role = String(user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isBroker = role === "broker";
  const isBuilder = role === "builder";
  const isExternalSales = role === "external_sales";
  const salesAgentType = String(user?.sales_agent_type || (user?.parent_id ? "associated" : "independent")).toLowerCase();
  const isConsoleLayout = isAdmin || isBroker || isBuilder || isExternalSales;
  const menuLabel = isAdmin ? "Admin Menu" : isBroker ? "Broker Menu" : isBuilder ? "Builder Menu" : "Sales Menu";
  const salesConsoleLabel = salesAgentType === "associated" ? "Associated Sales Console" : "Independent Sales Console";
  const salesWelcomeLabel = salesAgentType === "associated" ? "Welcome back, Associated Sales" : "Welcome back, Independent Sales";
  const builderDefaultPermissions = useMemo(
    () => [
      "view_builder_dashboard",
      "manage_builder_kyc",
      "manage_builder_agents",
      "manage_builder_projects",
      "manage_builder_inventory",
      "manage_builder_leads",
      "manage_builder_visits",
      "manage_builder_portfolio",
      "manage_builder_requirements",
      "manage_properties",
      "view_messages",
      "manage_visits",
      "manage_sales"
    ],
    []
  );
  const salesDefaultPermissions = useMemo(
    () => [
      "view_overview",
      "view_messages",
      "manage_properties",
      "manage_visits",
      "manage_sales",
      "manage_corporate"
    ],
    []
  );
  const currentPermissions = useMemo(() => {
    const rawPermissions = payload.permissions ?? payload.effectivePermissions ?? [];
    const permissions = Array.isArray(rawPermissions)
      ? rawPermissions.filter((permission): permission is string => typeof permission === "string" && permission.trim().length > 0)
      : [];
    if (isBuilder && permissions.length === 0) return builderDefaultPermissions;
    if (isExternalSales && permissions.length === 0) return salesDefaultPermissions;
    return permissions;
  }, [builderDefaultPermissions, isBuilder, isExternalSales, payload, salesDefaultPermissions]);
  const canAccess = (permission?: string) => !permission || isAdmin || currentPermissions.includes(permission);
  const visibleActions = useMemo(() => actions.filter((action) => canAccess(action.permission)), [actions, currentPermissions, isAdmin]);
  const visibleForms = useMemo(() => forms.filter((form) => canAccess(form.permission)), [forms, currentPermissions, isAdmin]);
  const accessibleSections = useMemo(() => sections.filter((section) => canAccess(section.permission)), [sections, currentPermissions, isAdmin]);
  const isMenuDriven = payload?.tab !== undefined || isConsoleLayout;
  const [editingBotResponse, setEditingBotResponse] = useState<DashboardRecord | null>(null);
  const [csrfToken, setCsrfToken] = useState("");
  useEffect(() => {
    void getClientCsrfToken().then(setCsrfToken).catch(() => {});
  }, []);
  const isRolePermissionForm = (form: DashboardForm): boolean => {
    const title = form.title.toLowerCase();
    const action = form.action.toLowerCase();
    return action.includes("/permissions/") || action.includes("update-role") || title.includes("permission") || title.includes(" role");
  };
  const rolePermissionForms = isAdmin ? visibleForms.filter((form) => isRolePermissionForm(form)) : [];
  const otherQuickActionForms = isAdmin ? visibleForms.filter((form) => !isRolePermissionForm(form)) : [];
  const categorizeQuickAction = (form: DashboardForm): { id: string; title: string } => {
    const text = `${form.title} ${form.action}`.toLowerCase();
    if (/visit|lead|assign/.test(text)) return { id: "visits-leads", title: "Visits & Leads" };
    if (/property|verify|kyc/.test(text)) return { id: "properties-listings", title: "Properties & Listings" };
    if (/corporate|requirement|suggestion/.test(text)) return { id: "corporate-requirements", title: "Corporate & Requirements" };
    if (/referral|withdraw|payout|pay/.test(text)) return { id: "referrals-payouts", title: "Referrals & Payouts" };
    if (/team|admin\/team/.test(text)) return { id: "team-management", title: "Team Management" };
    if (/bot|response|faq/.test(text)) return { id: "bot-content", title: "Bot & Content" };
    if (/user|member|role|status/.test(text)) return { id: "user-management", title: "User Management" };
    return { id: "other-actions", title: "Other Actions" };
  };
  const groupedQuickActions = new Map<string, { id: string; title: string; forms: DashboardForm[] }>();
  otherQuickActionForms.forEach((form) => {
    const category = categorizeQuickAction(form);
    const existing = groupedQuickActions.get(category.id);
    if (existing) {
      existing.forms.push(form);
      return;
    }
    groupedQuickActions.set(category.id, { ...category, forms: [form] });
  });
  const quickActionGroups = isAdmin
    ? [
        { id: "roles-permissions", title: "Roles & Permissions", forms: rolePermissionForms },
        ...Array.from(groupedQuickActions.values())
      ].filter((group) => group.forms.length)
    : [{ id: "quick-actions", title: "Quick Actions", forms: visibleForms }];
  const rawMenuItems = [
    { id: "dashboard-overview", label: "Overview" },
    ...(isBroker ? [] : [{ id: "dashboard-metrics", label: "Key Metrics" }]),
    ...(visibleForms.length ? [{ id: "dashboard-actions", label: "Quick Actions" }] : []),
    ...(isAdmin && rolePermissionForms.length ? [{ id: "dashboard-actions-roles-permissions", label: "Roles & Permissions" }] : []),
    ...(isAdmin ? [{ id: "partner-management", label: "Partners" }] : []),
    ...accessibleSections.map((section) =>
      section.key === "botResponses"
        ? { id: "section-botResponses", label: "Saksh Bot" }
        : { id: `section-${section.key}`, label: section.title }
    )
  ];
  const seenMenuIds = new Set<string>();
  const menuItems = rawMenuItems.filter((item) => {
    if (seenMenuIds.has(item.id)) return false;
    seenMenuIds.add(item.id);
    return true;
  });
  const defaultPanel = menuItems[0]?.id ?? "dashboard-overview";
  const [selectedPanel, setSelectedPanel] = useState(defaultPanel);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [lastSelectedSectionKey, setLastSelectedSectionKey] = useState<string | null>(null);
  const [usersChartMode, setUsersChartMode] = useState<"line" | "histogram">("line");
  const [propertiesChartMode, setPropertiesChartMode] = useState<"line" | "histogram">("line");
  const [formSelections, setFormSelections] = useState<Record<string, Record<string, string>>>({});
  const overviewCards = accessibleSections.map((section) => ({
    id: `section-${section.key}`,
    label: section.key === "botResponses" ? "Saksh Bot" : section.title
  }));
  const activeSectionId = selectedPanel.startsWith("section-") ? selectedPanel : null;
  const selectedSectionKey = activeSectionId ? activeSectionId.replace("section-", "") : lastSelectedSectionKey;
  const visibleSections = useMemo(() => {
    if (!isConsoleLayout) return accessibleSections;
    if (!activeSectionId) return [];
    if (activeSectionId === "partner-management") return [];
    return accessibleSections.filter((section) => `section-${section.key}` === activeSectionId);
  }, [isConsoleLayout, activeSectionId, accessibleSections]);
  const visibleMetrics = useMemo(() => {
    if (!isConsoleLayout) return metrics;
    if (!selectedSectionKey) return [];
    if (selectedPanel === "partner-management") return [];
    const filtered = metrics.filter((metric) => (metric.sectionKey ?? metric.sourceKey) === selectedSectionKey);
    return filtered;
  }, [isConsoleLayout, selectedSectionKey, metrics, selectedPanel]);
  const builderProjectStats = useMemo(() => {
    if (!isBuilder) return null;
    const projects = asArray(payload, "assignedProjects");
    const inventory = asArray(payload, "inventory");
    const portfolio = asArray(payload, "portfolio");
    const leads = asArray(payload, "leads").length + asArray(payload, "salesLeads").length;

    const statusCount = (status: string) =>
      projects.filter((project) => String(project.status ?? "").toLowerCase() === status.toLowerCase()).length;

    const projectTypes = Array.from(
      projects.reduce((map, project) => {
        const type = String(project.type ?? "Project").trim() || "Project";
        map.set(type, (map.get(type) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const latestProject = projects[0] ?? null;
    return {
      total: projects.length,
      active: statusCount("Active"),
      upcoming: statusCount("Upcoming"),
      completed: statusCount("Completed"),
      inventory: inventory.length,
      portfolio: portfolio.length,
      leads,
      projectTypes,
      latestProject
    };
  }, [isBuilder, payload]);
  const salesStats = useMemo(() => {
    if (!isExternalSales) return null;
    const leads = asArray(payload, "leads");
    const visits = asArray(payload, "visits");
    const visitRequests = asArray(payload, "visitRequests");
    const properties = asArray(payload, "properties");
    const myProperties = asArray(payload, "myProperties");
    const managedProperties = asArray(payload, "managedProperties");
    const projects = asArray(payload, "assignedProjects");
    const customers = asArray(payload, "corporateClients");
    const schedules = asArray(payload, "schedules");
    const salesTasks = asArray(payload, "salesTasks");
    const salesTransactions = asArray(payload, "salesTransactions");
    const corporateRequirements = asArray(payload, "corporateRequirements");
    const myRequirements = asArray(payload, "myRequirements");
    const suggestions = asArray(payload, "requirementSuggestions");
    const managementRequests = asArray(payload, "propertyManagementRequests");

    const leadStatuses = Array.from(
      leads.reduce((map, lead) => {
        const status = String(lead.status ?? "New").trim() || "New";
        map.set(status, (map.get(status) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      leads: leads.length,
      visits: visits.length,
      visitRequests: visitRequests.length,
      properties: properties.length,
      myProperties: myProperties.length,
      managedProperties: managedProperties.length,
      projects: projects.length,
      customers: customers.length,
      schedules: schedules.length,
      tasks: salesTasks.length,
      transactions: salesTransactions.length,
      managementRequests: managementRequests.length,
      requirements: corporateRequirements.length + myRequirements.length,
      suggestions: suggestions.length,
      latestSchedule: salesTasks[0] ?? schedules[0] ?? null,
      latestTransaction: salesTransactions[0] ?? null,
      leadStatuses
    };
  }, [isExternalSales, payload]);
  const partnerRecords = useMemo(() => {
    if (!isAdmin) return [];
    const partnerRoles = new Set(["builder", "broker", "corporate", "external_sales", "dealer", "agent"]);
    return asArray(payload, "users").filter((record) => {
      const role = String(record.role ?? "").toLowerCase();
      return partnerRoles.has(role);
    });
  }, [isAdmin, payload]);
  const adminKpi = useMemo(() => {
    if (!isAdmin) return null;
    const usersData = asArray(payload, "users");
    const activeProps = asArray(payload, "active");
    const pendingProps = asArray(payload, "pending");
    const visitReportProps = asArray(payload, "visitReports");
    const verifiedProps = asArray(payload, "verified");

    const uniquePropertyIds = new Set<string>();
    [...activeProps, ...pendingProps, ...visitReportProps, ...verifiedProps].forEach((record) => {
      const id = record.id;
      if (id !== undefined && id !== null) uniquePropertyIds.add(String(id));
    });

    const roleCount = (role: string) => usersData.filter((u) => String(u.role || "").toLowerCase() === role).length;
    const partnersByRole = {
      builder: roleCount("builder"),
      broker: roleCount("broker"),
      corporate: roleCount("corporate"),
      externalSales: roleCount("external_sales")
    };
    const partnersTotal = partnersByRole.builder + partnersByRole.broker + partnersByRole.corporate + partnersByRole.externalSales;

    const monthlyMap = new Map<string, number>();
    [...activeProps, ...pendingProps, ...visitReportProps, ...verifiedProps].forEach((record) => {
      const rawDate = record.created_at ?? record.listed_at;
      if (!rawDate) return;
      const date = new Date(String(rawDate));
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
    });
    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, count]) => {
        const [year, month] = key.split("-");
        const label = monthLabelFromParts(year, month);
        return { key, label, count };
      });
    const usersMonthlyMap = new Map<string, number>();
    usersData.forEach((record) => {
      const rawDate = record.created_at;
      if (!rawDate) return;
      const date = new Date(String(rawDate));
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      usersMonthlyMap.set(key, (usersMonthlyMap.get(key) ?? 0) + 1);
    });
    const usersMonthlyTrend = Array.from(usersMonthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, count]) => {
        const [year, month] = key.split("-");
        const label = monthLabelFromParts(year, month);
        return { key, label, count };
      });

    return {
      users: usersData.length,
      properties: uniquePropertyIds.size,
      partnersTotal,
      partnersByRole,
      monthlyTrend,
      usersMonthlyTrend
    };
  }, [isAdmin, payload]);
  const displayedQuickActionGroups =
    selectedPanel === "dashboard-actions-roles-permissions"
      ? quickActionGroups.filter((group) => group.id === "roles-permissions")
      : quickActionGroups.filter((group) => group.id !== "roles-permissions");

  return (
    <div
      className={isConsoleLayout ? "" : "container"}
      style={{
        display: "grid",
        gap: "1.25rem",
        padding: isConsoleLayout ? "0 0 2rem" : "2rem 0 3rem",
        background: isConsoleLayout
          ? "#f3efe4"
          : undefined,
        borderRadius: isConsoleLayout ? 0 : undefined,
        maxWidth: isConsoleLayout ? "100%" : undefined
      }}
    >
      <div
        style={{
          display: "grid",
          gap: isConsoleLayout ? "0" : "1rem",
          alignItems: "start",
          gridTemplateColumns: isMenuDriven ? (isMenuOpen ? "320px minmax(0, 1fr)" : "72px minmax(0,1fr)") : "minmax(0,1fr)"
        }}
      >
        {isMenuDriven ? (
          <aside
              className="surface ms-hide-scrollbar"
              style={{
                alignSelf: "start",
                borderRadius: isConsoleLayout ? 0 : 14,
                padding: isConsoleLayout ? "1rem 1.2rem" : ".6rem",
                position: "sticky",
                top: 0,
                borderRight: isConsoleLayout ? "1px solid #d7cfbb" : undefined,
                boxShadow: isConsoleLayout ? "none" : "0 18px 40px rgba(15,23,42,.08)",
                maxHeight: "100vh",
                minHeight: "100vh",
                overflowY: "auto",
                background: isConsoleLayout ? "#f7f3ea" : undefined
              }}
            >
            {isConsoleLayout && isMenuOpen ? (
              <div style={{ padding: ".2rem .2rem 1rem" }}>
                <Image src="/assets/logo.png" alt="Matrix Spaces" width={220} height={72} style={{ height: "auto", width: "220px", maxWidth: "100%" }} />
                <p
                  style={{
                    margin: ".55rem 0 0",
                    display: "inline-flex",
                    alignItems: "center",
                    minHeight: 30,
                    padding: ".3rem .75rem",
                    borderRadius: 999,
                    border: "1px solid #d6c9a6",
                    background: "#f3ebd5",
                    fontSize: ".86rem",
                    fontWeight: 700,
                    color: "#5b5344"
                  }}
                >
                  {isAdmin ? "Admin Console" : isBroker ? "Broker Console" : isBuilder ? "Builder Console" : salesConsoleLabel}
                </p>
              </div>
            ) : null}
            <div style={{ display: "flex", justifyContent: isMenuOpen ? "space-between" : "center", alignItems: "center", marginBottom: ".55rem" }}>
              {isMenuOpen ? (
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500" style={{ margin: 0 }}>
                  {menuLabel}
                </h2>
              ) : null}
              <button type="button" className="btn btn-secondary ms-admin-side-toggle" onClick={() => setIsMenuOpen((prev) => !prev)} title={isMenuOpen ? "Collapse menu" : "Expand menu"}>
                {isMenuOpen ? "Collapse" : ">"}
              </button>
            </div>
            <nav style={{ display: "grid", gap: ".4rem" }}>
              {menuItems.map((item) => {
                const Icon = menuIconFor(item.id);
                const commonStyle = {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isMenuOpen ? "flex-start" : "center",
                  gap: ".5rem",
                  width: "100%",
                  minHeight: 52,
                  boxSizing: "border-box" as const,
                  borderRadius: 10,
                  border: "1px solid #d5ccbb",
                  background: selectedPanel === item.id ? "#e6dfcc" : "rgba(255,255,255,.85)",
                  borderColor: selectedPanel === item.id ? "#8f7500" : "#d2cab7",
                  color: "#1f2433",
                  fontWeight: 800,
                  fontSize: ".92rem",
                  lineHeight: 1.2,
                  padding: isMenuOpen ? ".65rem .75rem" : ".6rem .35rem",
                  textAlign: "left" as const
                };
                if ("href" in item && item.href) {
                  return (
                    <Link key={item.id} href={item.href} title={item.label} aria-label={item.label} style={commonStyle} className="ms-admin-side-btn">
                      <Icon size={16} aria-hidden />
                      {isMenuOpen ? <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span> : null}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="ms-admin-side-btn"
                  onClick={() => setSelectedPanel(item.id)}
                  onClickCapture={() => {
                    if (item.id.startsWith("section-")) setLastSelectedSectionKey(item.id.replace("section-", ""));
                  }}
                    title={item.label}
                    aria-label={item.label}
                    style={commonStyle}
                  >
                    <Icon size={16} aria-hidden />
                    {isMenuOpen ? <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span> : null}
                  </button>
                );
              })}
            </nav>
            {isConsoleLayout && isMenuOpen ? (
              <div style={{ marginTop: "1rem", borderTop: "1px solid #d8cfbd", paddingTop: ".9rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 999, background: "#2e2e2e" }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, color: "#231f16" }}>{user?.name || user?.username || "Admin User"}</p>
                    <p style={{ margin: 0, fontSize: ".8rem", color: "#625a49" }}>{user?.email || "admin@matrixspaces.com"}</p>
                  </div>
                </div>
                <div style={{ display: "grid", gap: ".45rem", marginTop: ".75rem" }}>
                  <Link href="/profile" className="btn btn-secondary ms-admin-side-action" style={{ justifyContent: "center", borderRadius: 8, minHeight: 38 }}>
                    Profile
                  </Link>
                  <Link href="/partners" className="btn btn-secondary ms-admin-side-action" style={{ justifyContent: "center", borderRadius: 8, minHeight: 38 }}>
                    Partners
                  </Link>
                  <Link href="/logout" className="btn btn-primary ms-admin-side-action" style={{ justifyContent: "center", borderRadius: 8, minHeight: 38 }}>
                    Logout
                  </Link>
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}

        <div style={{ display: "grid", gap: "1rem", padding: isConsoleLayout ? "0 1.4rem 1.2rem" : undefined }}>
          <section
            id="dashboard-overview"
            className="surface"
              style={{
                display: isConsoleLayout && selectedPanel !== "dashboard-overview" ? "none" : "grid",
                gap: "1rem",
                borderRadius: 14,
                padding: "1.35rem",
                boxShadow: isConsoleLayout ? "none" : "0 22px 42px rgba(15,23,42,.1)",
                border: isConsoleLayout ? "1px solid #d8cfbd" : undefined,
                background: isConsoleLayout ? "#f6f2e8" : undefined
            }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="grid gap-2">
                <span className="ms-chip" style={{ color: isConsoleLayout ? "#6a5300" : "#b91c1c", background: isConsoleLayout ? "#efe6cf" : "#fff1f2", borderColor: isConsoleLayout ? "#cdbb8d" : "#fecdd3" }}>
                  {user?.role || "workspace"}
                </span>
                <h1 className="text-3xl font-black text-slate-950 md:text-5xl">{isAdmin ? "Welcome back, Admin" : isBroker ? "Welcome back, Broker" : isBuilder ? "Welcome back, Builder" : isExternalSales ? salesWelcomeLabel : title}</h1>
              </div>
              {visibleActions.length ? (
                <div className="flex flex-wrap gap-2">
              {visibleActions.map((action) => (
                    <span
                      key={`${action.href}-${action.label}`}
                      style={{
                        display: "inline-flex"
                      }}
                    >
                      <ActionLink action={action} />
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {isConsoleLayout ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {overviewCards.map((item) => {
                  const Icon = menuIconFor(item.id);
                  return (
                    <button
                      key={`overview-${item.id}`}
                      type="button"
                      onClick={() => setSelectedPanel(item.id)}
                      onClickCapture={() => {
                        if (item.id.startsWith("section-")) setLastSelectedSectionKey(item.id.replace("section-", ""));
                      }}
                      className="surface"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: ".7rem",
                        borderRadius: 10,
                        border: "1px solid #d8cfbd",
                        padding: ".9rem",
                        textAlign: "left",
                        background: "rgba(255,255,255,.72)"
                      }}
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-600">
                        <Icon size={18} aria-hidden />
                      </span>
                      <span className="text-sm font-black text-slate-900">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section
            id="dashboard-metrics"
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            style={{ display: isConsoleLayout && selectedPanel !== "dashboard-metrics" ? "none" : "grid" }}
          >
            {isAdmin && adminKpi ? (
              <>
                <article className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Users</p>
                      <strong className="mt-1 block text-3xl font-black text-slate-950">{adminKpi.users}</strong>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600">
                      <Users size={20} aria-hidden />
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn btn-secondary" onClick={() => setUsersChartMode("line")} style={{ fontSize: ".74rem", padding: ".25rem .5rem" }}>
                      Line
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setUsersChartMode("histogram")}
                      style={{ fontSize: ".74rem", padding: ".25rem .5rem" }}
                    >
                      Histogram
                    </button>
                  </div>
                  <MiniTrendChart points={adminKpi.usersMonthlyTrend} mode={usersChartMode} />
                </article>
                <article className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Properties</p>
                      <strong className="mt-1 block text-3xl font-black text-slate-950">{adminKpi.properties}</strong>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600">
                      <TableProperties size={20} aria-hidden />
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setPropertiesChartMode("line")}
                      style={{ fontSize: ".74rem", padding: ".25rem .5rem" }}
                    >
                      Line
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setPropertiesChartMode("histogram")}
                      style={{ fontSize: ".74rem", padding: ".25rem .5rem" }}
                    >
                      Histogram
                    </button>
                  </div>
                  <MiniTrendChart points={adminKpi.monthlyTrend} mode={propertiesChartMode} />
                </article>
                <article className="surface md:col-span-2 xl:col-span-2" style={{ borderRadius: 8, padding: "1rem" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Partners (Bifurcated)</p>
                      <strong className="mt-1 block text-3xl font-black text-slate-950">{adminKpi.partnersTotal}</strong>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600">
                      <Building2 size={20} aria-hidden />
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Builder: {adminKpi.partnersByRole.builder}</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Broker: {adminKpi.partnersByRole.broker}</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Corporate: {adminKpi.partnersByRole.corporate}</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                      External Sales: {adminKpi.partnersByRole.externalSales}
                    </div>
                  </div>
                </article>
                <article className="surface md:col-span-2 xl:col-span-4" style={{ borderRadius: 8, padding: "1rem" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Properties Over Time</p>
                      <strong className="mt-1 block text-xl font-black text-slate-950">Monthly trend (last {adminKpi.monthlyTrend.length || 0})</strong>
                    </div>
                  </div>
                  {adminKpi.monthlyTrend.length ? (
                    <div style={{ display: "grid", gap: ".45rem", marginTop: ".75rem" }}>
                      {(() => {
                        const maxCount = Math.max(...adminKpi.monthlyTrend.map((x) => x.count), 1);
                        return adminKpi.monthlyTrend.map((point) => (
                          <div key={point.key} style={{ display: "grid", gridTemplateColumns: "70px 1fr 40px", alignItems: "center", gap: ".55rem" }}>
                            <span className="text-xs font-bold text-slate-600">{point.label}</span>
                            <div style={{ height: 12, background: "rgba(15,23,42,.08)", borderRadius: 999 }}>
                              <div
                                style={{
                                  height: "100%",
                                  width: `${Math.max(6, (point.count / maxCount) * 100)}%`,
                                  background: "linear-gradient(90deg,#ef4444,#f97316)",
                                  borderRadius: 999
                                }}
                              />
                            </div>
                            <span className="text-xs font-black text-slate-800">{point.count}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-slate-600">No timestamp data available for trend.</p>
                  )}
                </article>
              </>
            ) : isBuilder && builderProjectStats ? (
              <>
                <article className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Projects</p>
                      <strong className="mt-1 block text-3xl font-black text-slate-950">{builderProjectStats.total}</strong>
                      <p className="mt-1 text-sm font-semibold text-slate-600">All builder projects you’ve added</p>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600">
                      <FolderKanban size={20} aria-hidden />
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Active: {builderProjectStats.active}</div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Upcoming: {builderProjectStats.upcoming}</div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Completed: {builderProjectStats.completed}</div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Inventory: {builderProjectStats.inventory}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                      Portfolio: {builderProjectStats.portfolio} · Leads: {builderProjectStats.leads}
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Top project types</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {builderProjectStats.projectTypes.length ? (
                          builderProjectStats.projectTypes.map(([type, count]) => (
                            <span key={type} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                              {type} · {count}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm font-semibold text-slate-500">No projects yet</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Latest project</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {builderProjectStats.latestProject ? recordTitle(builderProjectStats.latestProject, "Project") : "No projects yet"}
                      </p>
                      <p className="text-xs font-semibold text-slate-600">
                        {builderProjectStats.latestProject ? `${readField(builderProjectStats.latestProject, "location")} · ${readField(builderProjectStats.latestProject, "status")}` : "Add your first project to see details here."}
                      </p>
                    </div>
                  </div>
                </article>
              </>
            ) : isExternalSales && salesStats ? (
              <>
                <article className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Assigned Leads</p>
                      <strong className="mt-1 block text-3xl font-black text-slate-950">{salesStats.leads}</strong>
                      <p className="mt-1 text-sm font-semibold text-slate-600">Lead records currently assigned</p>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600">
                      <Users size={20} aria-hidden />
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {salesStats.leadStatuses.length ? (
                      salesStats.leadStatuses.map(([status, count]) => (
                        <span key={status} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {status}: {count}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm font-semibold text-slate-500">No leads yet</span>
                    )}
                  </div>
                </article>
                <article className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Visits</p>
                      <strong className="mt-1 block text-3xl font-black text-slate-950">{salesStats.visits}</strong>
                      <p className="mt-1 text-sm font-semibold text-slate-600">Requests: {salesStats.visitRequests}</p>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600">
                      <ListChecks size={20} aria-hidden />
                    </span>
                  </div>
                </article>
                <article className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Inventory</p>
                      <strong className="mt-1 block text-3xl font-black text-slate-950">{salesStats.properties}</strong>
                      <p className="mt-1 text-sm font-semibold text-slate-600">Requests: {salesStats.managementRequests} · Projects: {salesStats.projects}</p>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600">
                      <TableProperties size={20} aria-hidden />
                    </span>
                  </div>
                </article>
                <article className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{salesAgentType === "independent" ? "Transactions" : "Customers"}</p>
                      <strong className="mt-1 block text-3xl font-black text-slate-950">{salesAgentType === "independent" ? salesStats.transactions : salesStats.customers}</strong>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {salesAgentType === "independent" ? "Recorded deal progress" : "Corporate accounts assigned"}
                      </p>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600">
                      <Building2 size={20} aria-hidden />
                    </span>
                  </div>
                </article>
                <article className="surface md:col-span-2 xl:col-span-2" style={{ borderRadius: 8, padding: "1rem" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Tasks & Follow-ups</p>
                      <strong className="mt-1 block text-3xl font-black text-slate-950">{salesStats.tasks}</strong>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600">
                      <Bell size={20} aria-hidden />
                    </span>
                  </div>
                  <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">Next scheduled item</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {salesStats.latestSchedule ? readField(salesStats.latestSchedule, "title") : "No scheduled tasks"}
                    </p>
                    <p className="text-xs font-semibold text-slate-600">
                      {salesStats.latestSchedule ? `${readField(salesStats.latestSchedule, "status") || readField(salesStats.latestSchedule, "type")} - ${readField(salesStats.latestSchedule, "due_at") || readField(salesStats.latestSchedule, "scheduled_at")}` : "Add or update a task from Quick Actions."}
                    </p>
                  </div>
                </article>
                <article className="surface md:col-span-2 xl:col-span-2" style={{ borderRadius: 8, padding: "1rem" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Requirements & Matches</p>
                      <strong className="mt-1 block text-3xl font-black text-slate-950">{salesStats.requirements}</strong>
                      <p className="mt-1 text-sm font-semibold text-slate-600">Approved suggestions: {salesStats.suggestions}</p>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600">
                      <FolderKanban size={20} aria-hidden />
                    </span>
                  </div>
                </article>
              </>
            ) : visibleMetrics.length ? (
              visibleMetrics.map((metric) => (
                <article key={metric.label} className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{metric.label}</p>
                      <strong className="mt-1 block text-3xl font-black text-slate-950">{metricValue(metric, payload)}</strong>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600">
                      <Database size={20} aria-hidden />
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <article className="surface md:col-span-2 xl:col-span-4" style={{ borderRadius: 8, padding: "1rem" }}>
                <p className="text-sm font-semibold text-slate-600">Select a module first to view its metrics.</p>
              </article>
            )}
          </section>

          {visibleForms.length ? (
            <section
              id="dashboard-actions"
              className="grid gap-4"
              style={{ display: isConsoleLayout && selectedPanel !== "dashboard-actions" && selectedPanel !== "dashboard-actions-roles-permissions" ? "none" : "grid" }}
            >
              {displayedQuickActionGroups.map((group) => (
                <div key={group.id} className="grid gap-3">
                  <div className="surface" style={{ borderRadius: 8, padding: ".75rem 1rem" }}>
                    <h2 className="text-sm font-black uppercase tracking-wide text-slate-600">{group.title}</h2>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {group.forms.map((form) => (
                      (() => {
                        const formKey = `${group.id}-${form.action}-${form.title}`;
                        const selectedRoleValue =
                          formSelections[formKey]?.role ??
                          form.fields.find((field) => field.name === "role")?.value ??
                          form.fields.find((field) => field.name === "role")?.options?.[0]?.value ??
                          "";
                        const visibleFormFields =
                          form.action === "/admin/user/create-special"
                            ? form.fields.filter((field) => shouldShowAdminCreateSpecialField(selectedRoleValue, field.name))
                            : form.fields;

                        return (
                      <form
                        key={formKey}
                        action={`${backendBaseUrl}${resolveFormAction(form.action, form.fields)}`}
                        method="POST"
                        encType={form.encType}
                        onSubmit={(event) => {
                          const target = event.currentTarget;
                          target.querySelectorAll('input[data-generated="permissions"]').forEach((node) => node.remove());
                          expandCsvPermissions(target);
                        }}
                        className="surface"
                        style={{ display: "grid", gap: ".9rem", borderRadius: 8, padding: "1rem" }}
                      >
                        <input type="hidden" name="_csrf" value={csrfToken} />
                        <div className="flex items-start gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700">
                            <PlusCircle size={18} aria-hidden />
                          </span>
                          <div>
                            <h2 className="text-lg font-black text-slate-950">{form.title}</h2>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {isPermissionFormAction(form.action) ? (
                            <PermissionSelector mode={form.action.endsWith("/role") ? "role" : "user"} payload={payload} />
                          ) : (
                            visibleFormFields.map((field) => (
                              <div key={field.name} onChange={field.name === "role" ? (event) => {
                                const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
                                setFormSelections((prev) => ({
                                  ...prev,
                                  [formKey]: {
                                    ...(prev[formKey] || {}),
                                    [field.name]: target.value
                                  }
                                }));
                              } : undefined}>
                                <FormField field={field} />
                              </div>
                            ))
                          )}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", justifyContent: "stretch", gap: ".5rem" }}>
                          <button
                            type="reset"
                            className="btn btn-secondary"
                            style={{ height: 40, width: "100%", padding: ".45rem .7rem", whiteSpace: "nowrap", lineHeight: 1.15, textAlign: "center" }}
                          >
                            Reset
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ height: 40, width: "100%", padding: ".45rem .7rem", whiteSpace: "nowrap", lineHeight: 1.15, textAlign: "center" }}
                          >
                            {form.submitLabel}
                          </button>
                        </div>
                      </form>
                        );
                      })()
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          <section className="grid gap-4">
            {isAdmin && selectedPanel === "partner-management" ? (
              <article id="partner-management" className="surface" style={{ borderRadius: 8, overflow: "hidden" }}>
                <div className="flex flex-col gap-2 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">Partner Management</h2>
                  </div>
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    <BadgeCheck size={14} aria-hidden />
                    {partnerRecords.length}
                  </span>
                </div>
                <div className="p-3">
                  <AdminDataTable
                    sectionKey="partnerManagement"
                    title="Partner Management"
                    items={partnerRecords}
                    fields={["id", "username", "name", "role", "email", "phone", "created_at"]}
                  />
                </div>
              </article>
            ) : null}
            {visibleSections.map((section) => {
              const items = asArray(payload, section.key);
              const sectionFields = section.fields ?? (items[0] ? defaultFields(items[0]) : []);
              const useAdminTable = isConsoleLayout && section.key !== "botResponses";
              return (
                <article id={`section-${section.key}`} key={section.key} className="surface" style={{ borderRadius: 8, overflow: "hidden" }}>
              <div className="flex flex-col gap-2 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
                </div>
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  <BadgeCheck size={14} aria-hidden />
                  {items.length}
                </span>
              </div>

              {useAdminTable && sectionFields.length ? (
                <div className="p-3">
                  <AdminDataTable sectionKey={section.key} title={section.title} items={items} fields={sectionFields} />
                </div>
              ) : items.length ? (
                <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.slice(0, 12).map((item, index) => {
                    const fields = section.fields ?? defaultFields(item);
                    const href = itemHref(section, item);
                    const image = recordImage(item);
                    const title = recordTitle(item, `${section.title} ${index + 1}`);
                    const isBotResponseCard = section.key === "botResponses";
                    return (
                      <div key={String(item.id ?? `${section.key}-${index}`)} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        {image ? (
                          <div className="-mx-4 -mt-4 mb-4 aspect-[16/9] overflow-hidden rounded-t-lg bg-slate-100">
                            <Image
                              src={image}
                              alt={title}
                              width={640}
                              height={360}
                              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                              sizes="(max-width: 768px) 100vw, 360px"
                            />
                          </div>
                        ) : null}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-black text-slate-900">{title}</h3>
                            {readField(item, "id") !== "-" ? <p className="mt-1 text-xs font-bold text-slate-400">#{readField(item, "id")}</p> : null}
                          </div>
                          <FolderKanban size={18} className="flex-shrink-0 text-slate-300" aria-hidden />
                        </div>
                        {isBotResponseCard ? (
                          <div className="mt-4 grid gap-2">
                            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                              <p className="text-[11px] font-black uppercase tracking-wide text-rose-600">Trigger</p>
                              <p className="mt-1 text-sm font-bold text-slate-900 break-words">{readField(item, "trigger_text")}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Response</p>
                              <p className="mt-1 text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words">
                                {readField(item, "response_text")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingBotResponse(item)}
                                className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                              >
                                <Settings size={14} aria-hidden />
                                Edit response
                              </button>
                            </div>
                          </div>
                        ) : (
                          <dl className="mt-4 grid gap-2">
                            {fields.map((field) => (
                              <div key={field} className="flex justify-between gap-3 border-t border-slate-100 pt-2 text-sm">
                                <dt className="font-bold text-slate-500">{humanize(field)}</dt>
                                <dd className="max-w-[58%] truncate text-right font-semibold text-slate-800">{readField(item, field)}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        {href ? (
                          <Link href={href} className="mt-4 inline-flex items-center gap-1 text-sm font-black text-red-600">
                            Open
                            <ArrowUpRight size={14} aria-hidden />
                          </Link>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid place-items-center gap-2 p-6 text-center">
                  <BriefcaseBusiness size={28} className="text-slate-300" aria-hidden />
                  <h3 className="text-lg font-black text-slate-900">{section.emptyLabel ?? "No records yet"}</h3>
                </div>
              )}
                </article>
              );
            })}
          </section>
        </div>
      </div>
      {editingBotResponse ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setEditingBotResponse(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-bot-response-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <h2 id="edit-bot-response-title" className="text-xl font-black text-slate-950">
                  Edit Saksh Response
                </h2>
                <p className="mt-1 text-sm text-slate-500">Update the trigger keywords or response text for this bot reply.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingBotResponse(null)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close edit dialog"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <form
              key={String(editingBotResponse.id ?? "bot-response")}
              action={`${backendBaseUrl}/admin/bot/update`}
              method="POST"
              className="space-y-4 p-5"
            >
              <input type="hidden" name="_csrf" value={csrfToken} />
              <input type="hidden" name="id" value={String(editingBotResponse.id ?? "")} />
              <div className="grid gap-2">
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">Trigger keyword(s)</label>
                <input
                  type="text"
                  name="trigger"
                  defaultValue={rawString(editingBotResponse, "trigger_text")}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-rose-500"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">Response text</label>
                <textarea
                  name="response"
                  defaultValue={rawString(editingBotResponse, "response_text")}
                  required
                  rows={8}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-rose-500"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBotResponse(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-rose-700">
                  Update Response
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
