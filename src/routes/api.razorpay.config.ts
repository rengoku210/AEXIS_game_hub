import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/razorpay/config")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          keyIdConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
          keySecretConfigured: Boolean(process.env.RAZORPAY_KEY_SECRET),
          webhookSecretConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
          keyIdPrefix: process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_")
            ? "test"
            : process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_")
            ? "live"
            : null,
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  }
});
