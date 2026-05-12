/**
 * Single source of truth for the order lifecycle.
 * Mirrors the order_status enum in the database.
 */

export type OrderStatus =
  | "pending_payment"
  | "payment_pending"
  | "paid"
  | "admin_review"
  | "approved"
  | "credential_released"
  | "in_progress"
  | "delivered"
  | "rented"
  | "completed"
  | "cancelled"
  | "disputed"
  | "refunded";

export interface StatusMeta {
  label: string;
  tone: "neutral" | "info" | "warning" | "success" | "danger";
  description: string;
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  pending_payment: { label: "Awaiting payment", tone: "warning", description: "Buyer hasn't paid yet." },
  payment_pending: { label: "Payment processing", tone: "warning", description: "Payment received, confirming with bank." },
  paid: { label: "Paid", tone: "info", description: "Payment confirmed. Awaiting seller credentials." },
  admin_review: { label: "Admin review", tone: "info", description: "Seller submitted credentials. Admin verifying." },
  approved: { label: "Approved", tone: "success", description: "Admin approved. Releasing credentials." },
  credential_released: { label: "Credentials released", tone: "success", description: "Buyer received account credentials." },
  in_progress: { label: "In progress", tone: "info", description: "Seller is fulfilling the order." },
  delivered: { label: "Delivered", tone: "info", description: "Seller marked as delivered. Awaiting buyer confirmation." },
  rented: { label: "Rented", tone: "info", description: "Account rented. Active rental period." },
  completed: { label: "Completed", tone: "success", description: "Order complete. Funds settled." },
  cancelled: { label: "Cancelled", tone: "danger", description: "Order was cancelled." },
  disputed: { label: "Disputed", tone: "danger", description: "Buyer or seller raised a dispute. Admin reviewing." },
  refunded: { label: "Refunded", tone: "neutral", description: "Order was refunded." },
};

export const TIMELINE_ORDER: OrderStatus[] = [
  "pending_payment",
  "paid",
  "admin_review",
  "approved",
  "credential_released",
  "completed",
];

export function statusToneClass(status: OrderStatus): string {
  switch (STATUS_META[status]?.tone) {
    case "success": return "text-green-400 border-green-500/40 bg-green-500/10";
    case "info":    return "text-blue-300 border-blue-500/40 bg-blue-500/10";
    case "warning": return "text-yellow-300 border-yellow-500/40 bg-yellow-500/10";
    case "danger":  return "text-crimson border-crimson/40 bg-crimson/10";
    default:        return "text-muted-foreground border-border bg-surface";
  }
}

export function statusLabel(status: string): string {
  return STATUS_META[status as OrderStatus]?.label ?? status.replace(/_/g, " ");
}

/**
 * Admin actions allowed at each stage. Used to render the action panel.
 */
export interface AdminAction {
  next: OrderStatus;
  label: string;
  variant: "primary" | "danger" | "neutral";
  requiresReason?: boolean;
}

export function adminActionsFor(status: OrderStatus, hasHandoff: boolean): AdminAction[] {
  const actions: AdminAction[] = [];
  if (status === "paid" && hasHandoff) {
    actions.push({ next: "admin_review", label: "Start review", variant: "primary" });
  }
  if (status === "admin_review") {
    actions.push({ next: "approved", label: "Approve handoff", variant: "primary" });
    actions.push({ next: "disputed", label: "Hold for dispute", variant: "danger", requiresReason: true });
  }
  if (status === "approved") {
    actions.push({ next: "credential_released", label: "Release credentials to buyer", variant: "primary" });
  }
  if (status === "credential_released" || status === "delivered" || status === "rented") {
    actions.push({ next: "completed", label: "Mark completed", variant: "primary" });
  }
  if (status === "disputed") {
    actions.push({ next: "completed", label: "Resolve in buyer's favor (complete)", variant: "primary" });
    actions.push({ next: "refunded", label: "Refund buyer", variant: "danger", requiresReason: true });
  }
  if (["paid", "admin_review", "approved", "in_progress", "delivered", "rented"].includes(status)) {
    actions.push({ next: "cancelled", label: "Cancel order", variant: "danger", requiresReason: true });
  }
  return actions;
}