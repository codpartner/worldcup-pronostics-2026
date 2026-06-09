"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/PageHeader";

const inputClass =
  "mt-2 w-full rounded-xl border border-field-border bg-field px-4 py-3 text-field-foreground outline-none ring-[color:var(--wc-red)]/30 focus:ring-2";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    setMessage(
      data.message ||
        "If an account exists for that email, we sent a password reset link."
    );
    setLoading(false);
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <BrandMark size="lg" />
        </div>
        <p className="wc-kicker">CODPARTNER INTERNAL POOL</p>
        <h1 className="font-fifa wc-page-title mt-2">Reset password</h1>
        <p className="wc-page-desc mx-auto">
          Enter your work email and we&apos;ll send you a link to choose a new
          password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="wc-glass rounded-3xl p-6">
        <label className="block text-sm font-medium text-foreground/80">
          Work email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@codpartner.com"
            className={inputClass}
            required
          />
        </label>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        {message && <p className="mt-4 text-sm text-success">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="wc-btn mt-6 w-full disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-foreground hover:underline">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
