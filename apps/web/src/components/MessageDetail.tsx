"use client";

import React, { useState } from "react";
import {
  Reply,
  ReplyAll,
  Forward,
  Star,
  Archive,
  Trash2,
  Paperclip,
  Download,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  Mail,
  Heart,
  Send,
} from "lucide-react";
import { cn, formatFullDate, getInitials, formatBytes } from "@/lib/utils";

export interface AttachmentItem {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
}

export interface FullMessage {
  id: string;
  threadId: string;
  internetMessageId: string | null;
  fromAddress: string;
  fromName: string | null;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  rawHtmlBody?: string | null;
  direction: string;
  sentAt: string | null;
  receivedAt: string | null;
  inReplyTo: string | null;
  references: string | null;
  recipients: {
    id: string;
    address: string;
    name: string | null;
    recipientType: string;
  }[];
  attachments: AttachmentItem[];
  mailboxMessages?: {
    id: string;
    mailbox: {
      id: string;
      address: string;
      displayName: string | null;
    };
  }[];
}

interface MessageDetailProps {
  message: FullMessage | null;
  threadHistory?: FullMessage[];
  isLoading: boolean;
  onReply: (type: "reply" | "replyAll" | "forward") => void;
  onToggleStar: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onSendQuickReply: (text: string) => Promise<void>;
}

export function MessageDetail({
  message,
  threadHistory = [],
  isLoading,
  onReply,
  onToggleStar,
  onArchive,
  onDelete,
  onSendQuickReply,
}: MessageDetailProps) {
  const [allowImages, setAllowImages] = useState(false);
  const [quickReplyText, setQuickReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [expandedThreadIds, setExpandedThreadIds] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#FAF7F2] flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-8 h-8 border-2 border-cupid-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-stone-500">Opening conversation...</p>
        </div>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex-1 bg-[#FAF7F2] flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="max-w-md w-full bg-white/80 border border-[#ECE3D6] rounded-3xl p-8 shadow-sm flex flex-col items-center space-y-4">
          <div className="w-24 h-24 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center overflow-hidden p-3 shadow-inner">
            <img
              src="/assets/Img.jpg"
              alt="Cupid Silhouette"
              className="w-full h-full object-contain hover:scale-105 transition-transform"
            />
          </div>
          <div>
            <div className="flex items-center justify-center space-x-1.5 mb-1">
              <span className="font-mono font-bold text-base text-stone-900">
                Cupid Mail Reader
              </span>
              <Heart className="w-4 h-4 text-cupid-600 fill-current" />
            </div>
            <p className="text-xs text-stone-500 leading-relaxed max-w-xs mx-auto">
              Select a conversation from the list to view sealed letters, attachments, and thread history.
            </p>
          </div>
          <div className="pt-2 flex items-center space-x-2 text-[11px] font-mono text-stone-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cupid-500" />
            <span>Private & Encrypted</span>
          </div>
        </div>
      </div>
    );
  }

  const hasRemoteImages =
    message.htmlBody &&
    (message.htmlBody.includes("blocked-remote-image") || message.htmlBody.includes("<img"));

  const toggleExpand = (id: string) => {
    const next = new Set(expandedThreadIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedThreadIds(next);
  };

  const handleQuickReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickReplyText.trim() || isSendingReply) return;
    setIsSendingReply(true);
    try {
      await onSendQuickReply(quickReplyText);
      setQuickReplyText("");
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div className="flex-1 bg-[#FAF7F2] flex flex-col h-screen overflow-hidden">
      {/* Top Action Toolbar */}
      <div className="h-14 border-b border-[#ECE3D6] px-6 flex items-center justify-between bg-white/80 backdrop-blur-xs shrink-0">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => onReply("reply")}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono font-medium text-stone-700 bg-[#F5EFE6] hover:bg-rose-50 hover:text-cupid-900 border border-[#E5DDD0]/70 rounded-xl transition"
          >
            <Reply className="w-3.5 h-3.5" />
            <span>Reply</span>
          </button>
          <button
            onClick={() => onReply("replyAll")}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono font-medium text-stone-700 bg-[#F5EFE6] hover:bg-rose-50 hover:text-cupid-900 border border-[#E5DDD0]/70 rounded-xl transition"
          >
            <ReplyAll className="w-3.5 h-3.5" />
            <span>Reply All</span>
          </button>
          <button
            onClick={() => onReply("forward")}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono font-medium text-stone-700 bg-[#F5EFE6] hover:bg-rose-50 hover:text-cupid-900 border border-[#E5DDD0]/70 rounded-xl transition"
          >
            <Forward className="w-3.5 h-3.5" />
            <span>Forward</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onArchive(message.id)}
            className="p-2 text-stone-500 hover:text-cupid-900 hover:bg-rose-50 rounded-xl transition"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(message.id)}
            className="p-2 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Conversation Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        {/* Subject Header */}
        <div className="border-b border-[#ECE3D6] pb-4">
          <h1 className="text-xl font-bold font-mono text-stone-900 tracking-tight leading-snug">
            {message.subject || "(no subject)"}
          </h1>
          <div className="flex items-center space-x-2 mt-2 text-xs text-stone-500 font-mono">
            <span className="bg-rose-50 text-cupid-900 px-2 py-0.5 rounded-full border border-rose-200">
              {message.mailboxMessages?.[0]?.mailbox.address || "Mailbox"}
            </span>
            <span>•</span>
            <span>{threadHistory.length} message(s) in thread</span>
          </div>
        </div>

        {/* Older Messages in Thread (Accordion / History) */}
        {threadHistory.length > 1 && (
          <div className="space-y-3 border-b border-[#ECE3D6] pb-6">
            <div className="text-[11px] font-mono font-bold text-stone-400 uppercase tracking-wider">
              Previous messages
            </div>
            {threadHistory.slice(0, -1).map((hist) => {
              const isExpanded = expandedThreadIds.has(hist.id);
              return (
                <div
                  key={hist.id}
                  className="border border-[#ECE3D6] rounded-2xl overflow-hidden bg-white/70 shadow-2xs"
                >
                  <div
                    onClick={() => toggleExpand(hist.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-rose-50/50 transition text-xs"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="w-6 h-6 rounded-full bg-rose-100 text-cupid-900 flex items-center justify-center font-mono font-bold text-[10px]">
                        {getInitials(hist.fromName, hist.fromAddress)}
                      </div>
                      <span className="font-semibold text-stone-800">
                        {hist.fromName || hist.fromAddress}
                      </span>
                      <span className="text-stone-400 truncate max-w-md">
                        {hist.textBody?.slice(0, 80) || "No preview"}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-stone-400 font-mono text-[10px]">
                      <span>{formatFullDate(hist.sentAt || hist.receivedAt)}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-5 border-t border-[#ECE3D6] bg-white">
                      {hist.htmlBody ? (
                        <div
                          className="email-content-frame text-sm"
                          dangerouslySetInnerHTML={{ __html: hist.htmlBody }}
                        />
                      ) : (
                        <pre className="text-sm font-sans whitespace-pre-wrap text-stone-800">
                          {hist.textBody}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Active / Latest Message Card */}
        <div className="bg-white border border-[#ECE3D6] rounded-3xl p-6 shadow-sm shadow-cupid-900/5 space-y-6">
          {/* Sender & Recipient Bar */}
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cupid-900 via-cupid-800 to-cupid-900 text-white flex items-center justify-center font-mono font-bold text-sm shadow-sm shadow-cupid-900/25">
                {getInitials(message.fromName, message.fromAddress)}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-stone-900 text-sm">
                    {message.fromName || message.fromAddress}
                  </span>
                  <span className="text-xs font-mono text-stone-400">
                    &lt;{message.fromAddress}&gt;
                  </span>
                </div>
                <div className="text-xs text-stone-500 mt-0.5">
                  <span className="font-mono text-stone-400">To: </span>
                  {message.recipients.map((r, i) => (
                    <span key={r.id}>
                      {r.name ? `${r.name} ` : ""}
                      <span className="font-mono text-stone-600">&lt;{r.address}&gt;</span>
                      {i < message.recipients.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-right text-[11px] font-mono text-stone-400">
              <div>{formatFullDate(message.sentAt || message.receivedAt)}</div>
            </div>
          </div>

          {/* Privacy Banner if remote images exist */}
          {hasRemoteImages && !allowImages && (
            <div className="bg-rose-50/90 border border-rose-200/80 rounded-2xl p-3 flex items-center justify-between text-xs text-cupid-950">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-cupid-700 shrink-0" />
                <span>Remote images were blocked to safeguard your privacy and location.</span>
              </div>
              <button
                onClick={() => setAllowImages(true)}
                className="bg-white hover:bg-rose-100 border border-rose-300 text-cupid-900 px-3 py-1 rounded-xl font-mono text-[11px] font-semibold transition"
              >
                Load Images
              </button>
            </div>
          )}

          {/* Email Body */}
          <div className="pt-2">
            {message.htmlBody ? (
              <div
                className="email-content-frame text-sm"
                dangerouslySetInnerHTML={{
                  __html: allowImages
                    ? message.rawHtmlBody || message.htmlBody
                    : message.htmlBody,
                }}
              />
            ) : (
              <pre className="text-sm font-sans whitespace-pre-wrap text-stone-800 leading-relaxed">
                {message.textBody || "No text body available."}
              </pre>
            )}
          </div>

          {/* Attachments Section */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="pt-4 border-t border-[#ECE3D6] space-y-2.5">
              <div className="text-xs font-mono font-bold text-stone-500 flex items-center space-x-1.5">
                <Paperclip className="w-3.5 h-3.5 text-cupid-700" />
                <span>Attachments ({message.attachments.length})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {message.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={`/api/attachments/${att.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-2xl border border-[#ECE3D6] bg-[#FCFAF7] hover:bg-rose-50/60 hover:border-rose-200 transition group text-xs"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="w-7 h-7 rounded-xl bg-rose-100 text-cupid-800 flex items-center justify-center shrink-0">
                        <Paperclip className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-stone-800 truncate group-hover:text-cupid-900">
                          {att.filename}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          {formatBytes(att.sizeBytes)}
                        </div>
                      </div>
                    </div>

                    <div className="p-1.5 rounded-lg text-stone-400 group-hover:text-cupid-800 group-hover:bg-rose-100 transition">
                      <Download className="w-4 h-4" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Reply Form */}
        <form
          onSubmit={handleQuickReplySubmit}
          className="border border-[#ECE3D6] rounded-3xl bg-white p-5 space-y-3 shadow-sm"
        >
          <div className="text-xs font-mono font-semibold text-stone-700 flex items-center space-x-2">
            <CornerDownLeft className="w-3.5 h-3.5 text-cupid-700" />
            <span>Quick Reply to {message.fromName || message.fromAddress}</span>
          </div>

          <textarea
            value={quickReplyText}
            onChange={(e) => setQuickReplyText(e.target.value)}
            placeholder="Write a quick note..."
            rows={3}
            className="w-full p-3.5 bg-[#FAF7F2] text-sm text-stone-900 rounded-2xl border border-[#E5DDD0] focus:border-cupid-600 focus:ring-1 focus:ring-cupid-600 focus:outline-none resize-none transition placeholder:text-stone-400"
          />

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => onReply("reply")}
              className="text-xs font-mono text-cupid-800 hover:text-cupid-950 font-medium"
            >
              Open in full composer →
            </button>

            <button
              type="submit"
              disabled={!quickReplyText.trim() || isSendingReply}
              className="px-4 py-2 bg-gradient-to-r from-cupid-900 to-cupid-800 hover:from-cupid-950 hover:to-cupid-900 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-semibold shadow-sm shadow-cupid-900/20 transition flex items-center space-x-1.5"
            >
              <Send className="w-3 h-3" />
              <span>{isSendingReply ? "Sending..." : "Send Reply"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


