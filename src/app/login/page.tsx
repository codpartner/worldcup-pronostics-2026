"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/PageHeader";

type Mode = "login" | "signup";

const inputClass =
  "mt-2 w-full rounded-xl border border-field-border bg-field px-4 py-3 text-field-foreground outline-none ring-[color:var(--wc-red)]/30 focus:ring-2";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const workDomain = "codpartner.com";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const body =
      mode === "signup"
        ? { name, email, password }
        : { email, password };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    router.push("/matches");
    router.refresh();
  }

  function tabClass(active: boolean) {
    return active ? "wc-filter-active" : "text-muted hover:text-foreground";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 px-4 py-10 lg:flex-row lg:items-center">
      <div className="wc-login-hero relative hidden aspect-[4/5] w-full max-w-sm overflow-hidden lg:block">
        <Image
          src="/images/wc2026-banner.png"
          alt="FIFA World Cup 2026"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute bottom-5 left-5 right-5">
          <p className="font-fifa text-3xl leading-none text-white">WORLD CUP</p>
          <p className="font-fifa mt-1 text-5xl leading-none text-white">2026</p>
        </div>
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center lg:text-left">
          <div className="mx-auto mb-4 flex justify-center lg:mx-0 lg:justify-start">
            <BrandMark size="lg" />
          </div>
          <p className="wc-kicker">CODPARTNER INTERNAL POOL</p>
          <h1 className="font-fifa wc-page-title mt-2 text-left lg:text-left">
            Pronostics
          </h1>
          <p className="wc-page-desc text-left">
            Sign up with your work email, pick match winners, and compete with
            the team.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-default wc-glass p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tabClass(mode === "login")}`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tabClass(mode === "signup")}`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="wc-glass rounded-3xl p-6">
          {mode === "signup" && (
            <label className="block text-sm font-medium text-foreground/80">
              Full name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Alex Martin"
                className={inputClass}
                required
              />
            </label>
          )}

          <label
            className={`block text-sm font-medium text-foreground/80 ${
              mode === "signup" ? "mt-4" : ""
            }`}
          >
            Work email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={`you@${workDomain}`}
              className={inputClass}
              required
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-foreground/80">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                mode === "signup" ? "At least 8 characters" : "Your password"
              }
              className={inputClass}
              required
              minLength={mode === "signup" ? 8 : 1}
            />
          </label>

          {mode === "login" && (
            <p className="mt-2 text-right text-sm">
              <a
                href="/forgot-password"
                className="font-semibold text-[color:var(--wc-red)] hover:underline"
              >
                Forgot password?
              </a>
            </p>
          )}

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="wc-btn mt-6 w-full disabled:cursor-not-allowed"
          >
            {loading
              ? mode === "signup"
                ? "Creating account..."
                : "Logging in..."
              : mode === "signup"
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        <div className="wc-glass mt-6 rounded-2xl p-4 text-sm text-muted">
          <p className="font-fifa text-base text-foreground/80">Scoring</p>
          <ul className="mt-2 space-y-1">
            <li>1 pt — correct winner (or draw)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
