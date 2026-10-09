"use client";

import React, { useState } from "react";
import {
  Search,
  Star,
  Paperclip,
  RotateCw,
  Inbox,
  CheckSquare,
  Square,
  Heart,
} from "lucide-react";
import { cn, formatEmailDate } from "@/lib/utils";

export interface MessageListItem {
  id: string;
  mailboxMessageId: string;
  mailboxId: string;
  mailboxAddress: string;
  threadId: string;
  fromAddress: string;
  fromName: string;
  subject: string;
  snippet: string;
  messageCount: number;
  folder: string;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  date: string;
  direction: string;
  attachmentsCount: number;
  hasAttachments: boolean;
}

interface MessageListProps {
  messages: MessageListItem[];
  selectedMessageId: string | null;
  isLoading: boolean;
  searchTerm: string;
  filterTab: "ALL" | "UNREAD" | "STARRED" | "ATTACHMENTS";
  onSearchChange: (search: string) => void;
  onFilterChange: (tab: "ALL" | "UNREAD" | "STARRED" | "ATTACHMENTS") => void;
  onSelectMessage: (id: string) => void;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  onToggleRead: (id: string, isRead: boolean, e: React.MouseEvent) => void;
  onArchive: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRefresh: () => void;
}

export function MessageList({
  messages,
  selectedMessageId,
  isLoading,
  searchTerm,
  filterTab,
  onSearchChange,
  onFilterChange,
  onSelectMessage,
  onToggleStar,
  onToggleRead,
  onArchive,
  onDelete,
  onRefresh,
}: MessageListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter messages based on tab
  const filteredMessages = messages.filter((m) => {
    if (filterTab === "UNREAD") return !m.isRead;
    if (filterTab === "STARRED") return m.isStarred;
    if (filterTab === "ATTACHMENTS") return m.hasAttachments;
    return true;
  });

  const allSelected =
    filteredMessages.length > 0 && selectedIds.size === filteredMessages.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMessages.map((m) => m.id)));
    }
  };

  return (
    <div className="w-[370px] lg:w-[410px] bg-[#FAF7F2] border-r border-[#ECE3D6] flex flex-col h-screen shrink-0 select-none">
      {/* Top Search Bar */}
      <div className="p-3 border-b border-[#ECE3D6] bg-white/70 backdrop-blur-xs space-y-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search letters & senders..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#F5EFE6] hover:bg-white focus:bg-white text-xs font-mono rounded-xl border border-[#E5DDD0] focus:border-cupid-600 focus:outline-none focus:ring-1 focus:ring-cupid-600 transition placeholder:text-stone-400"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 text-xs">
          {(["ALL", "UNREAD", "STARRED", "ATTACHMENTS"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onFilterChange(tab)}
              className={cn(
                "px-2.5 py-1 rounded-lg font-mono text-[11px] font-medium transition whitespace-nowrap",
                filterTab === tab
                  ? "bg-cupid-800 text-white shadow-xs"
                  : "bg-[#EFE8DE] text-stone-600 hover:bg-[#E5DCD0]"
              )}
            >
              {tab === "ALL" && "All"}
              {tab === "UNREAD" && "Unread"}
              {tab === "STARRED" && "Starred"}
              {tab === "ATTACHMENTS" && "Files"}
            </button>
          ))}
        </div>
      </div>

      {/* Action Row */}
      <div className="h-9 px-3.5 border-b border-[#ECE3D6] flex items-center justify-between text-[11px] font-mono text-stone-500 bg-[#F6F0E6]/80">
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSelectAll}
            className="text-stone-400 hover:text-stone-700 transition"
            title="Select all"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-cupid-700" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
          </button>
          <span>{filteredMessages.length} conversation{filteredMessages.length === 1 ? "" : "s"}</span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={onRefresh}
            className="p-1 hover:bg-rose-50 rounded-lg hover:text-cupid-800 transition"
            title="Refresh inbox"
          >
            <RotateCw className={cn("w-3 h-3", isLoading && "animate-spin text-cupid-700")} />
          </button>
        </div>
      </div>

      {/* Message List Stream */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#EFE7DC]">
        {isLoading && filteredMessages.length === 0 ? (
          <div className="p-8 text-center text-stone-400 space-y-2">
            <div className="w-6 h-6 border-2 border-cupid-800 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-mono">Gathering letters...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#E5DDD0] shadow-xs flex items-center justify-center mx-auto overflow-hidden p-2">
              <img
                src="/assets/Img.jpg"
                alt="Cupid Silhouette"
                className="w-full h-full object-contain opacity-75"
              />
            </div>
            <div>
              <p className="text-xs font-mono font-bold text-stone-800">
                {searchTerm ? "No letters found" : "Inbox is empty"}
              </p>
              <p className="text-[11px] text-stone-400 font-sans mt-0.5 max-w-[200px] mx-auto">
                {searchTerm
                  ? "Try searching for a different keyword or recipient."
                  : "No letters in this folder yet. Ready to send one?"}
              </p>
            </div>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isSelected = selectedMessageId === msg.id;
            return (
              <div
                key={msg.id}
                onClick={() => onSelectMessage(msg.id)}
                className={cn(
                  "p-3.5 cursor-pointer transition relative group",
                  isSelected
                    ? "bg-rose-50/90 border-l-4 border-l-cupid-800 shadow-xs"
                    : !msg.isRead
                    ? "bg-[#FFFDFB] hover:bg-[#F7F1E8]"
                    : "bg-[#FAF7F2]/80 hover:bg-[#F3EBE0] text-stone-600"
                )}
              >
                {/* Header: Sender & Date */}
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center space-x-1.5 truncate">
                    {!msg.isRead && (
                      <span className="w-2 h-2 rounded-full bg-cupid-600 shrink-0 ring-2 ring-rose-200" />
                    )}
                    <span
                      className={cn(
                        "truncate",
                        !msg.isRead
                          ? "font-bold text-stone-950"
                          : "font-semibold text-stone-800"
                      )}
                    >
                      {msg.fromName || msg.fromAddress}
                    </span>
                    {msg.messageCount > 1 && (
                      <span className="text-[10px] font-mono bg-[#EFE8DE] text-stone-700 px-1.5 py-0.2 rounded-full font-bold">
                        {msg.messageCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-stone-400 shrink-0 ml-2">
                    {formatEmailDate(msg.date)}
                  </span>
                </div>

                {/* Subject */}
                <div
                  className={cn(
                    "text-xs truncate mb-1",
                    !msg.isRead ? "font-bold text-stone-900" : "font-medium text-stone-800"
                  )}
                >
                  {msg.subject || "(no subject)"}
                </div>

                {/* Snippet */}
                <div className="text-[11px] text-stone-500 line-clamp-1 leading-relaxed">
                  {msg.snippet || "No preview text"}
                </div>

                {/* Footer Badges & Actions */}
                <div className="flex items-center justify-between mt-2 pt-1 text-[11px] text-stone-400">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] bg-[#EFE8DE] text-stone-700 px-1.5 py-0.5 rounded font-mono truncate max-w-[150px]">
                      {msg.mailboxAddress}
                    </span>
                    {msg.hasAttachments && (
                      <span className="flex items-center space-x-0.5 text-cupid-900 bg-rose-100/80 px-1.5 py-0.5 rounded font-mono text-[10px]">
                        <Paperclip className="w-3 h-3" />
                        <span>{msg.attachmentsCount}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {/* Star Button */}
                    <button
                      onClick={(e) => onToggleStar(msg.id, e)}
                      className="p-1 hover:bg-stone-200/60 rounded-md transition"
                      title={msg.isStarred ? "Starred" : "Not starred"}
                    >
                      <Star
                        className={cn(
                          "w-3.5 h-3.5",
                          msg.isStarred
                            ? "fill-amber-400 text-amber-500"
                            : "text-stone-300 group-hover:text-stone-400"
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


