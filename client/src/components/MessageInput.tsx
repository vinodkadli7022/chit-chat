import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Smile, Sparkles, Loader2, X } from 'lucide-react';
import { GifPicker } from './GifPicker';
import { StickerPicker } from './StickerPicker';
import { ApiService } from '../services/api';
import { ModerationAlert } from '../types';

interface MessageInputProps {
  onSendMessage: (payload: {
    content?: string;
    mediaType?: 'TEXT' | 'IMAGE' | 'GIF' | 'STICKER';
    mediaUrl?: string;
  }) => Promise<void>;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onModerationAlert: (alert: ModerationAlert) => void;
  disabled?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  onModerationAlert,
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Typing debounce trigger
    onTypingStart();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTypingStop();
    }, 1500);
  };

  const handleSend = async () => {
    if (uploadingImage) return;

    // Send image if attached
    if (imagePreview) {
      try {
        setUploadingImage(true);
        const res = await ApiService.uploadMedia(imagePreview.file);
        await onSendMessage({
          content: text.trim() || undefined,
          mediaType: 'IMAGE',
          mediaUrl: res.url,
        });
        setImagePreview(null);
        setText('');
      } catch (err: any) {
        if (err.status === 422) {
          onModerationAlert({
            title: 'Image Moderation Alert',
            message: err.data?.message || 'Image was rejected due to explicit content violation.',
            score: err.data?.score,
            details: `Model: ${err.data?.details?.model || 'Lightweight Skin Tone & NSFW Classifier'} | Inference: ${err.data?.details?.inferenceTimeMs}ms`,
          });
        } else {
          onModerationAlert({
            title: 'Upload Failed',
            message: err.data?.message || 'Failed to upload image.',
          });
        }
      } finally {
        setUploadingImage(false);
      }
      return;
    }

    // Send text message
    if (!text.trim()) return;

    const content = text.trim();
    setText('');
    onTypingStop();

    try {
      await onSendMessage({ content, mediaType: 'TEXT' });
    } catch (err: any) {
      // Catch profanity rejection
      if (err.data?.error === 'PROFANITY_DETECTED' || err.message?.includes('prohibited language')) {
        onModerationAlert({
          title: 'Profanity Policy Violation',
          message: err.message || err.data?.message || 'Message blocked: prohibited language detected.',
          details: err.data?.flaggedWords ? `Flagged terms: ${err.data.flaggedWords.join(', ')}` : undefined,
        });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onModerationAlert({
        title: 'File Size Exceeded',
        message: 'The selected image exceeds the maximum permitted size of 5MB.',
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImagePreview({ file, url: previewUrl });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-3 bg-slate-900 border-t border-slate-800 relative select-none">
      {/* Popovers */}
      {showGifPicker && (
        <div className="absolute bottom-16 left-4 z-50">
          <GifPicker
            onSelectGif={async (url) => {
              setShowGifPicker(false);
              await onSendMessage({ mediaType: 'GIF', mediaUrl: url });
            }}
            onClose={() => setShowGifPicker(false)}
          />
        </div>
      )}

      {showStickerPicker && (
        <div className="absolute bottom-16 left-12 z-50">
          <StickerPicker
            onSelectSticker={async (url) => {
              setShowStickerPicker(false);
              await onSendMessage({ mediaType: 'STICKER', mediaUrl: url });
            }}
            onClose={() => setShowStickerPicker(false)}
          />
        </div>
      )}

      {/* Image Attachment Preview Bar */}
      {imagePreview && (
        <div className="mb-2 p-2 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between animate-in fade-in duration-100">
          <div className="flex items-center space-x-3">
            <img
              src={imagePreview.url}
              alt="Attachment"
              className="w-12 h-12 rounded-lg object-cover border border-slate-600"
            />
            <div>
              <p className="text-xs font-medium text-slate-200 truncate max-w-xs">{imagePreview.file.name}</p>
              <p className="text-[10px] text-slate-400">
                {(imagePreview.file.size / 1024).toFixed(1)} KB • Image will pass server moderation
              </p>
            </div>
          </div>
          <button
            onClick={() => setImagePreview(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input controls container */}
      <div className="flex items-end space-x-2 bg-slate-950/70 border border-slate-750 focus-within:border-indigo-500 rounded-2xl p-2 transition-colors">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Attachment & Picker Buttons */}
        <div className="flex items-center space-x-1 pb-1 text-slate-400">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach Image"
            className="p-1.5 rounded-lg hover:text-indigo-400 hover:bg-slate-800 transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowStickerPicker(!showStickerPicker);
              setShowGifPicker(false);
            }}
            title="Stickers"
            className={`p-1.5 rounded-lg transition-colors ${
              showStickerPicker ? 'text-indigo-400 bg-slate-800' : 'hover:text-amber-400 hover:bg-slate-800'
            }`}
          >
            <Smile className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowGifPicker(!showGifPicker);
              setShowStickerPicker(false);
            }}
            title="GIFs"
            className={`p-1.5 rounded-lg transition-colors ${
              showGifPicker ? 'text-indigo-400 bg-slate-800' : 'hover:text-indigo-400 hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Press Enter to send)"
          disabled={disabled || uploadingImage}
          className="flex-1 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none max-h-28 py-1.5 px-2 select-text"
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || uploadingImage || (!text.trim() && !imagePreview)}
          className={`p-2 rounded-xl transition-all ${
            text.trim() || imagePreview
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 active:scale-95'
              : 'text-slate-600 bg-slate-850 cursor-not-allowed'
          }`}
        >
          {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
