import React, { useState } from 'react';
import { Smile, X } from 'lucide-react';

interface StickerPickerProps {
  onSelectSticker: (stickerUrl: string) => void;
  onClose: () => void;
}

interface StickerPack {
  id: string;
  name: string;
  icon: string;
  stickers: string[];
}

const STICKER_PACKS: StickerPack[] = [
  {
    id: 'reactions',
    name: 'Reactions',
    icon: '🚀',
    stickers: [
      'https://cdn-icons-png.flaticon.com/512/742/742751.png', // Happy celebration
      'https://cdn-icons-png.flaticon.com/512/742/742752.png', // Heart eyes
      'https://cdn-icons-png.flaticon.com/512/742/742760.png', // Cool sunglasses
      'https://cdn-icons-png.flaticon.com/512/742/742927.png', // Thumbs up
      'https://cdn-icons-png.flaticon.com/512/742/742774.png', // Thinking
      'https://cdn-icons-png.flaticon.com/512/742/742813.png', // Shocked
      'https://cdn-icons-png.flaticon.com/512/742/742823.png', // Fire
      'https://cdn-icons-png.flaticon.com/512/742/742765.png', // Party popper
    ]
  },
  {
    id: 'cats',
    name: 'Cat Vibes',
    icon: '🐱',
    stickers: [
      'https://cdn-icons-png.flaticon.com/512/616/616430.png', // Happy cat
      'https://cdn-icons-png.flaticon.com/512/616/616431.png', // Playful cat
      'https://cdn-icons-png.flaticon.com/512/616/616432.png', // Sleek cat
      'https://cdn-icons-png.flaticon.com/512/616/616433.png', // Sleeping cat
      'https://cdn-icons-png.flaticon.com/512/616/616434.png', // Surprised cat
      'https://cdn-icons-png.flaticon.com/512/616/616435.png', // Smart cat
    ]
  },
  {
    id: 'dev',
    name: 'Tech & Code',
    icon: '⚡',
    stickers: [
      'https://cdn-icons-png.flaticon.com/512/1006/1006771.png', // Code brackets
      'https://cdn-icons-png.flaticon.com/512/1006/1006776.png', // Rocket launch
      'https://cdn-icons-png.flaticon.com/512/1006/1006780.png', // Lightning bug fix
      'https://cdn-icons-png.flaticon.com/512/1006/1006782.png', // Server cluster
      'https://cdn-icons-png.flaticon.com/512/1006/1006784.png', // Shield security
      'https://cdn-icons-png.flaticon.com/512/1006/1006786.png', // Database store
    ]
  }
];

export const StickerPicker: React.FC<StickerPickerProps> = ({ onSelectSticker, onClose }) => {
  const [selectedPack, setSelectedPack] = useState<string>('reactions');

  const currentPack = STICKER_PACKS.find((p) => p.id === selectedPack) || STICKER_PACKS[0];

  return (
    <div className="w-80 h-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-50">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
          <Smile className="w-4 h-4 text-amber-400" />
          <span>Sticker Packs</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Pack Tabs */}
      <div className="flex items-center space-x-1 p-2 border-b border-slate-800 bg-slate-900/60">
        {STICKER_PACKS.map((pack) => (
          <button
            key={pack.id}
            onClick={() => setSelectedPack(pack.id)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedPack === pack.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span>{pack.icon}</span>
            <span>{pack.name}</span>
          </button>
        ))}
      </div>

      {/* Sticker Grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-3">
        {currentPack.stickers.map((url, idx) => (
          <button
            key={idx}
            onClick={() => onSelectSticker(url)}
            className="group aspect-square p-2 rounded-xl bg-slate-800/60 hover:bg-slate-750 border border-slate-750 hover:border-indigo-500/80 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          >
            <img
              src={url}
              alt="Sticker"
              loading="lazy"
              className="w-14 h-14 object-contain filter drop-shadow-md transition-transform group-hover:scale-110"
            />
          </button>
        ))}
      </div>
    </div>
  );
};
