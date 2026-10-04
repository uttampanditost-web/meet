import React, { useState, useEffect, useRef } from "react";
import { AIAnalysisReport } from "../types";
import {
  Sparkles,
  X,
  Send,
  User,
  Zap,
  ListChecks,
  ChevronRight,
  Lightbulb,
  ShieldCheck,
  MessageSquare,
  FileText,
  Key,
  CheckCircle2,
  ExternalLink,
  Lock,
  Trash2
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "user" | "gemini";
  text: string;
  timestamp: string;
}

interface AIInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: AIAnalysisReport | null;
  isLoading: boolean;
  onRefreshReport: () => void;
  selectedDate?: string;
}

export const AIInsightsModal: React.FC<AIInsightsModalProps> = ({
  isOpen,
  onClose,
  reportData,
  isLoading,
  onRefreshReport,
  selectedDate,
}) => {
  const [activeView, setActiveView] = useState<"chat" | "report">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isChatSending, setIsChatSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize initial welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome-1",
          sender: "gemini",
          text: `👋 Hello! I am your **Gemini AI EdTech Assistant**.\n\nI can analyze mentor punctuality, audit student attendance records, summarize daily performance, and answer any questions. Ask me anything!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [isOpen, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (activeView === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeView, isChatSending]);

  // Automatically trigger report analysis when opened if no report exists yet
  useEffect(() => {
    if (isOpen && !reportData && !isLoading) {
      onRefreshReport();
    }
  }, [isOpen, reportData, isLoading, onRefreshReport]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend !== undefined ? textToSend : inputMessage).trim();
    if (!query || isChatSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsChatSending(true);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          selectedDate: selectedDate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg: ChatMessage = {
          id: `gemini-${Date.now()}`,
          sender: "gemini",
          text: data.reply || "I analyzed your request. How else can I assist with your 1:1 sessions?",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error("Chat server error");
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "gemini",
        text: "⚠️ I encountered a temporary connection issue. Please try sending your question again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsChatSending(false);
    }
  };

  const quickPrompts = [
    "🏆 Who is the most punctual mentor today?",
    "📊 Show completed sessions breakdown for all mentors",
    "🚨 Which slots had student dropouts or delays?",
    "💡 Give me 3 operational tips to improve attendance",
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-3xl w-full h-[88vh] flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center space-x-3">
            <div className="relative group">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-sky-500 blur-[14px] opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none animate-pulse" />
              <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-lg border border-white/20">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Gemini AI Assistant & Insights
                </h3>
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border border-purple-500/30">
                  Gemini Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interactive real-time operational chatbot & attendance intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Switcher Tabs */}
            <div className="flex bg-slate-800/80 p-0.5 rounded-full border border-slate-700/80">
              <button
                onClick={() => setActiveView("chat")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeView === "chat"
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>AI Chat</span>
              </button>
              <button
                onClick={() => setActiveView("report")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeView === "report"
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Audit Report</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors border border-slate-700 cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TAB 1: INTERACTIVE GEMINI CHATBOT */}
        {activeView === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/60">
            {/* Chat Messages Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${
                    msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Avatar Icon */}
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white text-xs ${
                      msg.sender === "user"
                        ? "bg-sky-500 shadow-sky-500/20 shadow-md"
                        : "bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-indigo-500/20 shadow-md"
                    }`}
                  >
                    {msg.sender === "user" ? (
                      <User className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-sky-600 text-white shadow-md font-medium"
                        : "bg-slate-900 border border-slate-800 text-slate-200 shadow-lg"
                    }`}
                  >
                    <div className="whitespace-pre-line break-words">{msg.text}</div>
                    <div
                      className={`text-[9px] mt-1.5 ${
                        msg.sender === "user" ? "text-sky-200 text-right" : "text-slate-500 text-left"
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              ))}

              {/* Bot Typing Indicator */}
              {isChatSending && (
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shrink-0">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-slate-400 flex items-center gap-1.5 shadow-lg">
                    <span className="text-xs">Gemini is thinking</span>
                    <span className="flex gap-1 ml-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0.4s]" />
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/80 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                Quick Queries:
              </span>
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isChatSending}
                  className="px-3 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/60 text-[11px] text-slate-300 hover:text-white whitespace-nowrap transition-colors cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask Gemini anything (e.g. 'when is janmastmi', mentor attendance, etc.)..."
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isChatSending}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: STRUCTURED EXECUTIVE AUDIT REPORT */}
        {activeView === "report" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-200">
            {isLoading ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto shadow-lg shadow-indigo-500/10 animate-bounce">
                  <Sparkles className="w-7 h-7 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-white">Analyzing Session Logs with Gemini...</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    Evaluating trainer punctuality, delay patterns, student presence, and formulating concrete operational solutions.
                  </p>
                </div>
              </div>
            ) : reportData ? (
              <>
                {/* Executive Summary Card */}
                <div className="bg-gradient-to-r from-indigo-950/70 via-purple-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Operations Executive Summary
                    </span>
                    <div className="flex items-center space-x-1.5 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                      <span className="text-[10px] text-slate-300">Punctuality Score:</span>
                      <span className="font-bold text-indigo-300">
                        {reportData.punctualityScore || 90}/100
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-200 leading-relaxed text-xs">
                    {reportData.summary}
                  </p>
                </div>

                {/* Concrete Operational Solutions Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      Gemini Recommended Operational Solutions
                    </h4>
                    <span className="text-[10px] text-emerald-400 font-medium">Ready to Apply</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {(reportData.solutions && reportData.solutions.length > 0
                      ? reportData.solutions
                      : [
                          "Automated Pre-Slot WhatsApp Alert: Fire automated reminder 5m prior to slot start to reduce mentor join delays.",
                          "10-Minute Absence Release Protocol: Release mentor if student does not join within 10m to maximize schedule efficiency.",
                          "Clean Slot Auto-Stop: Automatically mark single-participant expired slots as complete so next slots start on-time."
                        ]
                    ).map((solution: string, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-slate-950 border border-emerald-500/20 rounded-xl hover:border-emerald-500/40 transition-colors flex items-start space-x-3"
                      >
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200">{solution}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Insights & Bottlenecks */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-sky-400" />
                    Key Analytical Insights
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {reportData.keyInsights.map((insight, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-start space-x-2.5"
                      >
                        <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <span className="text-slate-300 leading-relaxed">{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trainer Performance Table */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    Trainer Reliability Scorecard
                  </h4>
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-[10px] text-slate-400 uppercase">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Mentor</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Completed</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Avg Delay</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        {reportData.trainerPerformance.map((tp, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-medium text-slate-200">
                              {tp.trainerName}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-300 font-mono">
                              {tp.sessionsCompleted}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-300 font-mono">
                              {tp.avgPunctualityMinutes}m
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  tp.rating === "Excellent"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : tp.rating === "Good"
                                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                }`}
                              >
                                {tp.rating}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <p>No audit report generated yet. Click Re-Analyze above to generate an operational audit.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
