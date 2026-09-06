import React, { useState } from 'react';
import { User } from '../types';
import { Columns, Radio, Shield, LogOut, ChevronDown, Check } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  demoAccounts: (User & { token: string })[];
  onSelectAccount: (account: User & { token: string }) => void;
  isSplitView: boolean;
  onToggleSplitView: () => void;
  isConnected: boolean;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  demoAccounts,
  onSelectAccount,
  isSplitView,
  onToggleSplitView,
  isConnected,
  onLogout,
}) => {
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-30 select-none">
      {/* Brand logo & title */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg text-white tracking-tight">ChatStream</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Production Real-time
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">Real-time messaging with server-side moderation</p>
        </div>
      </div>

      {/* Center / Right controls */}
      <div className="flex items-center space-x-3">
        {/* Socket Connection Status */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-slate-300 font-medium hidden md:inline">
            {isConnected ? 'WebSocket Live' : 'Reconnecting...'}
          </span>
        </div>

        {/* Split View Demo Toggle (Alice & Bob Side-by-Side) */}
        <button
          onClick={onToggleSplitView}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
            isSplitView
              ? 'bg-indigo-600 text-white shadow-indigo-600/30 ring-2 ring-indigo-400/50'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
          }`}
          title="Toggle dual user demo mode (Alice on left, Bob on right)"
        >
          <Columns className="w-4 h-4" />
          <span>{isSplitView ? 'Exit Split View' : 'Split-Screen Demo (Alice & Bob)'}</span>
        </button>

        {/* User Profile & Demo Switcher */}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-750 border border-slate-700/70 transition-colors"
            >
              <img
                src={currentUser.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover border border-slate-600"
              />
              <div className="text-left hidden lg:block">
                <p className="text-xs font-semibold text-slate-200 leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{currentUser.email}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {showAccountDropdown && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setShowAccountDropdown(false)}
              >
                <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Demo Account
                </div>
                <div className="py-1 space-y-0.5">
                  {demoAccounts.map((acc) => {
                    const isSelected = currentUser.id === acc.id;
                    return (
                      <button
                        key={acc.id}
                        onClick={() => onSelectAccount(acc)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                          isSelected ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={acc.avatar || ''}
                            alt={acc.name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <div className="text-left">
                            <p className="leading-tight font-medium">{acc.name}</p>
                            <p className="text-[10px] text-slate-500">{acc.email}</p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
