import React, { useState } from "react";
import { Trainer, Slot, AttendanceLog } from "../types";
import {
  Video,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Search,
  UserCheck,
  Phone,
  Mail,
  Edit2,
  Trash2,
  ShieldCheck,
  Building,
  Users,
  Layers,
  Sparkles,
  Upload,
  Image as ImageIcon,
  User,
  X,
  Globe,
} from "lucide-react";

interface TrainersGridProps {
  trainers: Trainer[];
  slots: Slot[];
  logs: AttendanceLog[];
  onSaveTrainer: (trainerData: Partial<Trainer>) => void;
  onDeleteTrainer: (id: string) => void;
  isConnected?: boolean;
  onConnectGoogle?: () => void;
  isAdmin?: boolean;
}

export const getTrainerSlug = (name?: string, id?: string): string => {
  if (name && typeof name === "string" && name.trim()) {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  return id || "mentor";
};

export const TrainersGrid: React.FC<TrainersGridProps> = ({
  trainers,
  slots,
  logs,
  onSaveTrainer,
  onDeleteTrainer,
  isConnected = false,
  onConnectGoogle,
  isAdmin = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Single Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<Partial<Trainer> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Batch Add Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchInputText, setBatchInputText] = useState("");

  // Modal copy state
  const [copiedModalLink, setCopiedModalLink] = useState(false);

  // Custom Branded Join Domain (e.g. https://join.be10x.in)
  const [customDomain, setCustomDomain] = useState(() => {
    return (
      localStorage.getItem("meettrack_custom_domain") ||
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_PUBLIC_JOIN_DOMAIN) ||
      ""
    );
  });
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  const [domainInput, setDomainInput] = useState(customDomain);

  const getEffectiveJoinBase = () => {
    if (customDomain && customDomain.trim()) {
      return customDomain.trim().replace(/\/+$/, "");
    }
    return window.location.origin;
  };

  const handleSaveDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = domainInput.trim().replace(/\/+$/, "");
    setCustomDomain(clean);
    if (clean) {
      localStorage.setItem("meettrack_custom_domain", clean);
    } else {
      localStorage.removeItem("meettrack_custom_domain");
    }
    setIsEditingDomain(false);
  };

  const activeTrainersCount = trainers.filter((t) => t.status === "active").length;
  const inactiveTrainersCount = trainers.filter((t) => t.status === "inactive").length;

  const filteredTrainers = trainers.filter((t) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && t.status === "active") ||
      (statusFilter === "inactive" && t.status === "inactive");

    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.meetUrl.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingTrainer((prev) => (prev ? { ...prev, avatar: reader.result as string } : null));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateMeetCode = () => {
    const r1 = Math.random().toString(36).substring(2, 5);
    const r2 = Math.random().toString(36).substring(2, 6);
    const r3 = Math.random().toString(36).substring(2, 5);
    return `https://meet.google.com/${r1}-${r2}-${r3}`;
  };

  const handleOpenAddModal = () => {
    setEditingTrainer({
      name: "",
      email: "",
      meetUrl: handleGenerateMeetCode(),
      specialization: "General Mentor",
      phone: "",
      avatar: "", // Default to blank profile picture
      slotDuration: 30, // Default 30 mins
      status: "active",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (trainer: Trainer) => {
    setEditingTrainer(trainer);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrainer || !editingTrainer.name || !editingTrainer.name.trim()) {
      setFormError("Mentor Full Name is required.");
      return;
    }

    setFormError(null);
    let cleanUrl = (editingTrainer.meetUrl || "").trim();

    if (!cleanUrl || cleanUrl === "https://meet.google.com" || cleanUrl === "https://meet.google.com/") {
      cleanUrl = handleGenerateMeetCode();
    } else if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      if (cleanUrl.includes("meet.google.com/")) {
        cleanUrl = `https://${cleanUrl}`;
      } else {
        const codeOnly = cleanUrl.replace(/^\/+/, "");
        cleanUrl = `https://meet.google.com/${codeOnly}`;
      }
    }

    onSaveTrainer({
      ...editingTrainer,
      name: editingTrainer.name.trim(),
      email: editingTrainer.email ? editingTrainer.email.trim() : "",
      specialization: editingTrainer.specialization ? editingTrainer.specialization.trim() : "General Mentor",
      phone: editingTrainer.phone ? editingTrainer.phone.trim() : "",
      meetUrl: cleanUrl,
      slotDuration: editingTrainer.slotDuration || 30,
      status: editingTrainer.status || "active",
    });
    setIsModalOpen(false);
    setEditingTrainer(null);
  };

  // Quick batch creation helper
  const handleQuickAdd5Mentors = () => {
    const sampleDomains = [
      { name: "Siddharth Rao", domain: "Data Engineering & Snowflake", urlSuffix: "tr11" },
      { name: "Ananya Deshmukh", domain: "UI/UX & Product Strategy", urlSuffix: "tr12" },
      { name: "Karan Malhotra", domain: "DevOps & Kubernetes", urlSuffix: "tr13" },
      { name: "Meera Iyer", domain: "Generative AI & LLMOps", urlSuffix: "tr14" },
      { name: "Tushar Saxena", domain: "Cybersecurity & Pentesting", urlSuffix: "tr15" },
    ];

    sampleDomains.forEach((item, i) => {
      onSaveTrainer({
        name: item.name,
        email: `${item.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        meetUrl: `https://meet.google.com/abc-defg-${item.urlSuffix}`,
        specialization: item.domain,
        phone: `+91 98765 432${20 + i}`,
        status: "active",
        avatar: `https://images.unsplash.com/photo-${1500000000000 + (i * 100000)}?auto=format&fit=crop&q=80&w=250`,
      });
    });
    setIsBatchModalOpen(false);
  };

  const handleParseBatchText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchInputText.trim()) return;

    // Line format: Name, Email, MeetURL, Specialization
    const lines = batchInputText.split("\n");
    lines.forEach((line) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 2 && parts[0]) {
        const name = parts[0];
        const email = parts[1] && parts[1].includes("@") ? parts[1] : `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
        const meetUrl = parts[2] || `https://meet.google.com/abc-defg-${Date.now().toString().slice(-4)}`;
        const specialization = parts[3] || "Mentor";

        onSaveTrainer({
          name,
          email,
          meetUrl,
          specialization,
          status: "active",
        });
      }
    });

    setBatchInputText("");
    setIsBatchModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Controls */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 ios-glass-card border border-white/15 p-5 rounded-2xl backdrop-blur-2xl shadow-xl">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building className="w-4 h-4 text-sky-400" />
            <span>{trainers.length} Registered Mentors & Dedicated Google Meet Links</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Add any number of mentors seamlessly. Each mentor operates a dedicated Google Meet link to host 1-on-1 sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Status Filter Tabs */}
          <div className="bg-black/40 p-1 rounded-xl border border-white/10 flex items-center text-xs backdrop-blur-md">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "all" ? "ios-glass-button bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              All ({trainers.length})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "active" ? "ios-glass-button bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Active ({activeTrainersCount})
            </button>
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "inactive" ? "ios-glass-button bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Inactive ({inactiveTrainersCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              id="search-trainers-input"
              placeholder="Search mentor or domain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400 backdrop-blur-md transition-all"
            />
          </div>

          <div className="flex items-center space-x-2">
            {isAdmin ? (
              <>
                <button
                  id="batch-add-btn"
                  onClick={() => setIsBatchModalOpen(true)}
                  className="ios-glass-button flex items-center space-x-1.5 px-3.5 py-2 text-sky-200 border border-white/15 rounded-xl text-xs font-semibold shadow transition-all whitespace-nowrap cursor-pointer active:scale-95"
                >
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span>Batch Add</span>
                </button>

                <button
                  id="add-trainer-btn"
                  onClick={handleOpenAddModal}
                  className="ios-glass-button flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow transition-all whitespace-nowrap cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Mentor</span>
                </button>
              </>
            ) : (
              <span className="text-[11px] bg-white/[0.04] text-slate-400 border border-white/10 px-3 py-1.5 rounded-xl font-medium">
                View-Only Mode
              </span>
            )}
          </div>
        </div>

        {!isAdmin && (
          <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-400 flex items-center justify-between backdrop-blur-md">
            <span>🔒 Viewing mentors directory in read-only mode. Admin privileges are required to add, edit, or remove mentors.</span>
          </div>
        )}
      </div>

      {/* Custom Branded Join Domain Banner */}
      <div className="ios-glass-card rounded-2xl p-4 border border-sky-400/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg bg-gradient-to-r from-sky-950/30 to-indigo-950/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0 shadow-sm">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>Smart Join Link Base URL:</span>
              <code className="text-sky-300 font-mono text-xs bg-black/50 px-2 py-0.5 rounded-lg border border-white/15">
                {getEffectiveJoinBase()}
              </code>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              All copied permanent links will start with this domain (e.g. your custom company domain <span className="text-sky-300 font-mono">https://join.be10x.in</span>).
            </p>
          </div>
        </div>

        {isEditingDomain ? (
          <form onSubmit={handleSaveDomain} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="url"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="https://join.be10x.in"
              className="bg-slate-900 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDomainInput(customDomain);
                setIsEditingDomain(false);
              }}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl text-xs transition cursor-pointer"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingDomain(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-sky-300 hover:text-white bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Set Custom Domain</span>
          </button>
        )}
      </div>

      {/* Grid of Trainers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTrainers.length > 0 ? (
          filteredTrainers.map((trainer, idx) => {
            const trainerSlots = slots.filter((s) => s.trainerId === trainer.id);
            const trainerLogs = logs.filter((l) => l.trainerId === trainer.id);

            const validTrainerLogs = trainerLogs.filter((l) => l.mentorJoinedAt !== null);
            const onTimeCount = validTrainerLogs.filter(
              (l) => l.mentorJoinDelayMinutes !== null && l.mentorJoinDelayMinutes <= 1
            ).length;
            const punctualityScore =
              validTrainerLogs.length > 0 ? Math.round((onTimeCount / validTrainerLogs.length) * 100) : 100;

            return (
              <div
                key={trainer.id}
                className={`ios-glass-card rounded-2xl p-5 sm:p-6 border transition-all duration-300 flex flex-col justify-between group relative overflow-hidden backdrop-blur-2xl ${
                  trainer.status === "inactive"
                    ? "border-white/10 opacity-70 bg-white/[0.02]"
                    : "border-white/15 bg-gradient-to-br from-white/[0.08] via-slate-900/90 to-white/[0.02] shadow-xl hover:border-sky-400/40 hover:shadow-[0_12px_40px_rgba(56,189,248,0.14)]"
                }`}
              >
                {/* Ambient Top Corner Light */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-500/20 transition-all" />

                <div>
                  {/* Header info */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3.5">
                      {trainer.avatar ? (
                        <img
                          src={trainer.avatar}
                          alt={trainer.name}
                          className="w-12 h-12 rounded-2xl object-cover border-2 border-sky-400/40 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400/20 via-indigo-500/20 to-purple-500/20 border-2 border-sky-400/40 flex items-center justify-center font-bold text-sky-200 text-sm shadow-[0_0_15px_rgba(56,189,248,0.2)] shrink-0">
                          {trainer.name ? trainer.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "M"}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                          {trainer.name}
                          <ShieldCheck className="w-4 h-4 text-sky-400" />
                        </h3>
                        <p className="text-xs text-sky-300/80 font-medium line-clamp-1">
                          {trainer.specialization}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full ios-glass-pill text-sky-300 border border-sky-400/30 font-mono">
                        Mentor #{idx + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-lg bg-sky-950/80 text-sky-300 border border-sky-500/30 font-mono">
                          ⏱️ {trainer.slotDuration === 60 ? "1 hr" : `${trainer.slotDuration || 30}m`}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${
                            trainer.status === "active"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {trainer.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="space-y-1.5 text-xs text-slate-300 mb-4 bg-white/[0.03] backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-inner">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">{trainer.email}</span>
                    </div>
                    {trainer.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span>{trainer.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Google Meet Link Banner */}
                  <div className="bg-gradient-to-br from-sky-950/35 to-indigo-950/30 backdrop-blur-md border border-sky-500/25 rounded-xl p-3.5 mb-3.5 shadow-inner">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-sky-400" />
                        <span>Assigned Google Meet Link</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30">
                        Active Link
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-black/40 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10">
                      <span className="text-xs font-mono text-sky-300 truncate mr-2">
                        {trainer.meetUrl}
                      </span>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handleCopyLink(trainer.id, trainer.meetUrl)}
                          className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="Copy Google Meet Link"
                        >
                          {copiedId === trainer.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={trainer.meetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 hover:bg-white/10 text-sky-400 hover:text-sky-300 rounded-lg transition-colors"
                          title="Open Meet in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Permanent Master Tracking Link for Mentor & Students */}
                  <div className="bg-gradient-to-br from-indigo-950/50 via-purple-950/30 to-sky-950/40 backdrop-blur-md border border-indigo-400/30 rounded-xl p-3.5 mb-4 space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-sky-200 font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Permanent Master Tracking Link</span>
                      </span>
                      <span className="text-[9px] bg-indigo-900/80 text-sky-200 px-2 py-0.5 rounded-full font-mono border border-indigo-400/30">1 Link For Both</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-relaxed">
                      Share this single link with both mentor and students. Mentor logins record mentor arrival, and student logins record student arrival!
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        const slug = getTrainerSlug(trainer.name, trainer.id);
                        const staticUrl = `${getEffectiveJoinBase()}/join/${slug}`;
                        navigator.clipboard.writeText(staticUrl);
                        setCopiedId(`permanent-${trainer.id}`);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="w-full py-2.5 ios-glass-button bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
                      title="Copy Permanent Tracking Link (Share with both mentor and students)"
                    >
                      {copiedId === `permanent-${trainer.id}` ? (
                        <span className="text-white font-bold flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-300" /> Copied Permanent Tracking Link!</span>
                      ) : (
                        <span className="flex items-center gap-1.5"><Copy className="w-3.5 h-3.5 text-sky-200" /> Copy Permanent Tracking Link</span>
                      )}
                    </button>
                  </div>

                  {/* Performance stats summary */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="bg-white/[0.03] backdrop-blur-md p-2.5 rounded-xl border border-white/10 text-center">
                      <span className="text-[10px] text-slate-400 block uppercase font-semibold">Today's Sessions</span>
                      <span className="text-sm font-bold text-white">{trainerSlots.length} Slots</span>
                    </div>
                    <div className="bg-white/[0.03] backdrop-blur-md p-2.5 rounded-xl border border-white/10 text-center">
                      <span className="text-[10px] text-slate-400 block uppercase font-semibold">Punctuality Score</span>
                      <span className="text-sm font-bold text-emerald-400">{punctualityScore}%</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                {isAdmin ? (
                  <div className="flex items-center justify-between pt-3.5 border-t border-white/10 text-xs">
                    <button
                      onClick={() =>
                        onSaveTrainer({
                          ...trainer,
                          status: trainer.status === "active" ? "inactive" : "active",
                        })
                      }
                      className={`px-3 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                        trainer.status === "active"
                          ? "ios-glass-pill text-slate-400 hover:text-amber-300 border-white/10"
                          : "bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {trainer.status === "active" ? "Deactivate" : "Activate"}
                    </button>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleOpenEditModal(trainer)}
                        className="px-3 py-1 ios-glass-button text-slate-200 rounded-lg flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-sky-400" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => onDeleteTrainer(trainer.id)}
                        className="px-3 py-1 ios-glass-button hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 rounded-lg flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${trainer.status === "active" ? "bg-emerald-400" : "bg-amber-400"}`} />
                      {trainer.status === "active" ? "Active Mentor" : "Inactive Mentor"}
                    </span>
                    <span className="text-[10px] text-slate-400">View-Only</span>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-slate-900/60 rounded-xl p-8 text-center border border-slate-800">
            <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white">No mentors found</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4 max-w-sm mx-auto">
              {searchTerm
                ? "Try adjusting your search query or clear the search filter."
                : isAdmin
                ? "Add your mentors to automatically create their 8:00 AM – 11:00 PM slot schedules and Google Meet tracking links."
                : "No mentors are currently registered in the directory."}
            </p>
            {isAdmin ? (
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Mentor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-semibold text-xs transition-all cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Batch Add</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Mentors list is managed by system administrators.</p>
            )}
          </div>
        )}
      </div>

      {/* Single Add/Edit Modal */}
      {isModalOpen && editingTrainer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl relative text-xs my-auto max-h-[88vh] flex flex-col overflow-hidden">
            {/* Pinned Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                <span>{editingTrainer.id ? "Edit Trainer Profile & Meet Link" : "Add New Mentor"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                {formError && (
                  <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                    <span className="font-semibold">⚠️</span>
                    <span>{formError}</span>
                  </div>
                )}

                {/* Profile Picture Option */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Mentor Profile Picture</span>
                    <span className="text-[10px] text-indigo-400 font-normal">
                      Upload image, paste URL, or keep blank
                    </span>
                  </label>
                  <div className="flex items-center space-x-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    {editingTrainer.avatar ? (
                      <img
                        src={editingTrainer.avatar}
                        alt="Avatar preview"
                        className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500/50 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-sm shrink-0 shadow-inner">
                        {editingTrainer.name
                          ? editingTrainer.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                          : "M"}
                      </div>
                    )}

                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <label className="cursor-pointer px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-[11px] font-semibold rounded-lg flex items-center space-x-1 transition">
                          <Upload className="w-3 h-3 text-indigo-400" />
                          <span>Upload Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileUpload}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => setEditingTrainer({ ...editingTrainer, avatar: "" })}
                          className="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-[11px] font-semibold rounded-lg transition flex items-center space-x-1"
                        >
                          <X className="w-3 h-3 text-slate-400" />
                          <span>Keep Blank</span>
                        </button>
                      </div>

                      <input
                        type="text"
                        value={editingTrainer.avatar || ""}
                        onChange={(e) =>
                          setEditingTrainer({ ...editingTrainer, avatar: e.target.value })
                        }
                        placeholder="Or paste photo URL (https://...)"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mentor Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingTrainer.name || ""}
                    onChange={(e) => {
                      setEditingTrainer({ ...editingTrainer, name: e.target.value });
                      if (formError) setFormError(null);
                    }}
                    placeholder="e.g. Vikram Sharma"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Specialization / Domain
                  </label>
                  <input
                    type="text"
                    value={editingTrainer.specialization || ""}
                    onChange={(e) =>
                      setEditingTrainer({
                        ...editingTrainer,
                        specialization: e.target.value,
                      })
                    }
                    placeholder="e.g. Full Stack Web Development"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Google Meet URL *
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditingTrainer({ ...editingTrainer, meetUrl: handleGenerateMeetCode() })}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto-Generate New Link</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editingTrainer.meetUrl || ""}
                    onChange={(e) =>
                      setEditingTrainer({ ...editingTrainer, meetUrl: e.target.value })
                    }
                    placeholder="https://meet.google.com/abc-defg-hij"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Enter Google Meet room link or code. Click "Auto-Generate" to create a fresh dedicated room link.
                  </p>

                  {/* PERMANENT MASTER TRACKING LINK - DISPLAYED DIRECTLY BELOW GOOGLE MEET URL */}
                  <div className="mt-3 bg-indigo-950/70 border border-indigo-500/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-indigo-300 font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Permanent Tracking Link (Share with both Mentor & Students)
                      </span>
                      <span className="text-[9px] bg-indigo-900 text-indigo-200 px-2 py-0.5 rounded font-mono font-bold">1 Single Link</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Share this exact link with both mentor and students. Mentor logins record mentor arrival time, and student logins record student arrival time!
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <input
                        type="text"
                        readOnly
                        value={`${getEffectiveJoinBase()}/join/${getTrainerSlug(editingTrainer.name, editingTrainer.id)}`}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-indigo-300 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const link = `${getEffectiveJoinBase()}/join/${getTrainerSlug(editingTrainer.name, editingTrainer.id)}`;
                          navigator.clipboard.writeText(link);
                          setCopiedModalLink(true);
                          setTimeout(() => setCopiedModalLink(false), 2000);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer shadow transition"
                      >
                        {copiedModalLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedModalLink ? "Copied!" : "Copy Link"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Slot Duration Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Slot Duration for this Mentor *</span>
                    <span className="text-[10px] text-indigo-400 font-normal">Daily 8:00 AM – 11:00 PM Schedule</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 30 as const, label: "30 Mins", desc: "30 slots / day" },
                      { value: 45 as const, label: "45 Mins", desc: "20 slots / day" },
                      { value: 60 as const, label: "1 Hour", desc: "15 slots / day" },
                    ].map((opt) => {
                      const isSelected = (editingTrainer.slotDuration || 30) === opt.value;
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() =>
                            setEditingTrainer({ ...editingTrainer, slotDuration: opt.value })
                          }
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? "bg-indigo-600/20 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500/50"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold text-xs">{opt.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                          </div>
                          <span className="text-[10px] text-slate-400 block">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                    ⚡ Auto-Schedule: Daily slots from <strong className="text-slate-200">8:00 AM to 11:00 PM</strong> are automatically generated for this mentor based on the selected slot duration.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={editingTrainer.email || ""}
                      onChange={(e) =>
                        setEditingTrainer({ ...editingTrainer, email: e.target.value })
                      }
                      placeholder="mentor@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={editingTrainer.phone || ""}
                      onChange={(e) =>
                        setEditingTrainer({ ...editingTrainer, phone: e.target.value })
                      }
                      placeholder="+91 98765 00000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Pinned Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/95 shrink-0 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg font-semibold shadow transition"
                >
                  Save Trainer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Add Mentors Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl relative text-xs my-auto max-h-[88vh] flex flex-col overflow-hidden">
            {/* Pinned Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Batch Register New Mentors</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div className="bg-indigo-950/40 border border-indigo-500/20 p-3 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-indigo-200">1-Click Quick Expand:</span>
                  <button
                    type="button"
                    onClick={handleQuickAdd5Mentors}
                    className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded font-bold shadow flex items-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3 text-purple-200" />
                    <span>Auto-Add 5 New Mentors</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Instantly adds 5 pre-configured mentors with unique Google Meet links & domain specializations.
                </p>
              </div>

              <form onSubmit={handleParseBatchText} className="space-y-3 flex flex-col">
                <label className="block text-xs font-semibold text-slate-300">
                  Or Paste CSV / Comma Separated Lines:
                </label>
                <p className="text-[11px] text-slate-500">
                  Format per line: <code className="text-indigo-300">Name, Email, MeetURL, Specialization</code>
                </p>

                <textarea
                  rows={4}
                  value={batchInputText}
                  onChange={(e) => setBatchInputText(e.target.value)}
                  placeholder={`Rohan Gupta, rohan.g@example.com, https://meet.google.com/abc-defg-tr11, DevOps\nKavya Reddy, kavya.r@example.com, https://meet.google.com/abc-defg-tr12, React Native`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
                />

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsBatchModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg font-semibold shadow transition"
                  >
                    Import Mentors
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

