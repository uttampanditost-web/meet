import React, { useRef } from "react";
import { User } from "firebase/auth";
import { Logo } from "./Logo";
import {
  Users,
  Clock,
  Sparkles,
  Download,
  Calendar,
  Activity,
  BarChart3,
  LogOut,
  Crown,
  Eye,
  Shield,
  Database,
  UserRound,
} from "lucide-react";

interface HeaderProps {
  activeTab: "dashboard" | "trainers" | "slots" | "students" | "logs" | "access";
  setActiveTab: (tab: "dashboard" | "trainers" | "slots" | "students" | "logs" | "access") => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  onOpenAIReport: () => void;
  onOpenExtensionGuide: () => void;
  onAddTrainer?: () => void;
  onAddSlot?: () => void;
  liveCount: number;
  trainersCount?: number;
  // Role & User Props
  isAdmin?: boolean;
  currentUserEmail?: string;
  onLogout?: () => void;
  onOpenAdminManagement?: () => void;
  // Optional / Legacy Google OAuth Props
  user?: User | null;
  googleToken?: string | null;
  onConnectGoogle?: () => void;
  onDisconnectGoogle?: () => void;
  onSyncCalendar?: () => void;
  isSyncingCalendar?: boolean;
  isFirebaseSynced?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  selectedDate,
  setSelectedDate,
  onOpenAIReport,
  onOpenExtensionGuide,
  liveCount,
  isAdmin = false,
  currentUserEmail,
  onLogout,
  user,
  onDisconnectGoogle,
}) => {
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleLogoutAction = () => {
    if (onLogout) {
      onLogout();
    } else if (onDisconnectGoogle) {
      onDisconnectGoogle();
    }
  };

  return (
    <header className="ios-glass-nav text-white sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* ================= TOP ROW ================= */}
        <div className="flex items-center justify-between py-2.5 border-b border-white/[0.08] gap-3">
          {/* Top Left: Logo & App Title */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
            <Logo size="md" className="rounded-2xl shadow-lg ring-1 ring-white/20" />
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-white leading-none">
                  <span className="font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                    BSIAI
                  </span>{" "}
                  <span className="font-medium text-slate-300">1:1 Dashboard</span>
                </h1>

                {/* iOS Live Meet Pill */}
                {liveCount > 0 ? (
                  <span className="flex items-center space-x-1 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium shadow-sm animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>{liveCount} Live</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-400/20 hidden sm:inline-block">
                    Google Meet
                  </span>
                )}

                {/* Supabase Realtime Synced Indicator */}
                <div
                  className="hidden md:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-semibold tracking-wide shadow-sm"
                  title="Real-time synchronization active with Supabase PostgreSQL database"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <Database className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Supabase Synced</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Middle: AI Insights iOS Glass Pill Button */}
          <div className="flex items-center justify-center">
            <button
              id="open-ai-report-btn"
              onClick={onOpenAIReport}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600/90 to-indigo-600/90 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full text-xs font-semibold shadow-md transition-all cursor-pointer border border-purple-300/30 hover:shadow-purple-500/25 active:scale-95"
              title="AI Insights & Attendance Audit"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-200 shrink-0" />
              <span>AI Insights</span>
            </button>
          </div>

          {/* Top Right: Date Picker -> Role Badge -> Logout */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
            {/* 1. iOS Glass Date Picker (Interactive full-coverage calendar picker) */}
            <div
              className="relative flex items-center justify-center ios-glass-pill px-3.5 py-1.5 text-xs text-slate-100 shadow-sm hover:border-white/35 transition-all cursor-pointer group overflow-hidden select-none"
              title="Click anywhere to select date"
              onClick={() => {
                try {
                  dateInputRef.current?.showPicker?.();
                } catch {}
              }}
            >
              <Calendar className="w-3.5 h-3.5 text-sky-400 mr-2 shrink-0 group-hover:scale-110 transition-transform pointer-events-none" />
              <span className="font-mono text-xs font-semibold text-slate-100 pointer-events-none tracking-wider">
                {(() => {
                  if (!selectedDate) return "";
                  const parts = selectedDate.split("-");
                  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : selectedDate;
                })()}
              </span>
              <input
                ref={dateInputRef}
                type="date"
                id="header-date-picker"
                style={{ colorScheme: "dark" }}
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="date-picker-overlay"
                title="Click anywhere to select date"
              />
            </div>

            {/* 2. Admin / Role Badge */}
            {isAdmin ? (
              <div
                className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-semibold shadow-sm backdrop-blur-md"
                title="You have Admin privileges (full edit & manage access)"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Admin</span>
              </div>
            ) : (
              <div
                className="flex items-center space-x-1 px-2.5 py-1 rounded-full ios-glass-pill text-slate-300 text-xs font-medium shadow-sm"
                title="You have Viewer permissions (read-only view)"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Viewer</span>
              </div>
            )}

            {/* 3. Logout Button on Top Right */}
            <button
              id="header-logout-btn"
              onClick={handleLogoutAction}
              className="ios-glass-button flex items-center space-x-1.5 px-3 py-1 rounded-full text-slate-300 hover:text-rose-300 hover:border-rose-500/30 text-xs font-medium cursor-pointer transition-all active:scale-95"
              title={
                currentUserEmail
                  ? `Signed in as ${currentUserEmail}. Click to Logout`
                  : user?.email
                  ? `Signed in as ${user.email}. Click to Logout`
                  : "Click to Logout"
              }
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* ================= BOTTOM ROW ================= */}
        {/* iOS Segmented Control Bar (Dashboard | Mentors | Slots | Reports | Access) + Download Extension */}
        <div className="py-2.5 flex items-center justify-between gap-4">
          <nav className="hidden md:flex flex-1 items-center ios-segmented-control mr-3 sm:mr-4">
            {/* 1. Dashboard */}
            <button
              id="tab-dashboard-btn"
              onClick={() => setActiveTab("dashboard")}
              className={`ios-segmented-item flex-1 flex items-center justify-center space-x-2 px-3 py-1.5 text-xs sm:text-sm cursor-pointer select-none active:scale-95 transition-all ${
                activeTab === "dashboard"
                  ? "ios-segmented-active text-white shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>Dashboard</span>
            </button>

            {/* 2. Mentors */}
            <button
              id="tab-trainers-btn"
              onClick={() => setActiveTab("trainers")}
              className={`ios-segmented-item flex-1 flex items-center justify-center space-x-2 px-3 py-1.5 text-xs sm:text-sm cursor-pointer select-none active:scale-95 transition-all ${
                activeTab === "trainers"
                  ? "ios-segmented-active text-white shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>Mentors</span>
            </button>

            {/* 3. Slots */}
            <button
              id="tab-slots-btn"
              onClick={() => setActiveTab("slots")}
              className={`ios-segmented-item flex-1 flex items-center justify-center space-x-2 px-3 py-1.5 text-xs sm:text-sm cursor-pointer select-none active:scale-95 transition-all ${
                activeTab === "slots"
                  ? "ios-segmented-active text-white shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Slots</span>
            </button>

            {/* 4. Students / Batch Directory */}
            <button
              id="tab-students-btn"
              onClick={() => setActiveTab("students")}
              className={`ios-segmented-item flex-1 flex items-center justify-center space-x-2 px-3 py-1.5 text-xs sm:text-sm cursor-pointer select-none active:scale-95 transition-all ${
                activeTab === "students"
                  ? "ios-segmented-active text-white shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <UserRound className="w-3.5 h-3.5 text-cyan-400" />
              <span>Students</span>
            </button>

            {/* 5. Reports (formerly Records) */}
            <button
              id="tab-logs-btn"
              onClick={() => setActiveTab("logs")}
              className={`ios-segmented-item flex-1 flex items-center justify-center space-x-2 px-3 py-1.5 text-xs sm:text-sm cursor-pointer select-none active:scale-95 transition-all ${
                activeTab === "logs"
                  ? "ios-segmented-active text-white shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Reports</span>
            </button>

            {/* 5. Access */}
            <button
              id="tab-access-btn"
              onClick={() => setActiveTab("access")}
              className={`ios-segmented-item flex-1 flex items-center justify-center space-x-2 px-3 py-1.5 text-xs sm:text-sm cursor-pointer select-none active:scale-95 transition-all ${
                activeTab === "access"
                  ? "ios-segmented-active text-white shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Access</span>
            </button>
          </nav>

          {/* Right Action Button: Download Extension shifted to the right end */}
          <div className="flex items-center space-x-2 shrink-0 ml-auto">
            <button
              id="open-extension-guide-btn"
              onClick={onOpenExtensionGuide}
              className="ios-glass-button flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-slate-200 text-xs font-medium cursor-pointer hover:border-teal-500/40 hover:text-teal-300 transition-all"
              title="Download MeetTrack Pro Chrome Extension for Automated Attendance Tracking"
            >
              <Download className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="hidden sm:inline">Download Extension</span>
            </button>
          </div>
        </div>

        {/* Mobile iOS Tab Bar */}
        <div className="md:hidden flex items-center justify-around py-1.5 border-t border-white/[0.08] text-xs">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all ${
              activeTab === "dashboard" ? "text-sky-400 font-bold bg-white/10" : "text-slate-400"
            }`}
          >
            <Activity className="w-4 h-4 mb-0.5" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab("trainers")}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all ${
              activeTab === "trainers" ? "text-purple-400 font-bold bg-white/10" : "text-slate-400"
            }`}
          >
            <Users className="w-4 h-4 mb-0.5" />
            <span>Mentors</span>
          </button>
          <button
            onClick={() => setActiveTab("slots")}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all ${
              activeTab === "slots" ? "text-amber-400 font-bold bg-white/10" : "text-slate-400"
            }`}
          >
            <Clock className="w-4 h-4 mb-0.5" />
            <span>Slots</span>
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all ${
              activeTab === "logs" ? "text-emerald-400 font-bold bg-white/10" : "text-slate-400"
            }`}
          >
            <BarChart3 className="w-4 h-4 mb-0.5" />
            <span>Reports</span>
          </button>
          <button
            onClick={() => setActiveTab("access")}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all ${
              activeTab === "access" ? "text-amber-400 font-bold bg-white/10" : "text-slate-400"
            }`}
          >
            <Shield className="w-4 h-4 mb-0.5" />
            <span>Access</span>
          </button>
        </div>
      </div>
    </header>
  );
};
