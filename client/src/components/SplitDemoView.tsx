import React, { useState, useEffect } from 'react';
import { User, Conversation, Message, ModerationAlert } from '../types';
import { io, Socket } from 'socket.io-client';
import { ChatWindow } from './ChatWindow';
import { Sidebar } from './Sidebar';
import { NewChatModal } from './NewChatModal';
import { ModerationModal } from './ModerationModal';

interface DemoUserSession {
  user: User;
  token: string;
}

interface SplitDemoViewProps {
  aliceAccount: DemoUserSession;
  bobAccount: DemoUserSession;
  onClose: () => void;
}

// Dedicated single-user pane in the split view
const SplitPane: React.FC<{
  session: DemoUserSession;
  label: string;
  themeColor: string;
}> = ({ session, label, themeColor }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [moderationAlert, setModerationAlert] = useState<ModerationAlert | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);

  // 1. Initialize dedicated socket for this user
  useEffect(() => {
    const s = io('http://localhost:5000', {
      auth: { token: session.token },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      console.log(`[Split Demo ${session.user.name}] Socket connected`);
    });

    s.on('message:received', ({ message, conversationId }: { message: Message; conversationId: string }) => {
      // If message is for currently open conversation, append to list
      setMessages((prev) => {
        // If message was optimistically added, reconcile tempId with real id
        const exists = prev.some((m) => m.id === message.id || (m.tempId && m.tempId === message.tempId));
        if (exists) {
          return prev.map((m) => (m.tempId === message.tempId || m.id === message.id ? message : m));
        }
        if (message.conversationId === activeConversationId) {
          return [...prev, message];
        }
        return prev;
      });

      // Update sidebar conversation list
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              lastMessage: {
                id: message.id,
                content: message.content,
                mediaType: message.mediaType,
                mediaUrl: message.mediaUrl,
                senderId: message.senderId,
                senderName: message.sender?.name || 'User',
                status: message.status,
                createdAt: message.createdAt,
              },
              unreadCount: message.senderId !== session.user.id && conversationId !== activeConversationId
                ? c.unreadCount + 1
                : c.unreadCount,
              updatedAt: message.createdAt,
            };
          }
          return c;
        })
      );

      // If active window, emit delivered and read
      if (message.conversationId === activeConversationId && message.senderId !== session.user.id) {
        s.emit('message:delivered', { messageId: message.id, conversationId });
        s.emit('conversation:read', { conversationId });
      }
    });

    s.on('message:status_update', ({ messageId, status }: { messageId: string; status: any }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status } : m))
      );
    });

    s.on('conversation:read_receipt', ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      if (userId !== session.user.id) {
        setMessages((prev) =>
          prev.map((m) => (m.conversationId === conversationId && m.senderId === session.user.id ? { ...m, status: 'READ' } : m))
        );
      }
    });

    s.on('typing:update', ({ conversationId, userName, isTyping }: any) => {
      if (conversationId === activeConversationId) {
        setTypingUser(isTyping ? userName : null);
      }
    });

    s.on('presence:update', ({ userId, isOnline, lastSeenAt }: any) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants.map((p) =>
            p.id === userId ? { ...p, isOnline, lastSeenAt } : p
          ),
        }))
      );
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [session.token, activeConversationId]);

  // 2. Fetch conversations
  const fetchConversations = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/conversations', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
        if (!activeConversationId && data.conversations.length > 0) {
          setActiveConversationId(data.conversations[0].id);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchConversations();
  }, [session.token]);

  // 3. Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/conversations/${activeConversationId}/messages?limit=30`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
          setNextCursor(data.nextCursor);
          setHasMore(!!data.nextCursor);
        }
      } catch (e) {}
    };

    fetchMessages();
  }, [activeConversationId, session.token]);

  // 4. Load older messages (cursor pagination)
  const handleLoadOlder = async () => {
    if (!activeConversationId || !nextCursor || loadingOlder) return;

    try {
      setLoadingOlder(true);
      const res = await fetch(
        `http://localhost:5000/api/conversations/${activeConversationId}/messages?cursor=${nextCursor}&limit=30`,
        { headers: { Authorization: `Bearer ${session.token}` } }
      );
      const data = await res.json();
      if (data.messages) {
        setMessages((prev) => [...data.messages, ...prev]);
        setNextCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
      }
    } catch (e) {} finally {
      setLoadingOlder(false);
    }
  };

  // 5. Send message with optimistic update and idempotency
  const handleSendMessage = async (payload: {
    content?: string;
    mediaType?: 'TEXT' | 'IMAGE' | 'GIF' | 'STICKER';
    mediaUrl?: string;
  }) => {
    if (!activeConversationId || !socket) return;

    const tempId = crypto.randomUUID();
    const optimisticMessage: Message = {
      id: tempId,
      tempId,
      conversationId: activeConversationId,
      senderId: session.user.id,
      content: payload.content || null,
      mediaType: payload.mediaType || 'TEXT',
      mediaUrl: payload.mediaUrl || null,
      status: 'SENDING',
      createdAt: new Date().toISOString(),
      sender: {
        id: session.user.id,
        name: session.user.name,
        avatar: session.user.avatar,
      },
    };

    // Add optimistically to UI
    setMessages((prev) => [...prev, optimisticMessage]);

    socket.emit(
      'message:send',
      {
        conversationId: activeConversationId,
        content: payload.content,
        mediaType: payload.mediaType,
        mediaUrl: payload.mediaUrl,
        tempId,
      },
      (ack: any) => {
        if (!ack || !ack.success) {
          // Revert or mark message failed
          setMessages((prev) =>
            prev.map((m) =>
              m.tempId === tempId ? { ...m, status: 'FAILED', errorReason: ack?.message } : m
            )
          );

          if (ack?.error === 'PROFANITY_DETECTED') {
            setModerationAlert({
              title: 'Profanity Policy Violation',
              message: ack.message || 'Message blocked due to prohibited language.',
              details: ack.flaggedWords ? `Flagged words: ${ack.flaggedWords.join(', ')}` : undefined,
            });
          }
        } else {
          // Replace optimistic message with confirmed server message
          setMessages((prev) =>
            prev.map((m) => (m.tempId === tempId ? ack.message : m))
          );
        }
      }
    );
  };

  const handleMarkAsRead = (convId: string) => {
    if (socket) {
      socket.emit('conversation:read', { conversationId: convId });
    }
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
    );
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId) || null;

  return (
    <div className="flex-1 h-full flex flex-col border-r border-slate-800 last:border-r-0 overflow-hidden relative">
      {/* Pane Header Identifier */}
      <div className={`px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs`}>
        <div className="flex items-center space-x-2">
          <span className={`w-2.5 h-2.5 rounded-full ${themeColor}`} />
          <span className="font-bold text-white tracking-wide">{label}</span>
          <span className="text-slate-400 font-mono">({session.user.email})</span>
        </div>
        <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-medium">
          Live Session Active
        </span>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => setActiveConversationId(id)}
          onOpenNewChat={() => setShowNewChat(true)}
          currentUser={session.user}
        />

        <ChatWindow
          conversation={activeConv}
          messages={messages}
          currentUser={session.user}
          hasMore={hasMore}
          loadingOlder={loadingOlder}
          onLoadOlder={handleLoadOlder}
          onSendMessage={handleSendMessage}
          onTypingStart={() => socket?.emit('typing:start', { conversationId: activeConversationId })}
          onTypingStop={() => socket?.emit('typing:stop', { conversationId: activeConversationId })}
          typingUser={typingUser}
          onModerationAlert={(alert) => setModerationAlert(alert)}
          onMarkAsRead={handleMarkAsRead}
        />
      </div>

      <ModerationModal alert={moderationAlert} onClose={() => setModerationAlert(null)} />

      {showNewChat && (
        <NewChatModal
          currentUser={session.user}
          onClose={() => setShowNewChat(false)}
          onConversationCreated={(newConv) => {
            setConversations((prev) => [newConv, ...prev]);
            setActiveConversationId(newConv.id);
          }}
        />
      )}
    </div>
  );
};

export const SplitDemoView: React.FC<SplitDemoViewProps> = ({
  aliceAccount,
  bobAccount,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 top-16 z-40 bg-slate-950 flex flex-col animate-in fade-in duration-150">
      {/* Split View Banner */}
      <div className="h-10 bg-indigo-950/70 border-b border-indigo-900/50 px-4 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-indigo-200">
          <span className="font-bold uppercase tracking-wider text-[10px] bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded">
            Interactive Dual-Client Evaluator Mode
          </span>
          <span className="hidden sm:inline text-indigo-300/80">
            Type on Alice's side and watch Bob receive messages, typing states, and read receipts in real-time!
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-semibold text-indigo-300 hover:text-white px-2 py-1 rounded bg-indigo-900/60 hover:bg-indigo-800 transition-colors"
        >
          Close Split View ✕
        </button>
      </div>

      {/* Side-by-side Dual Panes */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-800 min-h-0">
        <SplitPane
          session={aliceAccount}
          label="Account A: Alice Smith"
          themeColor="bg-indigo-500"
        />
        <SplitPane
          session={bobAccount}
          label="Account B: Bob Jones"
          themeColor="bg-emerald-500"
        />
      </div>
    </div>
  );
};
