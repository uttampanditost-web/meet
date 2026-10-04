import React, { useState } from "react";
import { Logo } from "./Logo";
import { Lock, Mail, Eye, EyeOff, ArrowRight, ArrowLeft, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { authenticateUser, AppUser } from "../lib/userService";

interface LoginPageProps {
  onLoginSuccess: (user: AppUser) => void;
  isLoading?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, isLoading = false }) => {
  const [viewState, setViewState] = useState<"splash" | "form">("splash");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await authenticateUser(email, password);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMessage(result.error || "Invalid email or password.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during authentication.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden bg-[#060b18] select-none font-sans">
      {/* Dynamic Cosmic Ambient Glowing Halos behind the scene */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Cyan/Sky Blue Core Flare */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[38rem] h-[38rem] bg-sky-500/25 rounded-full blur-[140px] animate-pulse pointer-events-none" />
        {/* Violet / Indigo Halo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[48rem] h-[48rem] bg-indigo-600/20 rounded-full blur-[160px] pointer-events-none" />
        {/* Subtle Tech Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(56,189,248,0.12)_1px,transparent_1px)] [background-size:28px_28px] opacity-30" />
      </div>

      {viewState === "splash" ? (
        /* STATE 1: Large Glowing Logo Splash Screen (Only Big Logo with Breathing Lights) */
        <div className="relative z-10 flex flex-col items-center justify-center animate-fadeIn">
          {/* Outer Multi-layered Light Aura around the Logo */}
          <div className="relative group cursor-pointer" onClick={() => setViewState("form")}>
            {/* Pulsating Breathing Light Rays from behind the logo */}
            <div className="absolute inset-0 -m-12 rounded-full bg-gradient-to-tr from-sky-400/50 via-blue-600/40 to-purple-600/50 blur-[60px] group-hover:blur-[80px] group-hover:scale-125 transition-all duration-700 pointer-events-none animate-pulse" />
            <div className="absolute inset-0 -m-20 rounded-full bg-sky-500/30 blur-[100px] group-hover:bg-sky-400/45 transition-all duration-700 pointer-events-none animate-pulse" />

            {/* Prominent Large Logo with Squircle Ring */}
            <div className="relative z-10 w-44 h-44 sm:w-52 sm:h-52 rounded-full p-2.5 bg-gradient-to-b from-white/25 via-sky-500/20 to-black/80 border-2 border-white/30 shadow-[0_0_90px_rgba(56,189,248,0.5),0_0_40px_rgba(99,102,241,0.6)] group-hover:scale-105 group-hover:shadow-[0_0_120px_rgba(56,189,248,0.8),0_0_60px_rgba(99,102,241,0.9)] transition-all duration-500 flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-black flex items-center justify-center border border-white/20 shadow-inner">
                <span
                  className="font-serif font-extrabold text-white text-7xl sm:text-8xl select-none leading-none transform translate-y-[-3px] tracking-tight drop-shadow-[0_4px_20px_rgba(255,255,255,0.4)]"
                  style={{
                    fontFamily: '"Playfair Display", "Times New Roman", Georgia, serif',
                  }}
                >
                  H
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STATE 2: Credential Login Sheet with Breathing Light Logo Centered Above */
        <div className="relative z-10 w-full max-w-md rounded-[32px] p-8 sm:p-10 bg-slate-900/90 border border-white/15 backdrop-blur-3xl shadow-[0_25px_70px_rgba(0,0,0,0.8),0_0_60px_rgba(56,189,248,0.2)] flex flex-col items-center text-center animate-fadeIn">
          {/* Top Back Button */}
          <div className="w-full flex justify-start mb-2">
            <button
              type="button"
              onClick={() => {
                setViewState("splash");
                setErrorMessage(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </div>

          {/* Logo Centered Above the Form with Breathing Ambient Light */}
          <div className="relative my-2 group">
            <div className="absolute inset-0 -m-6 rounded-full bg-gradient-to-tr from-sky-400/40 via-blue-600/30 to-purple-600/40 blur-[30px] pointer-events-none animate-pulse" />
            <div className="absolute inset-0 -m-10 rounded-full bg-sky-500/25 blur-[45px] pointer-events-none animate-pulse" />
            <div className="relative z-10 w-16 h-16 rounded-full p-1 bg-gradient-to-b from-white/30 to-black/80 border border-white/30 shadow-[0_0_35px_rgba(56,189,248,0.6)] flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-black flex items-center justify-center border border-white/15">
                <span
                  className="font-serif font-bold text-white text-2xl select-none leading-none transform translate-y-[-1px]"
                  style={{ fontFamily: '"Playfair Display", "Times New Roman", Georgia, serif' }}
                >
                  H
                </span>
              </div>
            </div>
          </div>

          {/* Title & Subtitle */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-2 mb-1">
            BSIAI 1:1 Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto leading-relaxed mb-6">
            Enter your authorized staff credentials to continue.
          </p>

          {/* Error Message */}
          {errorMessage && (
            <div className="w-full mb-5 p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5 text-left animate-fadeIn">
              <span className="text-rose-400 font-bold text-sm shrink-0">⚠️</span>
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}

          {/* Credential Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-4 text-left">
            {/* Email Field */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                <span>Email Address</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your email"
                className="w-full bg-slate-950/70 border border-white/15 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30 rounded-xl py-3 px-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all shadow-inner"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Password</span>
                </span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter your password"
                  className="w-full bg-slate-950/70 border border-white/15 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30 rounded-xl py-3 pl-3.5 pr-11 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full mt-2 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:via-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 px-6 rounded-full text-sm shadow-[0_10px_35px_rgba(56,189,248,0.4)] hover:shadow-[0_15px_45px_rgba(56,189,248,0.6)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sign In to Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* Role Access Information */}
          <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-slate-500 flex items-center justify-center gap-2">
            <span>Admin accounts have full edit privileges • Viewers have read-only access</span>
          </div>
        </div>
      )}
    </div>
  );
};
