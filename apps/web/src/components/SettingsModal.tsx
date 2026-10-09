"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Globe,
  Key,
  HardDrive,
  GitBranch,
  Plus,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Server,
  Cloud,
  Layers,
  ArrowRight,
  Shield,
  RotateCcw,
  Mail,
  Send,
  Inbox,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
}

interface StorageStatus {
  isCustom: boolean;
  cloudName: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasEnvDefaults: boolean;
  envCloudName: string;
}

export function SettingsModal({ isOpen, onClose, onRefreshData }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"domains" | "providers" | "storage" | "workflow">("domains");

  // Domain states
  const [domains, setDomains] = useState<any[]>([]);
  const [newDomainName, setNewDomainName] = useState("");
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  // Mailbox / Alias states
  const [selectedDomainForMailbox, setSelectedDomainForMailbox] = useState("");
  const [newLocalPart, setNewLocalPart] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [isAddingMailbox, setIsAddingMailbox] = useState(false);

  // Provider (BYOK) states
  const [providers, setProviders] = useState<any[]>([]);
  const [providerName, setProviderName] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [providerMessage, setProviderMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Storage (Cloudinary BYOK / env fallback) states
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [byokCloudName, setByokCloudName] = useState("");
  const [byokApiKey, setByokApiKey] = useState("");
  const [byokApiSecret, setByokApiSecret] = useState("");
  const [isSavingStorage, setIsSavingStorage] = useState(false);
  const [storageMessage, setStorageMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDomains();
      loadProviders();
      loadStorageStatus();
    }
  }, [isOpen]);

  const loadDomains = async () => {
    try {
      const res = await fetch("/api/domains");
      const data = await res.json();
      if (data.domains) {
        setDomains(data.domains);
        if (data.domains.length > 0 && !selectedDomainForMailbox) {
          setSelectedDomainForMailbox(data.domains[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load domains", e);
    }
  };

  const loadProviders = async () => {
    try {
      const res = await fetch("/api/providers");
      const data = await res.json();
      if (data.providers) {
        setProviders(data.providers);
      }
    } catch (e) {
      console.error("Failed to load providers", e);
    }
  };

  const loadStorageStatus = async () => {
    try {
      const res = await fetch("/api/storage");
      const data = await res.json();
      setStorageStatus(data);
      if (data.isCustom && data.cloudName) {
        setByokCloudName(data.cloudName);
      }
    } catch (e) {
      console.error("Failed to load storage status", e);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainName.trim()) return;
    setDomainError(null);
    setIsAddingDomain(true);

    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDomainName }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to add domain");
      }

      setNewDomainName("");
      await loadDomains();
      onRefreshData();
    } catch (err: any) {
      setDomainError(err?.message || "Failed to create domain");
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocalPart.trim() || !selectedDomainForMailbox) return;
    setIsAddingMailbox(true);

    try {
      const res = await fetch("/api/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "mailbox",
          domainId: selectedDomainForMailbox,
          localPart: newLocalPart,
          displayName: newDisplayName,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to create mailbox");
      }

      setNewLocalPart("");
      setNewDisplayName("");
      await loadDomains();
      onRefreshData();
    } catch (err: any) {
      alert(err?.message || "Failed to create mailbox");
    } finally {
      setIsAddingMailbox(false);
    }
  };

  const handleSaveResendKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendApiKey.trim()) return;
    setIsSavingProvider(true);
    setProviderMessage(null);

    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: providerName.trim() || "Resend Key",
          apiKey: resendApiKey.trim(),
          domainIds: selectedDomainIds,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save Resend API key");
      }

      setProviderMessage({ type: "success", text: "Resend key securely connected!" });
      setResendApiKey("");
      setProviderName("");
      await loadProviders();
      await loadDomains();
      onRefreshData();
    } catch (err: any) {
      setProviderMessage({ type: "error", text: err?.message || "Failed to save provider" });
    } finally {
      setIsSavingProvider(false);
    }
  };

  const handleSaveStorage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!byokCloudName.trim()) {
      setStorageMessage({ type: "error", text: "Please enter your Cloudinary Cloud Name." });
      return;
    }

    setIsSavingStorage(true);
    setStorageMessage(null);

    try {
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloudName: byokCloudName.trim(),
          apiKey: byokApiKey.trim(),
          apiSecret: byokApiSecret.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save storage settings");
      }

      setStorageMessage({ type: "success", text: "Custom Cloudinary BYOK storage connected!" });
      setByokApiKey("");
      setByokApiSecret("");
      await loadStorageStatus();
    } catch (err: any) {
      setStorageMessage({ type: "error", text: err?.message || "Failed to save storage" });
    } finally {
      setIsSavingStorage(false);
    }
  };

  const handleResetStorage = async () => {
    setIsSavingStorage(true);
    setStorageMessage(null);

    try {
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to reset storage");
      }

      setByokCloudName("");
      setByokApiKey("");
      setByokApiSecret("");
      setStorageMessage({ type: "success", text: "Reverted to environment defaults." });
      await loadStorageStatus();
    } catch (err: any) {
      setStorageMessage({ type: "error", text: err?.message || "Failed to reset storage" });
    } finally {
      setIsSavingStorage(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-3xl shadow-cupid-lg border border-[#ECE3D6] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#ECE3D6] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center space-x-3">
            <img src="/assets/Logo.png" alt="Cupid" className="w-8 h-8 object-contain" />
            <div>
              <h2 className="text-base font-bold font-mono text-stone-900">Domain Settings</h2>
              <p className="text-xs text-stone-500">Configure domains, email routing, storage, and workflow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-[#F3EBE0] rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#ECE3D6] px-6 bg-white text-xs font-mono font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab("domains")}
            className={cn(
              "py-3.5 px-4 border-b-2 flex items-center space-x-2 transition whitespace-nowrap",
              activeTab === "domains"
                ? "border-cupid-700 text-cupid-900"
                : "border-transparent text-stone-400 hover:text-stone-700"
            )}
          >
            <Globe className="w-4 h-4" />
            <span>Domains & Mailboxes</span>
          </button>

          <button
            onClick={() => setActiveTab("providers")}
            className={cn(
              "py-3.5 px-4 border-b-2 flex items-center space-x-2 transition whitespace-nowrap",
              activeTab === "providers"
                ? "border-cupid-700 text-cupid-900"
                : "border-transparent text-stone-400 hover:text-stone-700"
            )}
          >
            <Key className="w-4 h-4" />
            <span>Email Providers</span>
          </button>

          <button
            onClick={() => setActiveTab("storage")}
            className={cn(
              "py-3.5 px-4 border-b-2 flex items-center space-x-2 transition whitespace-nowrap",
              activeTab === "storage"
                ? "border-cupid-700 text-cupid-900"
                : "border-transparent text-stone-400 hover:text-stone-700"
            )}
          >
            <HardDrive className="w-4 h-4" />
            <span>Storage</span>
          </button>

          <button
            onClick={() => setActiveTab("workflow")}
            className={cn(
              "py-3.5 px-4 border-b-2 flex items-center space-x-2 transition whitespace-nowrap",
              activeTab === "workflow"
                ? "border-cupid-700 text-cupid-900"
                : "border-transparent text-stone-400 hover:text-stone-700"
            )}
          >
            <GitBranch className="w-4 h-4" />
            <span>Workflow</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FAF7F2]/40">
          {/* TAB 1: DOMAINS & MAILBOXES */}
          {activeTab === "domains" && (
            <div className="space-y-6">
              {/* Add Domain Form */}
              <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold font-mono text-stone-900 flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-cupid-700" />
                  <span>Add Custom Domain</span>
                </h3>

                {domainError && (
                  <div className="p-2.5 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 flex items-center space-x-1.5 font-mono">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{domainError}</span>
                  </div>
                )}

                <form onSubmit={handleAddDomain} className="flex gap-2">
                  <input
                    type="text"
                    value={newDomainName}
                    onChange={(e) => setNewDomainName(e.target.value)}
                    placeholder="e.g. loveletter.com"
                    className="flex-1 px-3.5 py-2 bg-white text-xs font-mono border border-[#E5DDD0] rounded-xl focus:outline-none focus:border-cupid-600"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isAddingDomain}
                    className="px-4 py-2 bg-gradient-to-r from-cupid-900 to-cupid-800 hover:from-cupid-950 hover:to-cupid-900 text-white text-xs font-mono font-semibold rounded-xl shadow-sm shadow-cupid-900/20 transition disabled:opacity-50"
                  >
                    {isAddingDomain ? "Adding..." : "Add Domain"}
                  </button>
                </form>
              </div>

              {/* List of Domains */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold font-mono text-stone-400 uppercase tracking-wider">
                  Configured Domains ({domains.length})
                </h4>

                {domains.map((dom) => (
                  <div
                    key={dom.id}
                    className="border border-[#ECE3D6] rounded-2xl p-4 bg-white space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold font-mono text-sm text-stone-900">{dom.name}</span>
                        <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded-full">
                          {dom.verificationStatus}
                        </span>
                      </div>

                      <span className="text-xs font-mono text-stone-400">
                        {dom.mailboxes?.length || 0} Mailbox(es)
                      </span>
                    </div>

                    {/* Mailboxes for this domain */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {dom.mailboxes?.map((mb: any) => (
                        <span
                          key={mb.id}
                          className="bg-[#FAF7F2] border border-[#ECE3D6] text-stone-700 font-mono text-[11px] px-2 py-1 rounded-lg"
                        >
                          {mb.address}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Create Mailbox Section */}
              {domains.length > 0 && (
                <div className="border border-[#ECE3D6] rounded-2xl p-5 bg-white space-y-3 shadow-2xs">
                  <h4 className="text-xs font-bold font-mono text-stone-800 flex items-center space-x-2">
                    <Plus className="w-4 h-4 text-cupid-700" />
                    <span>Create Mailbox</span>
                  </h4>

                  <form onSubmit={handleCreateMailbox} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select
                      value={selectedDomainForMailbox}
                      onChange={(e) => setSelectedDomainForMailbox(e.target.value)}
                      className="px-3 py-2 bg-[#FAF7F2] text-xs font-mono border border-[#E5DDD0] rounded-xl focus:outline-none"
                    >
                      {domains.map((d) => (
                        <option key={d.id} value={d.id}>
                          @{d.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={newLocalPart}
                      onChange={(e) => setNewLocalPart(e.target.value)}
                      placeholder="Username (e.g. contact, info)"
                      className="px-3 py-2 bg-[#FAF7F2] text-xs font-mono border border-[#E5DDD0] rounded-xl focus:outline-none"
                      required
                    />

                    <button
                      type="submit"
                      disabled={isAddingMailbox}
                      className="px-4 py-2 bg-gradient-to-r from-cupid-900 to-cupid-800 hover:from-cupid-950 hover:to-cupid-900 text-white text-xs font-mono font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                    >
                      {isAddingMailbox ? "Creating..." : "Create Mailbox"}
                    </button>
                  </form>
                </div>
              )}

              {/* Required DNS Records Table */}
              <div className="border border-[#ECE3D6] rounded-2xl p-5 bg-white space-y-3">
                <h4 className="text-xs font-bold font-mono text-stone-800">
                  Required DNS Records (Cloudflare & Resend)
                </h4>
                <p className="text-xs text-stone-500 leading-relaxed font-sans">
                  Add these records to your domain in Cloudflare DNS to enable incoming routing and outbound delivery.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-[#ECE3D6] rounded-xl divide-y divide-[#ECE3D6]">
                    <thead className="bg-[#FAF7F2] text-stone-600 font-mono text-[11px]">
                      <tr>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Value</th>
                        <th className="p-2.5">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECE3D6] font-mono text-[11px] text-stone-700">
                      <tr>
                        <td className="p-2.5 font-bold text-cupid-800">MX</td>
                        <td className="p-2.5">@</td>
                        <td className="p-2.5">route1.mx.cloudflare.net (Priority 10)</td>
                        <td className="p-2.5 font-sans text-stone-500">Cloudflare Email Routing</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-cupid-800">TXT</td>
                        <td className="p-2.5">@</td>
                        <td className="p-2.5">v=spf1 include:_spf.mx.cloudflare.net include:resend.com ~all</td>
                        <td className="p-2.5 font-sans text-stone-500">SPF (Inbound & Outbound)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-cupid-800">TXT</td>
                        <td className="p-2.5">_dmarc</td>
                        <td className="p-2.5">v=DMARC1; p=none;</td>
                        <td className="p-2.5 font-sans text-stone-500">DMARC Protection</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EMAIL PROVIDERS */}
          {activeTab === "providers" && (
            <div className="space-y-6">
              {/* Connect Resend Key Card */}
              <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold font-mono text-stone-900 flex items-center space-x-2">
                    <Key className="w-4 h-4 text-cupid-700" />
                    <span>Bring Your Own Resend Key (BYOK)</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Connect your own Resend sending API key. The key is encrypted at rest using AES-256-GCM.
                  </p>
                </div>

                {providerMessage && (
                  <div
                    className={cn(
                      "p-3 rounded-xl text-xs flex items-center space-x-2 font-mono",
                      providerMessage.type === "success"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                    )}
                  >
                    {providerMessage.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{providerMessage.text}</span>
                  </div>
                )}

                <form onSubmit={handleSaveResendKey} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-mono font-semibold text-stone-600 block mb-1">
                        Connection Label
                      </label>
                      <input
                        type="text"
                        value={providerName}
                        onChange={(e) => setProviderName(e.target.value)}
                        placeholder="e.g. My Cupid Resend Key"
                        className="w-full px-3 py-2 bg-white text-xs font-mono border border-[#E5DDD0] rounded-xl focus:outline-none focus:border-cupid-600"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-mono font-semibold text-stone-600 block mb-1">
                        Resend API Key
                      </label>
                      <input
                        type="password"
                        value={resendApiKey}
                        onChange={(e) => setResendApiKey(e.target.value)}
                        placeholder="re_..."
                        className="w-full px-3 py-2 bg-white text-xs font-mono border border-[#E5DDD0] rounded-xl focus:outline-none focus:border-cupid-600"
                        required
                      />
                    </div>
                  </div>

                  {domains.length > 0 && (
                    <div>
                      <label className="text-[11px] font-mono font-semibold text-stone-600 block mb-1">
                        Link to Domains (optional)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {domains.map((d) => {
                          const isSelected = selectedDomainIds.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedDomainIds(selectedDomainIds.filter((id) => id !== d.id));
                                } else {
                                  setSelectedDomainIds([...selectedDomainIds, d.id]);
                                }
                              }}
                              className={cn(
                                "px-2.5 py-1 rounded-xl text-xs font-mono font-medium border transition",
                                isSelected
                                  ? "bg-cupid-800 text-white border-cupid-800"
                                  : "bg-white text-stone-700 border-[#E5DDD0] hover:bg-rose-50"
                              )}
                            >
                              {d.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingProvider}
                    className="px-4 py-2 bg-gradient-to-r from-cupid-900 to-cupid-800 hover:from-cupid-950 hover:to-cupid-900 text-white text-xs font-mono font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {isSavingProvider ? "Encrypting & Connecting..." : "Connect Resend Key"}
                  </button>
                </form>
              </div>

              {/* Connected Providers List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold font-mono text-stone-400 uppercase tracking-wider">
                  Connected Sending Providers ({providers.length})
                </h4>

                {providers.length === 0 ? (
                  <p className="text-xs text-stone-400 font-mono">No external provider connections configured yet.</p>
                ) : (
                  providers.map((p) => (
                    <div
                      key={p.id}
                      className="border border-[#ECE3D6] rounded-2xl p-4 bg-white flex items-center justify-between shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs font-mono text-stone-900">{p.name}</span>
                          <span className="text-[10px] bg-rose-100 text-cupid-900 font-mono px-2 py-0.5 rounded-full font-semibold">
                            {p.provider}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400 font-mono">
                          {p.linkedDomains?.length > 0
                            ? `Active for: ${p.linkedDomains.map((ld: any) => ld.domainName).join(", ")}`
                            : "Available for all unmapped domains"}
                        </div>
                      </div>

                      <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                        {p.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: STORAGE */}
          {activeTab === "storage" && (
            <div className="space-y-6">
              {/* Storage Mode Status Card */}
              <div className="bg-white border border-[#ECE3D6] rounded-2xl p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-cupid-800 flex items-center justify-center font-bold">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-mono text-stone-900">
                        Cloudinary Storage Configuration
                      </h3>
                      <p className="text-xs text-stone-500 font-sans">
                        Media, file attachments, and immutable raw MIME emails storage.
                      </p>
                    </div>
                  </div>

                  {storageStatus?.isCustom ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono font-bold bg-cupid-100 text-cupid-900 px-2.5 py-1 rounded-full border border-rose-200">
                        Active: Custom BYOK Key
                      </span>
                      <button
                        onClick={handleResetStorage}
                        disabled={isSavingStorage}
                        className="px-2.5 py-1 text-[11px] font-mono font-medium text-stone-600 hover:text-stone-900 hover:bg-[#F3EBE0] border border-[#ECE3D6] rounded-lg transition flex items-center space-x-1"
                        title="Revert to environment defaults"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Use Defaults</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-700 px-2.5 py-1 rounded-full border border-stone-200">
                      Active: Environment Defaults (.env)
                    </span>
                  )}
                </div>

                <div className="p-3 bg-[#FAF7F2] border border-[#ECE3D6] rounded-xl text-xs space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-stone-600">
                    <span className="text-[11px] text-stone-400">Current Cloud:</span>
                    <span className="font-bold text-stone-900">
                      {storageStatus?.cloudName || "Not configured"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-stone-600">
                    <span className="text-[11px] text-stone-400">Storage Mode:</span>
                    <span className="text-cupid-800 font-bold">
                      {storageStatus?.isCustom ? "BYOK Custom Key" : "Environment Default (Fallback)"}
                    </span>
                  </div>
                </div>

                {storageMessage && (
                  <div
                    className={cn(
                      "p-3 rounded-xl text-xs flex items-center space-x-2 font-mono",
                      storageMessage.type === "success"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                    )}
                  >
                    {storageMessage.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{storageMessage.text}</span>
                  </div>
                )}
              </div>

              {/* BYOK Cloudinary Form */}
              <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold font-mono text-stone-900 flex items-center space-x-2">
                    <Key className="w-4 h-4 text-cupid-700" />
                    <span>Bring Your Own Cloudinary Key (BYOK)</span>
                  </h4>
                  <p className="text-xs text-stone-500 mt-1 font-sans">
                    Optionally connect your own Cloudinary cloud credentials. If no custom key is provided, Cupid Mail automatically uses the environment defaults configured in <code className="font-mono text-cupid-800">.env</code>.
                  </p>
                </div>

                <form onSubmit={handleSaveStorage} className="space-y-3 font-mono">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                      Cloud Name
                    </label>
                    <input
                      type="text"
                      value={byokCloudName}
                      onChange={(e) => setByokCloudName(e.target.value)}
                      placeholder="e.g. my-cupid-cloud"
                      className="w-full px-3.5 py-2 bg-white text-xs border border-[#E5DDD0] rounded-xl focus:outline-none focus:border-cupid-600 text-stone-900"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                        API Key (optional for uploads)
                      </label>
                      <input
                        type="password"
                        value={byokApiKey}
                        onChange={(e) => setByokApiKey(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full px-3.5 py-2 bg-white text-xs border border-[#E5DDD0] rounded-xl focus:outline-none focus:border-cupid-600 text-stone-900"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                        API Secret (optional)
                      </label>
                      <input
                        type="password"
                        value={byokApiSecret}
                        onChange={(e) => setByokApiSecret(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full px-3.5 py-2 bg-white text-xs border border-[#E5DDD0] rounded-xl focus:outline-none focus:border-cupid-600 text-stone-900"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <button
                      type="submit"
                      disabled={isSavingStorage}
                      className="px-4 py-2 bg-gradient-to-r from-cupid-900 to-cupid-800 hover:from-cupid-950 hover:to-cupid-900 text-white text-xs font-semibold rounded-xl shadow-sm shadow-cupid-900/20 transition disabled:opacity-50"
                    >
                      {isSavingStorage ? "Saving..." : "Save Custom Storage"}
                    </button>

                    {storageStatus?.isCustom && (
                      <button
                        type="button"
                        onClick={handleResetStorage}
                        disabled={isSavingStorage}
                        className="px-4 py-2 bg-white hover:bg-stone-50 border border-[#ECE3D6] text-stone-700 text-xs font-semibold rounded-xl transition"
                      >
                        Reset to Environment Defaults
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: WORKFLOW */}
          {activeTab === "workflow" && (
            <div className="space-y-6">
              {/* Introduction Card */}
              <div className="bg-white border border-[#ECE3D6] rounded-2xl p-5 space-y-2 shadow-2xs">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-cupid-900 flex items-center justify-center font-bold">
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-mono text-stone-900">
                      How Cupid Mail Works
                    </h3>
                    <p className="text-xs text-stone-500 font-sans">
                      An architectural overview of how letters are received, parsed, stored, and sent.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 1: Receiving */}
              <div className="bg-white border border-[#ECE3D6] rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center space-x-3">
                  <span className="w-7 h-7 rounded-xl bg-cupid-900 text-white font-mono font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <h4 className="text-xs font-bold font-mono text-stone-900">
                      Inbound Routing (Cloudflare Email Routing)
                    </h4>
                    <p className="text-[11px] text-stone-500 font-sans">
                      Zero server overhead, distributed edge reception.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed font-sans pl-10">
                  When someone sends an email to <code className="font-mono text-cupid-800 bg-rose-50 px-1 py-0.5 rounded">you@yourdomain.com</code>, Cloudflare Email Routing intercepts the incoming SMTP stream via your configured MX records (<code className="font-mono text-stone-700">route1.mx.cloudflare.net</code>). The message is immediately routed to Cupid's serverless Worker without running any virtual servers.
                </p>
              </div>

              {/* Step 2: Storage */}
              <div className="bg-white border border-[#ECE3D6] rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center space-x-3">
                  <span className="w-7 h-7 rounded-xl bg-cupid-900 text-white font-mono font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <h4 className="text-xs font-bold font-mono text-stone-900">
                      Raw Capture & Durable Storage (Cloudinary)
                    </h4>
                    <p className="text-[11px] text-stone-500 font-sans">
                      Immutable backup before parsing to prevent any data loss.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed font-sans pl-10">
                  Before performing any parsing or manipulation, the Worker uploads the complete raw MIME message (<code className="font-mono text-cupid-800 bg-rose-50 px-1 py-0.5 rounded">.eml</code>) into Cloudinary using your custom BYOK key or the environment defaults. This ensures that even if a worker times out or crashes during processing, the raw message is safely persisted.
                </p>
              </div>

              {/* Step 3: Parsing & Normalization */}
              <div className="bg-white border border-[#ECE3D6] rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center space-x-3">
                  <span className="w-7 h-7 rounded-xl bg-cupid-900 text-white font-mono font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <h4 className="text-xs font-bold font-mono text-stone-900">
                      Parsing & Indexing (Cupid Core Engine)
                    </h4>
                    <p className="text-[11px] text-stone-500 font-sans">
                      Thread grouping, SPF/DKIM verification, and HTML sanitation.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed font-sans pl-10">
                  The message stream is parsed into clean sender/recipient addresses, subjects, timestamps, and normalized thread conversations. Raw HTML is strictly sanitized to strip tracking pixels and malicious scripts, while attachments are cataloged with CDN download links.
                </p>
              </div>

              {/* Step 4: Outbound Sending */}
              <div className="bg-white border border-[#ECE3D6] rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center space-x-3">
                  <span className="w-7 h-7 rounded-xl bg-cupid-900 text-white font-mono font-bold text-xs flex items-center justify-center">
                    4
                  </span>
                  <div>
                    <h4 className="text-xs font-bold font-mono text-stone-900">
                      Outbound Dispatch (BYOK Resend)
                    </h4>
                    <p className="text-[11px] text-stone-500 font-sans">
                      High deliverability with DMARC, DKIM, and SPF alignment.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed font-sans pl-10">
                  When you compose a new letter or reply, Cupid Mail signs and dispatches the email using your connected Resend API key. Real-time webhooks listen for delivery confirmations, open receipts, and bounce events.
                </p>
              </div>

              {/* Step 5: Self-Healing */}
              <div className="bg-white border border-[#ECE3D6] rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center space-x-3">
                  <span className="w-7 h-7 rounded-xl bg-cupid-900 text-white font-mono font-bold text-xs flex items-center justify-center">
                    5
                  </span>
                  <div>
                    <h4 className="text-xs font-bold font-mono text-stone-900">
                      Automated Recovery Cron
                    </h4>
                    <p className="text-[11px] text-stone-500 font-sans">
                      Scheduled self-healing runs every 15 minutes.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed font-sans pl-10">
                  A scheduled background cron (<code className="font-mono text-cupid-800 bg-rose-50 px-1 py-0.5 rounded">*/15 * * * *</code>) continuously checks for any pending or interrupted ingestion jobs. If an unparsed message is discovered, it is automatically reprocessed and added to your inbox seamlessly.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
