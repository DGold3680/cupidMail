"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Send,
  Paperclip,
  Trash2,
  AlertCircle,
  File,
  Heart,
  Minus,
  Maximize2,
  GripHorizontal,
  Info,
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

interface MailboxOption {
  id: string;
  address: string;
  displayName: string | null;
  domain?: {
    id: string;
    name: string;
    sendingConfig?: {
      id: string;
      enabled: boolean;
      providerConnectionId: string | null;
    } | null;
  } | null;
}

export interface ComposeInitialState {
  mailboxId?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

interface ComposerProps {
  isOpen: boolean;
  mailboxes: MailboxOption[];
  initialState?: ComposeInitialState;
  onClose: () => void;
  onSentSuccess: () => void;
}

export function Composer({
  isOpen,
  mailboxes,
  initialState,
  onClose,
  onSentSuccess,
}: ComposerProps) {
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>("");
  const [toInput, setToInput] = useState<string>("");
  const [ccInput, setCcInput] = useState<string>("");
  const [bccInput, setBccInput] = useState<string>("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [attachments, setAttachments] = useState<{ filename: string; content: string; contentType: string; size: number }[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Draggable & window states
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragStartRef = React.useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const composerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !position && typeof window !== "undefined") {
      const width = Math.min(672, window.innerWidth - 32);
      const height = Math.min(600, window.innerHeight * 0.85);
      const initialX = Math.max(16, window.innerWidth - width - 24);
      const initialY = Math.max(16, window.innerHeight - height - 20);
      setPosition({ x: initialX, y: initialY });
    }
  }, [isOpen, position]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input") || (e.target as HTMLElement).closest("select")) {
      return;
    }
    e.preventDefault();
    setIsDragging(true);

    const rect = composerRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : (position?.x ?? 0);
    const currentY = rect ? rect.top : (position?.y ?? 0);

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: currentX,
      startY: currentY,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragStartRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.mouseX;
      const deltaY = moveEvent.clientY - dragStartRef.current.mouseY;

      const newX = dragStartRef.current.startX + deltaX;
      const newY = dragStartRef.current.startY + deltaY;

      const cardWidth = composerRef.current?.offsetWidth || 640;
      const cardHeight = composerRef.current?.offsetHeight || 500;
      const clampedX = Math.max(10, Math.min(window.innerWidth - cardWidth - 10, newX));
      const clampedY = Math.max(10, Math.min(window.innerHeight - 50, newY));

      setPosition({ x: clampedX, y: clampedY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  useEffect(() => {
    if (isOpen) {
      if (initialState?.mailboxId) {
        setSelectedMailboxId(initialState.mailboxId);
      } else if (mailboxes.length > 0) {
        setSelectedMailboxId(mailboxes[0].id);
      }

      setToInput(initialState?.to || "");
      setCcInput(initialState?.cc || "");
      setBccInput(initialState?.bcc || "");
      if (initialState?.cc) setShowCc(true);
      if (initialState?.bcc) setShowBcc(true);
      setSubject(initialState?.subject || "");
      setBody(initialState?.body || "");
      setAttachments([]);
      setErrorMsg(null);
    }
  }, [isOpen, initialState, mailboxes]);

  if (!isOpen) return null;

  const currentSender = mailboxes.find((m) => m.id === selectedMailboxId) || mailboxes[0];
  const baseDomain = "runnly.xyz";
  const senderDomainName =
    currentSender?.domain?.name ||
    (currentSender?.address ? currentSender.address.split("@")[1] : "");
  const isCustomDomainSender =
    Boolean(senderDomainName) && senderDomainName.toLowerCase() !== baseDomain.toLowerCase();
  const hasCustomKey = Boolean(
    currentSender?.domain?.sendingConfig?.providerConnectionId &&
      currentSender?.domain?.sendingConfig?.enabled
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:*;base64, prefix
        const base64Content = result.split(",")[1];
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            content: base64Content,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const parseRecipients = (input: string) => {
    return input
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((addr) => ({ address: addr }));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const toRecipients = parseRecipients(toInput);
    if (toRecipients.length === 0) {
      setErrorMsg("Please enter at least one recipient in the 'To' field.");
      return;
    }

    if (!currentSender) {
      setErrorMsg("Please select a valid sender mailbox.");
      return;
    }

    setIsSending(true);

    try {
      const payload = {
        mailboxId: currentSender.id,
        fromAddress: currentSender.address,
        fromName: currentSender.displayName || currentSender.address,
        to: toRecipients,
        cc: showCc ? parseRecipients(ccInput) : [],
        bcc: showBcc ? parseRecipients(bccInput) : [],
        subject: subject.trim() || "(no subject)",
        textBody: body,
        htmlBody: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2A221F;">${body
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br/>")}</div>`,
        threadId: initialState?.threadId,
        inReplyTo: initialState?.inReplyTo,
        references: initialState?.references,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      };

      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to dispatch email");
      }

      onSentSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      ref={composerRef}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              bottom: "auto",
              right: "auto",
              touchAction: "none",
            }
          : undefined
      }
      className={cn(
        "fixed z-50 w-full max-w-2xl bg-white border border-[#ECE3D6] rounded-3xl shadow-cupid-lg overflow-hidden flex flex-col",
        position ? "" : "bottom-5 right-6 max-h-[85vh]",
        isDragging && "shadow-2xl ring-2 ring-rose-400/50 select-none",
        isMinimized ? "h-auto max-h-none" : "max-h-[85vh]"
      )}
    >
      {/* Composer Header (Draggable Bar) */}
      <div
        onPointerDown={handlePointerDown}
        className={cn(
          "bg-gradient-to-r from-cupid-950 via-cupid-900 to-cupid-800 px-4 py-3 text-white flex items-center justify-between select-none cursor-grab active:cursor-grabbing border-b border-rose-900/40",
          isDragging && "cursor-grabbing"
        )}
        title="Click and drag to move letter card anywhere on screen"
      >
        <div className="flex items-center space-x-2 truncate">
          <GripHorizontal className="w-4 h-4 text-rose-300/70 shrink-0" />
          <img src="/assets/Logo.png" alt="Cupid" className="w-5 h-5 object-contain shrink-0" />
          <span className="font-mono font-semibold text-xs tracking-tight truncate">
            {initialState?.subject ? `Reply: ${initialState.subject}` : "Cupid Mail - New Letter"}
          </span>
          <span className="text-[10px] font-mono text-rose-300/60 hidden sm:inline shrink-0">
            (Drag across screen)
          </span>
        </div>
        <div className="flex items-center space-x-1 shrink-0 ml-2">
          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            className="p-1 hover:bg-rose-900/60 rounded-lg text-rose-200 hover:text-white transition"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-rose-900/60 rounded-lg text-rose-200 hover:text-white transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Error Alert */}
          {errorMsg && (
            <div className="bg-rose-50 border-b border-rose-200 p-3 text-xs text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

      {/* Composer Form */}
      <form onSubmit={handleSend} className="flex-1 flex flex-col p-5 space-y-2.5 overflow-y-auto bg-white">
        {/* From Field */}
        <div className="flex items-center text-xs border-b border-[#ECE3D6] pb-2 font-mono">
          <span className="w-16 text-stone-400 font-medium">From:</span>
          <select
            value={selectedMailboxId}
            onChange={(e) => setSelectedMailboxId(e.target.value)}
            className="flex-1 bg-transparent font-medium text-stone-800 focus:outline-none cursor-pointer"
          >
            {mailboxes.map((mb) => (
              <option key={mb.id} value={mb.id}>
                {mb.displayName ? `${mb.displayName} <${mb.address}>` : mb.address}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Domain Outbound Notice */}
        {isCustomDomainSender && !hasCustomKey && (
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2 text-[11px] font-sans text-amber-900 flex items-start space-x-2">
            <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-tight">
              <span>
                <strong>Note:</strong> You haven&apos;t added your own Resend key for <strong>@{senderDomainName}</strong> yet. This email will be sent on your behalf via <strong>runnly.xyz</strong> (replies will still arrive at <strong>{currentSender?.address}</strong>). To send directly from your domain, add your Resend key in Settings &rarr; Email Providers.
              </span>
            </div>
          </div>
        )}

        {/* To Field */}
        <div className="flex items-center text-xs border-b border-[#ECE3D6] pb-2 font-mono">
          <span className="w-16 text-stone-400 font-medium">To:</span>
          <input
            type="text"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            placeholder="Recipients (comma separated)..."
            className="flex-1 bg-transparent text-stone-800 focus:outline-none font-sans"
            required
          />
          <div className="flex items-center space-x-2 text-[11px] text-stone-400 font-mono">
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="hover:text-cupid-800 transition"
              >
                Cc
              </button>
            )}
            {!showBcc && (
              <button
                type="button"
                onClick={() => setShowBcc(true)}
                className="hover:text-cupid-800 transition"
              >
                Bcc
              </button>
            )}
          </div>
        </div>

        {/* CC Field */}
        {showCc && (
          <div className="flex items-center text-xs border-b border-[#ECE3D6] pb-2 font-mono">
            <span className="w-16 text-stone-400 font-medium">Cc:</span>
            <input
              type="text"
              value={ccInput}
              onChange={(e) => setCcInput(e.target.value)}
              placeholder="Cc recipients..."
              className="flex-1 bg-transparent text-stone-800 focus:outline-none font-sans"
            />
          </div>
        )}

        {/* BCC Field */}
        {showBcc && (
          <div className="flex items-center text-xs border-b border-[#ECE3D6] pb-2 font-mono">
            <span className="w-16 text-stone-400 font-medium">Bcc:</span>
            <input
              type="text"
              value={bccInput}
              onChange={(e) => setBccInput(e.target.value)}
              placeholder="Bcc recipients..."
              className="flex-1 bg-transparent text-stone-800 focus:outline-none font-sans"
            />
          </div>
        )}

        {/* Subject Field */}
        <div className="flex items-center text-xs border-b border-[#ECE3D6] pb-2">
          <span className="w-16 text-stone-400 font-mono font-medium">Subject:</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject..."
            className="flex-1 bg-transparent font-medium text-stone-900 focus:outline-none"
          />
        </div>

        {/* Body Textarea */}
        <div className="flex-1 min-h-[180px] pt-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your letter with care..."
            className="w-full h-full min-h-[180px] text-sm text-stone-900 focus:outline-none resize-none leading-relaxed placeholder:text-stone-400 font-sans"
          />
        </div>

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div className="pt-2 border-t border-[#ECE3D6] space-y-1.5">
            <div className="text-[11px] font-mono font-semibold text-stone-400">Attachments:</div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-1.5 bg-rose-50 border border-rose-200 text-cupid-900 px-2.5 py-1 rounded-xl text-xs"
                >
                  <File className="w-3.5 h-3.5" />
                  <span className="font-medium max-w-[150px] truncate">{att.filename}</span>
                  <span className="text-[10px] text-cupid-700 font-mono">({formatBytes(att.size)})</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="p-0.5 hover:text-rose-600 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Bar: Action Buttons */}
        <div className="pt-3 border-t border-[#ECE3D6] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              type="submit"
              disabled={isSending}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-cupid-900 via-cupid-800 to-cupid-900 hover:from-cupid-950 hover:to-cupid-800 active:scale-[0.99] disabled:opacity-50 text-white font-mono font-semibold text-xs rounded-xl shadow-md shadow-cupid-900/20 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? "Sending..." : "Send Letter"}</span>
            </button>

            {/* File Attachment Upload */}
            <label className="cursor-pointer p-2 text-stone-400 hover:text-cupid-800 hover:bg-rose-50 rounded-xl transition">
              <Paperclip className="w-4 h-4" />
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
            title="Discard draft"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </form>
      </>
      )}
    </div>
  );
}


