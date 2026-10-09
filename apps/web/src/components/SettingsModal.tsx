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
  Trash2,
  ChevronDown,
  ChevronUp,
  Info,
  Code2,
  AlertTriangle,
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
  const [baseDomainName, setBaseDomainName] = useState<string>("runnly.xyz");
  const [newDomainName, setNewDomainName] = useState("");
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<{ domainId: string; type: "success" | "warning"; text: string } | null>(null);
  const [expandedDnsDomainId, setExpandedDnsDomainId] = useState<string | null>(null);
  const [isDeletingDomainId, setIsDeletingDomainId] = useState<string | null>(null);
  const [domainToDelete, setDomainToDelete] = useState<{ id: string; name: string } | null>(null);
  const [domainDeleteError, setDomainDeleteError] = useState<string | null>(null);
  const [mailboxError, setMailboxError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      console.error("Clipboard copy failed", e);
    }
  };
  const [testingInboundDomainId, setTestingInboundDomainId] = useState<string | null>(null);
  const [testInboundResult, setTestInboundResult] = useState<{
    domainId: string;
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSendTestInbound = async (domain: any) => {
    setTestingInboundDomainId(domain.id);
    setTestInboundResult(null);

    const targetAddress =
      domain.mailboxes && domain.mailboxes.length > 0
        ? domain.mailboxes[0].address
        : `admin@${domain.name}`;

    try {
      const res = await fetch("/api/webhooks/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: targetAddress,
          from: "external-tester@runnly.xyz",
          subject: `Inbound Webhook Verification for ${domain.name}`,
          text: `Hello!\n\nThis is a verified test email sent via Mymail's Inbound Webhook gateway to ${targetAddress}.\n\nRaw asset persisted to Cloudinary and delivered to your INBOX!`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process test email");
      }

      setTestInboundResult({
        domainId: domain.id,
        type: "success",
        text: `Test email successfully delivered to ${targetAddress}! Check your inbox.`,
      });
      onRefreshData();
    } catch (err: any) {
      setTestInboundResult({
        domainId: domain.id,
        type: "error",
        text: err?.message || "Failed to send test email",
      });
    } finally {
      setTestingInboundDomainId(null);
    }
  };
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
        if (data.baseDomain) {
          setBaseDomainName(data.baseDomain);
        }
        if (data.domains.length > 0 && !selectedDomainForMailbox) {
          setSelectedDomainForMailbox(data.domains[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load domains", e);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    setVerifyMessage(null);
    try {
      const res = await fetch("/api/domains", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: domainId, action: "verify" }),
      });
      const data = await res.json();
      if (data.verified) {
        setVerifyMessage({
          domainId,
          type: "success",
          text: data.message || "Domain MX records verified successfully! Inbound routing active.",
        });
      } else {
        setVerifyMessage({
          domainId,
          type: "warning",
          text: data.message || "Cloudflare MX records not yet detected. Please allow 1-2 minutes for DNS propagation.",
        });
      }
      await loadDomains();
      onRefreshData();
    } catch (err: any) {
      setVerifyMessage({
        domainId,
        type: "warning",
        text: err?.message || "Failed to query DNS records",
      });
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const handleDeleteDomainClick = (domainId: string, domainName: string) => {
    setDomainToDelete({ id: domainId, name: domainName });
    setDomainDeleteError(null);
  };

  const handleConfirmDeleteDomain = async () => {
    if (!domainToDelete) return;
    setIsDeletingDomainId(domainToDelete.id);
    setDomainDeleteError(null);
    try {
      const res = await fetch(`/api/domains?id=${domainToDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete domain");
      }
      if (expandedDnsDomainId === domainToDelete.id) {
        setExpandedDnsDomainId(null);
      }
      setDomainToDelete(null);
      await loadDomains();
      onRefreshData();
    } catch (err: any) {
      setDomainDeleteError(err?.message || "Failed to delete domain");
    } finally {
      setIsDeletingDomainId(null);
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
    setMailboxError(null);

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
      setMailboxError(err?.message || "Failed to create mailbox");
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
          {activeTab === "domains" && (() => {
            const platformDomain = domains.find((d) => d.name === baseDomainName);
            const customDomains = domains.filter((d) => d.name !== baseDomainName);

            const getDnsRecords = (domainName: string) => [
              {
                type: "MX",
                name: "@",
                value: "route1.mx.cloudflare.net",
                priority: "10",
                purpose: "Cloudflare Inbound (Priority 10)",
              },
              {
                type: "MX",
                name: "@",
                value: "route2.mx.cloudflare.net",
                priority: "20",
                purpose: "Cloudflare Inbound (Priority 20)",
              },
              {
                type: "MX",
                name: "@",
                value: "route3.mx.cloudflare.net",
                priority: "30",
                purpose: "Cloudflare Inbound (Priority 30)",
              },
              {
                type: "TXT",
                name: "@",
                value: "v=spf1 include:_spf.mx.cloudflare.net include:resend.com ~all",
                priority: "-",
                purpose: "SPF (Inbound Routing & Resend)",
              },
              {
                type: "TXT",
                name: "_dmarc",
                value: "v=DMARC1; p=none;",
                priority: "-",
                purpose: "DMARC Protection Policy",
              },
              {
                type: "TXT",
                name: "resend._domainkey",
                value: "p=MIGfMA0GCSqGSIb3DQEBAQUAA... (copy from Resend tab)",
                priority: "-",
                purpose: "DKIM Key (Outbound Signing)",
              },
            ];

            const copyAllRecords = (domainName: string) => {
              const recs = getDnsRecords(domainName);
              const text = recs
                .map((r) => `Type: ${r.type}\tName: ${r.name}\tValue: ${r.value}\tPriority: ${r.priority}`)
                .join("\n");
              copyToClipboard(text, `all-${domainName}`);
            };

            return (
              <div className="space-y-6">
                {/* 1. Add Custom Domain Card */}
                <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold font-mono text-stone-900 flex items-center space-x-2">
                      <Globe className="w-4 h-4 text-cupid-700" />
                      <span>Connect Your Custom Domain</span>
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Add a domain you own (e.g. <span className="font-mono text-stone-700">jambacademy.com</span>). Newly added domains start as Pending until DNS records are verified.
                    </p>
                  </div>

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
                      placeholder="e.g. jambacademy.com"
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

                {/* 2. Custom Domains List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold font-mono text-stone-700 uppercase tracking-wider flex items-center space-x-2">
                      <span>Custom Domains</span>
                      <span className="bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded-full text-[10px]">
                        {customDomains.length}
                      </span>
                    </h4>
                  </div>

                  {customDomains.length === 0 ? (
                    <div className="border border-dashed border-[#ECE3D6] rounded-2xl p-6 bg-white text-center space-y-2">
                      <Globe className="w-8 h-8 text-stone-300 mx-auto" />
                      <p className="text-xs font-mono text-stone-600 font-semibold">No custom domains connected yet</p>
                      <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                        Enter your domain above to configure Cloudflare email routing and custom webmail addresses.
                      </p>
                    </div>
                  ) : (
                    customDomains.map((dom) => {
                      const isExpanded = expandedDnsDomainId === dom.id;
                      const isVerifying = verifyingDomainId === dom.id;
                      const isDeleting = isDeletingDomainId === dom.id;
                      const msg = verifyMessage?.domainId === dom.id ? verifyMessage : null;

                      return (
                        <div
                          key={dom.id}
                          className="border border-[#ECE3D6] rounded-2xl p-4 bg-white space-y-3 shadow-2xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold font-mono text-sm text-stone-900">{dom.name}</span>

                              {dom.verificationStatus === "VERIFIED" ? (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>VERIFIED</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200 font-semibold px-2 py-0.5 rounded-full">
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  <span>PENDING DNS SETUP</span>
                                </span>
                              )}

                              {dom.sendingConfig?.providerConnection ? (
                                <span
                                  className="inline-flex items-center space-x-1 text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded-full"
                                  title={`Outbound via ${dom.sendingConfig.providerConnection.name || "Custom Resend Key"}`}
                                >
                                  <span>Outbound: Custom Key</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab("providers")}
                                  className="inline-flex items-center space-x-1 text-[10px] font-mono bg-[#FAF7F2] hover:bg-[#F3EBE0] text-stone-600 border border-[#E5DDD0] font-medium px-2 py-0.5 rounded-full transition"
                                  title="Emails sent via runnly.xyz on your behalf. Click to connect your Resend key in Email Providers."
                                >
                                  <span>Outbound: via runnly.xyz</span>
                                </button>
                              )}

                              <span className="text-[11px] font-mono text-stone-400">
                                {dom.mailboxes?.length || 0} Mailbox(es)
                              </span>
                            </div>

                            {/* Domain Actions */}
                            <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => handleVerifyDomain(dom.id)}
                                disabled={isVerifying}
                                title="Check Cloudflare DNS records"
                                className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-lg border border-[#E5DDD0] bg-[#FAF7F2] hover:bg-[#F3EBE0] text-stone-700 flex items-center space-x-1 transition disabled:opacity-50"
                              >
                                <RefreshCw className={cn("w-3 h-3 text-stone-500", isVerifying && "animate-spin")} />
                                <span>{isVerifying ? "Checking..." : "Verify DNS"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setExpandedDnsDomainId(isExpanded ? null : dom.id)}
                                className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-lg border border-[#E5DDD0] bg-[#FAF7F2] hover:bg-[#F3EBE0] text-stone-700 flex items-center space-x-1 transition"
                              >
                                <span>DNS Records</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteDomainClick(dom.id, dom.name)}
                                disabled={isDeleting}
                                title="Delete domain"
                                className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Verification result feedback message */}
                          {msg && (
                            <div
                              className={cn(
                                "p-2.5 rounded-xl text-xs flex items-center space-x-1.5 font-mono",
                                msg.type === "success"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              )}
                            >
                              {msg.type === "success" ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                              ) : (
                                <AlertCircle className="w-4 h-4 shrink-0" />
                              )}
                              <span>{msg.text}</span>
                            </div>
                          )}

                          {/* Mailboxes for this domain */}
                          {dom.mailboxes && dom.mailboxes.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {dom.mailboxes.map((mb: any) => (
                                <span
                                  key={mb.id}
                                  className="bg-[#FAF7F2] border border-[#ECE3D6] text-stone-700 font-mono text-[11px] px-2 py-1 rounded-lg"
                                >
                                  {mb.address}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Expandable DNS Records for this specific domain */}
                          {isExpanded && (
                            <div className="pt-2 border-t border-[#ECE3D6] space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono font-bold text-stone-700">
                                  Required Cloudflare DNS Records for {dom.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyAllRecords(dom.name)}
                                  className="px-2 py-1 text-[10px] font-mono font-medium rounded-lg border border-[#E5DDD0] bg-[#FAF7F2] hover:bg-[#F3EBE0] text-stone-700 flex items-center space-x-1 transition"
                                >
                                  {copiedKey === `all-${dom.name}` ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-700 font-semibold">Copied All!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-stone-400" />
                                      <span>Copy All Records</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border border-[#ECE3D6] rounded-xl divide-y divide-[#ECE3D6]">
                                  <thead className="bg-[#FAF7F2] text-stone-600 font-mono text-[10px] uppercase">
                                    <tr>
                                      <th className="p-2">Type</th>
                                      <th className="p-2">Name / Host</th>
                                      <th className="p-2">Value / Target</th>
                                      <th className="p-2">Priority</th>
                                      <th className="p-2">Purpose</th>
                                      <th className="p-2 text-right">Copy</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#ECE3D6] font-mono text-[11px] text-stone-700">
                                    {getDnsRecords(dom.name).map((rec, rIdx) => {
                                      const rowKey = `${dom.id}-row-${rIdx}`;
                                      const nameKey = `${dom.id}-name-${rIdx}`;
                                      const valKey = `${dom.id}-val-${rIdx}`;
                                      const rowCopied = copiedKey === rowKey;

                                      return (
                                        <tr key={rIdx} className="hover:bg-[#FAF7F2]/50">
                                          <td className="p-2 font-bold text-cupid-800">{rec.type}</td>

                                          <td className="p-2">
                                            <div className="flex items-center space-x-1">
                                              <span>{rec.name}</span>
                                              <button
                                                type="button"
                                                onClick={() => copyToClipboard(rec.name, nameKey)}
                                                className="p-0.5 text-stone-400 hover:text-stone-700 rounded transition"
                                                title="Copy Name"
                                              >
                                                {copiedKey === nameKey ? (
                                                  <Check className="w-3 h-3 text-emerald-600" />
                                                ) : (
                                                  <Copy className="w-3 h-3" />
                                                )}
                                              </button>
                                            </div>
                                          </td>

                                          <td className="p-2 max-w-[280px] truncate" title={rec.value}>
                                            <div className="flex items-center space-x-1">
                                              <span className="truncate">{rec.value}</span>
                                              <button
                                                type="button"
                                                onClick={() => copyToClipboard(rec.value, valKey)}
                                                className="p-0.5 text-stone-400 hover:text-stone-700 rounded transition shrink-0"
                                                title="Copy Value"
                                              >
                                                {copiedKey === valKey ? (
                                                  <Check className="w-3 h-3 text-emerald-600" />
                                                ) : (
                                                  <Copy className="w-3 h-3" />
                                                )}
                                              </button>
                                            </div>
                                          </td>

                                          <td className="p-2 text-stone-600">{rec.priority}</td>

                                          <td className="p-2 font-sans text-stone-500 text-[11px]">{rec.purpose}</td>

                                          <td className="p-2 text-right">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                copyToClipboard(
                                                  `${rec.type} ${rec.name} ${rec.value} ${rec.priority !== "-" ? rec.priority : ""}`.trim(),
                                                  rowKey
                                                )
                                              }
                                              className="px-2 py-0.5 text-[10px] rounded border border-[#E5DDD0] bg-white hover:bg-stone-50 text-stone-600 transition"
                                            >
                                              {rowCopied ? (
                                                <span className="text-emerald-600 font-semibold">Copied!</span>
                                              ) : (
                                                "Copy"
                                              )}
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                                {/* Inbound Email Setup (Option 2: Cloudflare Email Worker) */}
                                <div className="bg-[#FAF7F2] border border-[#E5DDD0] rounded-xl p-4 space-y-3.5">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center space-x-1.5">
                                      <Code2 className="w-4 h-4 text-stone-700" />
                                      <span className="text-xs font-bold font-mono text-stone-800">
                                        Inbound Email Routing (Option 2: Cloudflare Worker)
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleSendTestInbound(dom)}
                                      disabled={testingInboundDomainId === dom.id}
                                      className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-lg border border-[#E5DDD0] bg-white hover:bg-stone-50 text-stone-800 flex items-center space-x-1 shadow-2xs transition disabled:opacity-50 self-start sm:self-auto"
                                    >
                                      <Send className={cn("w-3 h-3 text-stone-600", testingInboundDomainId === dom.id && "animate-pulse")} />
                                      <span>{testingInboundDomainId === dom.id ? "Sending Test..." : "Send Test Inbound Email"}</span>
                                    </button>
                                  </div>

                                  {testInboundResult && testInboundResult.domainId === dom.id && (
                                    <div
                                      className={cn(
                                        "p-2.5 rounded-lg text-xs font-mono flex items-center space-x-1.5",
                                        testInboundResult.type === "success"
                                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                          : "bg-rose-50 text-rose-800 border border-rose-200"
                                      )}
                                    >
                                      {testInboundResult.type === "success" ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      ) : (
                                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                      )}
                                      <span>{testInboundResult.text}</span>
                                    </div>
                                  )}

                                  {/* CRITICAL WARNING: Ensure Rule is Enabled */}
                                  <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-3.5 flex items-start space-x-3">
                                    <div className="p-1.5 bg-amber-500/20 text-amber-800 rounded-lg shrink-0 mt-0.5">
                                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                                    </div>
                                    <div className="text-xs space-y-1">
                                      <div className="font-bold font-mono text-amber-950 flex items-center space-x-2">
                                        <span>CRITICAL: Enable the Rule in Cloudflare Email Routing</span>
                                        <span className="bg-amber-200/90 text-amber-950 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                                          Must be ON
                                        </span>
                                      </div>
                                      <p className="text-amber-800 font-sans leading-relaxed text-[11px]">
                                        When creating a Catch-all or routing rule in Cloudflare, <strong>Cloudflare creates the rule in a Disabled state by default</strong>!
                                        You must toggle the status switch to <strong>Enabled (Active)</strong>. If it remains disabled, any email sent to <span className="font-mono font-semibold text-amber-950">@{dom.name}</span> will bounce immediately with <code className="bg-amber-100 text-amber-950 px-1 py-0.5 rounded text-[10px] font-mono font-bold">550 5.1.1 Address not found</code>.
                                      </p>
                                    </div>
                                  </div>

                                  {/* Option 2: 5-Line Cloudflare Email Worker Relay */}
                                  <div className="space-y-3 bg-white border border-[#ECE3D6] rounded-xl p-3.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div>
                                        <div className="flex items-center space-x-2">
                                          <span className="text-xs font-bold font-mono text-stone-900">
                                            Option 2: 5-Line Cloudflare Email Worker Relay
                                          </span>
                                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full">
                                            Self-Serve Setup
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-stone-500 font-sans mt-0.5">
                                          Deploy this lightweight worker in your Cloudflare account to stream incoming emails directly to Mymail:
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          copyToClipboard(
`export default {
  async email(message, env, ctx) {
    const res = await fetch("https://mymail-worker.runnly.workers.dev/api/inbound", {
      method: "POST",
      headers: {
        "x-inbound-recipient": message.to,
        "x-inbound-sender": message.from
      },
      body: message.raw
    });
    if (!res.ok) {
      message.setReject(\`Inbound error: \${res.status}\`);
    }
  }
};`,
                                            `worker-code-${dom.id}`
                                          )
                                        }
                                        className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-lg border border-[#E5DDD0] bg-[#FAF7F2] hover:bg-[#F3EBE0] text-stone-800 flex items-center space-x-1.5 transition self-start sm:self-auto shrink-0 shadow-2xs"
                                      >
                                        {copiedKey === `worker-code-${dom.id}` ? (
                                          <>
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            <span className="text-emerald-700 font-semibold">Copied Code!</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3.5 h-3.5 text-stone-400" />
                                            <span>Copy Worker Code</span>
                                          </>
                                        )}
                                      </button>
                                    </div>

                                    <div className="text-[11px] text-stone-600 space-y-2 font-sans bg-[#FAF7F2] p-3 rounded-lg border border-[#ECE3D6]">
                                      <p className="font-semibold font-mono text-stone-800 text-[11px]">Setup Steps in Cloudflare:</p>
                                      <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed">
                                        <li>
                                          In Cloudflare dashboard, go to <strong>Workers & Pages</strong> &rarr; <strong>Create application</strong> &rarr; <strong>Create Worker</strong> (name e.g. <code className="font-mono text-cupid-900 bg-white px-1 py-0.5 rounded border border-[#E5DDD0]">mymail-inbound</code>) &rarr; click <strong>Deploy</strong>.
                                        </li>
                                        <li>
                                          Click <strong>Edit code</strong>, replace the script with the 5-line code snippet above, and click <strong>Deploy</strong>.
                                        </li>
                                        <li>
                                          Navigate to <strong>{dom.name}</strong> &rarr; <strong>Email Routing</strong> &rarr; <strong>Routing Rules</strong>.
                                        </li>
                                        <li>
                                          Under <strong>Catch-all rule</strong>, set Action to <strong>Send to Worker</strong> &rarr; select <code className="font-mono text-stone-800 bg-white px-1 py-0.5 rounded border border-[#E5DDD0]">mymail-inbound</code> <em>(or select <code className="font-mono text-stone-800 bg-white px-1 py-0.5 rounded border border-[#E5DDD0]">mymail-worker</code> directly if {dom.name} is on the platform account)</em>.
                                        </li>
                                        <li className="text-amber-900 font-semibold">
                                          Toggle the rule switch to <strong>Enabled (Active / ON)</strong> &rarr; click <strong>Save</strong>.
                                        </li>
                                      </ol>
                                    </div>
                                  </div>
                                </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 3. Platform Base Domain Card */}
                {platformDomain && (
                  <div className="border border-[#ECE3D6] rounded-2xl p-4 bg-[#FAF7F2]/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold font-mono text-sm text-stone-900">{platformDomain.name}</span>
                        <span className="text-[10px] font-mono bg-rose-50 text-rose-800 border border-rose-200 font-semibold px-2 py-0.5 rounded-full">
                          Platform Host (Built-in)
                        </span>
                      </div>
                      <span className="text-xs font-mono text-stone-400">
                        {platformDomain.mailboxes?.length || 0} Mailbox(es)
                      </span>
                    </div>

                    <p className="text-[11px] text-stone-500 font-sans">
                      Default serverless domain provided with your Cupid Mail installation. Pre-configured and verified.
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {platformDomain.mailboxes?.map((mb: any) => (
                        <span
                          key={mb.id}
                          className="bg-white border border-[#ECE3D6] text-stone-700 font-mono text-[11px] px-2 py-1 rounded-lg"
                        >
                          {mb.address}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Create Mailbox Section */}
                {domains.length > 0 && (
                  <div className="border border-[#ECE3D6] rounded-2xl p-5 bg-white space-y-3 shadow-2xs">
                    <h4 className="text-xs font-bold font-mono text-stone-800 flex items-center space-x-2">
                      <Plus className="w-4 h-4 text-cupid-700" />
                      <span>Create Mailbox</span>
                    </h4>

                    {mailboxError && (
                      <div className="p-2.5 rounded-xl text-xs flex items-center space-x-1.5 font-mono bg-rose-50 text-rose-800 border border-rose-200">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{mailboxError}</span>
                      </div>
                    )}

                    <form onSubmit={handleCreateMailbox} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <select
                        value={selectedDomainForMailbox}
                        onChange={(e) => setSelectedDomainForMailbox(e.target.value)}
                        className="px-3 py-2 bg-[#FAF7F2] text-xs font-mono border border-[#E5DDD0] rounded-xl focus:outline-none"
                      >
                        {domains.map((d) => (
                          <option key={d.id} value={d.id}>
                            @{d.name} {d.name === baseDomainName ? "(Platform)" : d.verificationStatus === "PENDING" ? "(Pending DNS)" : ""}
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

                {/* 5. General DNS Guidance & Clipboard Reference */}
                <div className="border border-[#ECE3D6] rounded-2xl p-5 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold font-mono text-stone-800 flex items-center space-x-1.5">
                        <Info className="w-3.5 h-3.5 text-cupid-700" />
                        <span>Cloudflare DNS Setup Guide</span>
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5 leading-relaxed font-sans">
                        Add these records to your domain in Cloudflare DNS. Use the copy buttons to paste directly into Cloudflare.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyAllRecords(customDomains[0]?.name || baseDomainName)}
                      className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg border border-[#E5DDD0] bg-[#FAF7F2] hover:bg-[#F3EBE0] text-stone-700 flex items-center space-x-1.5 transition"
                    >
                      {copiedKey === `all-${customDomains[0]?.name || baseDomainName}` ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">Copied All Records!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-stone-400" />
                          <span>Copy All Records</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border border-[#ECE3D6] rounded-xl divide-y divide-[#ECE3D6]">
                      <thead className="bg-[#FAF7F2] text-stone-600 font-mono text-[10px] uppercase">
                        <tr>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Name / Host</th>
                          <th className="p-2.5">Value / Target</th>
                          <th className="p-2.5">Priority</th>
                          <th className="p-2.5">Purpose</th>
                          <th className="p-2.5 text-right">Copy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECE3D6] font-mono text-[11px] text-stone-700">
                        {getDnsRecords(customDomains[0]?.name || baseDomainName).map((rec, rIdx) => {
                          const guideRowKey = `guide-row-${rIdx}`;
                          const guideNameKey = `guide-name-${rIdx}`;
                          const guideValKey = `guide-val-${rIdx}`;

                          return (
                            <tr key={rIdx} className="hover:bg-[#FAF7F2]/50">
                              <td className="p-2.5 font-bold text-cupid-800">{rec.type}</td>

                              <td className="p-2.5">
                                <div className="flex items-center space-x-1.5">
                                  <span>{rec.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(rec.name, guideNameKey)}
                                    className="p-1 text-stone-400 hover:text-stone-700 rounded transition"
                                    title="Copy Name"
                                  >
                                    {copiedKey === guideNameKey ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              <td className="p-2.5">
                                <div className="flex items-center space-x-1.5">
                                  <span className="truncate max-w-[280px]">{rec.value}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(rec.value, guideValKey)}
                                    className="p-1 text-stone-400 hover:text-stone-700 rounded transition shrink-0"
                                    title="Copy Value"
                                  >
                                    {copiedKey === guideValKey ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              <td className="p-2.5 text-stone-600">{rec.priority}</td>

                              <td className="p-2.5 font-sans text-stone-500 text-[11px]">{rec.purpose}</td>

                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(
                                      `${rec.type} ${rec.name} ${rec.value} ${rec.priority !== "-" ? rec.priority : ""}`.trim(),
                                      guideRowKey
                                    )
                                  }
                                  className="px-2 py-1 text-[10px] rounded border border-[#E5DDD0] bg-white hover:bg-stone-50 text-stone-600 transition"
                                >
                                  {copiedKey === guideRowKey ? (
                                    <span className="text-emerald-600 font-semibold">Copied!</span>
                                  ) : (
                                    "Copy"
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* General Inbound Guide (Option 2) */}
                  <div className="pt-2 border-t border-[#ECE3D6] space-y-3">
                    <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-3.5 flex items-start space-x-3">
                      <div className="p-1.5 bg-amber-500/20 text-amber-800 rounded-lg shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="font-bold font-mono text-amber-950 flex items-center space-x-2">
                          <span>CRITICAL: Enable Rule in Cloudflare Email Routing</span>
                          <span className="bg-amber-200/90 text-amber-950 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                            Must be ON
                          </span>
                        </div>
                        <p className="text-amber-800 font-sans leading-relaxed text-[11px]">
                          When creating a Catch-all or routing rule in Cloudflare, <strong>Cloudflare defaults the rule to Disabled</strong>! You must toggle the switch to <strong>Enabled (Active)</strong>. If disabled, all incoming emails will bounce with <code className="bg-amber-100 text-amber-950 px-1 py-0.5 rounded text-[10px] font-mono font-bold">550 5.1.1 Address not found</code>.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 bg-[#FAF7F2] border border-[#E5DDD0] rounded-xl p-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold font-mono text-stone-900">
                              Option 2: 5-Line Cloudflare Email Worker Relay
                            </span>
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full">
                              Self-Serve Setup
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 font-sans mt-0.5">
                            Connect any domain by deploying this 5-line forwarder worker in Cloudflare:
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
`export default {
  async email(message, env, ctx) {
    const res = await fetch("https://mymail-worker.runnly.workers.dev/api/inbound", {
      method: "POST",
      headers: {
        "x-inbound-recipient": message.to,
        "x-inbound-sender": message.from
      },
      body: message.raw
    });
    if (!res.ok) {
      message.setReject(\`Inbound error: \${res.status}\`);
    }
  }
};`,
                              "guide-worker-code"
                            )
                          }
                          className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-lg border border-[#E5DDD0] bg-white hover:bg-stone-50 text-stone-800 flex items-center space-x-1.5 transition self-start sm:self-auto shrink-0 shadow-2xs"
                        >
                          {copiedKey === "guide-worker-code" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-semibold">Copied Code!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-stone-400" />
                              <span>Copy Worker Code</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="text-[11px] text-stone-600 space-y-1.5 font-sans bg-white p-3 rounded-lg border border-[#ECE3D6]">
                        <p className="font-semibold font-mono text-stone-800 text-[11px]">Steps in Cloudflare Email Routing:</p>
                        <ol className="list-decimal list-inside space-y-1 pl-1 leading-relaxed">
                          <li>Create a Worker in Cloudflare with the code above and click <strong>Deploy</strong>.</li>
                          <li>Go to <strong>Your Domain &rarr; Email Routing &rarr; Routing Rules</strong>.</li>
                          <li>Under <strong>Catch-all rule</strong>, set Action to <strong>Send to Worker</strong> &rarr; select your worker.</li>
                          <li className="text-amber-900 font-semibold">Switch rule status to <strong>Enabled (Active / ON)</strong> &rarr; Save.</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

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

                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start space-x-2 font-sans">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="leading-relaxed text-[11px]">
                    <strong>Important for Custom Domains:</strong> The platform&apos;s default Resend key only sends for <strong>{baseDomainName}</strong>. If you send an email from a custom domain without your own key, it will be sent on your behalf via <strong>{baseDomainName}</strong> (with replies routed back to your custom mailbox). To send directly from your domain, create a free API key at{" "}
                    <a href="https://resend.com" target="_blank" rel="noreferrer" className="underline font-semibold hover:text-amber-950">
                      resend.com
                    </a>
                    , verify your domain there, and link your key below.
                  </div>
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

        {/* In-App Confirmation Modal for Deleting Domain */}
        {domainToDelete && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-[#FFFDFB] border border-[#ECE3D6] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-cupid-900 flex items-center justify-center shrink-0 border border-rose-200">
                  <Trash2 className="w-5 h-5 text-cupid-800" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-mono text-stone-900">
                    Remove Domain?
                  </h3>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed font-sans">
                    Are you sure you want to remove <strong className="text-cupid-900 font-mono font-bold">{domainToDelete.name}</strong>? This will permanently delete all associated mailboxes, aliases, and incoming routing.
                  </p>
                </div>
              </div>

              {domainDeleteError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center space-x-2 font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{domainDeleteError}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#ECE3D6]">
                <button
                  type="button"
                  onClick={() => {
                    setDomainToDelete(null);
                    setDomainDeleteError(null);
                  }}
                  disabled={isDeletingDomainId !== null}
                  className="px-4 py-2 rounded-xl text-xs font-mono font-medium text-stone-600 hover:text-stone-900 hover:bg-[#F3EBE0] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteDomain}
                  disabled={isDeletingDomainId !== null}
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-cupid-900 to-cupid-800 hover:from-cupid-950 hover:to-cupid-900 text-white shadow-sm transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isDeletingDomainId !== null ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Removing...</span>
                    </>
                  ) : (
                    <span>Delete Domain</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
