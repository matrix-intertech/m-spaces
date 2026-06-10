export type UserRole =
  | "tenant"
  | "owner"
  | "builder"
  | "broker"
  | "agent"
  | "external_sales"
  | "corporate"
  | "corporate_user"
  | "admin"
  | "support";

export interface User {
  id: number;
  username?: string | null;
  name?: string | null;
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: UserRole | string | null;
  parent_id?: number | null;
  sales_agent_type?: "associated" | "independent" | string | null;
  parent_type?: "broker" | "builder" | string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  account_number?: string | null;
  agency_name?: string | null;
  city?: string | null;
  locality?: string | null;
}

export interface Property {
  id: number;
  title?: string | null;
  type?: string | null;
  condition?: string | null;
  contact?: string | null;
  listing_type?: "rent" | "sale" | string | null;
  locality?: string | null;
  city?: string | null;
  address?: string | null;
  final_price?: number | string | null;
  price?: number | string | null;
  rent?: number | string | null;
  size?: string | number | null;
  photos?: string[] | string | null;
  photo?: string | null;
  image_url?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  is_matrix_verified?: boolean | null;
  status?: string | null;
  description?: string | null;
  amenities?: string[] | string | null;
  facing?: string | null;
  configuration?: string | null;
  floor_number?: string | null;
  total_floors?: string | null;
  overlooking?: string | null;
  property_age?: string | null;
  owner_id?: number | null;
  ownership_type?: "self_owned" | "managed" | "managed_for_owner" | "broker_managed" | "sales_managed" | "builder_inventory" | string | null;
  assigned_broker_id?: number | null;
  assigned_brokers?: number[] | null;
  listed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  verification_status?: string | null;
  project_name?: string | null;
  possession_status?: string | null;
  video_url?: string | null;
}

export interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface ApiEnvelope<T> {
  status?: "success" | "error";
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PropertyListResponse {
  properties: Property[];
  pagination?: Pagination;
}

export interface Conversation {
  id: number;
  property_id?: number;
  property_title?: string | null;
  photos?: string[] | string | null;
  final_price?: number | string | null;
  price?: number | string | null;
  rent?: number | string | null;
  size?: number | string | null;
  listing_type?: string | null;
  locality?: string | null;
  city?: string | null;
  property_owner_id?: number | null;
  assigned_broker_id?: number | null;
  assigned_brokers?: number[] | null;
  effective_manager_id?: number | null;
  buyer_id?: number;
  owner_id?: number;
  buyer_username?: string | null;
  manager_username?: string | null;
  other_user_name?: string | null;
  other_user_avatar?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  updated_at?: string | null;
  unread_count?: number;
  is_bot_enabled?: boolean;
}

export interface ChatMessage {
  id?: number;
  conversation_id?: number;
  sender_id?: number;
  senderId?: number;
  clientMessageId?: string;
  content: string;
  created_at?: string;
  timestamp?: string;
  is_read?: boolean;
}
