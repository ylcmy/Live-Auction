import { useState, useCallback } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string) => void;
}

export default function ChatInput({ onSend }: ChatInputProps) {
  const [content, setContent] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent('');
  }, [content, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md rounded-full px-4 py-2.5 flex-1 border border-white/20">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="说点什么..."
        className="bg-transparent text-white text-sm placeholder-white/50 outline-none flex-1 min-w-0"
      />
      <button
        onClick={handleSend}
        disabled={!content.trim()}
        className={`flex-shrink-0 p-1.5 rounded-full transition-all duration-200 ${
          content.trim()
            ? 'bg-white/25 text-white hover:bg-white/35'
            : 'bg-white/10 text-white/30 cursor-not-allowed'
        }`}
      >
        <Send className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
