export type PostStatus = "draft" | "scheduled" | "published" | "failed";
export type PostType = "service" | "promotion" | "tip" | "intro" | "combo";
export type Tone = "friendly" | "professional" | "luxury";
export type Platform = "facebook" | "zalo" | "tiktok";
export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "done";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  category: string | null;
  duration: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  caption: string;
  hashtags: string | null;
  imageUrl: string | null;
  platform: Platform;
  postType: PostType;
  tone: Tone;
  status: PostStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  qualityScore: number | null;
  serviceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentRequest {
  id: string;
  name: string;
  phone: string | null;
  service: string | null;
  preferredAt: string | null;
  note: string | null;
  status: AppointmentStatus;
  source: string;
  createdAt: Date;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  success: boolean;
}
