"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/PageHeader";

const inputClass =
  "mt-2 w-full rounded-xl border border-field-border bg-field px-4 py-3 text-field-foreground outline-none ring-[color:var(--wc-red)]/30 focus:ring-2";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    setMessage(data.message || "Password updated.");
    setLoading(false);
    setTimeout(() => {
      router.push("/login");
    }, 1500);
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-fifa wc-page-title">Invalid link</h1>
        <p className="wc-page-desc mx-auto mt-4">
          This reset link is missing or invalid. Request a new one below.
        </p>
        <Link href="/forgot-password" className="wc-btn mt-8 inline-block">
          Request reset link
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <BrandMark size="lg" />
        </div>
        <p className="wc-kicker">CODPARTNER INTERNAL POOL</p>
        <h1 className="font-fifa wc-page-title mt-2">Choose new password</h1>
        <p className="wc-page-desc mx-auto">
          Enter a new password for your account. The link expires in 1 hour.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="wc-glass rounded-3xl p-6">
        <label className="block text-sm font-medium text-foreground/80">
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            className={inputClass}
            required
            minLength={8}
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-foreground/80">
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat your password"
            className={inputClass}
            required
            minLength={8}
          />
        </label>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        {message && <p className="mt-4 text-sm text-success">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="wc-btn mt-6 w-full disabled:cursor-not-allowed"
        >
          {loading ? "Updating..." : "Update password"}
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
