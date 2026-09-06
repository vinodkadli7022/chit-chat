import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { ApiService } from '../services/api';
import { Users, UserPlus, X, Check, Search } from 'lucide-react';

interface NewChatModalProps {
  currentUser: User | null;
  onClose: () => void;
  onConversationCreated: (conversation: any) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  currentUser,
  onClose,
  onConversationCreated,
}) => {
  const [tab, setTab] = useState<'direct' | 'group'>('direct');
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getAllUsers();
      setUsers(res.users);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleStartDirect = async (targetUserId: string) => {
    try {
      setSubmitting(true);
      setError(null);
      const res = await ApiService.createDirectConversation(targetUserId);
      onConversationCreated(res.conversation);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to start chat');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Please provide a group name');
      return;
    }
    if (selectedUserIds.length === 0) {
      setError('Please select at least one member');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await ApiService.createGroupConversation(groupName.trim(), selectedUserIds);
      onConversationCreated(res.conversation);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Start New Conversation</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="p-2 grid grid-cols-2 gap-1 bg-slate-950/60 border-b border-slate-800">
          <button
            onClick={() => setTab('direct')}
            className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
              tab === 'direct' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Direct 1-on-1 Chat
          </button>
          <button
            onClick={() => setTab('group')}
            className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
              tab === 'group' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            New Group Chat
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Tab 1: Direct Chat */}
        {tab === 'direct' && (
          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800/80 text-xs text-white placeholder-slate-400 border border-slate-700 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              {loading ? (
                <p className="text-xs text-slate-400 text-center py-6">Loading users...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No users found.</p>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleStartDirect(user.id)}
                    disabled={submitting}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <img
                          src={user.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                          alt={user.name}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                        <span
                          className={`w-2.5 h-2.5 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-slate-900 ${
                            user.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{user.name}</p>
                        <p className="text-[11px] text-slate-400">{user.email}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-indigo-400 hover:underline">
                      Chat →
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Group Chat */}
        {tab === 'group' && (
          <form onSubmit={handleCreateGroup} className="p-4 flex-1 flex flex-col overflow-hidden">
            <div className="space-y-3 pb-3 border-b border-slate-800">
              <label className="block text-xs font-medium text-slate-300">Group Name</label>
              <input
                type="text"
                placeholder="e.g. Design Sync, Core Team..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 text-xs text-white placeholder-slate-400 border border-slate-700 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="pt-3 flex-1 flex flex-col overflow-hidden">
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Select Members ({selectedUserIds.length} selected)
              </label>
              <div className="flex-1 overflow-y-auto space-y-1">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                    <div
                      key={user.id}
                      onClick={() => toggleUserSelection(user.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer border transition-all ${
                        isSelected
                          ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-200'
                          : 'hover:bg-slate-800 border-transparent text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={user.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-xs font-semibold">{user.name}</p>
                          <p className="text-[10px] text-slate-400">{user.email}</p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-600 bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 mt-auto">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all active:scale-98 disabled:opacity-50"
              >
                {submitting ? 'Creating Group...' : 'Create Group'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
