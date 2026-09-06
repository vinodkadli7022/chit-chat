import React, { useState } from 'react';
import { Conversation, User } from '../types';
import { Search, Plus, Users, MessageSquare, Check, CheckCheck } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenNewChat: () => void;
  currentUser: User | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNewChat,
  currentUser,
}) => {
  const [search, setSearch] = useState('');

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isToday(date)) return format(date, 'h:mm a');
      if (isYesterday(date)) return 'Yesterday';
      return format(date, 'MMM d');
    } catch {
      return '';
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="w-80 h-full bg-slate-900 border-r border-slate-800 flex flex-col select-none">
      {/* Search & Actions Header */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Messages</h2>
          <button
            onClick={onOpenNewChat}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800/80 text-xs text-white placeholder-slate-500 border border-slate-700/60 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-500 text-xs">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No conversations found.</p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const otherUser = conv.type === 'DIRECT'
              ? conv.participants.find((p) => p.id !== currentUser?.id)
              : null;

            const isOnline = otherUser ? otherUser.isOnline : false;

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all text-left ${
                  isActive
                    ? 'bg-indigo-600/20 border border-indigo-500/40 shadow-sm'
                    : 'hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                {/* Avatar with presence badge */}
                <div className="relative flex-shrink-0">
                  <img
                    src={conv.avatar || (otherUser?.avatar) || 'https://api.dicebear.com/7.x/bottts/svg?seed=chat'}
                    alt={conv.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-700"
                  />
                  {conv.type === 'DIRECT' && (
                    <span
                      className={`w-3 h-3 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-slate-900 ${
                        isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    />
                  )}
                  {conv.type === 'GROUP' && (
                    <div className="w-3.5 h-3.5 rounded-full absolute -bottom-0.5 -right-0.5 bg-indigo-600 flex items-center justify-center text-[8px] text-white font-bold border border-slate-900">
                      G
                    </div>
                  )}
                </div>

                {/* Conversation Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold truncate ${isActive ? 'text-indigo-200' : 'text-slate-200'}`}>
                      {conv.name}
                    </p>
                    <span className="text-[10px] text-slate-500 flex-shrink-0 ml-1">
                      {formatTimestamp(conv.lastMessage?.createdAt || conv.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[11px] text-slate-400 truncate max-w-[140px]">
                      {conv.lastMessage?.mediaType === 'IMAGE' && '📷 [Image]'}
                      {conv.lastMessage?.mediaType === 'GIF' && '✨ [GIF]'}
                      {conv.lastMessage?.mediaType === 'STICKER' && '🚀 [Sticker]'}
                      {conv.lastMessage?.mediaType === 'TEXT' && conv.lastMessage?.content}
                      {!conv.lastMessage && 'No messages yet'}
                    </p>

                    {/* Unread count badge */}
                    {conv.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold min-w-4 text-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
