"use client";

import React from "react";
import {
  Inbox,
  Star,
  Send,
  FileText,
  Archive,
  Trash2,
  Mail,
  Plus,
  Settings,
  Globe,
  Layers,
  Heart,
  LogOut,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";

interface MailboxItem {
  id: string;
  address: string;
  displayName: string | null;
  domain?: {
    name: string;
  };
}

interface SidebarProps {
  currentFolder: string;
  currentMailboxId: string;
  mailboxes: MailboxItem[];
  unreadCount?: number;
  onSelectFolder: (folder: string) => void;
  onSelectMailbox: (mailboxId: string) => void;
  onOpenComposer: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  currentFolder,
  currentMailboxId,
  mailboxes,
  unreadCount = 0,
  onSelectFolder,
  onSelectMailbox,
  onOpenComposer,
  onOpenSettings,
}: SidebarProps) {
  const [currentUser, setCurrentUser] = React.useState<{
    id: string;
    email: string;
    name?: string | null;
    role?: string;
  } | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    window.location.href = "/login";
  };

  const folders = [
    { id: "INBOX", label: "Inbox", icon: Inbox, count: unreadCount },
    { id: "STARRED", label: "Starred", icon: Star },
    { id: "SENT", label: "Sent", icon: Send },
    { id: "DRAFTS", label: "Drafts", icon: FileText },
    { id: "ARCHIVE", label: "Archive", icon: Archive },
    { id: "TRASH", label: "Trash", icon: Trash2 },
  ];

  return (
    <aside className="w-64 bg-[#FCFAF7] border-r border-[#ECE3D6] flex flex-col h-screen select-none shrink-0 shadow-xs">
      {/* Brand Header */}
      <div className="h-16 border-b border-[#ECE3D6] px-4 flex items-center justify-between bg-white/70 backdrop-blur-xs">
        <div className="flex items-center space-x-2.5">
          <div className="relative">
            {/* Cupid 3D Logo */}
            <img
              src="/assets/Logo.png"
              alt="Cupid Mail"
              className="w-10 h-10 object-contain drop-shadow-sm transition-transform hover:scale-105"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-cupid-600 rounded-full border-2 border-white flex items-center justify-center">
              <Heart className="w-1.5 h-1.5 text-white fill-current" />
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-mono font-bold text-base text-stone-900 tracking-tight">
                Cupid<span className="text-cupid-800">Mail</span>
              </span>
            </div>
            <p className="text-[10px] font-mono text-stone-400 leading-none">
              Private & Serverless
            </p>
          </div>
        </div>
      </div>

      {/* Compose CTA */}
      <div className="p-3.5">
        <button
          onClick={onOpenComposer}
          className="w-full group flex items-center justify-center space-x-2 bg-gradient-to-r from-cupid-900 via-cupid-800 to-cupid-900 hover:from-cupid-950 hover:to-cupid-800 active:scale-[0.99] text-white font-mono text-xs font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-cupid-900/20 transition-all duration-150 border border-rose-900/30"
        >
          <Plus className="w-4 h-4 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
          <span>New Letter</span>
        </button>
      </div>

      {/* Main Folders Navigation */}
      <div className="px-3 py-1 space-y-0.5 flex-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[11px] font-mono font-bold text-stone-400 uppercase tracking-wider">
          Mailboxes
        </div>
        {folders.map((folder) => {
          const Icon = folder.icon;
          const isActive = currentFolder === folder.id;
          return (
            <button
              key={folder.id}
              onClick={() => onSelectFolder(folder.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition",
                isActive
                  ? "bg-rose-50/90 text-cupid-950 font-semibold shadow-xs border border-rose-100"
                  : "text-stone-600 hover:bg-[#F3EBE0]/60 hover:text-stone-900"
              )}
            >
              <div className="flex items-center space-x-2.5">
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isActive ? "text-cupid-700 stroke-[2.2]" : "text-stone-400"
                  )}
                />
                <span className={cn(isActive && "font-semibold")}>{folder.label}</span>
              </div>
              {folder.count && folder.count > 0 ? (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition",
                    isActive
                      ? "bg-cupid-800 text-white shadow-xs"
                      : "bg-rose-100 text-cupid-900"
                  )}
                >
                  {folder.count}
                </span>
              ) : null}
            </button>
          );
        })}

        {/* Multi-Domain / Account Filter Section */}
        <div className="pt-5">
          <div className="px-3 py-1.5 text-[11px] font-mono font-bold text-stone-400 uppercase tracking-wider flex items-center justify-between">
            <span>Inboxes</span>
            <Globe className="w-3.5 h-3.5 text-stone-400" />
          </div>

          <div className="space-y-0.5 mt-1">
            <button
              onClick={() => onSelectMailbox("all")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition",
                currentMailboxId === "all"
                  ? "bg-rose-50/90 text-cupid-950 font-semibold border border-rose-100"
                  : "text-stone-600 hover:bg-[#F3EBE0]/60 hover:text-stone-900"
              )}
            >
              <div className="flex items-center space-x-2.5 truncate">
                <Layers
                  className={cn(
                    "w-4 h-4",
                    currentMailboxId === "all" ? "text-cupid-700" : "text-stone-400"
                  )}
                />
                <span className="truncate">All Inboxes</span>
              </div>
            </button>

            {mailboxes.map((mb) => {
              const isSelected = currentMailboxId === mb.id;
              return (
                <button
                  key={mb.id}
                  onClick={() => onSelectMailbox(mb.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition text-left",
                    isSelected
                      ? "bg-rose-50/90 text-cupid-950 font-semibold border border-rose-100"
                      : "text-stone-600 hover:bg-[#F3EBE0]/60 hover:text-stone-900"
                  )}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        isSelected
                          ? "bg-cupid-700 ring-2 ring-rose-200"
                          : "bg-stone-300"
                      )}
                    />
                    <span className="truncate font-mono text-[11px]">{mb.address}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer & User Profile */}
      <div className="p-3 border-t border-[#ECE3D6] bg-white/60 space-y-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-mono font-medium text-stone-700 hover:bg-rose-50 hover:text-cupid-900 border border-transparent hover:border-rose-200/60 transition"
        >
          <Settings className="w-4 h-4 text-stone-400" />
          <span>Domain settings</span>
        </button>

        {/* User Account Bar */}
        {currentUser && (
          <div className="pt-2 border-t border-[#ECE3D6] flex items-center justify-between px-1">
            <div className="flex items-center space-x-2 truncate">
              <div className="w-7 h-7 rounded-xl bg-cupid-900 text-white font-mono font-bold text-[11px] flex items-center justify-center shrink-0 shadow-xs">
                {getInitials(currentUser.name, currentUser.email)}
              </div>
              <div className="truncate text-left">
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-semibold text-stone-800 truncate font-mono">
                    {currentUser.name || currentUser.email.split("@")[0]}
                  </span>
                  {currentUser.role === "ADMIN" && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-rose-100 text-cupid-900 border border-rose-200">
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-mono text-stone-400 truncate max-w-[130px]" title={currentUser.email}>
                  {currentUser.email}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-stone-400 hover:text-cupid-900 hover:bg-rose-50 rounded-lg transition shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

