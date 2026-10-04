import React, { useState } from "react";
import { Radio, Zap, Activity, MessageSquare, Send, CheckCircle2, RefreshCw } from "lucide-react";

interface RealtimeProtocolBarProps {
  realtimeMode: "SSE" | "LongPolling" | "WebRTC" | "MQTT";
  mqttMessages: any[];
  onPublishMQTT: (topic: string, payload: any) => void;
}

export const RealtimeProtocolBar: React.FC<RealtimeProtocolBarProps> = ({
  realtimeMode,
  mqttMessages,
  onPublishMQTT,
}) => {
  const [topicInput, setTopicInput] = useState("meet/attendance");
  const [payloadInput, setPayloadInput] = useState('{"status": "mentor_joined", "room": "meet-101"}');
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) return;
    try {
      const parsed = JSON.parse(payloadInput);
      onPublishMQTT(topicInput.trim(), parsed);
    } catch {
      onPublishMQTT(topicInput.trim(), { text: payloadInput });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg text-slate-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Protocol Badges */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 font-semibold text-white">
            <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Real-time Multi-Protocol Core</span>
          </div>

          {/* SSE Badge */}
          <span
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border flex items-center gap-1 ${
              realtimeMode === "SSE"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-slate-800/80 text-slate-400 border-slate-700"
            }`}
          >
            <Zap className="w-3 h-3 text-emerald-400" />
            <span>Server-Sent Events (SSE) Active</span>
          </span>

          {/* Long Polling Badge */}
          <span
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border flex items-center gap-1 ${
              realtimeMode === "LongPolling"
                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                : "bg-slate-800/80 text-slate-400 border-slate-700"
            }`}
          >
            <RefreshCw className="w-3 h-3 text-blue-400" />
            <span>HTTP Long Polling Fallback</span>
          </span>

          {/* WebRTC Badge */}
          <span className="px-2.5 py-1 rounded-md text-[11px] font-medium border bg-slate-800/80 text-purple-300 border-purple-500/30 flex items-center gap-1">
            <Activity className="w-3 h-3 text-purple-400" />
            <span>WebRTC Signaling Channel</span>
          </span>

          {/* MQTT Badge */}
          <span className="px-2.5 py-1 rounded-md text-[11px] font-medium border bg-slate-800/80 text-amber-300 border-amber-500/30 flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-amber-400" />
            <span>MQTT Pub/Sub ({mqttMessages.length} msgs)</span>
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline shrink-0"
        >
          {isExpanded ? "Hide Protocol Console ▲" : "MQTT / WebRTC Console ▼"}
        </button>
      </div>

      {/* Expanded MQTT & WebRTC Debug Console */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* MQTT Publisher Form */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <h4 className="font-bold text-slate-200 mb-2 flex items-center gap-1.5 text-xs">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>MQTT Topic Publisher</span>
            </h4>
            <form onSubmit={handlePublish} className="space-y-2">
              <div>
                <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Topic (e.g. meet/attendance)
                </label>
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  placeholder="meet/attendance"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Payload (JSON or string)
                </label>
                <input
                  type="text"
                  value={payloadInput}
                  onChange={(e) => setPayloadInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  placeholder='{"event": "mentor_ping"}'
                />
              </div>
              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold py-1.5 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Send className="w-3 h-3" />
                <span>Publish to MQTT Broker</span>
              </button>
            </form>
          </div>

          {/* MQTT Live Stream Feed */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col h-44">
            <h4 className="font-bold text-slate-200 mb-2 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>MQTT Live Topic Stream</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {mqttMessages.length} items
              </span>
            </h4>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
              {mqttMessages.length === 0 ? (
                <p className="text-slate-500 italic py-4 text-center">
                  Listening for MQTT topic messages...
                </p>
              ) : (
                mqttMessages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                  >
                    <div className="flex items-center justify-between text-[10px] text-amber-400 font-semibold mb-0.5">
                      <span>📌 {msg.topic}</span>
                      <span className="text-slate-500">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <pre className="text-[10px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                      {typeof msg.payload === "object"
                        ? JSON.stringify(msg.payload)
                        : String(msg.payload)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
