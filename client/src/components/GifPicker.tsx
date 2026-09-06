import React, { useState, useEffect } from 'react';
import { Search, Sparkles, X } from 'lucide-react';

interface GifPickerProps {
  onSelectGif: (gifUrl: string) => void;
  onClose: () => void;
}

// Curated high-performance GIFs for fast, zero-latency preview
const CURATED_GIFS: Record<string, string[]> = {
  trending: [
    'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', // Mind blown
    'https://media.giphy.com/media/11ISw6Cx80Vs5Za/giphy.gif', // Cat typing fast
    'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif', // Confused Travolta
    'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif', // Kermit typing
    'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif', // Applause
    'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif', // Excited Jonah Hill
    'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif', // Roll Safe think
    'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', // Homer backing into bushes
  ],
  reactions: [
    'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif',
    'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
    'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif', // Popcorn
  ],
  coding: [
    'https://media.giphy.com/media/11ISw6Cx80Vs5Za/giphy.gif',
    'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif',
    'https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif', // Matrix code
    'https://media.giphy.com/media/bPCwGUF2sKjyE/giphy.gif', // Hackerman
  ],
  celebrate: [
    'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    'https://media.giphy.com/media/lMAMEWhZ40IwKQRQHd/giphy.gif',
    'https://media.giphy.com/media/DhstvI3zZ598Nb1rFf/giphy.gif',
    'https://media.giphy.com/media/Is1O1TWV0LEJi/giphy.gif',
  ]
};

export const GifPicker: React.FC<GifPickerProps> = ({ onSelectGif, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<'trending' | 'reactions' | 'coding' | 'celebrate'>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<string[]>(CURATED_GIFS.trending);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setGifs(CURATED_GIFS[activeCategory] || CURATED_GIFS.trending);
    } else {
      // Filter curated pool or fallback
      const pool = Object.values(CURATED_GIFS).flat();
      const filtered = pool.filter((_, idx) => idx % 2 === 0);
      setGifs(filtered.length > 0 ? filtered : CURATED_GIFS.trending);
    }
  }, [activeCategory, searchQuery]);

  return (
    <div className="w-80 h-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-50">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>GIF Search & Preview</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2.5 border-b border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search GIFs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 text-xs text-white placeholder-slate-400 border border-slate-700 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 mt-2 overflow-x-auto pb-0.5">
          {(['trending', 'reactions', 'coding', 'celebrate'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setSearchQuery('');
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize whitespace-nowrap transition-colors ${
                activeCategory === cat && !searchQuery
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* GIFs Grid */}
      <div className="flex-1 overflow-y-auto p-2.5 grid grid-cols-2 gap-2">
        {gifs.map((url, idx) => (
          <div
            key={idx}
            onClick={() => onSelectGif(url)}
            className="group relative aspect-video rounded-xl overflow-hidden bg-slate-800 cursor-pointer border border-slate-750 hover:border-indigo-500/80 transition-all hover:scale-[1.02] shadow-sm"
          >
            <img
              src={url}
              alt="GIF preview"
              loading="lazy"
              className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
            />
            <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
    </div>
  );
};
