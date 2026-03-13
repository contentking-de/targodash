"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canEdit } from "@/lib/rbac";
import { getAuthenticatedBlobUrl } from "@/lib/blob-url";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TaskUser {
  id: string;
  name: string | null;
  email: string;
}

interface TaskCommentUser {
  id: string;
  name: string | null;
  email: string;
}

interface TaskCommentReaction {
  id: string;
  commentId: string;
  userId: string;
  emoji: string;
  user?: TaskCommentUser;
  createdAt: string;
}

interface TaskComment {
  id: string;
  text: string;
  userId: string;
  createdAt: string;
  user?: TaskCommentUser;
  reactions?: TaskCommentReaction[];
}

interface TaskFile {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  order: number;
  dueDate: string | null;
  category: string | null;
  labels: string[];
  creator: TaskUser;
  assignees: TaskUser[];
  comments: TaskComment[];
  files?: TaskFile[];
  createdAt: string;
  updatedAt: string;
}

interface Column {
  id: string;
  title: string;
  color: string;
  bgColor: string;
}

const COLUMNS: Column[] = [
  { id: "backlog", title: "Backlog", color: "text-slate-400", bgColor: "bg-slate-500/20" },
  { id: "todo", title: "To Do", color: "text-blue-400", bgColor: "bg-blue-500/20" },
  { id: "in_progress", title: "In Arbeit", color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
  { id: "review", title: "Review", color: "text-purple-400", bgColor: "bg-purple-500/20" },
  { id: "done", title: "Erledigt", color: "text-green-400", bgColor: "bg-green-500/20" },
];

const PRIORITIES = [
  { id: "low", label: "Niedrig", color: "text-slate-400", bgColor: "bg-slate-500/20" },
  { id: "medium", label: "Mittel", color: "text-blue-400", bgColor: "bg-blue-500/20" },
  { id: "high", label: "Hoch", color: "text-orange-400", bgColor: "bg-orange-500/20" },
  { id: "urgent", label: "Dringend", color: "text-red-400", bgColor: "bg-red-500/20" },
];

const CATEGORIES = [
  "Konto & Karten",
  "Kredit & Finanzierung",
  "Sparen & Investieren",
  "Schutz & Vorsorge",
];

// Kategorie-Farben für Timeline
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "Konto & Karten": { bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-500", text: "text-blue-700 dark:text-blue-300" },
  "Kredit & Finanzierung": { bg: "bg-green-100 dark:bg-green-900/30", border: "border-green-500", text: "text-green-700 dark:text-green-300" },
  "Sparen & Investieren": { bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-500", text: "text-purple-700 dark:text-purple-300" },
  "Schutz & Vorsorge": { bg: "bg-orange-100 dark:bg-orange-900/30", border: "border-orange-500", text: "text-orange-700 dark:text-orange-300" },
};

// Hilfsfunktionen für Dateien
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const getFileIcon = (fileType: string): string => {
  if (fileType.startsWith("image/")) return "🖼️";
  if (fileType === "application/pdf") return "📄";
  if (fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("csv")) return "📊";
  if (fileType.includes("document") || fileType.includes("word")) return "📝";
  if (fileType.includes("presentation") || fileType.includes("powerpoint")) return "📈";
  if (fileType.includes("zip") || fileType.includes("rar") || fileType.includes("tar")) return "📦";
  return "📎";
};

// Datei-Upload-Komponente
function TaskFileUploadArea({
  onUpload,
}: {
  onUpload: (files: FileList) => Promise<void>;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      try {
        await onUpload(e.target.files);
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsUploading(true);
      try {
        await onUpload(e.dataTransfer.files);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
      className={`relative border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
        isDragOver
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
      }`}
    >
      {isUploading ? (
        <div className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-slate-600 dark:text-slate-400">Wird hochgeladen...</span>
        </div>
      ) : (
        <label className="cursor-pointer">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Dateien hierher ziehen oder <span className="text-blue-600 dark:text-blue-400 underline">auswählen</span>
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-500">Max. 10 MB · PDF, DOCX, XLSX, PPTX, PNG, JPG, GIF, WebP</span>
          <input type="file" multiple accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.gif,.webp" onChange={handleFileChange} className="hidden" />
        </label>
      )}
    </div>
  );
}

// Sortable Task Card Component
function SortableTaskCard({
  task,
  onClick,
}: {
  task: Task;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm"
    >
      <TaskCardContent task={task} />
    </div>
  );
}

// Task Card Content (shared between sortable and overlay)
function TaskCardContent({ task }: { task: Task }) {
  const priority = PRIORITIES.find((p) => p.id === task.priority);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-slate-900 dark:text-white text-sm line-clamp-2">
          {task.title}
        </h4>
        {priority && (
          <span className={`px-1.5 py-0.5 text-xs rounded ${priority.bgColor} ${priority.color} shrink-0`}>
            {priority.label}
          </span>
        )}
      </div>
      
      {task.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {task.category && (
            <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
              {task.category}
            </span>
          )}
          {task.labels?.slice(0, 2).map((label) => (
            <span
              key={label}
              className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded"
            >
              {label}
            </span>
          ))}
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {task.dueDate && (
            <span className={`text-xs ${isOverdue ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`}>
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.comments.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {task.comments.length}
            </span>
          )}
          {task.files && task.files.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {task.files.length}
            </span>
          )}
          {/* Multiple Assignees */}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex -space-x-1">
              {task.assignees.slice(0, 3).map((assignee) => (
                <div
                  key={assignee.id}
                  className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium border border-white dark:border-slate-800"
                  title={assignee.name || assignee.email}
                >
                  {(assignee.name || assignee.email).charAt(0).toUpperCase()}
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="w-5 h-5 rounded-full bg-slate-400 flex items-center justify-center text-white text-xs font-medium border border-white dark:border-slate-800">
                  +{task.assignees.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Droppable Column Component
function DroppableColumn({
  column,
  tasks,
  onTaskClick,
  onAddTask,
  canEditData,
}: {
  column: Column;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (status: string) => void;
  canEditData: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-slate-100 dark:bg-slate-900/50 rounded-xl">
      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${column.bgColor}`}></span>
            <h3 className={`font-medium ${column.color}`}>{column.title}</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
              {tasks.length}
            </span>
          </div>
          {canEditData && (
            <button
              onClick={() => onAddTask(column.id)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
              title="Task hinzufügen"
            >
              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] transition-colors ${
          isOver ? "bg-blue-50 dark:bg-blue-900/20" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className={`h-20 border-2 border-dashed rounded-lg flex items-center justify-center transition-colors ${
            isOver 
              ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" 
              : "border-slate-300 dark:border-slate-700"
          }`}>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {isOver ? "Hier ablegen" : "Keine Tasks"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Task Detail Modal
function TaskDetailModal({
  task,
  users,
  onClose,
  onUpdate,
  onDelete,
  onCommentAdded,
  canEditData,
}: {
  task: Task;
  users: TaskUser[];
  onClose: () => void;
  onUpdate: (updates: Partial<Task> & { assigneeIds?: string[] }) => void;
  onDelete: () => void;
  onCommentAdded: (taskId: string, comment: TaskComment) => void;
  canEditData: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(task);
  const { data: session } = useSession();
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(
    task.assignees?.map((a) => a.id) || []
  );
  const [isSaving, setIsSaving] = useState(false);
  
  // Comment states
  const [newComment, setNewComment] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [localComments, setLocalComments] = useState<TaskComment[]>(task.comments || []);

  // Mention states
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [mentionDropdownPos, setMentionDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // File states
  const [localFiles, setLocalFiles] = useState<TaskFile[]>(task.files || []);

  // Update local comments and files when task changes
  useEffect(() => {
    setLocalComments(task.comments || []);
  }, [task.comments]);

  useEffect(() => {
    setLocalFiles(task.files || []);
  }, [task.files]);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate({
      ...editedTask,
      assigneeIds: selectedAssigneeIds,
    });
    setIsEditing(false);
    setIsSaving(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || isAddingComment) return;
    
    setIsAddingComment(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment.trim(), mentionedUserIds }),
      });

      if (response.ok) {
        const data = await response.json();
        setLocalComments((prev) => [...prev, data.comment]);
        onCommentAdded(task.id, data.comment);
        setNewComment("");
        setMentionedUserIds([]);
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsAddingComment(false);
    }
  };

  const QUICK_EMOJIS = ["👍", "❤️", "😄", "🎉", "🚀", "👀", "💯", "🙏"];
  const [openEmojiPickerFor, setOpenEmojiPickerFor] = useState<string | null>(null);

  const handleToggleReaction = async (commentId: string, emoji: string) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}/comments/${commentId}/reactions`, {
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

      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        setMentionDropdownPos({
          top: rect.top - 4,
          left: rect.left + 8,
        });
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (user: TaskUser) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
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
      if (textareaRef.current) {
        const newPos = (beforeMention + `@${mentionName} `).length;
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
        textareaRef.current.focus();
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

    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleAddComment();
    }
  };

  const handleUploadFiles = async (files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    try {
      const response = await fetch(`/api/tasks/${task.id}/files`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload fehlgeschlagen");
      }

      const data = await response.json();
      if (data.files) {
        setLocalFiles((prev) => [...data.files, ...prev]);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      alert(`Fehler beim Hochladen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Datei wirklich löschen?")) return;

    try {
      const response = await fetch(`/api/tasks/${task.id}/files?fileId=${fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Fehler beim Löschen");

      setLocalFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Fehler beim Löschen der Datei");
    }
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-4">
          <div className="flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editedTask.title}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                className="w-full text-xl font-semibold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-blue-500 outline-none text-slate-900 dark:text-white"
              />
            ) : (
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{task.title}</h2>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Erstellt von {task.creator.name || task.creator.email} am {formatDate(task.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEditData && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {canEditData && (
              <button
                onClick={onDelete}
                className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
              {isEditing ? (
                <select
                  value={editedTask.status}
                  onChange={(e) => setEditedTask({ ...editedTask, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  {COLUMNS.map((col) => (
                    <option key={col.id} value={col.id}>{col.title}</option>
                  ))}
                </select>
              ) : (
                <span className={`inline-block px-2 py-1 rounded text-sm ${COLUMNS.find((c) => c.id === task.status)?.bgColor} ${COLUMNS.find((c) => c.id === task.status)?.color}`}>
                  {COLUMNS.find((c) => c.id === task.status)?.title}
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priorität</label>
              {isEditing ? (
                <select
                  value={editedTask.priority}
                  onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              ) : (
                <span className={`inline-block px-2 py-1 rounded text-sm ${PRIORITIES.find((p) => p.id === task.priority)?.bgColor} ${PRIORITIES.find((p) => p.id === task.priority)?.color}`}>
                  {PRIORITIES.find((p) => p.id === task.priority)?.label}
                </span>
              )}
            </div>
          </div>

          {/* Assignees (Multi-Select) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Zugewiesen an ({selectedAssigneeIds.length} ausgewählt)
            </label>
            {isEditing ? (
              <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAssigneeIds.includes(user.id)}
                      onChange={() => toggleAssignee(user.id)}
                      className="rounded border-slate-300 dark:border-slate-600"
                    />
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {user.name || user.email}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {task.assignees && task.assignees.length > 0 ? (
                  task.assignees.map((assignee) => (
                    <div key={assignee.id} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-full px-2 py-1">
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                        {(assignee.name || assignee.email).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {assignee.name || assignee.email}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">Nicht zugewiesen</span>
                )}
              </div>
            )}
          </div>

          {/* Due Date & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fälligkeitsdatum</label>
              {isEditing ? (
                <input
                  type="date"
                  value={editedTask.dueDate?.split("T")[0] || ""}
                  onChange={(e) => setEditedTask({ ...editedTask, dueDate: e.target.value || null })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              ) : (
                <span className="text-slate-600 dark:text-slate-400">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString("de-DE") : "Kein Datum"}
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kategorie</label>
              {isEditing ? (
                <select
                  value={editedTask.category || ""}
                  onChange={(e) => setEditedTask({ ...editedTask, category: e.target.value || null })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Keine Kategorie</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              ) : (
                <span className="text-slate-600 dark:text-slate-400">{task.category || "Keine Kategorie"}</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Beschreibung</label>
            {isEditing ? (
              <textarea
                value={editedTask.description || ""}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value || null })}
                rows={4}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                placeholder="Beschreibung hinzufügen..."
              />
            ) : (
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {task.description || "Keine Beschreibung"}
              </p>
            )}
          </div>

          {/* Files Section */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Dateien ({localFiles.length})
            </label>
            
            {/* Bestehende Dateien */}
            {localFiles.length > 0 ? (
              <div className="space-y-2 mb-3">
                {localFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-900 rounded-lg group"
                  >
                    <a
                      href={getAuthenticatedBlobUrl(file.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 flex-1 min-w-0 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <span className="text-lg flex-shrink-0">{getFileIcon(file.fileType)}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-900 dark:text-white block truncate">
                          {file.fileName}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-500">
                          {formatFileSize(file.fileSize)} • {formatDate(file.createdAt)}
                        </span>
                      </div>
                    </a>
                    {isEditing && (
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                        title="Datei löschen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : !isEditing ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Keine Dateien</p>
            ) : null}

            {/* Upload - nur im Bearbeitungsmodus */}
            {isEditing && (
              <TaskFileUploadArea onUpload={handleUploadFiles} />
            )}
          </div>

          {/* Comments Section */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Kommentare & Notizen ({localComments.length})
            </label>
            
            {/* Existing Comments */}
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
                  <div key={comment.id} className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 group/comment">
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium shrink-0">
                        {(comment.user?.name || comment.user?.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {comment.user?.name || comment.user?.email || "Unbekannt"}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-500">
                            {formatDate(comment.createdAt)}
                          </span>
                          {/* Quick reaction button */}
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
                          {(() => {
                            const userNames = users.map((u) => u.name || u.email.split("@")[0]).filter(Boolean);
                            if (userNames.length === 0) return comment.text;
                            const escapedNames = userNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
                            const mentionRegex = new RegExp(`(@(?:${escapedNames.join("|")}))`, "g");
                            const parts = comment.text.split(mentionRegex);
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
                          })()}
                        </p>
                        {/* Reactions */}
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
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {/* Add Comment Form */}
            {canEditData && (
              <div className="relative">
                <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                  <textarea
                    ref={textareaRef}
                    value={newComment}
                    onChange={handleCommentChange}
                    placeholder="Kommentar oder Notiz hinzufügen... Tippe @ um jemanden zu erwähnen"
                    rows={6}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm resize-y border-0 focus:ring-0 focus:outline-none min-h-[120px]"
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
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || isAddingComment}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                    >
                      {isAddingComment ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Senden...
                        </>
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
                {/* Mention Dropdown – fixed to viewport to avoid overflow clipping */}
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
            )}
          </div>
        </div>

        {/* Footer */}
        {isEditing && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
            <button
              onClick={() => {
                setEditedTask(task);
                setSelectedAssigneeIds(task.assignees?.map((a) => a.id) || []);
                setIsEditing(false);
              }}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition-colors"
            >
              {isSaving ? "Speichern..." : "Speichern"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// New Task Modal
function NewTaskModal({
  status,
  users,
  onClose,
  onCreate,
}: {
  status: string;
  users: TaskUser[];
  onClose: () => void;
  onCreate: (task: { title: string; description: string | null; status: string; priority: string; category: string | null; dueDate: string | null; assigneeIds: string[] }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const toggleAssignee = (userId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    
    setIsCreating(true);
    await onCreate({
      title,
      description: description || null,
      status,
      priority,
      category: category || null,
      dueDate: dueDate || null,
      assigneeIds,
    });
    setIsCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Neuen Task erstellen
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            In Spalte: {COLUMNS.find((c) => c.id === status)?.title}
          </p>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Titel *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task-Titel eingeben..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Beschreibung
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibung hinzufügen..."
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Priorität
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Kategorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="">Keine Kategorie</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Multi-Select Assignees */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Zuweisen an ({assigneeIds.length} ausgewählt)
            </label>
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              {users.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={assigneeIds.includes(user.id)}
                    onChange={() => toggleAssignee(user.id)}
                    className="rounded border-slate-300 dark:border-slate-600"
                  />
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {user.name || user.email}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Fälligkeitsdatum
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          {/* Hinweis auf Datei-Upload */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Dateien können nach dem Erstellen im Task-Detail hochgeladen werden.
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !title.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition-colors"
          >
            {isCreating ? "Erstelle..." : "Task erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Timeline View Component
function TimelineView({
  tasks,
  onTaskClick,
  filterCategory,
}: {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  filterCategory: string;
}) {
  // Nur Tasks mit Fälligkeitsdatum anzeigen
  const tasksWithDueDate = tasks.filter((task) => task.dueDate);
  
  // Tasks nach Kategorie filtern (falls Filter gesetzt)
  const filteredTasks = filterCategory === "all" 
    ? tasksWithDueDate 
    : tasksWithDueDate.filter((task) => task.category === filterCategory);

  // Zeitraum berechnen (heute bis 8 Wochen in die Zukunft)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 7); // Eine Woche in der Vergangenheit für überfällige Tasks
  
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 56); // 8 Wochen in die Zukunft

  // Wochen generieren
  const weeks: { start: Date; end: Date; label: string }[] = [];
  const currentWeekStart = new Date(startDate);
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1); // Montag
  
  while (currentWeekStart < endDate) {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    weeks.push({
      start: new Date(currentWeekStart),
      end: weekEnd,
      label: `KW ${getWeekNumber(currentWeekStart)}`,
    });
    
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  // Hilfsfunktion für Kalenderwoche
  function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Tasks nach Kategorie gruppieren
  const categories = filterCategory === "all" 
    ? [...new Set(filteredTasks.map((t) => t.category || "Keine Kategorie"))]
    : [filterCategory];

  // Position eines Tasks auf der Timeline berechnen
  const getTaskPosition = (dueDate: string, createdAt: string) => {
    const due = new Date(dueDate);
    const created = new Date(createdAt);
    
    const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Startposition (Erstelldatum oder Anfang der Timeline)
    const effectiveStart = created < startDate ? startDate : created;
    const startPosition = Math.max(0, ((effectiveStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100);
    
    // Endposition (Fälligkeitsdatum)
    const endPosition = Math.min(100, ((due.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100);
    
    // Breite
    const width = Math.max(2, endPosition - startPosition);
    
    return { left: startPosition, width };
  };

  // Heute-Linie Position
  const todayPosition = ((today.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100;

  if (filteredTasks.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center">
        <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
          Keine Tasks mit Fälligkeitsdatum
        </h3>
        <p className="text-slate-500 dark:text-slate-400">
          Füge Tasks ein Fälligkeitsdatum hinzu, um sie in der Timeline zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden">
      {/* Timeline Header mit Wochen */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex">
          {/* Kategorie-Spalte */}
          <div className="w-48 flex-shrink-0 p-3 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Kategorie</span>
          </div>
          {/* Wochen-Header */}
          <div className="flex-1 flex relative">
            {weeks.map((week, idx) => (
              <div
                key={idx}
                className="flex-1 p-2 text-center border-r border-slate-200 dark:border-slate-700 last:border-r-0"
              >
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{week.label}</span>
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  {week.start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Body */}
      <div>
        {categories.map((category) => {
          const categoryTasks = filteredTasks.filter((t) => (t.category || "Keine Kategorie") === category);
          if (categoryTasks.length === 0) return null;
          
          const colors = CATEGORY_COLORS[category] || { bg: "bg-slate-100 dark:bg-slate-700", border: "border-slate-400", text: "text-slate-700 dark:text-slate-300" };
          
          return (
            <div key={category} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
              {/* Kategorie-Header */}
              <div className="flex bg-slate-50 dark:bg-slate-900/30">
                <div className="w-48 flex-shrink-0 p-3 border-r border-slate-200 dark:border-slate-700">
                  <span className={`text-sm font-medium ${colors.text}`}>{category}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">({categoryTasks.length})</span>
                </div>
                <div className="flex-1 relative min-h-[40px]">
                  {/* Heute-Linie */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                    style={{ left: `${todayPosition}%` }}
                  >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-1 py-0.5 bg-red-500 text-white text-xs rounded whitespace-nowrap">
                      Heute
                    </div>
                  </div>
                  {/* Wochen-Grid */}
                  <div className="absolute inset-0 flex">
                    {weeks.map((_, idx) => (
                      <div key={idx} className="flex-1 border-r border-slate-100 dark:border-slate-800 last:border-r-0" />
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Tasks in dieser Kategorie */}
              {categoryTasks.map((task) => {
                const position = getTaskPosition(task.dueDate!, task.createdAt);
                const isOverdue = new Date(task.dueDate!) < today && task.status !== "done";
                const priority = PRIORITIES.find((p) => p.id === task.priority);
                const status = COLUMNS.find((c) => c.id === task.status);
                
                return (
                  <div key={task.id} className="flex hover:bg-slate-50 dark:hover:bg-slate-900/20">
                    <div className="w-48 flex-shrink-0 p-2 border-r border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => onTaskClick(task)}
                        className="text-left w-full"
                      >
                        <p className="text-sm text-slate-900 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {status && (
                            <span className={`px-1.5 py-0.5 text-xs rounded ${status.bgColor} ${status.color}`}>
                              {status.title}
                            </span>
                          )}
                        </div>
                      </button>
                    </div>
                    <div className="flex-1 relative py-2 px-1">
                      {/* Heute-Linie */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500/30 z-0"
                        style={{ left: `${todayPosition}%` }}
                      />
                      {/* Wochen-Grid */}
                      <div className="absolute inset-0 flex">
                        {weeks.map((_, idx) => (
                          <div key={idx} className="flex-1 border-r border-slate-100 dark:border-slate-800 last:border-r-0" />
                        ))}
                      </div>
                      {/* Task-Balken */}
                      <div
                        className={`absolute top-2 bottom-2 rounded-full cursor-pointer transition-all hover:opacity-80 ${colors.bg} border-l-4 ${colors.border} ${isOverdue ? "opacity-60" : ""}`}
                        style={{
                          left: `${position.left}%`,
                          width: `${position.width}%`,
                          minWidth: "60px",
                        }}
                        onClick={() => onTaskClick(task)}
                        title={`${task.title} - Fällig: ${new Date(task.dueDate!).toLocaleDateString("de-DE")}`}
                      >
                        <div className="h-full flex items-center px-2 overflow-hidden">
                          <span className={`text-xs font-medium truncate ${colors.text}`}>
                            {task.title}
                          </span>
                          {priority && (
                            <span className={`ml-1 px-1 py-0.5 text-xs rounded ${priority.bgColor} ${priority.color} shrink-0`}>
                              {priority.label.charAt(0)}
                            </span>
                          )}
                          {isOverdue && (
                            <span className="ml-1 text-red-500 text-xs shrink-0">!</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-medium text-slate-600 dark:text-slate-400">Legende:</span>
          {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => (
            <div key={cat} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${colors.bg} border-l-2 ${colors.border}`} />
              <span className="text-slate-600 dark:text-slate-400">{cat}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 ml-4">
            <div className="w-3 h-0.5 bg-red-500" />
            <span className="text-slate-600 dark:text-slate-400">Heute</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function TasksPage() {
  const { data: session } = useSession();
  const canEditData = canEdit(session?.user?.role);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<"kanban" | "timeline">("kanban");

  // Filter states
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch("/api/tasks");
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, [fetchTasks, fetchUsers]);

  useEffect(() => {
    const taskId = searchParams.get("taskId");
    if (taskId && tasks.length > 0 && !selectedTask) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setSelectedTask(task);
        router.replace("/tasks", { scroll: false });
      }
    }
  }, [searchParams, tasks, selectedTask, router]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;

    if (!over) return;

    const activeTaskId = active.id as string;
    const activeTask = tasks.find((t) => t.id === activeTaskId);
    if (!activeTask) return;

    // Determine target status - could be dropping on a column or on another task
    let targetStatus: string;
    let targetOrder: number;

    const overTask = tasks.find((t) => t.id === over.id);
    
    if (overTask) {
      // Dropped on another task
      targetStatus = overTask.status;
      const columnTasks = tasks.filter((t) => t.status === targetStatus);
      targetOrder = columnTasks.findIndex((t) => t.id === over.id);
    } else {
      // Dropped on a column
      targetStatus = over.id as string;
      const columnTasks = tasks.filter((t) => t.status === targetStatus);
      targetOrder = columnTasks.length; // Add at the end
    }

    // Optimistically update the UI
    setTasks((prevTasks) => {
      const updatedTasks = prevTasks.map((t) => {
        if (t.id === activeTaskId) {
          return { ...t, status: targetStatus };
        }
        return t;
      });
      
      // Reorder within the column
      const columnTasks = updatedTasks.filter((t) => t.status === targetStatus);
      const otherTasks = updatedTasks.filter((t) => t.status !== targetStatus);
      
      const movedTask = columnTasks.find((t) => t.id === activeTaskId);
      const remainingColumnTasks = columnTasks.filter((t) => t.id !== activeTaskId);
      
      if (movedTask) {
        remainingColumnTasks.splice(targetOrder, 0, movedTask);
      }
      
      // Update order numbers
      const reorderedColumnTasks = remainingColumnTasks.map((t, idx) => ({
        ...t,
        order: idx,
      }));
      
      return [...otherTasks, ...reorderedColumnTasks];
    });

    // Send update to server
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: activeTaskId,
          newStatus: targetStatus,
          newOrder: targetOrder,
        }),
      });
    } catch (error) {
      console.error("Error reordering task:", error);
      // Reload on error to sync with server
      fetchTasks();
    }
  };

  const handleCreateTask = async (taskData: { title: string; description: string | null; status: string; priority: string; category: string | null; dueDate: string | null; assigneeIds: string[] }) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });

      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const handleUpdateTask = async (updates: Partial<Task> & { assigneeIds?: string[] }) => {
    if (!selectedTask) return;

    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setTasks((prev) => prev.map((t) => (t.id === data.task.id ? data.task : t)));
        setSelectedTask(data.task);
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    if (!confirm("Task wirklich löschen?")) return;

    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
        setSelectedTask(null);
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filterPriority !== "all" && task.priority !== filterPriority) return false;
    if (filterCategory !== "all" && task.category !== filterCategory) return false;
    if (filterAssignee !== "all") {
      if (filterAssignee === "unassigned" && task.assignees?.length > 0) return false;
      if (filterAssignee !== "unassigned" && !task.assignees?.some((a) => a.id === filterAssignee)) return false;
    }
    return true;
  });

  // Group tasks by column
  const tasksByColumn = COLUMNS.reduce((acc, column) => {
    acc[column.id] = filteredTasks
      .filter((task) => task.status === column.id)
      .sort((a, b) => a.order - b.order);
    return acc;
  }, {} as Record<string, Task[]>);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tasks</h1>
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tasks</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {viewMode === "kanban" ? "Kanban Board für Aufgabenverwaltung" : "Zeitliche Übersicht aller Tasks"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                viewMode === "kanban"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Kanban
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                viewMode === "timeline"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Timeline
            </button>
          </div>
          {canEditData && (
            <button
              onClick={() => setNewTaskStatus("backlog")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Neuer Task
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Priorität</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle</option>
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Kategorie</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Zugewiesen</label>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle</option>
            <option value="unassigned">Nicht zugewiesen</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name || user.email}</option>
            ))}
          </select>
        </div>
        {session?.user?.id && (
          <button
            onClick={() =>
              setFilterAssignee(filterAssignee === session.user.id ? "all" : session.user.id)
            }
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              filterAssignee === session.user.id
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Meine Tasks
          </button>
        )}
        <div className="flex-1"></div>
        <div>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {filteredTasks.length} von {tasks.length} Tasks
          </span>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === "kanban" && (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
            {COLUMNS.map((column) => (
              <DroppableColumn
                key={column.id}
                column={column}
                tasks={tasksByColumn[column.id]}
                onTaskClick={setSelectedTask}
                onAddTask={setNewTaskStatus}
                canEditData={canEditData}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-blue-500 shadow-lg w-72 opacity-90">
                <TaskCardContent task={activeTask} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Timeline View */}
      {viewMode === "timeline" && (
        <TimelineView
          tasks={filteredTasks}
          onTaskClick={setSelectedTask}
          filterCategory={filterCategory}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          onCommentAdded={(taskId, comment) => {
            // Update tasks list with new comment
            setTasks((prev) =>
              prev.map((t) =>
                t.id === taskId
                  ? { ...t, comments: [...t.comments, comment] }
                  : t
              )
            );
            // Update selected task
            setSelectedTask((prev) =>
              prev && prev.id === taskId
                ? { ...prev, comments: [...prev.comments, comment] }
                : prev
            );
          }}
          canEditData={canEditData}
        />
      )}

      {/* New Task Modal */}
      {newTaskStatus && (
        <NewTaskModal
          status={newTaskStatus}
          users={users}
          onClose={() => setNewTaskStatus(null)}
          onCreate={handleCreateTask}
        />
      )}
    </div>
  );
}
