"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { canEdit } from "@/lib/rbac";
import { StatCard } from "@/components/ui/StatCard";

interface TicketCommentReaction {
  id: string;
  commentId: string;
  userId: string;
  emoji: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface TicketComment {
  id: string;
  text: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  reactions: TicketCommentReaction[];
  createdAt: string;
}

interface TicketAssignee {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  type: "bug" | "feature";
  status: "open" | "in_progress" | "closed";
  priority: "low" | "medium" | "high";
  user: {
    name: string | null;
    email: string;
  };
  assignees: TicketAssignee[];
  comments: TicketComment[];
  createdAt: string;
  updatedAt: string;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

export default function TicketsPage() {
  const { data: session } = useSession();
  const canEditData = canEdit(session?.user?.role);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showClosed, setShowClosed] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<"bug" | "feature">("feature");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail ref for scroll behavior
  const detailRef = useRef<HTMLDivElement>(null);

  // Comment state
  const [newComment, setNewComment] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);

  // Mention states
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [mentionDropdownPos, setMentionDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Reaction states
  const QUICK_EMOJIS = ["👍", "❤️", "😄", "🎉", "🚀", "👀", "💯", "🙏"];
  const [openEmojiPickerFor, setOpenEmojiPickerFor] = useState<string | null>(null);
  const [localComments, setLocalComments] = useState<TicketComment[]>([]);

  // Assignee edit state (für Detail-View)
  const [isEditingAssignees, setIsEditingAssignees] = useState(false);
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [isSavingAssignees, setIsSavingAssignees] = useState(false);

  useEffect(() => {
    fetchTickets();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedTicket && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedTicket?.id]);

  useEffect(() => {
    setLocalComments(selectedTicket?.comments || []);
    setMentionedUserIds([]);
    setShowMentionDropdown(false);
    setOpenEmojiPickerFor(null);
  }, [selectedTicket?.id, selectedTicket?.comments]);

  const filteredMentionUsers = users.filter((u) => {
    if (!mentionSearch) return true;
    const search = mentionSearch.toLowerCase();
    return (u.name || "").toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
  });

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setNewComment(value);

    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s@]*)$/);

    if (mentionMatch) {
      setMentionSearch(mentionMatch[1]);
      setShowMentionDropdown(true);
      setMentionIndex(0);

      if (commentTextareaRef.current) {
        const rect = commentTextareaRef.current.getBoundingClientRect();
        setMentionDropdownPos({
          top: rect.top - 4,
          left: rect.left + 8,
        });
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (user: UserOption) => {
    if (!commentTextareaRef.current) return;
    const cursorPos = commentTextareaRef.current.selectionStart;
    const textBeforeCursor = newComment.slice(0, cursorPos);
    const textAfterCursor = newComment.slice(cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s@]*)$/);
    if (!mentionMatch) return;

    const mentionName = user.name || user.email.split("@")[0];
    const beforeMention = textBeforeCursor.slice(0, mentionMatch.index);
    const newText = `${beforeMention}@${mentionName} ${textAfterCursor}`;
    setNewComment(newText);
    setShowMentionDropdown(false);

    if (!mentionedUserIds.includes(user.id)) {
      setMentionedUserIds((prev) => [...prev, user.id]);
    }

    setTimeout(() => {
      if (commentTextareaRef.current) {
        const newPos = (beforeMention + `@${mentionName} `).length;
        commentTextareaRef.current.selectionStart = newPos;
        commentTextareaRef.current.selectionEnd = newPos;
        commentTextareaRef.current.focus();
      }
    }, 0);
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionDropdown && filteredMentionUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMentionUsers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMentionUsers[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionDropdown(false);
        return;
      }
    }

    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && selectedTicket) {
      addComment(selectedTicket.id);
    }
  };

  const handleToggleReaction = async (commentId: string, emoji: string) => {
    if (!selectedTicket) return;
    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/comments/${commentId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });

      if (response.ok) {
        const data = await response.json();
        setLocalComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, reactions: data.reactions } : c
          )
        );
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
    setOpenEmojiPickerFor(null);
  };

  const renderCommentText = (text: string) => {
    const userNames = users.map((u) => u.name || u.email.split("@")[0]).filter(Boolean);
    if (userNames.length === 0) return text;
    const escapedNames = userNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const mentionRegex = new RegExp(`(@(?:${escapedNames.join("|")}))`, "g");
    const parts = text.split(mentionRegex);
    return parts.map((part, i) => {
      if (part.startsWith("@") && userNames.some((n) => part === `@${n}`)) {
        return (
          <span key={i} className="text-purple-600 dark:text-purple-400 font-medium bg-purple-50 dark:bg-purple-900/20 rounded px-0.5">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/tickets");
      const data = await response.json();
      setTickets(data.tickets || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const createTicket = async () => {
    if (!newTitle.trim() || !newDescription.trim()) return;

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          type: newType,
          priority: newPriority,
          assigneeIds: newAssigneeIds,
        }),
      });

      const data = await response.json();
      if (data.ticket) {
        setTickets([data.ticket, ...tickets]);
        setShowNewForm(false);
        setNewTitle("");
        setNewDescription("");
        setNewType("feature");
        setNewPriority("medium");
        setNewAssigneeIds([]);
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
      alert("Fehler beim Erstellen des Tickets");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();
      if (data.ticket) {
        setTickets(tickets.map((t) => (t.id === ticketId ? data.ticket : t)));
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(data.ticket);
        }
      }
    } catch (error) {
      console.error("Error updating ticket:", error);
    }
  };

  const updateTicketAssignees = async (ticketId: string, assigneeIds: string[]) => {
    try {
      setIsSavingAssignees(true);
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeIds }),
      });

      const data = await response.json();
      if (data.ticket) {
        setTickets(tickets.map((t) => (t.id === ticketId ? data.ticket : t)));
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(data.ticket);
        }
        setIsEditingAssignees(false);
      }
    } catch (error) {
      console.error("Error updating assignees:", error);
    } finally {
      setIsSavingAssignees(false);
    }
  };

  const addComment = async (ticketId: string) => {
    if (!newComment.trim()) return;

    try {
      setIsAddingComment(true);
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment.trim(), mentionedUserIds }),
      });

      if (response.ok) {
        const ticketResponse = await fetch(`/api/tickets/${ticketId}`);
        const data = await ticketResponse.json();
        if (data.ticket) {
          setTickets(tickets.map((t) => (t.id === ticketId ? data.ticket : t)));
          setSelectedTicket(data.ticket);
        }
        setNewComment("");
        setMentionedUserIds([]);
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsAddingComment(false);
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!confirm("Ticket wirklich löschen?")) return;

    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTickets(tickets.filter((t) => t.id !== ticketId));
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(null);
        }
      }
    } catch (error) {
      console.error("Error deleting ticket:", error);
    }
  };

  const getTypeLabel = (type: string) => {
    return type === "bug" ? "Bug" : "Feature";
  };

  const getTypeColor = (type: string) => {
    return type === "bug"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : "bg-purple-500/20 text-purple-400 border-purple-500/30";
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return "Offen";
      case "in_progress":
        return "In Bearbeitung";
      case "closed":
        return "Geschlossen";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "in_progress":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "closed":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Hoch";
      case "medium":
        return "Mittel";
      case "low":
        return "Niedrig";
      default:
        return priority;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-400";
      case "medium":
        return "text-yellow-400";
      case "low":
        return "text-slate-400";
      default:
        return "text-slate-400";
    }
  };

  const toggleAssignee = (userId: string, currentIds: string[], setIds: (ids: string[]) => void) => {
    if (currentIds.includes(userId)) {
      setIds(currentIds.filter((id) => id !== userId));
    } else {
      setIds([...currentIds, userId]);
    }
  };

  const getUserDisplayName = (user: { name: string | null; email: string }) => {
    return user.name || user.email;
  };

  const filteredTickets = tickets
    .filter((ticket) => {
      if (filterType !== "all" && ticket.type !== filterType) return false;
      if (filterStatus !== "all" && ticket.status !== filterStatus) return false;
      if (!showClosed && filterStatus === "all" && ticket.status === "closed") return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Berechne Ticket-Statistiken
  const ticketStats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tickets</h1>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tickets</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Bugs melden und Feature-Wünsche einreichen
          </p>
        </div>
        {canEditData && (
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neues Ticket
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Gesamt Tickets"
          value={ticketStats.total}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          title="Offen"
          value={ticketStats.open}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="In Bearbeitung"
          value={ticketStats.inProgress}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Geschlossen"
          value={ticketStats.closed}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Neues Ticket Form */}
      {showNewForm && canEditData && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Neues Ticket erstellen
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Typ *
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as "bug" | "feature")}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="feature">Feature-Wunsch</option>
                  <option value="bug">Bug-Report</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Priorität
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as "low" | "medium" | "high")}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Titel *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Kurze Beschreibung des Problems oder Wunsches"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Beschreibung *
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Detaillierte Beschreibung..."
                rows={4}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            {/* Assignee Multi-Select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Zuweisen an
              </label>
              <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                {/* Ausgewählte Assignees als Tags */}
                {newAssigneeIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 border-b border-slate-200 dark:border-slate-700">
                    {newAssigneeIds.map((uid) => {
                      const user = users.find((u) => u.id === uid);
                      if (!user) return null;
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-sm"
                        >
                          {getUserDisplayName(user)}
                          <button
                            type="button"
                            onClick={() => toggleAssignee(uid, newAssigneeIds, setNewAssigneeIds)}
                            className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-200"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {/* User-Liste */}
                <div className="max-h-40 overflow-y-auto">
                  {users.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={newAssigneeIds.includes(user.id)}
                        onChange={() => toggleAssignee(user.id, newAssigneeIds, setNewAssigneeIds)}
                        className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white truncate">
                          {user.name || "—"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {user.email}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Zugewiesene Personen werden per E-Mail benachrichtigt
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={createTicket}
                disabled={isSubmitting || !newTitle.trim() || !newDescription.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isSubmitting ? "Erstelle..." : "Ticket erstellen"}
              </button>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  setNewTitle("");
                  setNewDescription("");
                  setNewAssigneeIds([]);
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Typ
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle</option>
            <option value="bug">Bugs</option>
            <option value="feature">Features</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle</option>
            <option value="open">Offen</option>
            <option value="in_progress">In Bearbeitung</option>
            <option value="closed">Geschlossen</option>
          </select>
        </div>
        {filterStatus === "all" && (
          <button
            onClick={() => setShowClosed(!showClosed)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 ${
              showClosed
                ? "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showClosed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              )}
            </svg>
            {showClosed
              ? `Geschlossene angezeigt (${ticketStats.closed})`
              : `Geschlossene einblenden (${ticketStats.closed})`}
          </button>
        )}
      </div>

      {/* Tickets Liste und Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tickets Liste */}
        <div className="space-y-3">
          {filteredTickets.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
              <p className="text-slate-500 dark:text-slate-400">
                {tickets.length === 0
                  ? "Noch keine Tickets vorhanden"
                  : "Keine Tickets mit diesen Filtern"}
              </p>
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => {
                  setSelectedTicket(ticket);
                  setIsEditingAssignees(false);
                }}
                className={`bg-white dark:bg-slate-800 rounded-xl p-4 border cursor-pointer transition-all ${
                  selectedTicket?.id === ticket.id
                    ? "border-blue-500 ring-2 ring-blue-500/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full border ${getTypeColor(
                          ticket.type
                        )}`}
                      >
                        {getTypeLabel(ticket.type)}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(
                          ticket.status
                        )}`}
                      >
                        {getStatusLabel(ticket.status)}
                      </span>
                    </div>
                    <h3 className="font-medium text-slate-900 dark:text-white truncate">
                      {ticket.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-500">
                      <span>{ticket.user.name || ticket.user.email}</span>
                      <span>·</span>
                      <span>{formatDate(ticket.createdAt)}</span>
                      {ticket.comments && ticket.comments.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{ticket.comments.length} Kommentare</span>
                        </>
                      )}
                    </div>
                    {/* Assignees Badges in der Liste */}
                    {ticket.assignees && ticket.assignees.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ticket.assignees.map((assignee) => (
                          <span
                            key={assignee.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {assignee.user.name || assignee.user.email}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
                    {getPriorityLabel(ticket.priority)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Ticket Detail */}
        {selectedTicket && (
          <div>
            <div ref={detailRef} className="scroll-mt-6" />
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full border ${getTypeColor(
                        selectedTicket.type
                      )}`}
                    >
                      {getTypeLabel(selectedTicket.type)}
                    </span>
                    <span className={`text-sm ${getPriorityColor(selectedTicket.priority)}`}>
                      Priorität: {getPriorityLabel(selectedTicket.priority)}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {selectedTicket.title}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Erstellt von {selectedTicket.user.name || selectedTicket.user.email} am{" "}
                    {formatDate(selectedTicket.createdAt)}
                  </p>
                </div>
                {canEditData && (
                  <button
                    onClick={() => deleteTicket(selectedTicket.id)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Ticket löschen"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Status ändern */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Status ändern
                </label>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => updateTicketStatus(selectedTicket.id, e.target.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border ${getStatusColor(
                    selectedTicket.status
                  )} bg-transparent`}
                >
                  <option value="open">Offen</option>
                  <option value="in_progress">In Bearbeitung</option>
                  <option value="closed">Geschlossen</option>
                </select>
              </div>
            </div>

            {/* Assignees Section */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Zugewiesen an
                </h3>
                {canEditData && !isEditingAssignees && (
                  <button
                    onClick={() => {
                      setEditAssigneeIds(selectedTicket.assignees.map((a) => a.user.id));
                      setIsEditingAssignees(true);
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Bearbeiten
                  </button>
                )}
              </div>

              {isEditingAssignees ? (
                <div>
                  <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                    {/* Ausgewählte Assignees als Tags */}
                    {editAssigneeIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 p-2 border-b border-slate-200 dark:border-slate-700">
                        {editAssigneeIds.map((uid) => {
                          const user = users.find((u) => u.id === uid);
                          if (!user) return null;
                          return (
                            <span
                              key={uid}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-sm"
                            >
                              {getUserDisplayName(user)}
                              <button
                                type="button"
                                onClick={() => toggleAssignee(uid, editAssigneeIds, setEditAssigneeIds)}
                                className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-200"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="max-h-40 overflow-y-auto">
                      {users.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={editAssigneeIds.includes(user.id)}
                            onChange={() => toggleAssignee(user.id, editAssigneeIds, setEditAssigneeIds)}
                            className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-900 dark:text-white truncate">
                              {user.name || "—"}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {user.email}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => updateTicketAssignees(selectedTicket.id, editAssigneeIds)}
                      disabled={isSavingAssignees}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                    >
                      {isSavingAssignees ? "Speichere..." : "Speichern"}
                    </button>
                    <button
                      onClick={() => setIsEditingAssignees(false)}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-sm rounded-lg transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {selectedTicket.assignees && selectedTicket.assignees.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.assignees.map((assignee) => (
                        <div
                          key={assignee.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg"
                        >
                          <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-medium">
                            {(assignee.user.name || assignee.user.email).charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {assignee.user.name || assignee.user.email}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                      Niemand zugewiesen
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Beschreibung */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Beschreibung
              </h3>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {selectedTicket.description}
              </p>
            </div>

            {/* Kommentare */}
            <div className="p-6">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
                Kommentare ({localComments.length})
              </h3>

              {localComments.length > 0 && (
                <div className="space-y-3 mb-4">
                  {localComments.map((comment) => {
                    const reactionGroups = new Map<string, { emoji: string; users: { id: string; name: string | null; email: string }[]; count: number }>();
                    (comment.reactions || []).forEach((r) => {
                      const existing = reactionGroups.get(r.emoji);
                      const user = r.user || { id: r.userId, name: null, email: "Unbekannt" };
                      if (existing) {
                        existing.users.push(user);
                        existing.count++;
                      } else {
                        reactionGroups.set(r.emoji, { emoji: r.emoji, users: [user], count: 1 });
                      }
                    });

                    return (
                      <div
                        key={comment.id}
                        className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 group/comment"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium shrink-0">
                              {(comment.user?.name || comment.user?.email || "?").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {comment.user?.name || comment.user?.email || "Unbekannt"}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-500">
                              {formatDate(comment.createdAt)}
                            </span>
                          </div>
                          <div className="relative ml-auto">
                            <button
                              onClick={() => setOpenEmojiPickerFor(openEmojiPickerFor === comment.id ? null : comment.id)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-0 group-hover/comment:opacity-100 transition-all"
                              title="Reaktion hinzufügen"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            {openEmojiPickerFor === comment.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenEmojiPickerFor(null)} />
                                <div className="absolute right-0 top-8 z-20 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 flex gap-1">
                                  {QUICK_EMOJIS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleToggleReaction(comment.id, emoji)}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-lg transition-colors hover:scale-110"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {renderCommentText(comment.text)}
                        </p>

                        {reactionGroups.size > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {Array.from(reactionGroups.values()).map((group) => {
                              const hasReacted = group.users.some((u) => u.id === session?.user?.id);
                              return (
                                <button
                                  key={group.emoji}
                                  onClick={() => handleToggleReaction(comment.id, group.emoji)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all hover:scale-105 ${
                                    hasReacted
                                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700"
                                      : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700"
                                  }`}
                                  title={group.users.map((u) => u.name || u.email).join(", ")}
                                >
                                  <span className="text-sm">{group.emoji}</span>
                                  <span>{group.count}</span>
                                </button>
                              );
                            })}
                            <button
                              onClick={() => setOpenEmojiPickerFor(openEmojiPickerFor === comment.id ? null : comment.id)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                              title="Reaktion hinzufügen"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Neuer Kommentar mit @-Mentions */}
              <div className="relative">
                <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                  <textarea
                    ref={commentTextareaRef}
                    value={newComment}
                    onChange={handleCommentChange}
                    placeholder="Kommentar hinzufügen... Tippe @ um jemanden zu erwähnen"
                    rows={4}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm resize-y border-0 focus:ring-0 focus:outline-none min-h-[80px]"
                    onKeyDown={handleCommentKeyDown}
                  />
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Cmd/Ctrl + Enter zum Senden
                      </span>
                      {mentionedUserIds.length > 0 && (
                        <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                          {mentionedUserIds.length} Person{mentionedUserIds.length !== 1 ? "en" : ""} erwähnt
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => addComment(selectedTicket.id)}
                      disabled={isAddingComment || !newComment.trim()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                    >
                      {isAddingComment ? (
                        "Sende..."
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Senden
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Mention Dropdown */}
                {showMentionDropdown && filteredMentionUsers.length > 0 && mentionDropdownPos && (
                  <div
                    className="fixed w-72 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 max-h-52 overflow-y-auto z-50"
                    style={{ top: mentionDropdownPos.top, left: mentionDropdownPos.left, transform: "translateY(-100%)" }}
                  >
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Personen
                    </div>
                    {filteredMentionUsers.map((user, idx) => (
                      <button
                        key={user.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMention(user);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors ${
                          idx === mentionIndex
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium shrink-0">
                          {(user.name || user.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block truncate font-medium">{user.name || user.email}</span>
                          {user.name && (
                            <span className="block truncate text-xs text-slate-400 dark:text-slate-500">{user.email}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
