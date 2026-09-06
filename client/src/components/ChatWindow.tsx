import React, { useEffect } from 'react';
import { Conversation, Message, User, ModerationAlert } from '../types';
import { MessageFeed } from './MessageFeed';
import { MessageInput } from './MessageInput';
import { Users, MoreVertical, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  currentUser: User | null;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onSendMessage: (payload: {
    content?: string;
    mediaType?: 'TEXT' | 'IMAGE' | 'GIF' | 'STICKER';
    mediaUrl?: string;
  }) => Promise<void>;
  onTypingStart: () => void;
  onTypingStop: () => void;
  typingUser: string | null;
  onModerationAlert: (alert: ModerationAlert) => void;
  onMarkAsRead: (conversationId: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  messages,
  currentUser,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  typingUser,
  onModerationAlert,
  onMarkAsRead,
}) => {
  // Automatically mark as read when window mounts or active conversation updates
  useEffect(() => {
    if (conversation) {
      onMarkAsRead(conversation.id);
    }
  }, [conversation?.id, messages.length]);

  if (!conversation) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-950 p-6 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 mb-4 shadow-xl">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">Select a Conversation</h3>
        <p className="text-xs text-slate-400 max-w-sm">
          Choose an existing chat from the left or create a new conversation to start messaging with real-time sync.
        </p>
      </div>
    );
  }

  const otherUser = conversation.type === 'DIRECT'
    ? conversation.participants.find((p) => p.id !== currentUser?.id)
    : null;

  const isOnline = otherUser ? otherUser.isOnline : false;

  const getPresenceText = () => {
    if (typingUser) {
      return (
        <span className="text-indigo-400 font-medium flex items-center space-x-1">
          <span>{typingUser} is typing</span>
          <span className="animate-bounce">.</span>
          <span className="animate-bounce delay-100">.</span>
          <span className="animate-bounce delay-200">.</span>
        </span>
      );
    }

    if (conversation.type === 'GROUP') {
      return `${conversation.participants.length} members`;
    }

    if (isOnline) {
      return <span className="text-emerald-400 font-medium">Online</span>;
    }

    if (otherUser?.lastSeenAt) {
      try {
        return `Last seen ${format(new Date(otherUser.lastSeenAt), 'h:mm a')}`;
      } catch {
        return 'Offline';
      }
    }

    return 'Offline';
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-950 overflow-hidden min-h-0">
      {/* Chat Header */}
      <div className="h-16 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between select-none z-10 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img
              src={conversation.avatar || otherUser?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=chat'}
              alt={conversation.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-700"
            />
            {conversation.type === 'DIRECT' && (
              <span
                className={`w-2.5 h-2.5 rounded-full absolute bottom-0 right-0 border-2 border-slate-900 ${
                  isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                }`}
              />
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{conversation.name}</h2>
            <div className="text-[11px] text-slate-400 flex items-center space-x-1">
              {getPresenceText()}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <div className="px-2.5 py-1 rounded-full bg-slate-800 text-[10px] text-slate-300 font-medium border border-slate-700 flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Moderated Channel</span>
          </div>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <MessageFeed
          messages={messages}
          currentUser={currentUser}
          hasMore={hasMore}
          loadingOlder={loadingOlder}
          onLoadOlder={onLoadOlder}
        />
      </div>

      {/* Input Box */}
      <div className="flex-shrink-0">
        <MessageInput
          onSendMessage={onSendMessage}
          onTypingStart={onTypingStart}
          onTypingStop={onTypingStop}
          onModerationAlert={onModerationAlert}
        />
      </div>
    </div>
  );
};
