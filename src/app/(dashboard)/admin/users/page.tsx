"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from "@/lib/rbac";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form states
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/users");
      if (response.status === 403) {
        setError("Keine Berechtigung für diese Seite");
        return;
      }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Fehler beim Laden der Nutzer");
    } finally {
      setIsLoading(false);
    }
  };

  const createUser = async () => {
    if (!newEmail.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          name: newName.trim() || null,
          role: newRole,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error);
        return;
      }

      if (data.user) {
        setUsers([data.user, ...users]);
        setShowNewForm(false);
        setNewEmail("");
        setNewName("");
        setNewRole("member");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      setError("Fehler beim Erstellen des Nutzers");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateUser = async (userId: string, updates: { name?: string; role?: string }) => {
    try {
      setError(null);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error);
        return;
      }

      if (data.user) {
        setUsers(users.map((u) => (u.id === userId ? data.user : u)));
        setEditingUser(null);
      }
    } catch (error) {
      console.error("Error updating user:", error);
      setError("Fehler beim Aktualisieren des Nutzers");
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Nutzer wirklich löschen? Alle zugehörigen Daten werden ebenfalls gelöscht.")) return;

    try {
      setError(null);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error);
        return;
      }

      setUsers(users.filter((u) => u.id !== userId));
    } catch (error) {
      console.error("Error deleting user:", error);
      setError("Fehler beim Löschen des Nutzers");
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "superadmin":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "agentur":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "compliance":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "legal":
        return "bg-pink-500/20 text-pink-400 border-pink-500/30";
      case "dev":
        return "bg-teal-500/20 text-teal-400 border-teal-500/30";
      case "member":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "viewer":
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Prüfe ob User volle Admin-Rechte hat (Superadmin oder Agentur)
  const hasAdminRights = session?.user?.role === "superadmin" || session?.user?.role === "agentur";
  if (!hasAdminRights) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nutzerverwaltung</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400">Sie haben keine Berechtigung für diese Seite.</p>
          <p className="text-slate-400 text-sm mt-2">Nur Superadmins und Agenturen können Nutzer verwalten.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nutzerverwaltung</h1>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nutzerverwaltung</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {users.length} Nutzer im System
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Nutzer
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Neuer Nutzer Form */}
      {showNewForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Neuen Nutzer anlegen
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  E-Mail *
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nutzer@example.com"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Max Mustermann"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Rolle
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="viewer">Betrachter - Kann nur lesen</option>
                <option value="member">Mitglied - Kann bearbeiten</option>
                <option value="compliance">Compliance - Content-Review</option>
                <option value="legal">Legal - Legal-Review</option>
                <option value="dev">Dev - Production-Ready</option>
                <option value="superadmin">Superadmin - Volle Rechte</option>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {ROLE_DESCRIPTIONS[newRole]}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={createUser}
                disabled={isSubmitting || !newEmail.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isSubmitting ? "Erstelle..." : "Nutzer anlegen"}
              </button>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  setNewEmail("");
                  setNewName("");
                  setNewRole("member");
                  setError(null);
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rollen-Übersicht */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(["superadmin", "agentur", "compliance", "legal", "dev", "member", "viewer"] as Role[]).map((role) => {
          const count = users.filter((u) => u.role === role).length;
          return (
            <div
              key={role}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 text-xs rounded-full border ${getRoleColor(role)}`}>
                  {ROLE_LABELS[role]}
                </span>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{count}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          );
        })}
      </div>

      {/* User Liste */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                Nutzer
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                Rolle
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                Erstellt
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {user.name || "—"}
                      {user.id === session?.user?.id && (
                        <span className="ml-2 text-xs text-blue-500">(Sie)</span>
                      )}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editingUser?.id === user.id ? (
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                      className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-sm"
                    >
                      <option value="viewer">Betrachter</option>
                      <option value="member">Mitglied</option>
                      <option value="compliance">Compliance</option>
                      <option value="legal">Legal</option>
                      <option value="dev">Dev</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 text-xs rounded-full border ${getRoleColor(user.role)}`}>
                      {ROLE_LABELS[user.role as Role] || user.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {editingUser?.id === user.id ? (
                      <>
                        <button
                          onClick={() => updateUser(user.id, { role: editingUser.role })}
                          className="p-1.5 text-green-500 hover:bg-green-500/10 rounded transition-colors"
                          title="Speichern"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="p-1.5 text-slate-500 hover:bg-slate-500/10 rounded transition-colors"
                          title="Abbrechen"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                          title="Bearbeiten"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {user.id !== session?.user?.id && (
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                            title="Löschen"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
