import React from "react";
import { AlertTriangle, X, CheckCircle, ExternalLink, ShieldAlert } from "lucide-react";

interface OAuthErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage?: string | null;
}

export const OAuthErrorModal: React.FC<OAuthErrorModalProps> = ({
  isOpen,
  onClose,
  errorMessage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start space-x-3 mb-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Google OAuth Verification Notice</h3>
            <p className="text-xs text-slate-400 mt-0.5">Error 403: access_denied (Testing Mode)</p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 mb-5">
          <p className="font-semibold text-amber-300">
            Why Google blocked login:
          </p>
          <p className="leading-relaxed">
            The Google Cloud OAuth consent screen is currently in <strong className="text-white">Testing Mode</strong>. Google restricts access exclusively to approved test accounts until verified or published.
          </p>

          <div className="border-t border-slate-800 pt-3 mt-3">
            <p className="font-semibold text-indigo-300 mb-2">How to allow your email account:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
              <li>Open Google Cloud Console.</li>
              <li>Go to <strong className="text-white">APIs & Services &gt; OAuth Consent Screen</strong>.</li>
              <li>Under <strong className="text-white">Test Users</strong>, click <strong className="text-white">Add Users</strong> and add your sign-in email address.</li>
              <li>Or click <strong className="text-white font-medium">Publish App</strong> to remove the test user restriction.</li>
            </ol>
          </div>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center space-x-2 text-xs text-emerald-300 mb-5">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Note:</strong> MeetTrack is fully operational without Google Auth! You can schedule slots, manage mentors, and track attendance manually anytime.
          </span>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md"
          >
            Got it, Continue Using App
          </button>
        </div>
      </div>
    </div>
  );
};
