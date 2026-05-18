import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Mail, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SiteShell } from "@/components/layout/SiteShell";

const SUPPORT_EMAIL = "support@huxzain.shop";
const SUPPORT_WHATSAPP = "+91 80996 41606";
const SUPPORT_WHATSAPP_URL = "https://wa.me/918099641606";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact HUXZAIN" }] }),
  component: ContactPage,
});

function ContactPage() {
  const startedAt = useMemo(() => Date.now(), []);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    category: "general",
    message: "",
    website: "",
  });

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, startedAt }),
    });
    const json = await res.json().catch(() => ({})) as { error?: string };
    setLoading(false);

    if (!res.ok) {
      toast.error(json.error ?? "Could not send your message.");
      return;
    }

    toast.success("Message sent. Support will review it shortly.");
    setForm({ name: "", email: "", subject: "", category: "general", message: "", website: "" });
  };

  return (
    <SiteShell>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-3">Support</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Contact HUXZAIN</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Get help with orders, seller verification, payments, listings, disputes, and account security.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface/70 p-4 transition-colors hover:border-crimson/40"
            >
              <Mail className="size-5 text-crimson" />
              <span>
                <span className="block text-sm font-semibold">Support email</span>
                <span className="block text-sm text-muted-foreground">{SUPPORT_EMAIL}</span>
              </span>
            </a>
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg border border-border bg-surface/70 p-4 transition-colors hover:border-crimson/40"
            >
              <MessageCircle className="size-5 text-crimson" />
              <span>
                <span className="block text-sm font-semibold">WhatsApp support</span>
                <span className="block text-sm text-muted-foreground">{SUPPORT_WHATSAPP}</span>
              </span>
            </a>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface/70 p-4">
            <ShieldCheck className="mt-0.5 size-5 text-crimson" />
            <p className="text-sm leading-6 text-muted-foreground">
              Keep order, payment, and account conversations on HUXZAIN. Support will never ask for OTPs or passwords.
            </p>
          </div>
        </section>

        <form onSubmit={submit} className="glass-strong rounded-2xl p-5 space-y-4 sm:p-8">
          <input
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={update("website")}
            aria-hidden="true"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input value={form.name} onChange={update("name")} required maxLength={120} className="input-style" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={update("email")} required className="input-style" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field label="Subject">
              <input value={form.subject} onChange={update("subject")} required maxLength={160} className="input-style" />
            </Field>
            <Field label="Category">
              <select value={form.category} onChange={update("category")} className="input-style">
                <option value="general">General</option>
                <option value="payment">Payment</option>
                <option value="dispute">Dispute</option>
                <option value="technical">Technical</option>
                <option value="account">Account</option>
                <option value="listing">Listing</option>
                <option value="fraud">Fraud</option>
              </select>
            </Field>
          </div>
          <Field label="Message">
            <textarea
              value={form.message}
              onChange={update("message")}
              required
              minLength={20}
              maxLength={5000}
              rows={7}
              className="input-style resize-y"
            />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-crimson px-5 py-3.5 text-sm font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-crimson-glow disabled:opacity-50"
          >
            <Send className="size-4" />
            {loading ? "Sending..." : "Send message"}
          </button>
        </form>
      </div>
      <style>{`.input-style { width:100%; background:var(--surface-elevated); border:1px solid var(--border); border-radius:0.5rem; padding:0.75rem 1rem; font-size:0.875rem; color:var(--foreground); outline:none; transition:border-color .15s; }
      .input-style:focus { border-color: oklch(0.55 0.22 25 / 0.5); }`}</style>
    </SiteShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
