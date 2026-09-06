import React, { useState } from 'react';
import { Message, User } from '../types';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSender: boolean;
  currentUser: User | null;
  onImageClick?: (url: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showSender,
  currentUser,
  onImageClick,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);

  const formattedTime = (() => {
    try {
      return format(new Date(message.createdAt), 'h:mm a');
    } catch {
      return '';
    }
  })();

  const renderStatusIcon = () => {
    if (!isOwn) return null;

    switch (message.status) {
      case 'SENDING':
        return <span title="Sending..."><Clock className="w-3 h-3 text-slate-400 animate-pulse" /></span>;
      case 'SENT':
        return <span title="Sent"><Check className="w-3.5 h-3.5 text-slate-400" /></span>;
      case 'DELIVERED':
        return <span title="Delivered"><CheckCheck className="w-3.5 h-3.5 text-slate-400" /></span>;
      case 'READ':
        return <span title="Read"><CheckCheck className="w-3.5 h-3.5 text-sky-400 font-bold" /></span>;
      case 'FAILED':
        return <span title={message.errorReason || 'Failed to deliver'}><AlertCircle className="w-3.5 h-3.5 text-rose-400" /></span>;
      default:
        return <span title="Sent"><Check className="w-3 h-3 text-slate-400" /></span>;
    }
  };

  return (
    <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} mb-2.5 group select-text`}>
      <div className={`flex items-end max-w-[80%] sm:max-w-[70%] space-x-2 ${isOwn ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
        {/* Avatar for other users in group/direct chats */}
        {!isOwn && showSender && (
          <img
            src={message.sender?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=avatar'}
            alt={message.sender?.name || 'User'}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-1 border border-slate-700"
          />
        )}
        {!isOwn && !showSender && <div className="w-7 flex-shrink-0" />}

        <div className="flex flex-col">
          {/* Sender name for group chats */}
          {!isOwn && showSender && (
            <span className="text-[11px] font-semibold text-indigo-400 ml-1 mb-1">
              {message.sender?.name || 'Anonymous'}
            </span>
          )}

          {/* Bubble content */}
          <div
            className={`relative rounded-2xl p-3 shadow-md transition-all ${
              isOwn
                ? 'bg-indigo-600 text-white rounded-br-xs'
                : 'bg-slate-800 text-slate-100 rounded-bl-xs border border-slate-750'
            } ${message.status === 'FAILED' ? 'border border-rose-500/80 bg-rose-950/40 text-rose-200' : ''}`}
          >
            {/* 1. Text Message */}
            {message.content && (
              <p className="text-xs sm:text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                {message.content}
              </p>
            )}

            {/* 2. Image Attachment */}
            {message.mediaType === 'IMAGE' && message.mediaUrl && (
              <div className="rounded-xl overflow-hidden my-1 max-w-xs relative bg-slate-900 cursor-pointer">
                {!imgLoaded && (
                  <div className="w-48 h-40 bg-slate-850 animate-pulse flex items-center justify-center text-xs text-slate-500">
                    Loading media...
                  </div>
                )}
                <img
                  src={message.mediaUrl.startsWith('/') ? `http://localhost:5000${message.mediaUrl}` : message.mediaUrl}
                  alt="Attachment"
                  loading="lazy"
                  onLoad={() => setImgLoaded(true)}
                  onClick={() => onImageClick?.(message.mediaUrl!)}
                  className={`max-h-60 w-auto rounded-xl object-cover transition-opacity duration-200 ${
                    imgLoaded ? 'opacity-100' : 'opacity-0 h-0'
                  }`}
                />
              </div>
            )}

            {/* 3. GIF Message */}
            {message.mediaType === 'GIF' && message.mediaUrl && (
              <div className="rounded-xl overflow-hidden my-1 max-w-xs bg-slate-900">
                <img
                  src={message.mediaUrl}
                  alt="GIF"
                  loading="lazy"
                  className="max-h-56 w-auto rounded-xl object-cover"
                />
              </div>
            )}

            {/* 4. Sticker Message */}
            {message.mediaType === 'STICKER' && message.mediaUrl && (
              <div className="p-1 my-1">
                <img
                  src={message.mediaUrl}
                  alt="Sticker"
                  loading="lazy"
                  className="w-24 h-24 sm:w-28 sm:h-28 object-contain filter drop-shadow-md hover:scale-105 transition-transform"
                />
              </div>
            )}

            {/* Footer metadata: Time & Read Receipt */}
            <div className={`flex items-center space-x-1.5 justify-end mt-1 text-[10px] ${isOwn ? 'text-indigo-200' : 'text-slate-400'}`}>
              <span>{formattedTime}</span>
              {renderStatusIcon()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
