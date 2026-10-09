"use client";

import React, { useState } from "react";
import { ArrowRight, ShieldCheck, Heart, Mail, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to request password reset");
      }

      setIsSuccess(true);
      if (data.resetUrl) {
        setDevResetUrl(data.resetUrl);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process password reset request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4 selection:bg-rose-200 selection:text-rose-950 font-sans">
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
              Reset Password
            </h1>
            <p className="text-xs text-stone-500 font-sans mt-1">
              We&apos;ll send instructions via the platform (<span className="font-mono text-cupid-800 font-semibold">runnly.xyz</span>) to reset your password.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-mono">
            {errorMsg}
          </div>
        )}

        {isSuccess ? (
          <div className="space-y-4 text-center py-2 relative z-10 animate-in fade-in">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-sm font-bold font-mono text-stone-900">Check Your Email</h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                If an account exists for <strong className="font-mono text-cupid-900">{email}</strong>, a reset link was sent from <span className="font-mono text-cupid-800">no-reply@runnly.xyz</span>.
              </p>
            </div>

            {devResetUrl && (
              <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl text-left text-xs font-mono text-rose-900 break-all space-y-1">
                <span className="text-[10px] text-cupid-700 font-bold block uppercase tracking-wider">Dev Reset Link:</span>
                <Link href={devResetUrl} className="underline hover:text-cupid-950 font-semibold">
                  Click here to proceed directly &rarr;
                </Link>
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/login"
                className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-cupid-900 border border-rose-200 font-mono font-semibold text-xs rounded-xl transition flex items-center justify-center space-x-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-mono font-semibold text-stone-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="adsconversionng@gmail.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF7F2] border border-[#E5DDD0] rounded-xl text-sm focus:outline-none focus:border-cupid-600 focus:bg-white transition text-stone-900 placeholder:text-stone-400 font-mono"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-cupid-900 via-cupid-800 to-cupid-900 hover:from-cupid-950 hover:to-cupid-800 active:scale-[0.99] disabled:opacity-50 text-white font-mono font-semibold text-sm rounded-xl shadow-md shadow-cupid-900/20 transition flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? "Sending Link..." : "Send Reset Link"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="text-xs font-mono text-stone-500 hover:text-stone-900 transition inline-flex items-center space-x-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </form>
        )}

        <div className="pt-2 border-t border-[#ECE3D6] text-center space-y-1 relative z-10">
          <div className="flex items-center justify-center space-x-1.5 text-[11px] font-mono text-stone-400">
            <ShieldCheck className="w-3.5 h-3.5 text-cupid-700" />
            <span>Platform Auth &amp; Delivery on runnly.xyz</span>
          </div>
        </div>
      </div>
    </div>
  );
}
