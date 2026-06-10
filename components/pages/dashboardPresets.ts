import type { DashboardAction, DashboardForm, DashboardMetric, DashboardSection } from "./RoleDashboard";
import type { User } from "@/types";

export type DashboardKind = "admin" | "builder" | "broker" | "sales" | "external-sales" | "corporate";

interface DashboardPreset {
  title: string;
  subtitle: string;
  metrics: DashboardMetric[];
  sections: DashboardSection[];
  actions: DashboardAction[];
  forms: DashboardForm[];
}

const leadTypeOptions = [
  { label: "Tenant", value: "tenant" },
  { label: "Owner", value: "owner" },
  { label: "Corporate", value: "corporate" },
  { label: "Investor", value: "investor" }
];

const propertyTypeOptions = [
  { label: "Office", value: "Office" },
  { label: "Retail", value: "Retail" },
  { label: "Warehouse", value: "Warehouse" },
  { label: "Coworking", value: "Coworking" }
];

function portfolioAction(user: User | null): DashboardAction[] {
  return user?.username ? [{ href: `/portfolio/${user.username}`, label: "Public portfolio", primary: false }] : [];
}

export function dashboardPreset(kind: DashboardKind, user: User | null): DashboardPreset {
  if (kind === "admin") {
    return {
      title: "Admin Dashboard",
      subtitle: "Live administrative workspace for property verification, users, visits, KYC, sales, corporate accounts, referrals, and permissions.",
      actions: [
        { href: "/notifications", label: "Notifications", permission: "view_overview" },
        { href: "/messages", label: "Messages", permission: "view_messages" },
        { href: "/list-property", label: "List property", primary: true, permission: "manage_properties" }
      ],
      metrics: [
        { label: "Pending verification", sourceKey: "pending" },
        { label: "Active listings", sourceKey: "active" },
        { label: "Users", sourceKey: "users" },
        { label: "Visits", sourceKey: "visits" }
      ],
      sections: [
        { key: "pending", title: "Pending Property Approvals", fields: ["locality", "type", "status", "verification_status"], linkBase: "/property", permission: "manage_properties" },
        { key: "visitReports", title: "Visit Reports Pending Review", fields: ["locality", "type", "status", "verification_status"], linkBase: "/property", permission: "manage_properties" },
        { key: "active", title: "Active Listings", fields: ["owner_name", "locality", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
        { key: "users", title: "Users Data", fields: ["id", "username", "name", "role", "sales_agent_type", "parent_type", "email", "phone", "created_at"], permission: "view_users" },
        { key: "visits", title: "Visits", fields: ["property_title", "renter_name", "agent_name", "scheduled_at"], permission: "manage_visits" },
        { key: "kycPending", title: "Builder KYC", fields: ["username", "email", "phone"], permission: "manage_kyc" },
        { key: "allLeads", title: "Sales Leads", fields: ["agent_name", "phone", "status", "created_at"], permission: "manage_sales" },
        { key: "corporateClients", title: "Corporate Clients", fields: ["agency_name", "email", "rm_name", "is_domain_approved"], permission: "manage_corporate" },
        { key: "referralsList", title: "Referrals", fields: ["referrer_name", "referred_name", "status", "amount"], permission: "manage_referrals" },
        { key: "withdrawalsList", title: "Withdrawal Requests", fields: ["id", "name", "email", "amount", "status"], permission: "manage_referrals" },
        { key: "contactMessages", title: "Contact Messages", fields: ["name", "email", "phone", "topic", "message", "created_at"], permission: "view_messages" },
        { key: "issueReports", title: "Issue Reports", fields: ["reporter_username", "reporter_email", "reported_username", "reason", "description", "status", "created_at"], permission: "manage_users" },
        { key: "botResponses", title: "Saksh Bot Responses", fields: ["trigger_text", "response_text", "id"], permission: "manage_bot" }
      ],
      forms: [
        {
          title: "Update Property Verification",
          description: "Apply verification workflow updates by property ID.",
          action: "/admin/update",
          submitLabel: "Update verification",
          permission: "manage_properties",
          fields: [
            { name: "id", label: "Property ID", type: "number", required: true, placeholder: "e.g. 128" },
            {
              name: "verification_status",
              label: "Verification status",
              type: "select",
              required: true,
              options: [
                { label: "Unverified", value: "Unverified" },
                { label: "Under Review", value: "Under Review" },
                { label: "Verified", value: "Verified" },
                { label: "Premium Verified", value: "Premium Verified" },
                { label: "Rejected", value: "Rejected" }
              ]
            }
          ]
        },
        {
          title: "Update User Role",
          description: "Change a user role by user ID.",
          action: "/admin/user/update-role",
          submitLabel: "Update role",
          permission: "manage_users",
          fields: [
            { name: "id", label: "User ID", type: "number", required: true, placeholder: "e.g. 40" },
            {
              name: "role",
              label: "Role",
              type: "select",
              required: true,
              options: [
                { label: "Owner", value: "owner" },
                { label: "Builder", value: "builder" },
                { label: "Broker", value: "broker" },
                { label: "Corporate", value: "corporate" },
                { label: "External Sales", value: "external_sales" },
                { label: "Support", value: "support" },
                { label: "Admin", value: "admin" }
              ]
            }
          ]
        },
        {
          title: "Toggle User Status",
          description: "Enable or disable a user account.",
          action: "/admin/user/toggle-status",
          submitLabel: "Apply status",
          permission: "manage_users",
          fields: [
            { name: "id", label: "User ID", type: "number", required: true, placeholder: "e.g. 40" },
            {
              name: "is_active",
              label: "Set active",
              type: "select",
              required: true,
              options: [
                { label: "Enable (true)", value: "true" },
                { label: "Disable (false)", value: "false" }
              ]
            }
          ]
        },
        {
          title: "Edit User Details",
          description: "Update user profile fields by user ID.",
          action: "/admin/user/edit",
          submitLabel: "Save user details",
          permission: "manage_users",
          fields: [
            { name: "id", label: "User ID", type: "number", required: true, placeholder: "e.g. 40" },
            { name: "name", label: "Name", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "phone", label: "Phone", type: "tel" },
            {
              name: "role",
              label: "Role",
              type: "select",
              required: true,
              options: [
                { label: "Owner", value: "owner" },
                { label: "Builder", value: "builder" },
                { label: "Broker", value: "broker" },
                { label: "Corporate", value: "corporate" },
                { label: "External Sales", value: "external_sales" },
                { label: "Support", value: "support" },
                { label: "Admin", value: "admin" }
              ]
            },
            { name: "agency_name", label: "Company / Agency" },
            { name: "gst_number", label: "GST Number" },
            { name: "rera_number", label: "RERA Number" }
          ]
        },
        {
          title: "Create Special User",
          description: "Create user with selected role and optional parent/team link.",
          action: "/admin/user/create-special",
          submitLabel: "Create user",
          permission: "manage_users",
          fields: [
            { name: "name", label: "Name", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "password", label: "Password (optional random if blank)", type: "password" },
            { name: "phone", label: "Phone", type: "tel" },
            {
              name: "role",
              label: "Role",
              type: "select",
              required: true,
              options: [
                { label: "Owner", value: "owner" },
                { label: "Builder", value: "builder" },
                { label: "Broker", value: "broker" },
                { label: "Corporate", value: "corporate" },
                { label: "External Sales", value: "external_sales" },
                { label: "Support", value: "support" },
                { label: "Admin", value: "admin" }
              ]
            },
            { name: "agency_name", label: "Company / Agency" },
            { name: "corporate_type", label: "Corporate Type" },
            { name: "parent_id", label: "Parent User ID (optional)", type: "number" }
          ]
        },
        {
          title: "Add Team Member",
          description: "Add support/admin/external-sales team member.",
          action: "/admin/team/add",
          submitLabel: "Add team member",
          permission: "manage_team",
          fields: [
            { name: "name", label: "Name", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "password", label: "Password", type: "password", required: true },
            { name: "phone", label: "Phone", type: "tel" },
            {
              name: "role",
              label: "Team role",
              type: "select",
              required: true,
              options: [
                { label: "Support", value: "support" },
                { label: "External Sales", value: "external_sales" },
                { label: "Admin", value: "admin" }
              ]
            }
          ]
        },
        {
          title: "Update Visit Status",
          description: "Mark visit as pending, assigned, approved, rejected, or completed.",
          action: "/admin/visit/status",
          submitLabel: "Update visit",
          permission: "manage_visits",
          fields: [
            { name: "visitId", label: "Visit ID", type: "number", required: true, placeholder: "e.g. 77" },
            {
              name: "status",
              label: "Visit status",
              type: "select",
              required: true,
              options: [
                { label: "Pending", value: "pending" },
                { label: "Assigned", value: "assigned" },
                { label: "Approved", value: "approved" },
                { label: "Rejected", value: "rejected" },
                { label: "Completed", value: "completed" }
              ]
            }
          ]
        },
        {
          title: "Assign Visit to Agent",
          description: "Assign/unassign agent for a visit.",
          action: "/admin/visit/assign",
          submitLabel: "Assign visit",
          permission: "manage_visits",
          fields: [
            { name: "visitId", label: "Visit ID", type: "number", required: true, placeholder: "e.g. 77" },
            { name: "agent_id", label: "Agent ID (blank to unassign)" }
          ]
        },
        {
          title: "Assign Lead",
          description: "Assign a lead to an agent.",
          action: "/admin/assign-lead",
          submitLabel: "Assign lead",
          permission: "manage_sales",
          fields: [
            { name: "lead_id", label: "Lead ID", type: "number", required: true },
            { name: "agent_id", label: "Agent ID", type: "number", required: true }
          ]
        },
        {
          title: "Update Lead Status",
          description: "Update lead progress status.",
          action: "/admin/update-lead-status",
          submitLabel: "Update lead",
          permission: "manage_sales",
          fields: [
            { name: "leadId", label: "Lead ID", type: "number", required: true },
            {
              name: "status",
              label: "Lead status",
              type: "select",
              required: true,
              options: [
                { label: "New", value: "new" },
                { label: "Contacted", value: "contacted" },
                { label: "Qualified", value: "qualified" },
                { label: "Converted", value: "converted" },
                { label: "Dropped", value: "dropped" }
              ]
            }
          ]
        },
        {
          title: "Delete Lead",
          description: "Remove lead by lead ID.",
          action: "/admin/delete-lead",
          submitLabel: "Delete lead",
          permission: "manage_sales",
          fields: [{ name: "id", label: "Lead ID", type: "number", required: true }]
        },
        {
          title: "Approve Corporate Domain",
          description: "Approve a corporate account and linked child users by corporate user ID.",
          action: "/admin/corporate/approve",
          submitLabel: "Approve corporate",
          permission: "manage_corporate",
          fields: [{ name: "userId", label: "Corporate User ID", type: "number", required: true }]
        },
        {
          title: "Assign Relationship Manager",
          description: "Assign or unassign RM for a corporate account.",
          action: "/admin/corporate/assign-rm",
          submitLabel: "Assign RM",
          permission: "manage_corporate",
          fields: [
            { name: "corporate_id", label: "Corporate User ID", type: "number", required: true },
            { name: "rm_id", label: "RM User ID (blank to unassign)", type: "number" }
          ]
        },
        {
          title: "Update KYC Decision",
          description: "Approve or reject pending KYC for a specific user.",
          action: "/admin/kyc/update",
          submitLabel: "Update KYC",
          permission: "manage_kyc",
          fields: [
            { name: "userId", label: "User ID", type: "number", required: true },
            {
              name: "status",
              label: "KYC status",
              type: "select",
              required: true,
              options: [
                { label: "Approve", value: "approved" },
                { label: "Reject", value: "rejected" }
              ]
            },
            { name: "reason", label: "Rejection reason (optional)", type: "textarea", rows: 2 }
          ]
        },
        {
          title: "Create & Assign Visit",
          description: "Create a visit and directly assign an agent.",
          action: "/admin/visit/create-assign",
          submitLabel: "Create visit",
          permission: "manage_visits",
          fields: [
            { name: "property_id", label: "Property ID", type: "number", required: true },
            { name: "user_id", label: "Visitor User ID", type: "number", required: true },
            { name: "agent_id", label: "Agent User ID", type: "number", required: true },
            { name: "scheduled_at", label: "Scheduled At", type: "datetime-local", required: true },
            { name: "notes", label: "Notes", type: "textarea", rows: 2 }
          ]
        },
        {
          title: "Update Requirement Status",
          description: "Change a corporate requirement pipeline status.",
          action: "/admin/corporate/requirement/status",
          submitLabel: "Update requirement",
          permission: "manage_corporate",
          fields: [
            { name: "req_id", label: "Requirement ID", type: "number", required: true },
            {
              name: "status",
              label: "Requirement status",
              type: "select",
              required: true,
              options: [
                { label: "Open", value: "open" },
                { label: "In Progress", value: "in_progress" },
                { label: "Closed", value: "closed" },
                { label: "Rejected", value: "rejected" }
              ]
            }
          ]
        },
        {
          title: "Delete Requirement",
          description: "Permanently remove a corporate requirement.",
          action: "/admin/requirements/delete",
          submitLabel: "Delete requirement",
          permission: "manage_corporate",
          fields: [{ name: "req_id", label: "Requirement ID", type: "number", required: true }]
        },
        {
          title: "Suggest Property To Corporate",
          description: "Push a property suggestion to a corporate user's shortlist.",
          action: "/admin/corporate/suggest",
          submitLabel: "Suggest property",
          permission: "manage_corporate",
          fields: [
            { name: "corporate_id", label: "Corporate User ID", type: "number", required: true },
            { name: "property_id", label: "Property ID", type: "number", required: true }
          ]
        },
        {
          title: "Approve Suggestion",
          description: "Approve a requirement suggestion by suggestion ID.",
          action: "/admin/corporate/suggestion/approve",
          submitLabel: "Approve suggestion",
          permission: "manage_corporate",
          fields: [{ name: "suggestion_id", label: "Suggestion ID", type: "number", required: true }]
        },
        {
          title: "Reject Suggestion",
          description: "Reject a requirement suggestion by suggestion ID.",
          action: "/admin/corporate/suggestion/reject",
          submitLabel: "Reject suggestion",
          permission: "manage_corporate",
          fields: [{ name: "suggestion_id", label: "Suggestion ID", type: "number", required: true }]
        },
        {
          title: "Set Property Verification (Direct)",
          description: "Set verification status via property route-style endpoint.",
          action: "/admin/property/:id/verify-status",
          submitLabel: "Set verification",
          permission: "manage_properties",
          fields: [
            { name: "id", label: "Property ID", type: "number", required: true, placeholder: "e.g. 128" },
            {
              name: "verification_status",
              label: "Verification status",
              type: "select",
              required: true,
              options: [
                { label: "Unverified", value: "Unverified" },
                { label: "Under Review", value: "Under Review" },
                { label: "Verified", value: "Verified" },
                { label: "Premium Verified", value: "Premium Verified" },
                { label: "Rejected", value: "Rejected" }
              ]
            }
          ]
        },
        {
          title: "Toggle Property Listed/Unlisted",
          description: "Toggle listing status for a property.",
          action: "/admin/property/:id/update-status",
          submitLabel: "Toggle status",
          permission: "manage_properties",
          fields: [{ name: "id", label: "Property ID", type: "number", required: true, placeholder: "e.g. 128" }]
        },
        {
          title: "Update Role Permissions",
          description: "Replace permissions for a role (comma-separated permission IDs).",
          action: "/admin/permissions/role",
          submitLabel: "Update role permissions",
          permission: "manage_permissions",
          fields: [
            { name: "role_name", label: "Role Name", required: true, placeholder: "e.g. broker" },
            { name: "permissions", label: "Permission IDs", type: "text", placeholder: "e.g. 1,2,6,9" }
          ]
        },
        {
          title: "Update User Permission Overrides",
          description: "Override permissions for one user (comma-separated permission IDs).",
          action: "/admin/permissions/user",
          submitLabel: "Update user permissions",
          permission: "manage_permissions",
          fields: [
            { name: "user_id", label: "User ID", type: "number", required: true },
            { name: "permissions", label: "Permission IDs", type: "text", placeholder: "e.g. 1,2,6,9" }
          ]
        },
        {
          title: "Pay Verified Referral",
          description: "Mark a verified referral as paid by referral ID.",
          action: "/admin/referral/pay",
          submitLabel: "Mark as paid",
          permission: "manage_referrals",
          fields: [{ name: "referral_id", label: "Referral ID", type: "number", required: true }]
        },
        {
          title: "Update Withdrawal Status",
          description: "Approve or reject withdrawal request.",
          action: "/admin/referral/withdrawal/status",
          submitLabel: "Update withdrawal",
          permission: "manage_referrals",
          fields: [
            { name: "withdrawal_id", label: "Withdrawal ID", type: "number", required: true },
            {
              name: "status",
              label: "Status",
              type: "select",
              required: true,
              options: [
                { label: "Approve", value: "approved" },
                { label: "Reject", value: "rejected" }
              ]
            }
          ]
        },
        {
          title: "Delete User",
          description: "Hard delete user and related records by user ID.",
          action: "/admin/user/delete",
          submitLabel: "Delete user",
          permission: "manage_users",
          fields: [{ name: "id", label: "User ID", type: "number", required: true, placeholder: "Use with caution" }]
        },
        {
          title: "Add Saksh Response",
          description: "Create a new keyword trigger and response text for Saksh.",
          action: "/admin/bot/add",
          submitLabel: "Add response",
          permission: "manage_bot",
          fields: [
            { name: "trigger", label: "Trigger keyword(s)", required: true, placeholder: "price, rent, cost" },
            { name: "response", label: "Response text", type: "textarea", required: true, rows: 4, placeholder: "The estimated monthly rent is {{price}}." }
          ]
        },
        {
          title: "Update Saksh Response",
          description: "Update an existing response by ID.",
          action: "/admin/bot/update",
          submitLabel: "Update response",
          permission: "manage_bot",
          fields: [
            { name: "id", label: "Response ID", type: "number", required: true, placeholder: "e.g. 3" },
            { name: "trigger", label: "Trigger keyword(s)", required: true, placeholder: "hello, hi" },
            { name: "response", label: "Response text", type: "textarea", required: true, rows: 4 }
          ]
        },
        {
          title: "Delete Saksh Response",
          description: "Delete a response by ID.",
          action: "/admin/bot/delete",
          submitLabel: "Delete response",
          permission: "manage_bot",
          fields: [{ name: "id", label: "Response ID", type: "number", required: true, placeholder: "e.g. 7" }]
        }
      ]
    };
  }

  if (kind === "builder") {
    return {
      title: "Builder Dashboard",
      subtitle: "Manage builder sales agents, KYC, projects, inventory, CRM leads, visits, and public portfolio data from Next.js.",
      actions: [
        ...portfolioAction(user),
        { href: "/list-property", label: "List property", primary: true, permission: "manage_builder_projects" }
      ],
      metrics: [
        { label: "Total Properties", sourceKey: "myPropertiesTotal", sectionKey: "myProperties" },
        { label: "Active Properties", sourceKey: "myPropertiesActive", sectionKey: "myProperties" },
        { label: "Sold Properties", sourceKey: "myPropertiesSold", sectionKey: "myProperties" },
        { label: "Rented Properties", sourceKey: "myPropertiesRented", sectionKey: "myProperties" },
        { label: "Draft Properties", sourceKey: "myPropertiesDraft", sectionKey: "myProperties" },
        { label: "Managed Properties", sourceKey: "managedPropertiesCount", sectionKey: "managedProperties" },
        { label: "All Properties", sourceKey: "allPropertiesList", sectionKey: "allPropertiesList" },
        { label: "Inventory units", sourceKey: "inventory", sectionKey: "inventory" },
        { label: "Projects", sourceKey: "assignedProjects", sectionKey: "assignedProjects" },
        { label: "Builder leads", sourceKey: "leads", sectionKey: "leads" }
      ],
      sections: [
        { key: "myProperties", title: "My Properties", fields: ["title", "locality", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
        { key: "managedProperties", title: "Managed Properties", fields: ["title", "owner_name", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
        { key: "allPropertiesList", title: "All Properties", fields: ["title", "owner_name", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
        { key: "kyc", title: "KYC Verification Status", fields: ["doc_type", "document_number", "status", "rejection_reason"], permission: "manage_builder_kyc" },
        { key: "agents", title: "Sales Agents", fields: ["username", "email", "phone", "created_at"], permission: "manage_builder_agents" },
        { key: "assignedProjects", title: "Projects", fields: ["type", "location", "status", "rera_id"], permission: "manage_builder_projects" },
        { key: "inventory", title: "Inventory", fields: ["project_name", "tower", "unit_number", "status"], permission: "manage_builder_inventory" },
        { key: "leads", title: "Builder CRM Leads", fields: ["project_name", "phone", "email", "stage"], permission: "manage_builder_leads" },
        { key: "salesLeads", title: "Sales Leads", fields: ["phone", "email", "status", "created_at"], permission: "manage_builder_leads" },
        { key: "salesTasks", title: "Sales Tasks", fields: ["title", "assignee_name", "status", "due_at"], permission: "manage_builder_leads" },
        { key: "salesTransactions", title: "Sales Transactions", fields: ["property_title", "counterparty_name", "amount", "status"], permission: "manage_builder_projects" },
        { key: "agentVisits", title: "Agent Visits", fields: ["property_title", "renter_name", "agent_name", "scheduled_at"], permission: "manage_builder_visits" },
        { key: "unassignedVisits", title: "Unassigned Visits", fields: ["property_title", "renter_name", "locality", "scheduled_at"], permission: "manage_builder_visits" },
        { key: "portfolio", title: "Portfolio Projects", fields: ["type", "location", "completion_year", "created_at"], permission: "manage_builder_portfolio" },
        { key: "myRequirements", title: "My Requirements", fields: ["cities", "property_type", "budget", "status"], permission: "manage_builder_requirements" }
      ],
      forms: [
        {
          title: "Add Sales Agent",
          description: "Creates an external sales account under this builder.",
          action: "/builder/add-agent",
          submitLabel: "Add sales agent",
          permission: "manage_builder_agents",
          fields: [
            { name: "username", label: "Name", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "phone", label: "Phone", type: "tel", required: true },
            { name: "password", label: "Temporary password", type: "password", required: true },
            { name: "role", label: "Role", type: "hidden", value: "external_sales" }
          ]
        },
        {
          title: "Add Builder Lead",
          action: "/builder/leads/add",
          submitLabel: "Add lead",
          permission: "manage_builder_leads",
          fields: [
            { name: "name", label: "Lead name", required: true },
            { name: "phone", label: "Phone", type: "tel" },
            { name: "email", label: "Email", type: "email" },
            { name: "project_id", label: "Project ID" },
            { name: "source", label: "Source", value: "Direct" },
            { name: "stage", label: "Stage", value: "Inquiry" }
          ]
        },
        {
          title: "Add Sales Task",
          action: "/builder/tasks/create",
          submitLabel: "Add task",
          permission: "manage_builder_leads",
          fields: [
            { name: "title", label: "Task title", required: true },
            { name: "description", label: "Description", type: "textarea" },
            { name: "assigned_to", label: "Assigned User ID", type: "number" },
            { name: "related_property_id", label: "Property ID", type: "number" },
            { name: "related_lead_id", label: "Lead ID", type: "number" },
            { name: "due_at", label: "Due at", type: "datetime-local" },
            { name: "notes", label: "Notes", type: "textarea" }
          ]
        },
        {
          title: "Update Sales Task",
          action: "/builder/tasks/update",
          submitLabel: "Update task",
          permission: "manage_builder_leads",
          fields: [
            { name: "task_id", label: "Task ID", type: "number", required: true },
            {
              name: "status",
              label: "Status",
              type: "select",
              required: true,
              options: [
                { label: "Pending", value: "pending" },
                { label: "In Progress", value: "in_progress" },
                { label: "Completed", value: "completed" },
                { label: "Cancelled", value: "cancelled" }
              ]
            },
            { name: "notes", label: "Notes", type: "textarea" }
          ]
        },
        {
          title: "Add Transaction",
          action: "/builder/transactions/add",
          submitLabel: "Add transaction",
          permission: "manage_builder_projects",
          fields: [
            { name: "agent_id", label: "Agent ID", type: "number" },
            { name: "property_id", label: "Property ID", type: "number" },
            { name: "counterparty_name", label: "Counterparty", required: true },
            { name: "amount", label: "Amount", type: "number", required: true },
            { name: "stage", label: "Stage", value: "initiated" },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: [
                { label: "Pending", value: "pending" },
                { label: "Confirmed", value: "confirmed" },
                { label: "Closed", value: "closed" },
                { label: "Cancelled", value: "cancelled" }
              ]
            },
            { name: "notes", label: "Notes", type: "textarea" }
          ]
        },
        {
          title: "Add Project",
          action: "/builder/projects/add",
          submitLabel: "Launch project",
          encType: "multipart/form-data",
          permission: "manage_builder_projects",
          fields: [
            { name: "name", label: "Project name", required: true },
            { name: "type", label: "Project type", required: true },
            { name: "location", label: "Location", required: true },
            { name: "status", label: "Status", value: "Upcoming" },
            { name: "rera_id", label: "RERA ID" },
            { name: "description", label: "Description", type: "textarea" }
          ]
        }
      ]
    };
  }

  if (kind === "broker") {
    return {
      title: "Broker Dashboard",
      subtitle: "Manage assigned properties, visit requests, projects, sales agents, leads, schedules, and corporate requirement suggestions.",
      actions: [
        { href: "/messages", label: "Messages", permission: "view_messages" },
        { href: "/list-property", label: "List property", primary: true, permission: "manage_properties" }
      ],
      metrics: [
        { label: "Total Properties", sourceKey: "myPropertiesTotal", sectionKey: "myProperties" },
        { label: "Active Properties", sourceKey: "myPropertiesActive", sectionKey: "myProperties" },
        { label: "Sold Properties", sourceKey: "myPropertiesSold", sectionKey: "myProperties" },
        { label: "Rented Properties", sourceKey: "myPropertiesRented", sectionKey: "myProperties" },
        { label: "Draft Properties", sourceKey: "myPropertiesDraft", sectionKey: "myProperties" },
        { label: "Managed Properties", sourceKey: "managedPropertiesCount", sectionKey: "managedProperties" },
        { label: "Assigned Properties", sourceKey: "assignedPropertiesCount", sectionKey: "allPropertiesList" },
        { label: "Visits", sourceKey: "visits", sectionKey: "visits" },
        { label: "Sales agents", sourceKey: "agentsUnderBuilder", sectionKey: "agentsUnderBuilder" },
        { label: "Leads", sourceKey: "salesLeads", sectionKey: "salesLeads" }
      ],
      sections: [
        { key: "myProperties", title: "My Properties", fields: ["title", "locality", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
        { key: "managedProperties", title: "Managed Properties", fields: ["title", "owner_name", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
        { key: "allPropertiesList", title: "All Properties", fields: ["title", "owner_name", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
        { key: "assignedProperties", title: "Assigned Properties", fields: ["owner_name", "locality", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
        { key: "visitRequests", title: "Visit Requests", fields: ["property_title", "renter_name", "agent_name", "scheduled_at"], permission: "manage_visits" },
        { key: "visits", title: "My Visits", fields: ["property_title", "renter_name", "status", "scheduled_at"], permission: "manage_visits" },
        { key: "assignedProjects", title: "Assigned Projects", fields: ["builder_name", "location", "status", "created_at"], permission: "manage_properties" },
        { key: "agentsUnderBuilder", title: "Sales Team", fields: ["username", "email", "phone", "role"], permission: "manage_team" },
        { key: "salesLeads", title: "Sales Leads", fields: ["assigned_agent_name", "phone", "status", "created_at"], permission: "manage_sales" },
        { key: "salesTasks", title: "Sales Tasks", fields: ["title", "assignee_name", "status", "due_at"], permission: "manage_sales" },
        { key: "salesTransactions", title: "Sales Transactions", fields: ["property_title", "counterparty_name", "amount", "status"], permission: "manage_sales" },
        { key: "schedules", title: "Schedule", fields: ["title", "lead_name", "type", "scheduled_at"], permission: "manage_visits" },
        { key: "myRequirements", title: "My Requirements", fields: ["cities", "property_type", "budget", "status"], permission: "manage_corporate" }
      ],
      forms: [
        {
          title: "Add Sales Agent",
          action: "/broker/add-sales-agent",
          submitLabel: "Add agent",
          permission: "manage_team",
          fields: [
            { name: "username", label: "Name", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "phone", label: "Phone", type: "tel" },
            { name: "password", label: "Temporary password", type: "password", required: true },
            { name: "role", label: "Role", type: "hidden", value: "external_sales" }
          ]
        },
        {
          title: "Add Lead",
          action: "/external-sales/add-lead",
          submitLabel: "Add lead",
          permission: "manage_sales",
          fields: [
            { name: "name", label: "Lead name", required: true },
            { name: "phone", label: "Phone", type: "tel" },
            { name: "email", label: "Email", type: "email" },
            { name: "type", label: "Lead type", type: "select", options: leadTypeOptions },
            { name: "property_id", label: "Property ID" },
            { name: "preferences", label: "Preferences", type: "textarea" }
          ]
        },
        {
          title: "Add Sales Task",
          action: "/broker/tasks/create",
          submitLabel: "Add task",
          permission: "manage_sales",
          fields: [
            { name: "title", label: "Task title", required: true },
            { name: "description", label: "Description", type: "textarea" },
            { name: "assigned_to", label: "Assigned User ID", type: "number" },
            { name: "related_property_id", label: "Property ID", type: "number" },
            { name: "related_lead_id", label: "Lead ID", type: "number" },
            { name: "due_at", label: "Due at", type: "datetime-local" },
            { name: "notes", label: "Notes", type: "textarea" }
          ]
        },
        {
          title: "Update Sales Task",
          action: "/broker/tasks/update",
          submitLabel: "Update task",
          permission: "manage_sales",
          fields: [
            { name: "task_id", label: "Task ID", type: "number", required: true },
            {
              name: "status",
              label: "Status",
              type: "select",
              required: true,
              options: [
                { label: "Pending", value: "pending" },
                { label: "In Progress", value: "in_progress" },
                { label: "Completed", value: "completed" },
                { label: "Cancelled", value: "cancelled" }
              ]
            },
            { name: "notes", label: "Notes", type: "textarea" }
          ]
        },
        {
          title: "Add Transaction",
          action: "/broker/transactions/add",
          submitLabel: "Add transaction",
          permission: "manage_sales",
          fields: [
            { name: "agent_id", label: "Agent ID", type: "number" },
            { name: "property_id", label: "Property ID", type: "number" },
            { name: "counterparty_name", label: "Counterparty", required: true },
            { name: "amount", label: "Amount", type: "number", required: true },
            { name: "stage", label: "Stage", value: "initiated" },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: [
                { label: "Pending", value: "pending" },
                { label: "Confirmed", value: "confirmed" },
                { label: "Closed", value: "closed" },
                { label: "Cancelled", value: "cancelled" }
              ]
            },
            { name: "notes", label: "Notes", type: "textarea" }
          ]
        }
      ]
    };
  }

  if (kind === "sales" || kind === "external-sales") {
    const salesAgentType = String(user?.sales_agent_type || (user?.parent_id ? "associated" : "independent")).toLowerCase();
    const isIndependentSales = salesAgentType === "independent";
    return {
      title: isIndependentSales ? "Independent Sales Dashboard" : "Associated Sales Dashboard",
      subtitle: isIndependentSales
        ? "Manage your own properties, leads, customers, visits, requirements, and follow-ups."
        : "Manage assigned leads, parent-managed inventory, projects, visits, customers, and follow-ups.",
      actions: [
        { href: "/notifications", label: "Notifications", permission: "view_overview" },
        { href: "/messages", label: "Messages", permission: "view_messages" },
        { href: "/search", label: "Search inventory", primary: true, permission: "manage_properties" }
      ],
      metrics: isIndependentSales
        ? [
            { label: "Total Properties", sourceKey: "myPropertiesTotal", sectionKey: "myProperties" },
            { label: "Active Properties", sourceKey: "myPropertiesActive", sectionKey: "myProperties" },
            { label: "Sold Properties", sourceKey: "myPropertiesSold", sectionKey: "myProperties" },
            { label: "Rented Properties", sourceKey: "myPropertiesRented", sectionKey: "myProperties" },
            { label: "Draft Properties", sourceKey: "myPropertiesDraft", sectionKey: "myProperties" },
            { label: "Managed Properties", sourceKey: "managedPropertiesCount", sectionKey: "managedProperties" },
            { label: "Assigned Properties", sourceKey: "assignedPropertiesCount", sectionKey: "allPropertiesList" },
            { label: "My leads", sourceKey: "leads", sectionKey: "leads" },
            { label: "Scheduled visits", sourceKey: "visits", sectionKey: "visits" },
            { label: "Transactions", sourceKey: "salesTransactions", sectionKey: "salesTransactions" }
          ]
        : [
            { label: "Total Properties", sourceKey: "myPropertiesTotal", sectionKey: "myProperties" },
            { label: "Active Properties", sourceKey: "myPropertiesActive", sectionKey: "myProperties" },
            { label: "Sold Properties", sourceKey: "myPropertiesSold", sectionKey: "myProperties" },
            { label: "Rented Properties", sourceKey: "myPropertiesRented", sectionKey: "myProperties" },
            { label: "Draft Properties", sourceKey: "myPropertiesDraft", sectionKey: "myProperties" },
            { label: "Managed Properties", sourceKey: "managedPropertiesCount", sectionKey: "managedProperties" },
            { label: "Assigned Properties", sourceKey: "assignedPropertiesCount", sectionKey: "allPropertiesList" },
            { label: "Assigned leads", sourceKey: "leads", sectionKey: "leads" },
            { label: "Assigned projects", sourceKey: "assignedProjects", sectionKey: "assignedProjects" },
            { label: "Scheduled visits", sourceKey: "visits", sectionKey: "visits" }
          ],
      sections: isIndependentSales
          ? [
            { key: "myProperties", title: "My Properties", fields: ["title", "locality", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
            { key: "managedProperties", title: "Managed Properties", fields: ["title", "owner_name", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
            { key: "allPropertiesList", title: "All Properties", fields: ["title", "owner_name", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
            { key: "propertyManagementRequests", title: "Property Management Requests", fields: ["property_title", "owner_name", "status", "created_at"], permission: "manage_properties" },
            { key: "leads", title: "Leads", fields: ["name", "phone", "email", "type", "status"], permission: "manage_sales" },
            { key: "visitRequests", title: "Visit Requests", fields: ["property_title", "renter_name", "agent_name", "scheduled_at"], permission: "manage_visits" },
            { key: "visits", title: "Scheduled Visits", fields: ["property_title", "renter_name", "status", "scheduled_at"], permission: "manage_visits" },
            { key: "salesTasks", title: "Tasks & Follow-ups", fields: ["title", "assignee_name", "status", "due_at"], permission: "manage_visits" },
            { key: "salesTransactions", title: "Transactions", fields: ["property_title", "counterparty_name", "amount", "status"], permission: "manage_sales" },
            { key: "corporateClients", title: "Customers", fields: ["agency_name", "email", "phone"], permission: "manage_corporate" },
            { key: "corporateRequirements", title: "Corporate Requirements", fields: ["corp_name", "cities", "property_type", "budget"], permission: "manage_corporate" },
            { key: "myRequirements", title: "Posted Requirements", fields: ["cities", "property_type", "budget", "status"], permission: "manage_corporate" },
            { key: "requirementSuggestions", title: "Approved Suggestions", fields: ["property_title", "locality", "final_price", "type"], linkBase: "/property", linkIdKey: "property_id", permission: "manage_corporate" }
          ]
        : [
            { key: "myProperties", title: "My Properties", fields: ["title", "locality", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
            { key: "managedProperties", title: "Managed Properties", fields: ["title", "owner_name", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
            { key: "allPropertiesList", title: "All Properties", fields: ["title", "owner_name", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
            { key: "leads", title: "Assigned Leads", fields: ["name", "phone", "email", "type", "status"], permission: "manage_sales" },
            { key: "properties", title: "Assigned Properties", fields: ["owner_name", "locality", "status", "final_price"], linkBase: "/property", permission: "manage_properties" },
            { key: "assignedProjects", title: "Assigned Projects", fields: ["builder_name", "location", "status", "created_at"], permission: "manage_properties" },
            { key: "visitRequests", title: "Visit Requests", fields: ["property_title", "renter_name", "agent_name", "scheduled_at"], permission: "manage_visits" },
            { key: "visits", title: "Scheduled Visits", fields: ["property_title", "renter_name", "status", "scheduled_at"], permission: "manage_visits" },
            { key: "salesTasks", title: "Assigned Tasks", fields: ["title", "assignee_name", "status", "due_at"], permission: "manage_visits" },
            { key: "salesTransactions", title: "Transactions", fields: ["property_title", "counterparty_name", "amount", "status"], permission: "manage_sales" },
            { key: "corporateClients", title: "Assigned Customers", fields: ["agency_name", "email", "phone"], permission: "manage_corporate" },
            { key: "corporateRequirements", title: "Assigned Requirements", fields: ["corp_name", "cities", "property_type", "budget"], permission: "manage_corporate" }
          ],
      forms: [
        {
          title: "Add Lead",
          action: "/external-sales/add-lead",
          submitLabel: "Add lead",
          permission: "manage_sales",
          fields: [
            { name: "name", label: "Lead name", required: true },
            { name: "phone", label: "Phone", type: "tel" },
            { name: "email", label: "Email", type: "email" },
            { name: "type", label: "Lead type", type: "select", options: leadTypeOptions },
            { name: "property_id", label: "Property ID" },
            { name: "preferences", label: "Preferences", type: "textarea" }
          ]
        },
        {
          title: "Add Schedule Item",
          action: "/external-sales/schedule/add",
          submitLabel: "Add schedule",
          permission: "manage_visits",
          fields: [
            { name: "title", label: "Title", required: true },
            { name: "scheduled_at", label: "Scheduled at", type: "datetime-local", required: true },
            { name: "type", label: "Type", type: "select", options: [{ label: "Visit", value: "visit" }, { label: "Call", value: "call" }, { label: "Other", value: "other" }] },
            { name: "reference_id", label: "Lead ID" },
            { name: "description", label: "Description", type: "textarea" }
          ]
        },
        {
          title: "Update Task",
          action: "/sales/tasks/update",
          submitLabel: "Update task",
          permission: "manage_visits",
          fields: [
            { name: "task_id", label: "Task ID", type: "number", required: true },
            {
              name: "status",
              label: "Status",
              type: "select",
              required: true,
              options: [
                { label: "Pending", value: "pending" },
                { label: "In Progress", value: "in_progress" },
                { label: "Completed", value: "completed" },
                { label: "Cancelled", value: "cancelled" }
              ]
            },
            { name: "notes", label: "Notes", type: "textarea" }
          ]
        },
        {
          title: "Add Transaction",
          action: "/sales/transactions/add",
          submitLabel: "Add transaction",
          permission: "manage_sales",
          fields: [
            { name: "property_id", label: "Property ID", type: "number" },
            { name: "counterparty_name", label: "Counterparty", required: true },
            { name: "amount", label: "Amount", type: "number", required: true },
            { name: "stage", label: "Stage", value: "initiated" },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: [
                { label: "Pending", value: "pending" },
                { label: "Confirmed", value: "confirmed" },
                { label: "Closed", value: "closed" },
                { label: "Cancelled", value: "cancelled" }
              ]
            },
            { name: "notes", label: "Notes", type: "textarea" }
          ]
        }
      ]
    };
  }

  return {
    title: "Corporate Dashboard",
    subtitle: "Manage company profile, team users, requirements, RM assignments, shortlist, suggestions, and visits.",
    actions: [
      { href: "/requirements", label: "Requirements", permission: "manage_corporate" },
      { href: "/search", label: "Find spaces", primary: true, permission: "manage_corporate" }
    ],
    metrics: [
      { label: "Requirements", sourceKey: "requirements" },
      { label: "Suggestions", sourceKey: "requirementSuggestions" },
      { label: "Team shortlist", sourceKey: "teamShortlist" },
      { label: "Visits", sourceKey: "visits" }
    ],
    sections: [
      { key: "requirements", title: "Requirements", fields: ["cities", "property_type", "budget", "status"], permission: "manage_corporate" },
      { key: "requirementSuggestions", title: "Approved Suggestions", fields: ["property_title", "locality", "final_price", "type"], linkBase: "/property", linkIdKey: "property_id", permission: "manage_corporate" },
      { key: "teamShortlist", title: "Team Shortlist", fields: ["locality", "final_price", "type", "added_by"], linkBase: "/property", permission: "manage_corporate" },
      { key: "visits", title: "Visits", fields: ["property_title", "scheduled_by", "agent_name", "scheduled_at"], permission: "manage_visits" },
      { key: "subordinates", title: "Team Members", fields: ["username", "email", "phone", "created_at"], permission: "manage_corporate" }
    ],
      forms: [
        {
          title: "Post Requirement",
          action: "/corporate/requirements/add",
          submitLabel: "Post requirement",
          permission: "manage_corporate",
          fields: [
          { name: "cities", label: "Cities", required: true },
          { name: "locality", label: "Locality" },
          { name: "property_type", label: "Property type", type: "select", options: propertyTypeOptions },
          { name: "min_size", label: "Minimum size" },
          { name: "budget", label: "Budget" },
          { name: "description", label: "Description", type: "textarea" }
        ]
      },
        {
          title: "Add Team Member",
          description: "Requires approved corporate domain in the backend.",
          action: "/corporate/add-subordinate",
          submitLabel: "Add member",
          permission: "manage_corporate",
          fields: [
          { name: "name", label: "Name", required: true },
          { name: "email", label: "Company email", type: "email", required: true },
          { name: "phone", label: "Phone", type: "tel" },
          { name: "password", label: "Temporary password", type: "password", required: true }
        ]
      }
    ]
  };
}
