import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, User, ChevronDown, Mic, Paperclip } from 'lucide-react';
import { QUICK_AI_PROMPTS } from '../data/hanflixData';
import { usePandaPet } from './panda-pet';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  currentUser?: {
    name: string;
    learningProfile?: { hskLevel?: number; goal?: string; topics?: string[] } | null;
  } | null;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

const SUGGESTED_CHIPS = [
  '🔤 Giải thích từ vựng',
  '📐 Luyện ngữ pháp',
  '🗣️ Mẫu câu giao tiếp',
  '🎵 Phát âm chuẩn',
  '📝 Ví dụ thực tế',
];

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-end">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B91B1C] to-[#7F1D1D] flex items-center justify-center shrink-0 shadow-sm">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border border-[#E7E7EA] rounded-2xl rounded-bl-none px-4 py-3 shadow-xs">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-1.5 h-1.5 rounded-full bg-[#B91B1C]/60"
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AIAssistantDrawer({ isOpen, onClose, initialPrompt, currentUser }: AIAssistantDrawerProps) {
  const panda = usePandaPet();
  const greeting = `Chào ${currentUser?.name?.split(' ').pop() || 'bạn'}! 👋 Tôi là Panda AI. Bạn đang ở HSK ${currentUser?.learningProfile?.hskLevel || 3} (${currentUser?.learningProfile?.goal || 'Kinh doanh & Du lịch'}) — hãy hỏi tôi bất cứ điều gì về từ vựng, ngữ pháp hay bài học nhé!`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: greeting,
      time: 'Vừa xong',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    if (isOpen && initialPrompt && !sentInitial.current) {
      sentInitial.current = true;
      setTimeout(() => handleSend(initialPrompt), 100);
    }
    if (!isOpen) sentInitial.current = false;
  }, [isOpen, initialPrompt]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  };

  const handleSend = (textToSend?: string) => {
    const query = (textToSend ?? inputText).trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);
    panda?.handlePandaAIEvent({ type: 'thinking' });

    setTimeout(() => {
      let aiResponseText = '';
      if (query.includes('ngữ pháp') || query.includes('Giải thích') || query.includes('grammar')) {
        aiResponseText =
          'Cấu trúc "请 + 动词 + 一下" (Qǐng… yíxià) mang nghĩa lịch sự: "Xin vui lòng làm gì đó một chút".\n\n• 请等一下 — Xin chờ một chút\n• 请看一下 — Xin mời xem qua\n\nRất hữu ích khi dùng ở nhà hàng hoặc khách sạn! 🍜';
      } else if (query.includes('câu') || query.includes('Ví dụ') || query.includes('mẫu')) {
        aiResponseText =
          'Dưới đây là 3 câu luyện tập HSK 3 chủ đề Nhà hàng:\n\n1. 我要一份微辣的宫保鸡丁。\n   → Tôi muốn một phần gà Cung Bảo cay nhẹ.\n\n2. 请问服务员，洗手间在哪里？\n   → Xin hỏi, nhà vệ sinh ở đâu?\n\n3. 我们可以微信支付吗？\n   → Chúng tôi có thể thanh toán WeChat không?';
      } else if (query.includes('phát âm') || query.includes('Phát âm')) {
        aiResponseText =
          'Âm "qǐng" (请) — thanh 3, uốn lưỡi nhẹ, bật hơi.\nÂm "cài" (菜) — thanh 4, bật hơi mạnh hơn.\n\nMẹo: Thanh 3 thường "xuống rồi lên" như giọng nghi ngờ trong tiếng Việt. 🎵';
      } else {
        aiResponseText = `Đã ghi nhận: "${query}".\n\nTheo lộ trình HSK 3 của bạn, tôi khuyên xem tiếp bài "Đặt phòng khách sạn" — bạn sẽ tích lũy được 5 mẫu câu Du lịch thực dụng ngay! 🗺️`;
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiResponseText,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setIsTyping(false);
      setMessages((prev) => [...prev, aiMsg]);
      panda?.handlePandaAIEvent({ type: 'completed' });
    }, 1200 + Math.random() * 400);
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .ai-drawer { animation: slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; }
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #E7E7EA; border-radius: 4px; }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[440px] flex flex-col ai-drawer">
        {/* Glass-morphic container */}
        <div className="flex flex-col h-full bg-white/95 backdrop-blur-xl shadow-[0_0_60px_rgba(0,0,0,0.18)] border-l border-white/60">

          {/* Header */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#B91B1C] via-[#9B1516] to-[#6B0E0E]" />
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.3) 0%, transparent 60%)' }}
            />
            <div className="relative p-4 flex items-center gap-3">
              {/* AI Avatar */}
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shadow-inner">
                  <Sparkles className="w-5 h-5 text-white fill-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#B91B1C]" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-black text-white text-[15px] tracking-tight leading-none mb-0.5">
                  Trợ lý Panda AI
                </h3>
                <p className="text-white/70 text-[11px] font-medium">
                  {currentUser?.name || 'Học viên'} · HSK {currentUser?.learningProfile?.hskLevel || 3} · {currentUser?.learningProfile?.goal || 'Kinh doanh & Du lịch'}
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick chips */}
          <div className="px-3 py-2.5 bg-[#FDF1F1] border-b border-[#F0D4D4] no-scrollbar overflow-x-auto">
            <div className="flex gap-2 w-max">
              {SUGGESTED_CHIPS.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(chip.replace(/^[^\s]+\s/, ''))}
                  className="px-3 py-1.5 rounded-full bg-white border border-[#B91B1C]/20 text-[#B91B1C] text-[11px] font-semibold hover:bg-[#B91B1C] hover:text-white hover:border-[#B91B1C] transition-all duration-150 whitespace-nowrap shadow-xs"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-5 space-y-5 chat-scroll"
            style={{ background: 'linear-gradient(180deg, #F9F9FB 0%, #F4F4F7 100%)' }}
          >
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 items-end ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ animation: `slideUp 0.2s ease ${Math.min(idx * 0.05, 0.3)}s both` }}
              >
                {msg.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B91B1C] to-[#7F1D1D] flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div className={`group flex flex-col max-w-[82%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-br from-[#B91B1C] to-[#9B1516] text-white rounded-2xl rounded-br-sm'
                        : 'bg-white text-[#18181B] border border-[#E7E7EA]/80 rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-[#A0A3AB] mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {msg.time}
                  </span>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#18181B] flex items-center justify-center shrink-0 shadow-sm">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {isTyping && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Scroll to bottom btn */}
          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 h-7 px-3 bg-white border border-[#E7E7EA] rounded-full shadow-md text-[11px] font-semibold text-[#5F6368] flex items-center gap-1 hover:bg-[#F7F7F9] transition-all"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Tin nhắn mới
            </button>
          )}

          {/* Input area */}
          <div className="p-3 border-t border-[#E7E7EA]/80 bg-white/90 backdrop-blur-sm">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-end gap-2 bg-[#F4F4F7] rounded-2xl border border-[#E0E0E6] px-2 py-2 focus-within:border-[#B91B1C]/50 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(185,27,28,0.08)] transition-all duration-200"
            >
              <button
                type="button"
                title="Đính kèm tệp"
                className="p-1.5 rounded-lg text-[#A0A3AB] hover:text-[#5F6368] hover:bg-[#E7E7EA] transition-colors shrink-0"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                ref={inputRef}
                type="text"
                placeholder="Hỏi về từ vựng, ngữ pháp..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 px-2 py-1 text-[13px] text-[#18181B] bg-transparent outline-none placeholder:text-[#A0A3AB] min-h-[28px] resize-none"
              />
              <button
                type="button"
                title="Nhập bằng giọng nói"
                className="p-1.5 rounded-lg text-[#A0A3AB] hover:text-[#B91B1C] hover:bg-[#FDF1F1] transition-colors shrink-0"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="w-9 h-9 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] disabled:opacity-35 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0"
                aria-label="Gửi"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-center text-[10px] text-[#C0C3CA] mt-2">
              AI có thể mắc lỗi. Kiểm tra thông tin quan trọng.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
