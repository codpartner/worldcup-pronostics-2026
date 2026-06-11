"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  predictionsCount: number;
  totalPoints: number;
  groupRankingsSet: boolean;
  bracketSubmitted: boolean;
}

type EditState =
  | { kind: "profile"; user: AdminUser; name: string; email: string }
  | { kind: "password"; user: AdminUser; password: string }
  | null;

function formatDate(value: string) {
  return new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const reload = useCallback(async () => {
    const response = await fetch("/api/admin/users");
    if (!response.ok) {
      setError("Could not load users.");
      return;
    }
    const data = await response.json();
    setUsers(data.users || []);
  }, []);

  useEffect(() => {
    async function load() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const meData = await meRes.json();
      if (!meData.user?.isAdmin) {
        router.push("/matches");
        return;
      }
      setCurrentUserId(meData.user.id);
      await reload();
      setLoading(false);
    }
    load();
  }, [router, reload]);

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [filter, users]);

  function flash(msg: string) {
    setMessage(msg);
    setError(null);
    window.setTimeout(() => setMessage((m) => (m === msg ? null : m)), 4000);
  }

  async function toggleAdmin(user: AdminUser) {
    setBusyId(user.id);
    setError(null);
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "admin", isAdmin: !user.isAdmin }),
    });
    const data = await response.json();
    setBusyId(null);
    if (!response.ok) {
      setError(data.error || "Could not update admin access.");
      return;
    }
    await reload();
    flash(`${user.name} is ${!user.isAdmin ? "now an admin" : "no longer an admin"}.`);
  }

  async function resetPicks(user: AdminUser) {
    if (
      !window.confirm(
        `Reset ALL data for ${user.name}? This deletes their match picks, pick history, group rankings, and submitted bracket. This cannot be undone.`
      )
    ) {
      return;
    }
    setBusyId(user.id);
    setError(null);
    const response = await fetch(`/api/admin/users/${user.id}/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    setBusyId(null);
    if (!response.ok) {
      setError(data.error || "Could not reset picks.");
      return;
    }
    await reload();
    flash(`All picks reset for ${user.name}.`);
  }

  async function deleteUser(user: AdminUser) {
    if (
      !window.confirm(
        `Permanently delete ${user.name} (${user.email}) and all their data? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusyId(user.id);
    setError(null);
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    setBusyId(null);
    if (!response.ok) {
      setError(data.error || "Could not delete user.");
      return;
    }
    await reload();
    flash(`${user.name} deleted.`);
  }

  async function saveEdit() {
    if (!edit) return;
    setSavingEdit(true);
    setError(null);

    const body =
      edit.kind === "profile"
        ? { action: "profile", name: edit.name, email: edit.email }
        : { action: "password", password: edit.password };

    const response = await fetch(`/api/admin/users/${edit.user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    setSavingEdit(false);
    if (!response.ok) {
      setError(data.error || "Could not save changes.");
      return;
    }
    const editedName = edit.user.name;
    setEdit(null);
    await reload();
    flash(
      edit.kind === "profile"
        ? `Profile updated for ${editedName}.`
        : `Password updated for ${editedName}.`
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-muted">
        Loading users...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="wc-kicker">
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
            {" / "}Users
          </p>
          <h1 className="font-fifa wc-page-title mt-2">Manage users</h1>
          <p className="wc-page-desc">
            {users.length} player{users.length === 1 ? "" : "s"}. Edit profiles,
            reset passwords, toggle admin access, reset picks, or delete accounts.
          </p>
        </div>
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search name or email..."
          className="w-full rounded-xl border border-field-border bg-field text-field-foreground px-4 py-3 text-foreground outline-none ring-emerald-400/40 focus:ring-2 sm:max-w-xs"
        />
      </div>

      {message && <p className="mb-4 text-sm text-success">{message}</p>}
      {error && <p className="mb-4 text-danger">{error}</p>}

      <div className="wc-glass overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="wc-table-head text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Player</th>
              <th className="px-4 py-3 font-medium">Picks</th>
              <th className="px-4 py-3 font-medium">Points</th>
              <th className="px-4 py-3 font-medium">Bracket</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((user) => {
                const self = user.id === currentUserId;
                const busy = busyId === user.id;
                return (
                  <tr key={user.id} className="border-t border-default align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {user.name}
                        </Link>
                        {user.isAdmin && (
                          <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Admin
                          </span>
                        )}
                        {self && (
                          <span className="text-[10px] uppercase tracking-wider text-muted">
                            (you)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted">{user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-foreground/80">
                      {user.predictionsCount}
                    </td>
                    <td className="px-4 py-3 text-foreground/80">
                      {user.totalPoints}
                    </td>
                    <td className="px-4 py-3 text-foreground/80">
                      {user.bracketSubmitted ? "Submitted" : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="wc-btn-secondary px-3 py-1.5 text-xs"
                        >
                          View picks
                        </Link>
                        <button
                          onClick={() =>
                            setEdit({
                              kind: "profile",
                              user,
                              name: user.name,
                              email: user.email,
                            })
                          }
                          disabled={busy}
                          className="wc-btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            setEdit({ kind: "password", user, password: "" })
                          }
                          disabled={busy}
                          className="wc-btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                        >
                          Password
                        </button>
                        <button
                          onClick={() => toggleAdmin(user)}
                          disabled={busy || (self && user.isAdmin)}
                          className="wc-btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                          title={
                            self && user.isAdmin
                              ? "You cannot remove your own admin access"
                              : undefined
                          }
                        >
                          {user.isAdmin ? "Revoke admin" : "Make admin"}
                        </button>
                        <button
                          onClick={() => resetPicks(user)}
                          disabled={busy}
                          className="rounded-full border border-amber-400/50 px-3 py-1.5 text-xs font-semibold text-amber-600 transition hover:bg-amber-400/10 disabled:opacity-50 dark:text-amber-400"
                        >
                          Reset picks
                        </button>
                        <button
                          onClick={() => deleteUser(user)}
                          disabled={busy || self}
                          className="rounded-full border border-red-400/50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-400/10 disabled:opacity-50 dark:text-red-400"
                          title={self ? "You cannot delete your own account" : undefined}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !savingEdit && setEdit(null)}
        >
          <div
            className="wc-glass w-full max-w-md rounded-2xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-fifa mb-1 text-lg text-foreground">
              {edit.kind === "profile" ? "Edit profile" : "Set new password"}
            </h2>
            <p className="mb-4 text-sm text-muted">{edit.user.email}</p>

            {edit.kind === "profile" ? (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-foreground/80">
                  Name
                  <input
                    value={edit.name}
                    onChange={(event) =>
                      setEdit({ ...edit, name: event.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-field-border bg-field text-field-foreground px-3 py-2 outline-none ring-emerald-400/40 focus:ring-2"
                  />
                </label>
                <label className="text-sm font-medium text-foreground/80">
                  Email
                  <input
                    type="email"
                    value={edit.email}
                    onChange={(event) =>
                      setEdit({ ...edit, email: event.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-field-border bg-field text-field-foreground px-3 py-2 outline-none ring-emerald-400/40 focus:ring-2"
                  />
                </label>
              </div>
            ) : (
              <label className="text-sm font-medium text-foreground/80">
                New password
                <input
                  type="text"
                  value={edit.password}
                  placeholder="At least 8 characters"
                  onChange={(event) =>
                    setEdit({ ...edit, password: event.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-field-border bg-field text-field-foreground px-3 py-2 outline-none ring-emerald-400/40 focus:ring-2"
                />
              </label>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEdit(null)}
                disabled={savingEdit}
                className="wc-btn-secondary px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="wc-btn px-4 py-2 text-sm disabled:opacity-50"
              >
                {savingEdit ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
