import React, { useState, useEffect } from 'react';
import { User, Conversation, Message, ModerationAlert } from './types';
import { ApiService } from './services/api';
import { socketService } from './services/socket';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { SplitDemoView } from './components/SplitDemoView';
import { AuthModal } from './components/AuthModal';
import { NewChatModal } from './components/NewChatModal';
import { ModerationModal } from './components/ModerationModal';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<(User & { token: string })[]>([]);
  const [isSplitView, setIsSplitView] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [moderationAlert, setModerationAlert] = useState<ModerationAlert | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // 1. Initial Load: Fetch demo accounts & check current session
  useEffect(() => {
    const init = async () => {
      try {
        const demoRes = await ApiService.getDemoAccounts();
        setDemoAccounts(demoRes.accounts);

        const token = ApiService.getToken();
        if (token) {
          try {
            const meRes = await ApiService.getMe();
            setCurrentUser(meRes.user);
          } catch {
            ApiService.setToken(null);
          }
        } else if (demoRes.accounts.length > 0) {
          // Default to Alice Smith for instant preview
          const defaultAlice = demoRes.accounts[0];
          ApiService.setToken(defaultAlice.token);
          setCurrentUser(defaultAlice);
        }
      } catch (e) {
        console.error('Initialization error:', e);
      } finally {
        setAuthLoading(false);
      }
    };

    init();
  }, []);

  // 2. Setup Socket.IO connection & listeners whenever currentUser changes
  useEffect(() => {
    if (!currentUser) return;

    const socket = socketService.connect();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    setIsConnected(socket.connected);

    // Incoming messages
    socket.on('message:received', ({ message, conversationId }: { message: Message; conversationId: string }) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id || (m.tempId && m.tempId === message.tempId));
        if (exists) {
          return prev.map((m) => (m.tempId === message.tempId || m.id === message.id ? message : m));
        }
        if (message.conversationId === activeConversationId) {
          return [...prev, message];
        }
        return prev;
      });

      // Update sidebar
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
              unreadCount: message.senderId !== currentUser.id && conversationId !== activeConversationId
                ? c.unreadCount + 1
                : c.unreadCount,
              updatedAt: message.createdAt,
            };
          }
          return c;
        })
      );

      // Acknowledge delivered receipt
      if (message.conversationId === activeConversationId && message.senderId !== currentUser.id) {
        socket.emit('message:delivered', { messageId: message.id, conversationId });
        socket.emit('conversation:read', { conversationId });
      }
    });

    // Message status update (SENT -> DELIVERED -> READ)
    socket.on('message:status_update', ({ messageId, status }: any) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status } : m))
      );
    });

    // Read receipts
    socket.on('conversation:read_receipt', ({ conversationId, userId }: any) => {
      if (userId !== currentUser.id) {
        setMessages((prev) =>
          prev.map((m) => (m.conversationId === conversationId && m.senderId === currentUser.id ? { ...m, status: 'READ' } : m))
        );
      }
    });

    // Typing updates
    socket.on('typing:update', ({ conversationId, userName, isTyping }: any) => {
      if (conversationId === activeConversationId) {
        setTypingUser(isTyping ? userName : null);
      }
    });

    // Presence updates
    socket.on('presence:update', ({ userId, isOnline, lastSeenAt }: any) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants.map((p) =>
            p.id === userId ? { ...p, isOnline, lastSeenAt } : p
          ),
        }))
      );
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('message:received');
      socket.off('message:status_update');
      socket.off('conversation:read_receipt');
      socket.off('typing:update');
      socket.off('presence:update');
    };
  }, [currentUser, activeConversationId]);

  // 3. Load conversations
  const loadConversations = async () => {
    if (!currentUser) return;
    try {
      const res = await ApiService.getConversations();
      setConversations(res.conversations);
      if (!activeConversationId && res.conversations.length > 0) {
        setActiveConversationId(res.conversations[0].id);
      }
    } catch (e) {
      console.error('Error fetching conversations:', e);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [currentUser]);

  // 4. Load messages for active conversation
  useEffect(() => {
    if (!activeConversationId) return;

    const loadMessages = async () => {
      try {
        const res = await ApiService.getMessages(activeConversationId, undefined, 30);
        setMessages(res.messages);
        setNextCursor(res.nextCursor);
        setHasMore(!!res.nextCursor);
      } catch (e) {
        console.error('Error fetching messages:', e);
      }
    };

    loadMessages();
  }, [activeConversationId]);

  // 5. Cursor-based pagination (scrolling up)
  const handleLoadOlder = async () => {
    if (!activeConversationId || !nextCursor || loadingOlder) return;

    try {
      setLoadingOlder(true);
      const res = await ApiService.getMessages(activeConversationId, nextCursor, 30);
      setMessages((prev) => [...res.messages, ...prev]);
      setNextCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } catch (e) {
      console.error('Error loading older messages:', e);
    } finally {
      setLoadingOlder(false);
    }
  };

  // 6. Send message with optimistic update and idempotency
  const handleSendMessage = async (payload: {
    content?: string;
    mediaType?: 'TEXT' | 'IMAGE' | 'GIF' | 'STICKER';
    mediaUrl?: string;
  }) => {
    if (!activeConversationId || !currentUser) return;

    const tempId = crypto.randomUUID();
    const optimisticMessage: Message = {
      id: tempId,
      tempId,
      conversationId: activeConversationId,
      senderId: currentUser.id,
      content: payload.content || null,
      mediaType: payload.mediaType || 'TEXT',
      mediaUrl: payload.mediaUrl || null,
      status: 'SENDING',
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const ack = await socketService.sendMessage({
        conversationId: activeConversationId,
        content: payload.content,
        mediaType: payload.mediaType,
        mediaUrl: payload.mediaUrl,
        tempId,
      });

      if (ack && ack.success) {
        setMessages((prev) =>
          prev.map((m) => (m.tempId === tempId ? ack.message : m))
        );
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === tempId ? { ...m, status: 'FAILED', errorReason: err.message } : m
        )
      );
      throw err;
    }
  };

  const handleMarkAsRead = async (convId: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('conversation:read', { conversationId: convId });
    }
    await ApiService.markAsRead(convId).catch(() => {});
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
    );
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId) || null;

  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        Initializing secure messaging platform...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Global Navbar */}
      <Navbar
        currentUser={currentUser}
        demoAccounts={demoAccounts}
        onSelectAccount={(acc) => {
          ApiService.setToken(acc.token);
          setCurrentUser(acc);
          socketService.disconnect();
        }}
        isSplitView={isSplitView}
        onToggleSplitView={() => setIsSplitView(!isSplitView)}
        isConnected={isConnected}
        onLogout={() => {
          ApiService.setToken(null);
          setCurrentUser(null);
          socketService.disconnect();
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => setActiveConversationId(id)}
          onOpenNewChat={() => setShowNewChat(true)}
          currentUser={currentUser}
        />

        <ChatWindow
          conversation={activeConv}
          messages={messages}
          currentUser={currentUser}
          hasMore={hasMore}
          loadingOlder={loadingOlder}
          onLoadOlder={handleLoadOlder}
          onSendMessage={handleSendMessage}
          onTypingStart={() => {
            socketService.getSocket()?.emit('typing:start', { conversationId: activeConversationId });
          }}
          onTypingStop={() => {
            socketService.getSocket()?.emit('typing:stop', { conversationId: activeConversationId });
          }}
          typingUser={typingUser}
          onModerationAlert={(alert) => setModerationAlert(alert)}
          onMarkAsRead={handleMarkAsRead}
        />
      </div>

      {/* Evaluator Split Screen Mode */}
      {isSplitView && demoAccounts.length >= 2 && (
        <SplitDemoView
          aliceAccount={{ user: demoAccounts[0], token: demoAccounts[0].token }}
          bobAccount={{ user: demoAccounts[1], token: demoAccounts[1].token }}
          onClose={() => setIsSplitView(false)}
        />
      )}

      {/* Auth Modal if logged out */}
      {!currentUser && (
        <AuthModal
          demoAccounts={demoAccounts}
          onSuccess={(user) => {
            setCurrentUser(user);
            loadConversations();
          }}
        />
      )}

      {/* New Conversation Modal */}
      {showNewChat && (
        <NewChatModal
          currentUser={currentUser}
          onClose={() => setShowNewChat(false)}
          onConversationCreated={(newConv) => {
            setConversations((prev) => [newConv, ...prev]);
            setActiveConversationId(newConv.id);
          }}
        />
      )}

      {/* Moderation Alert Modal */}
      <ModerationModal
        alert={moderationAlert}
        onClose={() => setModerationAlert(null)}
      />
    </div>
  );
};

export default App;
