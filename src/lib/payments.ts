import { getAccessToken } from "@/lib/auth/api";

export async function createRazorpayOrder(data: { listing_id: string; buyer_notes?: string }) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch("/api/razorpay/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || "Failed to create order");
  }

  return await res.json();
}

export async function verifyRazorpayPayment(data: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch("/api/razorpay/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || "Failed to verify payment");
  }

  return await res.json();
}
