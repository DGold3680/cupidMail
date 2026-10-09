"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { MessageList, MessageListItem } from "@/components/MessageList";
import { MessageDetail, FullMessage } from "@/components/MessageDetail";
import { Composer, ComposeInitialState } from "@/components/Composer";
import { SettingsModal } from "@/components/SettingsModal";

export default function MailDashboard() {
  const router = useRouter();
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Navigation & Filter state
  const [currentFolder, setCurrentFolder] = useState<string>("INBOX");
  const [currentMailboxId, setCurrentMailboxId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterTab, setFilterTab] = useState<"ALL" | "UNREAD" | "STARRED" | "ATTACHMENTS">("ALL");

  // Data state
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<FullMessage | null>(null);
  const [threadHistory, setThreadHistory] = useState<FullMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Loading states
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Modals state
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [composerState, setComposerState] = useState<ComposeInitialState | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // 1. Fetch Mailboxes
  const loadMailboxes = useCallback(async () => {
    try {
      const res = await fetch("/api/mailboxes");
      const data = await res.json();
      if (data.mailboxes) {
        setMailboxes(data.mailboxes);
      }
    } catch (e) {
      console.error("Failed to load mailboxes", e);
    }
  }, []);

  // 2. Fetch Messages List (Optimized)
  const loadMessages = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const params = new URLSearchParams({
        folder: currentFolder,
        mailboxId: currentMailboxId,
        limit: "50",
      });
      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      const res = await fetch(`/api/emails/messages?${params.toString()}`);
      const data = await res.json();

      if (data.items) {
        setMessages(data.items);
        setUnreadCount(data.unreadCount || 0);

        // Auto-select first message if none selected or current is not in list
        if (data.items.length > 0 && !selectedMessageId) {
          setSelectedMessageId(data.items[0].id);
        } else if (data.items.length === 0) {
          setSelectedMessageId(null);
          setSelectedMessage(null);
        }
      }
    } catch (e) {
      console.error("Failed to load messages", e);
    } finally {
      setIsLoadingList(false);
    }
  }, [currentFolder, currentMailboxId, searchTerm, selectedMessageId]);

  // 3. Fetch Full Message Details
  const loadMessageDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/emails/messages/${id}`);
      const data = await res.json();
      if (data.message) {
        setSelectedMessage(data.message);
        setThreadHistory(data.threadHistory || []);

        // Optimistically mark as read in local list
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
        );
      }
    } catch (e) {
      console.error("Failed to load message detail", e);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // Check auth session on load
  useEffect(() => {
    let mounted = true;
    const verifyUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        if (!data?.user) {
          router.replace("/login");
          return;
        }
        if (mounted) {
          setIsAuthChecking(false);
        }
      } catch {
        router.replace("/login");
      }
    };
    verifyUser();
    return () => {
      mounted = false;
    };
  }, [router]);

  // Initial load once authenticated
  useEffect(() => {
    if (!isAuthChecking) {
      loadMailboxes();
    }
  }, [isAuthChecking, loadMailboxes]);

  useEffect(() => {
    if (!isAuthChecking) {
      loadMessages();
    }
  }, [isAuthChecking, loadMessages]);

  useEffect(() => {
    if (selectedMessageId) {
      loadMessageDetail(selectedMessageId);
    }
  }, [selectedMessageId, loadMessageDetail]);

  // Message Actions
  const handleToggleStar = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isStarred: !m.isStarred } : m))
    );

    try {
      await fetch(`/api/emails/messages/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleStar" }),
      });
    } catch (err) {
      console.error("Star error:", err);
    }
  };

  const handleToggleRead = async (id: string, isRead: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isRead: !isRead } : m))
    );

    try {
      await fetch(`/api/emails/messages/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleRead", value: !isRead }),
      });
    } catch (err) {
      console.error("Read toggle error:", err);
    }
  };

  const handleArchive = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (selectedMessageId === id) {
      setSelectedMessageId(null);
      setSelectedMessage(null);
    }

    try {
      await fetch(`/api/emails/messages/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
    } catch (err) {
      console.error("Archive error:", err);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (selectedMessageId === id) {
      setSelectedMessageId(null);
      setSelectedMessage(null);
    }

    try {
      await fetch(`/api/emails/messages/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trash" }),
      });
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleReply = (type: "reply" | "replyAll" | "forward") => {
    if (!selectedMessage) return;

    let to = selectedMessage.fromAddress;
    let cc = "";
    let subject = selectedMessage.subject;

    if (type === "reply" && !subject.startsWith("Re:")) {
      subject = `Re: ${subject}`;
    } else if (type === "forward") {
      subject = subject.startsWith("Fwd:") ? subject : `Fwd: ${subject}`;
      to = "";
    } else if (type === "replyAll") {
      if (!subject.startsWith("Re:")) subject = `Re: ${subject}`;
      // Collect all recipients except self
      const otherRecipients = selectedMessage.recipients
        .map((r) => r.address)
        .filter((addr) => addr !== selectedMessage.fromAddress);
      cc = otherRecipients.join(", ");
    }

    const activeMailbox =
      mailboxes.find((m) => m.id === selectedMessage.mailboxMessages?.[0]?.mailbox?.id) ||
      mailboxes[0];

    setComposerState({
      mailboxId: activeMailbox?.id,
      to,
      cc,
      subject,
      threadId: selectedMessage.threadId,
      inReplyTo: selectedMessage.internetMessageId || undefined,
      references: selectedMessage.references
        ? `${selectedMessage.references} ${selectedMessage.internetMessageId}`
        : selectedMessage.internetMessageId || undefined,
      body:
        type === "forward"
          ? `\n\n---------- Forwarded message ---------\nFrom: ${selectedMessage.fromName} <${selectedMessage.fromAddress}>\nSubject: ${selectedMessage.subject}\n\n${selectedMessage.textBody || ""}`
          : `\n\nOn ${selectedMessage.sentAt || selectedMessage.receivedAt}, ${selectedMessage.fromName || selectedMessage.fromAddress} wrote:\n> ${(selectedMessage.textBody || "").replace(/\n/g, "\n> ")}`,
    });

    setIsComposerOpen(true);
  };

  const handleQuickReply = async (text: string) => {
    if (!selectedMessage) return;

    const activeMailbox =
      mailboxes.find((m) => m.id === selectedMessage.mailboxMessages?.[0]?.mailbox?.id) ||
      mailboxes[0];

    if (!activeMailbox) {
      throw new Error("No active mailbox configured. Please verify your domain in Settings.");
    }

    const payload = {
      mailboxId: activeMailbox.id,
      fromAddress: activeMailbox.address,
      to: [{ address: selectedMessage.fromAddress, name: selectedMessage.fromName || undefined }],
      subject: selectedMessage.subject.startsWith("Re:")
        ? selectedMessage.subject
        : `Re: ${selectedMessage.subject}`,
      textBody: text,
      threadId: selectedMessage.threadId,
      inReplyTo: selectedMessage.internetMessageId || undefined,
    };

    const res = await fetch("/api/emails/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to send quick reply");
    }

    // Refresh details to show reply in thread
    if (selectedMessageId) {
      await loadMessageDetail(selectedMessageId);
    }
  };

  if (isAuthChecking) {
    return (
      <div className="h-screen w-screen bg-[#FAF7F2] flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <img
            src="/assets/Logo.png"
            alt="Cupid Mail"
            className="w-16 h-16 object-contain animate-pulse"
          />
        </div>
        <p className="text-xs font-mono text-stone-500 tracking-wider">
          Opening Cupid Mailbox...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#FAF7F2] font-sans overflow-hidden selection:bg-rose-200 selection:text-rose-950">
      {/* 1. Cupid Mail Sidebar */}
      <Sidebar
        currentFolder={currentFolder}
        currentMailboxId={currentMailboxId}
        mailboxes={mailboxes}
        unreadCount={unreadCount}
        onSelectFolder={(f) => {
          setCurrentFolder(f);
          setSelectedMessageId(null);
        }}
        onSelectMailbox={(mbId) => {
          setCurrentMailboxId(mbId);
          setSelectedMessageId(null);
        }}
        onOpenComposer={() => {
          setComposerState(undefined);
          setIsComposerOpen(true);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Message List Stream */}
      <MessageList
        messages={messages}
        selectedMessageId={selectedMessageId}
        isLoading={isLoadingList}
        searchTerm={searchTerm}
        filterTab={filterTab}
        onSearchChange={setSearchTerm}
        onFilterChange={setFilterTab}
        onSelectMessage={setSelectedMessageId}
        onToggleStar={handleToggleStar}
        onToggleRead={handleToggleRead}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onRefresh={loadMessages}
      />

      {/* 3. Message Viewer / Conversation Detail */}
      <MessageDetail
        message={selectedMessage}
        threadHistory={threadHistory}
        isLoading={isLoadingDetail}
        onReply={handleReply}
        onToggleStar={(id) => handleToggleStar(id)}
        onArchive={(id) => handleArchive(id)}
        onDelete={(id) => handleDelete(id)}
        onSendQuickReply={handleQuickReply}
      />

      {/* 4. Floating Composer Modal */}
      <Composer
        isOpen={isComposerOpen}
        mailboxes={mailboxes}
        initialState={composerState}
        onClose={() => setIsComposerOpen(false)}
        onSentSuccess={() => {
          loadMessages();
        }}
      />

      {/* 5. Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onRefreshData={() => {
          loadMailboxes();
          loadMessages();
        }}
      />
    </div>
  );
}

