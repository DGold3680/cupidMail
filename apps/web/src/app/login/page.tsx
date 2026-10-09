"use client";

import React, { useState } from "react";
import { ArrowRight, ShieldCheck, Sparkles, Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      router.push("/");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign in. You can also explore via Demo Mode below.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4 selection:bg-rose-200 selection:text-rose-950">
      <div className="w-full max-w-md bg-white border border-[#ECE3D6] rounded-3xl p-8 shadow-cupid-lg space-y-6 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-rose-100/60 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-rose-100/40 rounded-full blur-2xl pointer-events-none" />

        {/* Brand */}
        <div className="text-center space-y-3 relative z-10">
          <div className="relative inline-block">
            <img
              src="/assets/Logo.png"
              alt="Cupid Mail"
              className="w-24 h-24 object-contain mx-auto drop-shadow-md hover:scale-105 transition-transform"
            />
            <span className="absolute bottom-1 right-2 w-4 h-4 bg-cupid-600 rounded-full border-2 border-white flex items-center justify-center">
              <Heart className="w-2 h-2 text-white fill-current" />
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold font-mono text-stone-900 tracking-tight">
              Cupid<span className="text-cupid-800">Mail</span>
            </h1>
            <p className="text-xs text-stone-500 font-sans mt-1">
              Private, serverless multi-domain letters delivered with care
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-mono font-semibold text-stone-700 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cupid@example.com"
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E5DDD0] rounded-xl text-sm focus:outline-none focus:border-cupid-600 focus:bg-white transition text-stone-900 placeholder:text-stone-400 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-stone-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E5DDD0] rounded-xl text-sm focus:outline-none focus:border-cupid-600 focus:bg-white transition text-stone-900 placeholder:text-stone-400 font-mono"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-gradient-to-r from-cupid-900 via-cupid-800 to-cupid-900 hover:from-cupid-950 hover:to-cupid-800 active:scale-[0.99] disabled:opacity-50 text-white font-mono font-semibold text-sm rounded-xl shadow-md shadow-cupid-900/20 transition flex items-center justify-center space-x-2"
          >
            <span>{isLoading ? "Signing in..." : "Sign In to Cupid Mail"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-[#ECE3D6] text-center space-y-3 relative z-10">
          <button
            onClick={handleDemoSignIn}
            className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-cupid-900 border border-rose-200 font-mono font-semibold text-xs rounded-xl transition flex items-center justify-center space-x-2 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-cupid-600" />
            <span>Enter Demo Mode (Explore Webmail)</span>
          </button>

          <div className="flex items-center justify-center space-x-1.5 text-[11px] font-mono text-stone-400">
            <ShieldCheck className="w-3.5 h-3.5 text-cupid-700" />
            <span>Encrypted, Private & Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}


