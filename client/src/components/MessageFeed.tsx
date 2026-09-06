import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { Message, User } from '../types';
import { MessageBubble } from './MessageBubble';
import { format, isToday, isYesterday } from 'date-fns';
import { Loader2, X } from 'lucide-react';

interface MessageFeedProps {
  messages: Message[];
  currentUser: User | null;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}

export const MessageFeed: React.FC<MessageFeedProps> = ({
  messages,
  currentUser,
  hasMore,
  loadingOlder,
  onLoadOlder,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const shouldScrollToBottomRef = useRef<boolean>(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Preserve scroll position when older messages are loaded at the top
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (prevScrollHeightRef.current > 0) {
      const heightDiff = container.scrollHeight - prevScrollHeightRef.current;
      if (heightDiff > 0) {
        container.scrollTop += heightDiff;
      }
      prevScrollHeightRef.current = 0;
    } else if (shouldScrollToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Handle scroll events to detect if user is near bottom
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldScrollToBottomRef.current = distanceFromBottom < 100;
  };

  // IntersectionObserver for top sentinel to trigger loading older messages
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingOlder) {
          prevScrollHeightRef.current = container.scrollHeight;
          onLoadOlder();
        }
      },
      {
        root: container,
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingOlder, onLoadOlder]);

  // Format date dividers
  const getDateLabel = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isToday(date)) return 'Today';
      if (isYesterday(date)) return 'Yesterday';
      return format(date, 'MMMM d, yyyy');
    } catch {
      return '';
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-4 flex flex-col space-y-1 relative"
    >
      {/* Top Sentinel for upward infinite scroll */}
      <div ref={topSentinelRef} className="h-4 flex items-center justify-center py-2">
        {loadingOlder && (
          <div className="flex items-center space-x-2 text-xs text-indigo-400 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800 shadow">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading older messages...</span>
          </div>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs py-12">
          <p>No messages yet.</p>
          <p className="text-[11px] text-slate-600 mt-1">Send a message to start the conversation!</p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const isOwn = msg.senderId === currentUser?.id;
          const prevMsg = messages[index - 1];
          const showSender = !prevMsg || prevMsg.senderId !== msg.senderId;

          // Date Divider check
          const currentDate = getDateLabel(msg.createdAt);
          const prevDate = prevMsg ? getDateLabel(prevMsg.createdAt) : null;
          const showDateDivider = currentDate !== prevDate;

          return (
            <React.Fragment key={msg.tempId || msg.id}>
              {showDateDivider && (
                <div className="flex items-center justify-center my-3 select-none">
                  <span className="px-3 py-1 rounded-full bg-slate-800/90 text-slate-400 text-[10px] font-semibold tracking-wider border border-slate-700/60 uppercase">
                    {currentDate}
                  </span>
                </div>
              )}
              <MessageBubble
                message={msg}
                isOwn={isOwn}
                showSender={showSender}
                currentUser={currentUser}
                onImageClick={(url) => setLightboxUrl(url)}
              />
            </React.Fragment>
          );
        })
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl.startsWith('/') ? `http://localhost:5000${lightboxUrl}` : lightboxUrl}
            alt="Full size preview"
            className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
