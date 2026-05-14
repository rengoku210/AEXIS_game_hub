import { supabase } from "@/integrations/supabase/client";

export async function createRazorpayOrder(data: { listing_id: string; buyer_notes?: string }) {
  const { data: res, error } = await supabase.functions.invoke("create-razorpay-order", {
    body: data,
  });
  if (error) throw error;
  if (res?.error) throw new Error(res.error);
  return res;
}

export async function verifyRazorpayPayment(data: any) {
  const { data: res, error } = await supabase.functions.invoke("verify-razorpay-payment", {
    body: data,
  });
  if (error) throw error;
  if (res?.error) throw new Error(res.error);
  return res;
}
