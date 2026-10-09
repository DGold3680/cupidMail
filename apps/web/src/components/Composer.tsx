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
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

interface MailboxOption {
  id: string;
  address: string;
  displayName: string | null;
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
    <div className="fixed bottom-0 right-6 w-full max-w-2xl bg-white border border-[#ECE3D6] rounded-t-3xl shadow-cupid-lg z-50 overflow-hidden flex flex-col max-h-[85vh]">
      {/* Composer Header */}
      <div className="bg-gradient-to-r from-cupid-950 via-cupid-900 to-cupid-800 px-5 py-3 text-white flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          <img src="/assets/Logo.png" alt="Cupid" className="w-5 h-5 object-contain" />
          <span className="font-mono font-semibold text-xs tracking-tight">
            {initialState?.subject ? `Reply: ${initialState.subject}` : "Cupid Mail - New Letter"}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onClose}
            className="p-1 hover:bg-rose-900/60 rounded-lg text-rose-200 hover:text-white transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

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
    </div>
  );
}


