import React, { useState } from 'react';
import { User } from '../types';
import { ApiService } from '../services/api';
import { Shield, Sparkles, ArrowRight, Lock, Mail, User as UserIcon } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: User, token: string) => void;
  demoAccounts: (User & { token: string })[];
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, demoAccounts }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await ApiService.register(email, password, name);
        onSuccess(res.user, res.token);
      } else {
        const res = await ApiService.login(email, password);
        onSuccess(res.user, res.token);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSelect = (acc: User & { token: string }) => {
    ApiService.setToken(acc.token);
    onSuccess(acc, acc.token);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-xl shadow-indigo-500/25">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Welcome to ChatStream</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time messaging with server-side AI moderation & high reliability
          </p>
        </div>

        {/* 1-Click Quick Demo Accounts (For Evaluators) */}
        <div className="mb-6 p-3.5 bg-indigo-950/40 rounded-2xl border border-indigo-800/40">
          <div className="flex items-center space-x-2 text-indigo-300 text-xs font-semibold mb-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>1-Click Evaluator Demo Accounts</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => handleDemoSelect(acc)}
                className="flex items-center space-x-2 p-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-left transition-all hover:border-indigo-500 group"
              >
                <img
                  src={acc.avatar || ''}
                  alt={acc.name}
                  className="w-7 h-7 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                    {acc.name.split(' ')[0]}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate capitalize">
                    {acc.name === 'Alice Smith' ? 'Host' : 'Member'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-4 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
            Or Sign In With Email
          </span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800/80 text-xs text-white placeholder-slate-500 border border-slate-750 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800/80 text-xs text-white placeholder-slate-500 border border-slate-750 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800/80 text-xs text-white placeholder-slate-500 border border-slate-750 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all active:scale-98 flex items-center justify-center space-x-2 mt-2"
          >
            <span>{loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-indigo-400 hover:underline"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
};
