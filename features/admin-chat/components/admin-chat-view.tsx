"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getAdminChatAction,
  listAdminChatMessagesAction,
  listAdminChatsAction,
  markAdminChatReadAction,
  openAdminChatAction,
  sendAdminChatMessageAction,
} from "@/features/admin-chat/actions";
import { useAdminChatSocket } from "@/features/admin-chat/hooks/use-admin-chat-socket";
import {
  ADMIN_CHAT_MEDIA,
  adminChatFileSrc,
  adminChatFileUploadUrl,
  adminChatImageUploadUrl,
  isAdminChatFile,
  isAdminChatImage,
} from "@/lib/api/admin-chat-media";
import { EmptyState } from "@/components/feedback/empty-state";
import { useToast } from "@/components/providers/toast-provider";
import { AnchoredMenu } from "@/components/ui/anchored-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type {
  AdminChatConversation,
  AdminChatMessage,
} from "@/types/admin-chat";

const MAX_CONTENT = 4000;
const PAGE_LIMIT = 50;
const ADMIN_LABEL = "Carl Admin";

type ConversationRow = AdminChatConversation & {
  preview?: string;
};

function formatRel(value: string | null | undefined): string {
  if (!value) return "";
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (mins < 1) return "Just now";
  if (mins < 60) return mins === 1 ? "1 Min ago" : `${mins} Min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return h === 1 ? "1 Hour ago" : `${h} Hour ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 Day ago" : `${d} Day ago`;
}

function formatClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function dayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function sortConversations(rows: ConversationRow[]): ConversationRow[] {
  return [...rows].sort((a, b) => {
    const aAt = a.lastMessageAt ?? a.updatedAt ?? a.createdAt;
    const bAt = b.lastMessageAt ?? b.updatedAt ?? b.createdAt;
    return new Date(bAt).getTime() - new Date(aAt).getTime();
  });
}

function upsertConversation(
  rows: ConversationRow[],
  next: ConversationRow,
): ConversationRow[] {
  const without = rows.filter((row) => row.id !== next.id);
  return sortConversations([next, ...without]);
}

function mergeMessages(
  existing: AdminChatMessage[],
  incoming: AdminChatMessage[],
): AdminChatMessage[] {
  const byId = new Map<string, AdminChatMessage>();
  for (const row of existing) byId.set(row.id, row);
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function threadTitle(row: ConversationRow): string {
  const subject = row.subject?.trim();
  if (subject && !/^untitled(\s+ticket)?$/i.test(subject)) return subject;
  const preview = row.preview?.trim();
  if (preview && preview !== "No messages yet" && preview !== "Message") {
    return preview.length > 48 ? `${preview.slice(0, 48)}…` : preview;
  }
  return "Admin support";
}

function ticketStatusLabel(status: ConversationRow["status"]): string {
  return status === "CLOSED" ? "Closed" : "Open";
}

/** Short human ticket ref from conversation id. */
function ticketCode(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = clean.slice(-6) || clean.slice(0, 6) || "TICKET";
  return `#${tail}`;
}

type TicketFilter = "open" | "closed" | "all";

function previewFromMessage(message: AdminChatMessage): string {
  const caption = message.content.trim();
  if (message.messageType === "IMAGE") return caption || "Photo";
  if (message.messageType === "FILE") return caption || message.fileName || "Document";
  return caption || "Message";
}

function attachmentSrc(message: AdminChatMessage): string {
  const raw = message.imageUrl || message.fileUrl;
  if (
    raw &&
    /^https?:\/\//i.test(raw) &&
    !/\/agents\/me\/admin-chats\//.test(raw)
  ) {
    return raw;
  }
  return adminChatFileSrc(message.conversationId, message.id);
}

function ChatAttachment({ message }: { message: AdminChatMessage }) {
  const caption = message.content.trim();
  if (message.messageType === "IMAGE") {
    const src = attachmentSrc(message);
    return (
      <div className="min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption || "Photo"}
          className="max-h-56 max-w-full rounded-[12px] object-cover"
        />
        {caption ? (
          <p className="mt-2 whitespace-pre-wrap break-words">{caption}</p>
        ) : null}
      </div>
    );
  }
  if (message.messageType === "FILE") {
    const src = attachmentSrc(message);
    const name = message.fileName?.trim() || "Document";
    return (
      <div className="min-w-0">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[#377dff] underline"
        >
          {name}
        </a>
        {caption && caption !== name ? (
          <p className="mt-2 whitespace-pre-wrap break-words">{caption}</p>
        ) : null}
      </div>
    );
  }
  return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
}

function SupportIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="24" cy="24" r="22" className="stroke-accent/25" strokeWidth="2" />
      <path
        d="M24 28v-2m0-10a2.5 2.5 0 0 0-2.5 2.5V22c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5V18.5A2.5 2.5 0 0 0 24 16Z"
        className="stroke-accent"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 24a10 10 0 0 0 20 0"
        className="stroke-accent"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 24v3a2 2 0 0 0 2 2h2m16-5v3a2 2 0 0 1-2 2h-2"
        className="stroke-accent"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function padCount(value: number): string {
  return String(value).padStart(2, "0");
}

const TICKET_FILTERS: { id: TicketFilter; label: string; bar: string }[] = [
  { id: "open", label: "Open", bar: "OPEN" },
  { id: "closed", label: "Close", bar: "CLOSE" },
  { id: "all", label: "All", bar: "ALL" },
];

export function AdminChatView({
  initialConversations,
}: {
  initialConversations: AdminChatConversation[];
}) {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ConversationRow[]>(() =>
    sortConversations(initialConversations),
  );
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const sorted = sortConversations(initialConversations);
    return (
      sorted.find((row) => row.status === "OPEN")?.id ??
      sorted[0]?.id ??
      null
    );
  });
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [openSubject, setOpenSubject] = useState("");
  const [openMessage, setOpenMessage] = useState("");
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>("open");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchGen = useRef(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threads = useRef(
    new Map<string, { messages: AdminChatMessage[]; hasOlder: boolean }>(),
  );
  const stickToBottom = useRef(true);
  const prefetchedPreviews = useRef(new Set<string>());

  const selected = useMemo(
    () => conversations.find((row) => row.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const refreshList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const result = await listAdminChatsAction();
    setListLoading(false);
    if (!result.ok) {
      setListError(result.message);
      return;
    }
    setConversations((prev) => {
      const previews = new Map(prev.map((row) => [row.id, row.preview]));
      return sortConversations(
        result.data.map((row) => ({
          ...row,
          preview: previews.get(row.id),
        })),
      );
    });
  }, []);

  const onSocketMessage = useCallback(
    (message: AdminChatMessage) => {
      const isOpenThread = message.conversationId === selectedId;
      const preview = previewFromMessage(message);

      setConversations((prev) => {
        const existing = prev.find((row) => row.id === message.conversationId);
        const next: ConversationRow = existing
          ? {
              ...existing,
              preview,
              lastMessageAt: message.createdAt,
              updatedAt: message.createdAt,
              unreadCount:
                message.sender === "ADMIN" && !isOpenThread
                  ? (existing.unreadCount ?? 0) + 1
                  : isOpenThread
                    ? 0
                    : existing.unreadCount,
            }
          : {
              id: message.conversationId,
              status: "OPEN",
              subject: null,
              preview,
              lastMessageAt: message.createdAt,
              createdAt: message.createdAt,
              updatedAt: message.createdAt,
              closedAt: null,
              unreadCount: message.sender === "ADMIN" && !isOpenThread ? 1 : 0,
            };
        return upsertConversation(prev, next);
      });

      if (!isOpenThread) {
        const saved = threads.current.get(message.conversationId);
        if (saved) {
          threads.current.set(message.conversationId, {
            messages: mergeMessages(saved.messages, [message]),
            hasOlder: saved.hasOlder,
          });
        }
        return;
      }
      setMessages((prev) => {
        const next = mergeMessages(prev, [message]);
        threads.current.set(message.conversationId, {
          messages: next,
          hasOlder: threads.current.get(message.conversationId)?.hasOlder ?? false,
        });
        return next;
      });
      if (message.sender === "ADMIN") {
        void markAdminChatReadAction(message.conversationId);
      }
    },
    [selectedId],
  );

  const onSocketConversation = useCallback(
    (conversation: AdminChatConversation) => {
      setConversations((prev) => {
        const existing = prev.find((row) => row.id === conversation.id);
        return upsertConversation(prev, {
          ...conversation,
          preview: existing?.preview,
        });
      });
    },
    [],
  );

  useAdminChatSocket({
    conversationId: selectedId,
    onMessage: onSocketMessage,
    onConversationUpdated: onSocketConversation,
  });

  useEffect(() => {
    const missing = conversations.filter(
      (row) => !row.preview && !prefetchedPreviews.current.has(row.id),
    );
    if (missing.length === 0) return;
    let cancelled = false;

    void Promise.all(
      missing.map(async (row) => {
        prefetchedPreviews.current.add(row.id);
        const result = await listAdminChatMessagesAction(row.id, {
          limit: PAGE_LIMIT,
        });
        if (!result.ok || result.data.length === 0) return null;
        const last = result.data[result.data.length - 1];
        return [row.id, previewFromMessage(last)] as const;
      }),
    ).then((rows) => {
      if (cancelled) return;
      setConversations((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          const hit = rows.find((entry) => entry?.[0] === row.id);
          if (!hit || row.preview) return row;
          changed = true;
          return { ...row, preview: hit[1] };
        });
        return changed ? next : prev;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [conversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setThreadError(null);
      setHasOlder(false);
      return;
    }

    setComposerOpen(false);
    const conversationId = selectedId;
    const gen = ++fetchGen.current;
    let cancelled = false;
    const saved = threads.current.get(conversationId);
    if (saved) {
      setMessages(saved.messages);
      setHasOlder(saved.hasOlder);
      setThreadLoading(false);
    } else {
      setMessages([]);
      setThreadLoading(true);
    }
    setThreadError(null);
    stickToBottom.current = true;

    void (async () => {
      const detail = await getAdminChatAction(conversationId);
      if (cancelled || gen !== fetchGen.current) return;

      if (!detail.ok) {
        setThreadLoading(false);
        setThreadError(detail.message);
        setMessages([]);
        return;
      }

      const last = detail.data.messages.at(-1);
      setConversations((prev) =>
        upsertConversation(prev, {
          ...detail.data.conversation,
          preview: last ? previewFromMessage(last) : undefined,
          unreadCount: 0,
        }),
      );
      const older = detail.data.messages.length >= PAGE_LIMIT;
      threads.current.set(conversationId, {
        messages: detail.data.messages,
        hasOlder: older,
      });
      setMessages(detail.data.messages);
      setHasOlder(older);
      setThreadLoading(false);

      void markAdminChatReadAction(conversationId).then((readResult) => {
        if (!readResult.ok) return;
        setConversations((prev) =>
          prev.map((row) =>
            row.id === conversationId ? { ...row, unreadCount: 0 } : row,
          ),
        );
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, threadLoading]);

  async function loadOlder() {
    if (!selectedId || loadingOlder || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    stickToBottom.current = false;
    const result = await listAdminChatMessagesAction(selectedId, {
      limit: PAGE_LIMIT,
      before: oldest.id,
    });
    setLoadingOlder(false);
    if (!result.ok) {
      toast(result.message, "error");
      return;
    }
    const older = result.data.length >= PAGE_LIMIT;
    setHasOlder(older);
    setMessages((prev) => {
      const next = mergeMessages(result.data, prev);
      threads.current.set(selectedId, { messages: next, hasOlder: older });
      return next;
    });
  }

  async function handleSend() {
    if (!selectedId || sending) return;
    const content = draft.trim();
    if (!content) return;
    if (content.length > MAX_CONTENT) {
      toast(`Message must be ${MAX_CONTENT} characters or fewer.`, "error");
      return;
    }
    if (selected?.status === "CLOSED") {
      toast("This chat is closed.", "error");
      return;
    }

    setSending(true);
    stickToBottom.current = true;
    const result = await sendAdminChatMessageAction(selectedId, content);
    setSending(false);
    if (!result.ok) {
      toast(result.message, "error");
      return;
    }
    setDraft("");
    setMessages((prev) => {
      const next = mergeMessages(prev, [result.data]);
      threads.current.set(selectedId, {
        messages: next,
        hasOlder: threads.current.get(selectedId)?.hasOlder ?? false,
      });
      return next;
    });
    setConversations((prev) =>
      upsertConversation(prev, {
        ...(selected ?? {
          id: selectedId,
          status: "OPEN",
          subject: null,
          createdAt: result.data.createdAt,
          closedAt: null,
        }),
        preview: previewFromMessage(result.data),
        lastMessageAt: result.data.createdAt,
        updatedAt: result.data.createdAt,
      }),
    );
  }

  async function handleUpload(kind: "image" | "file", file: File | undefined) {
    if (!selectedId || !file || uploading || sending) return;
    if (selected?.status === "CLOSED") {
      toast("This chat is closed.", "error");
      return;
    }
    if (kind === "image" && !isAdminChatImage(file)) {
      toast("Use a jpeg, png, webp, gif, or heic photo.", "error");
      return;
    }
    if (kind === "file" && !isAdminChatFile(file)) {
      toast("Use a pdf, Word, Excel, text file, or a photo.", "error");
      return;
    }
    const limit =
      kind === "image" ? ADMIN_CHAT_MEDIA.maxImageBytes : ADMIN_CHAT_MEDIA.maxFileBytes;
    if (file.size > limit) {
      toast(
        kind === "image"
          ? "Photos must be 10 MB or smaller."
          : "Files must be 15 MB or smaller.",
        "error",
      );
      return;
    }

    const caption = draft.trim();
    const form = new FormData();
    form.set("file", file);
    if (caption) form.set("caption", caption);
    setUploading(true);
    stickToBottom.current = true;
    try {
      const response = await fetch(
        kind === "image"
          ? adminChatImageUploadUrl(selectedId)
          : adminChatFileUploadUrl(selectedId),
        { method: "POST", body: form },
      );
      const raw: unknown = await response.json().catch(() => null);
      const record =
        raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
      if (!response.ok) {
        const message =
          record && typeof record.message === "string"
            ? record.message
            : "Couldn't send that file.";
        toast(message, "error");
        return;
      }
      const payload = record?.data ?? record;
      if (!payload || typeof payload !== "object" || !("id" in payload)) {
        toast("Couldn't send that file.", "error");
        return;
      }
      const parsed = payload as AdminChatMessage;
      setDraft("");
      setMessages((prev) => {
        const next = mergeMessages(prev, [parsed]);
        threads.current.set(selectedId, {
          messages: next,
          hasOlder: threads.current.get(selectedId)?.hasOlder ?? false,
        });
        return next;
      });
      setConversations((prev) =>
        upsertConversation(prev, {
          ...(selected ?? {
            id: selectedId,
            status: "OPEN",
            subject: null,
            createdAt: parsed.createdAt,
            closedAt: null,
          }),
          preview: previewFromMessage(parsed),
          lastMessageAt: parsed.createdAt,
          updatedAt: parsed.createdAt,
        }),
      );
    } catch {
      toast("Couldn't send that file.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleOpenChat() {
    if (opening) return;
    const subject = openSubject.trim();
    const message = openMessage.trim();
    if (!subject) {
      toast("Add a title for this support ticket.", "error");
      return;
    }
    if (!message) {
      toast("Describe your issue before sending.", "error");
      return;
    }
    if (message.length > MAX_CONTENT) {
      toast(`Message must be ${MAX_CONTENT} characters or fewer.`, "error");
      return;
    }
    setOpening(true);
    const result = await openAdminChatAction({
      subject,
      message,
      forceNew: true,
    });
    setOpening(false);
    if (!result.ok) {
      toast(result.message, "error");
      return;
    }

    const { conversation, message: firstMessage } = result.data;
    const titled: ConversationRow = {
      ...conversation,
      subject: conversation.subject?.trim() || subject,
      preview: firstMessage
        ? previewFromMessage(firstMessage)
        : message,
      unreadCount: 0,
    };
    setConversations((prev) => upsertConversation(prev, titled));
    setSelectedId(conversation.id);
    setComposerOpen(false);
    setOpenSubject("");
    setOpenMessage("");
    setTicketFilter(
      conversation.status === "CLOSED" ? "closed" : "open",
    );

    if (firstMessage) {
      threads.current.set(conversation.id, {
        messages: [firstMessage],
        hasOlder: false,
      });
      setMessages([firstMessage]);
    } else if (!result.data.created) {
      // Backend reused an open thread — still post the description as a follow-up.
      const sent = await sendAdminChatMessageAction(conversation.id, message);
      if (sent.ok) {
        setMessages((prev) => mergeMessages(prev, [sent.data]));
        setConversations((rows) =>
          upsertConversation(rows, {
            ...titled,
            preview: previewFromMessage(sent.data),
            lastMessageAt: sent.data.createdAt,
            updatedAt: sent.data.createdAt,
          }),
        );
      } else {
        setMessages([]);
        toast(sent.message, "error");
        return;
      }
    } else {
      setMessages([]);
    }

    toast(
      result.data.created
        ? "Support ticket opened."
        : "Added to your open support ticket.",
      "success",
    );
  }

  function startNewChat() {
    setComposerOpen(true);
    setOpenSubject("");
    setOpenMessage("");
  }

  if (listError && conversations.length === 0) {
    return (
      <EmptyState
        title="Can't load support tickets"
        description={listError}
        action={
          <Button type="button" onClick={() => void refreshList()} loading={listLoading}>
            Try again
          </Button>
        }
      />
    );
  }

  const openCount = conversations.filter((row) => row.status === "OPEN").length;
  const closedCount = conversations.filter((row) => row.status === "CLOSED").length;
  const filteredConversations = conversations.filter((row) => {
    if (ticketFilter === "open") return row.status === "OPEN";
    if (ticketFilter === "closed") return row.status === "CLOSED";
    return true;
  });
  const hasConversations = conversations.length > 0;

  const messageBlocks = useMemo(() => {
    const blocks: Array<
      | { type: "day"; key: string; label: string }
      | { type: "message"; key: string; message: AdminChatMessage }
    > = [];
    let lastDay = "";
    for (const message of messages) {
      const label = dayLabel(message.createdAt);
      if (label && label !== lastDay) {
        blocks.push({ type: "day", key: `day-${label}`, label });
        lastDay = label;
      }
      blocks.push({ type: "message", key: message.id, message });
    }
    return blocks;
  }, [messages]);

  const filterCounts: Record<TicketFilter, number> = {
    open: openCount,
    closed: closedCount,
    all: conversations.length,
  };
  const activeFilter =
    TICKET_FILTERS.find((item) => item.id === ticketFilter) ?? TICKET_FILTERS[0];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-medium leading-[1.3] tracking-[-0.05em] text-black">
            Support Tickets
          </h1>
          <p className="mt-1 max-w-[589px] text-[16px] font-normal leading-[1.3] tracking-[-0.02em] text-black/50">
            Track, manage, and resolve customer requests efficiently from one
            place. Keep every issue organized, monitor progress, and make sure
            no support request gets missed.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewChat}
          className="relative inline-flex h-[35px] shrink-0 items-center rounded-[40px] bg-white pl-[15px] pr-[45px] text-[12px] font-medium tracking-[-0.05em] text-black"
        >
          Create New Ticket
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/figma/support/plus.svg"
            alt=""
            width={29}
            height={29}
            className="absolute right-[3px] top-[3px]"
          />
        </button>
      </header>

    <div className="grid min-h-[640px] gap-5 lg:h-[min(720px,calc(100dvh-16rem))] lg:grid-cols-[297px_minmax(0,1fr)] lg:items-stretch">
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-[10px] bg-white">
        <div className="shrink-0 px-[15px] pb-3 pt-[10px]">
          <h2 className="text-[24px] font-semibold tracking-[-0.05em] text-[#1f1f21]">
            Tickets
          </h2>
          <p className="mt-1 max-w-[267px] text-[14px] font-normal leading-[1.3] tracking-[-0.04em] text-black/80">
            See all relevant tickets in one place and stay up to date on their
            current status and activity.
          </p>
          <div className="relative mt-[15px]">
            <button
              ref={filterButtonRef}
              type="button"
              aria-expanded={filterOpen}
              aria-haspopup="menu"
              onClick={() => setFilterOpen((open) => !open)}
              className="flex h-[37px] w-full items-center justify-between rounded-[8px] bg-[#f7f7f7] px-[10px]"
            >
              <span className="text-[16px] font-medium leading-[1.3] tracking-[-0.05em] text-black">
                {activeFilter.bar}
                <span className="ml-2">{padCount(filterCounts[ticketFilter])}</span>
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/figma/earnings/chevron-circle.svg"
                alt=""
                width={21}
                height={21}
                className={cn(filterOpen && "rotate-180")}
              />
            </button>
            <AnchoredMenu
              open={filterOpen}
              triggerRef={filterButtonRef}
              menuRef={filterMenuRef}
              aria-label="Ticket status"
              className="w-[287px] overflow-hidden rounded-[8px] border border-[#cacaca]/80 bg-white py-2 shadow-[0_0_5px_rgba(0,0,0,0.05)]"
            >
              {TICKET_FILTERS.map((item, index) => {
                const selectedFilter = item.id === ticketFilter;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={cn(
                      "flex w-full items-center justify-between px-[10px] py-2.5 text-left text-[16px] font-medium leading-[1.3] tracking-[-0.05em]",
                      selectedFilter ? "text-black" : "text-black/20",
                      index > 0 && "border-t border-[#efefef]",
                    )}
                    onClick={() => {
                      setTicketFilter(item.id);
                      setFilterOpen(false);
                    }}
                  >
                    <span>{item.label}</span>
                    <span>{padCount(filterCounts[item.id])}</span>
                  </button>
                );
              })}
            </AnchoredMenu>
          </div>
        </div>

        {filteredConversations.length > 0 ? (
          <ul className="min-h-0 flex-1 space-y-[10px] overflow-y-auto px-[5px] pb-3">
            {filteredConversations.map((row) => {
              const active = row.id === selectedId;
              const unread = row.unreadCount ?? 0;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setComposerOpen(false);
                      setSelectedId(row.id);
                    }}
                    className={cn(
                      "flex min-h-[130px] w-full flex-col rounded-[8px] px-[10px] py-[10px] text-left",
                      active ? "bg-[rgba(201,239,255,0.5)]" : "bg-[#f7f7f7]",
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold leading-[14px] tracking-[-0.05em] text-black">
                          ADMIN
                        </span>
                        <span className="block text-[12px] font-normal leading-[14px] tracking-[-0.05em] text-[#777583]">
                          {ticketCode(row.id)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[12px] font-medium leading-[14px] tracking-[-0.05em] text-black">
                        {formatRel(row.lastMessageAt ?? row.updatedAt)}
                        {unread > 0 ? (
                          <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[#377dff] px-1 text-[10px] font-bold text-white">
                            {unread}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="mt-5 block truncate text-[16px] font-medium leading-[1.3] tracking-[-0.04em] text-black">
                      {threadTitle(row)}
                    </span>
                    <span className="mt-1 line-clamp-2 text-[14px] font-normal leading-[1.3] tracking-[-0.04em] text-black/40">
                      {row.preview ?? "No messages yet"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
            <p className="text-sm text-muted">
              {ticketFilter === "open"
                ? "No open tickets"
                : ticketFilter === "closed"
                  ? "No closed tickets"
                  : "No tickets yet"}
            </p>
          </div>
        )}
      </aside>

      <section className="flex min-h-[480px] min-w-0 flex-col lg:min-h-0">
        {selected ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-[#fdfdfd]">
            <header className="flex shrink-0 items-center gap-[10px] border-b border-[#efefef] px-5 py-5">
              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#f0f0f0]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/figma/support/user.svg" alt="" width={16} height={16} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold leading-[14px] text-black">
                  {ADMIN_LABEL}
                </span>
                <span className="block truncate text-[12px] font-medium leading-[14px] text-[#777583]">
                  {ticketStatusLabel(selected.status)} · {threadTitle(selected)}
                </span>
              </span>
            </header>

            {threadLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted">
                Loading conversation…
              </div>
            ) : threadError ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState
                  className="border-0 bg-transparent shadow-none"
                  title="Can't open this chat"
                  description={threadError}
                  action={
                    <Button
                      type="button"
                      onClick={() => {
                        const id = selectedId;
                        setSelectedId(null);
                        requestAnimationFrame(() => setSelectedId(id));
                      }}
                    >
                      Retry
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <div
                  ref={scrollRef}
                  className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-[#fdfdfd] px-5 py-6"
                  onScroll={(event) => {
                    const el = event.currentTarget;
                    stickToBottom.current =
                      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                  }}
                >
                  {hasOlder ? (
                    <div className="flex justify-center pb-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 text-xs"
                        loading={loadingOlder}
                        onClick={() => void loadOlder()}
                      >
                        Load earlier messages
                      </Button>
                    </div>
                  ) : null}

                  {messages.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted">
                      No messages yet. Send the first message below.
                    </p>
                  ) : (
                    messageBlocks.map((block) => {
                      if (block.type === "day") {
                        return (
                          <div
                            key={block.key}
                            className="flex justify-center py-1"
                          >
                            <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-medium text-muted shadow-sm">
                              {block.label}
                            </span>
                          </div>
                        );
                      }

                      const message = block.message;
                      const mine = message.sender === "AGENT";
                      const system = message.sender === "SYSTEM";

                      if (system) {
                        return (
                          <div key={block.key} className="flex justify-center">
                            <p className="max-w-md rounded-lg bg-surface px-3 py-1.5 text-center text-xs text-muted">
                              {message.content}
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={block.key}
                          className={cn(
                            "flex flex-col gap-1",
                            mine ? "items-end" : "items-start",
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[480px] px-4 py-3 text-[14px] font-normal leading-[1.5] text-[#11142d]",
                              mine
                                ? "rounded-bl-[16px] rounded-br-[16px] rounded-tl-[16px] rounded-tr-[4px] bg-[rgba(84,149,253,0.2)]"
                                : "rounded-bl-[16px] rounded-br-[16px] rounded-tl-[4px] rounded-tr-[16px] bg-[#f0f3f6]",
                            )}
                          >
                            <ChatAttachment message={message} />
                          </div>
                          <p className="text-[11px] text-[#b2b3bd]">
                            {formatClock(message.createdAt)}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                <footer className="shrink-0 border-t border-[#eef0f2] bg-[#fdfdfd] p-6">
                  {selected.status === "CLOSED" ? (
                    <div className="rounded-[100px] bg-[#f7f8fa] px-4 py-3 text-center text-sm text-[#777583]">
                      This ticket is closed. Open a{" "}
                      <button
                        type="button"
                        className="font-semibold text-[#377dff]"
                        onClick={startNewChat}
                      >
                        new ticket
                      </button>
                      .
                    </div>
                  ) : (
                    <form
                      className="flex items-center gap-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleSend();
                      }}
                    >
                      <button
                        type="button"
                        aria-label="Add a photo"
                        disabled={uploading || sending}
                        onClick={() => imageInputRef.current?.click()}
                        className="flex size-9 shrink-0 items-center justify-center rounded-[18px] bg-[#f0f0f0] disabled:opacity-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/figma/support/image.svg" alt="" width={16} height={16} />
                      </button>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          void handleUpload("image", file);
                        }}
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          void handleUpload("file", file);
                        }}
                      />
                      <label className="flex min-w-0 flex-1 items-center gap-3 rounded-[100px] bg-[#f7f8fa] px-4 py-3">
                        <button
                          type="button"
                          aria-label="Add a document"
                          disabled={uploading || sending}
                          onClick={() => fileInputRef.current?.click()}
                          className="shrink-0 disabled:opacity-50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/figma/support/paperclip.svg" alt="" width={18} height={18} />
                        </button>
                        <textarea
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          placeholder={uploading ? "Sending file…" : "Write message here..."}
                          className="max-h-24 min-h-[17px] w-full flex-1 resize-none border-0 bg-transparent p-0 text-[14px] leading-normal text-[#11142d] outline-none placeholder:text-[#b2b3bd]"
                          maxLength={MAX_CONTENT}
                          disabled={sending || uploading}
                          rows={1}
                          onKeyDown={(event) => {
                            if (
                              event.key === "Enter" &&
                              !event.shiftKey &&
                              !event.nativeEvent.isComposing
                            ) {
                              event.preventDefault();
                              void handleSend();
                            }
                          }}
                        />
                      </label>
                      <button
                        type="submit"
                        className="flex size-11 shrink-0 items-center justify-center rounded-[22px] bg-[#377dff] disabled:opacity-50"
                        disabled={sending || uploading || !draft.trim()}
                        aria-label="Send message"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width={18}
                          height={18}
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M5 12h12M13 6l6 6-6 6"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </form>
                  )}
                </footer>
              </>
            )}
          </div>
        ) : hasConversations ? (
          <div className="flex flex-1 items-center justify-center rounded-[10px] bg-[#fdfdfd]">
            <EmptyState
              className="border-0 bg-transparent shadow-none"
              title="Select a ticket"
              description="Choose a ticket from the list to continue with Carl ops."
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-[10px] bg-[#fdfdfd] p-6">
            <EmptyState
              className="max-w-md border-0 bg-transparent shadow-none"
              icon={<SupportIcon className="size-16" />}
              title="Open a support ticket"
              description="Get help from ops with tasks, payments, or anything blocking your work."
              action={
                <Button type="button" onClick={startNewChat}>
                  New ticket
                </Button>
              }
            />
          </div>
        )}
      </section>
    </div>
    {composerOpen
      ? createPortal(
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/10 backdrop-blur-[5px]"
              aria-label="Close"
              onClick={() => setComposerOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-ticket-title"
              className="relative w-full max-w-[546px] rounded-[10px] bg-white p-[25px] shadow-[0_2px_2.5px_rgba(0,0,0,0.05)]"
            >
              <h2
                id="new-ticket-title"
                className="text-[32px] font-semibold leading-normal tracking-[-0.05em] text-[#0b1f3a]"
              >
                New support ticket
              </h2>
              <p className="mt-[10px] max-w-[496px] text-[16px] font-normal leading-normal text-[rgba(0,16,44,0.5)]">
                Create a new support ticket and share the details of your issue
                so our team can assist you quickly.
              </p>
              <label className="mt-[49px] block">
                <span className="text-[16px] font-medium leading-normal tracking-[-0.05em] text-[#00102c]">
                  Title
                </span>
                <input
                  value={openSubject}
                  onChange={(event) => setOpenSubject(event.target.value)}
                  placeholder="Enter name here"
                  maxLength={200}
                  className="mt-[10px] h-[50px] w-full rounded-[10px] border border-[#cacaca] bg-white px-[15px] text-[14px] tracking-[-0.05em] text-[#00102c] outline-none placeholder:text-[rgba(0,16,44,0.2)]"
                />
              </label>
              <label className="mt-[25px] block">
                <span className="text-[16px] font-medium leading-normal tracking-[-0.05em] text-[#00102c]">
                  Description
                </span>
                <textarea
                  value={openMessage}
                  onChange={(event) => setOpenMessage(event.target.value)}
                  placeholder="Johnwhite @gmail.com"
                  maxLength={MAX_CONTENT}
                  className="mt-[10px] h-[184px] w-full resize-none rounded-[10px] border border-[#cacaca] bg-white px-4 py-4 text-[14px] tracking-[-0.05em] text-[#00102c] outline-none placeholder:text-[rgba(0,16,44,0.2)]"
                />
              </label>
              <div className="mt-[25px] flex gap-[19px]">
                <button
                  type="button"
                  disabled={opening}
                  onClick={() => void handleOpenChat()}
                  className="h-12 min-w-0 flex-[316] rounded-[8px] bg-[#3b82f6] text-[18px] font-medium tracking-[-0.05em] text-white disabled:opacity-60"
                >
                  {opening ? "Creating…" : "Create Ticket"}
                </button>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="h-[50px] min-w-0 flex-[162] rounded-[8px] border border-[#cacaca] bg-white text-[18px] font-medium tracking-[-0.05em] text-[#cacaca]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null}
    </div>
  );
}
