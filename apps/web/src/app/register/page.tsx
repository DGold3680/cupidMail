"use client";

import React, { useState } from "react";
import { ArrowRight, ShieldCheck, Heart, Lock, Mail, User, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to create account");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create account");
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
              Join Cupid<span className="text-cupid-800">Mail</span>
            </h1>
            <p className="text-xs text-stone-500 font-sans mt-1">
              Create your account to add and manage your own custom domains
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-mono">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-mono font-semibold text-stone-700 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF7F2] border border-[#E5DDD0] rounded-xl text-sm focus:outline-none focus:border-cupid-600 focus:bg-white transition text-stone-900 placeholder:text-stone-400 font-mono"
                required
              />
            </div>
          </div>

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
                placeholder="jane@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF7F2] border border-[#E5DDD0] rounded-xl text-sm focus:outline-none focus:border-cupid-600 focus:bg-white transition text-stone-900 placeholder:text-stone-400 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-stone-700 mb-1.5">
              Password (min 6 characters)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF7F2] border border-[#E5DDD0] rounded-xl text-sm focus:outline-none focus:border-cupid-600 focus:bg-white transition text-stone-900 placeholder:text-stone-400 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-stone-700 mb-1.5">
              Confirm Password
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
            disabled={isLoading}
            className="w-full py-2.5 bg-gradient-to-r from-cupid-900 via-cupid-800 to-cupid-900 hover:from-cupid-950 hover:to-cupid-800 active:scale-[0.99] disabled:opacity-50 text-white font-mono font-semibold text-sm rounded-xl shadow-md shadow-cupid-900/20 transition flex items-center justify-center space-x-2"
          >
            <span>{isLoading ? "Creating Account..." : "Create Account"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-[#ECE3D6] text-center space-y-3 relative z-10">
          <div className="flex items-center justify-center space-x-1 text-xs text-stone-500 font-sans">
            <span>Already have an account?</span>
            <Link
              href="/login"
              className="text-cupid-800 font-mono font-bold hover:underline inline-flex items-center space-x-1"
            >
              <span>Sign in</span>
              <LogIn className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex items-center justify-center space-x-1.5 text-[11px] font-mono text-stone-400">
            <ShieldCheck className="w-3.5 h-3.5 text-cupid-700" />
            <span>Encrypted, Private & Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
