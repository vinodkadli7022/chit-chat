import React from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { ModerationAlert } from '../types';

interface ModerationModalProps {
  alert: ModerationAlert | null;
  onClose: () => void;
}

export const ModerationModal: React.FC<ModerationModalProps> = ({ alert, onClose }) => {
  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Banner */}
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{alert.title}</h3>
              <p className="text-xs text-rose-300/90 font-medium">Server-side security enforcement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-200 text-xs leading-relaxed">
            {alert.message}
          </div>

          {alert.details && (
            <div className="space-y-1.5 text-xs text-slate-300">
              <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Technical Details</p>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
                {alert.details}
              </div>
            </div>
          )}

          {typeof alert.score === 'number' && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-400">Model Confidence Score</span>
                <span className="text-rose-400">{Math.round(alert.score * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, alert.score * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-start space-x-2 text-[11px] text-slate-400 pt-1">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p>
              This content was blocked on the server before storage or socket broadcast. The recipient was not notified.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-850 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all active:scale-98"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
