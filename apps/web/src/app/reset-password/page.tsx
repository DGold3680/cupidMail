"use client";

import React, { useState, Suspense } from "react";
import { ArrowRight, ShieldCheck, Heart, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!token) {
      setErrorMsg("Reset token is missing. Please click the link from your email.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to reset password");
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset password. Link may have expired.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-[#ECE3D6] rounded-3xl p-8 shadow-cupid-lg space-y-6 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-16 -right-16 w-44 h-44 bg-rose-100/60 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-rose-100/40 rounded-full blur-2xl pointer-events-none" />

      {/* Brand Header */}
      <div className="text-center space-y-3 relative z-10">
        <div className="relative inline-block">
          <img
            src="/assets/Logo.png"
            alt="Cupid Mail"
            className="w-20 h-20 object-contain mx-auto drop-shadow-md hover:scale-105 transition-transform"
          />
          <span className="absolute bottom-1 right-2 w-4 h-4 bg-cupid-600 rounded-full border-2 border-white flex items-center justify-center">
            <Heart className="w-2 h-2 text-white fill-current" />
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-bold font-mono text-stone-900 tracking-tight">
            Set New Password
          </h1>
          <p className="text-xs text-stone-500 font-sans mt-1">
            Choose a strong new password for your Cupid Mail account
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-mono flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!token && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-2xl font-mono">
          No reset token found in URL. Please open the link received in your email.
        </div>
      )}

      {isSuccess ? (
        <div className="space-y-4 text-center py-4 relative z-10 animate-in fade-in">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-sm font-bold font-mono text-stone-900">Password Reset Complete!</h2>
            <p className="text-xs text-stone-500 mt-1">
              You are now logged in. Redirecting to your inbox...
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-mono font-semibold text-stone-700 mb-1.5">
              New Password (min 6 characters)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF7F2] border border-[#E5DDD0] rounded-xl text-sm focus:outline-none focus:border-cupid-600 focus:bg-white transition text-stone-900 placeholder:text-stone-400 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-stone-700 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF7F2] border border-[#E5DDD0] rounded-xl text-sm focus:outline-none focus:border-cupid-600 focus:bg-white transition text-stone-900 placeholder:text-stone-400 font-mono"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !token}
            className="w-full py-2.5 bg-gradient-to-r from-cupid-900 via-cupid-800 to-cupid-900 hover:from-cupid-950 hover:to-cupid-800 active:scale-[0.99] disabled:opacity-50 text-white font-mono font-semibold text-sm rounded-xl shadow-md shadow-cupid-900/20 transition flex items-center justify-center space-x-2"
          >
            <span>{isLoading ? "Updating Password..." : "Update Password & Sign In"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="text-xs font-mono text-stone-500 hover:text-stone-900 transition"
            >
              Cancel &amp; Return to Sign In
            </Link>
          </div>
        </form>
      )}

      <div className="pt-2 border-t border-[#ECE3D6] text-center space-y-1 relative z-10">
        <div className="flex items-center justify-center space-x-1.5 text-[11px] font-mono text-stone-400">
          <ShieldCheck className="w-3.5 h-3.5 text-cupid-700" />
          <span>Encrypted, Private & Secure</span>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4 selection:bg-rose-200 selection:text-rose-950 font-sans">
      <Suspense fallback={<div className="font-mono text-xs text-stone-400">Loading password reset...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
