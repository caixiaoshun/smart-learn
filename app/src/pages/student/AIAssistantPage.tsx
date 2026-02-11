import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  MessageSquare,
  Send,
  Mic,
  PlusCircle,
  RefreshCw,
  Trash2,
  Bot,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  Lightbulb,
  HelpCircle,
  Settings2,
  LayoutDashboard,
  BookOpen,
} from 'lucide-react';

const QUICK_PROMPTS = [
  { icon: Lightbulb, text: '解释行为数据图表？', color: 'text-blue-600' },
  { icon: HelpCircle, text: '生成练习题', color: 'text-purple-500' },
];

export function AIAssistantPage() {
  const { messages, sendMessage, models, selectedModel, fetchModels, setSelectedModel, isLoadingModels, isStreaming, fetchHistory, chatHistory, createSession, deleteHistoryItem, submitFeedback } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'up' | 'down'>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionDateLabel = useMemo(() => new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }), []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 加载模型列表和聊天历史
  useEffect(() => {
    fetchModels();
    fetchHistory();
  }, [fetchModels, fetchHistory]);

  // Handle prompt from URL query parameter
  useEffect(() => {
    const prompt = searchParams.get('prompt');
    if (prompt && selectedModel) {
      setInputValue(prompt);
      // Clear the prompt from URL to avoid re-triggering
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, selectedModel]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return;

    const content = inputValue;
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    await sendMessage(content);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const handleCopyMessage = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('复制失败');
    }
  }, []);

  const handleFeedback = useCallback((messageId: string, type: 'up' | 'down') => {
    const current = feedbackMap[messageId];
    const newFeedback = current === type ? null : type;
    if (newFeedback) {
      setFeedbackMap((prev) => ({ ...prev, [messageId]: newFeedback }));
    } else {
      setFeedbackMap((prev) => {
        const updated = { ...prev };
        delete updated[messageId];
        return updated;
      });
    }
    submitFeedback(messageId, newFeedback);
  }, [feedbackMap, submitFeedback]);

  const handleQuickPrompt = (text: string) => {
    setInputValue(text);
    textareaRef.current?.focus();
  };

  return (
    <div className="h-screen flex">
      {/* 左侧边栏 */}
      <aside className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white h-full shadow-sm z-10">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/20">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-slate-800 text-lg font-bold tracking-tight">智慧教育平台</h1>
          </div>
          <button
            onClick={() => createSession()}
            className="w-full flex items-center justify-center gap-2 rounded-lg h-11 bg-blue-600 hover:bg-blue-700 transition-colors text-white text-sm font-bold shadow-lg shadow-blue-600/20 group"
          >
            <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
            <span>新对话</span>
          </button>
        </div>

        {/* 导航链接 */}
        <div className="px-4 py-2 flex flex-col gap-1">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-sm font-medium">仪表盘</span>
          </button>
          <button
            onClick={() => navigate('/courses')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-sm font-medium">我的课程</span>
          </button>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-600/10">
            <Bot className="w-5 h-5" />
            <span className="text-sm font-medium">AI 助手</span>
          </div>
        </div>

        <div className="h-px bg-slate-200 mx-6 my-2" />

        {/* 搜索历史 */}
        <div className="px-4 py-2">
          <div className="relative group/search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within/search:text-blue-600" />
            <input
              type="text"
              placeholder="搜索对话..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border-none bg-blue-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-blue-600 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* 对话历史 */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
          {(['今天', '昨天', '更早'] as const).map((group) => {
            const items = chatHistory
              .filter((c) => c.time === group)
              .filter((c) => !searchQuery || c.title.includes(searchQuery));
            if (items.length === 0) return null;
            return (
              <div key={group} className="flex flex-col gap-1">
                <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{group}</h3>
                {items.map((chat) => (
                  <button
                    key={chat.id}
                    className="group flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-blue-50 transition-colors w-full text-left"
                  >
                    <MessageSquare className="w-5 h-5 text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-600 group-hover:text-slate-800 truncate">{chat.title}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHistoryItem(chat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>
                ))}
              </div>
            );
          })}
          {chatHistory.length === 0 && (
            <p className="text-xs text-slate-400 px-3 mt-2">暂无对话历史</p>
          )}
        </div>

        {/* 用户信息 */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-blue-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm border border-slate-200">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">{user?.name || '用户'}</p>
              <p className="text-xs text-slate-400">{user?.role === 'TEACHER' ? '教师账号' : '学生账号'}</p>
            </div>
            <Settings2 className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </aside>

      {/* 右侧聊天区域 */}
      <main className="flex-1 flex flex-col h-full bg-[#f0f4fa] relative">
        {/* 顶部标题 */}
        <header className="flex-shrink-0 h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
              <Bot className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h2 className="text-slate-800 text-base font-bold leading-none">EduBot 助手</h2>
              <span className="text-xs text-green-600 font-medium">在线 · 个性化学习</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedModel || ''}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isLoadingModels || models.length === 0}
              className="text-sm text-slate-700 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {models.length === 0 ? (
                <option value="">暂无可用模型</option>
              ) : (
                models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))
              )}
            </select>
            <button
              onClick={fetchModels}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              disabled={isLoadingModels}
              title="刷新模型"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingModels ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => fetchHistory()}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="历史记录"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="设置"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 消息区域 */}
        <ScrollArea className="flex-1 p-4 sm:p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* 时间戳 */}
            <div className="flex justify-center">
              <span className="text-xs font-medium text-slate-500 bg-blue-50 border border-slate-200 px-3 py-1 rounded-full">
                {sessionDateLabel}
              </span>
            </div>

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.isAI ? '' : 'flex-row-reverse'} max-w-3xl ${message.isAI ? '' : 'ml-auto'}`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border shadow-sm ${
                  message.isAI
                    ? 'bg-blue-600/10 border-blue-600/20'
                    : 'bg-white border-slate-200 overflow-hidden'
                }`}>
                  {message.isAI ? (
                    <Bot className="w-5 h-5 text-blue-600" />
                  ) : (
                    <span className="text-sm font-bold text-blue-600">
                      {user?.name?.charAt(0) || 'U'}
                    </span>
                  )}
                </div>

                <div className={`flex flex-col gap-2 flex-1 ${message.isAI ? '' : 'items-end'}`}>
                  <div className={`flex items-baseline gap-2 ${message.isAI ? '' : 'flex-row-reverse'}`}>
                    <span className="text-sm font-bold text-slate-800">
                      {message.isAI ? 'EduBot' : '你'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(message.createdAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div
                    className={`text-sm leading-relaxed ${
                      message.isAI
                        ? 'bg-white text-slate-700 p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm'
                        : 'bg-blue-600 text-white p-4 rounded-2xl rounded-tr-none shadow-md shadow-blue-500/20'
                    }`}
                  >
                    {message.isAI ? (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                        <MarkdownRenderer content={message.content} />
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>

                  {/* AI 消息操作按钮 */}
                  {message.isAI && message.content && (
                    <div className="flex items-center gap-2 ml-1">
                      <button
                        onClick={() => handleFeedback(message.id, 'up')}
                        className={`p-1 transition-colors ${feedbackMap[message.id] === 'up' ? 'text-green-600' : 'text-slate-400 hover:text-green-600'}`}
                        title="有帮助"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleFeedback(message.id, 'down')}
                        className={`p-1 transition-colors ${feedbackMap[message.id] === 'down' ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                        title="无帮助"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCopyMessage(message.id, message.content)}
                        className="p-1 text-slate-400 hover:text-slate-700 transition-colors ml-auto flex items-center gap-1 text-xs"
                        title="复制"
                      >
                        {copiedId === message.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        <span>{copiedId === message.id ? '已复制' : '复制'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && !isStreaming && (
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center border border-blue-600/20 shadow-sm">
                  <Bot className="w-5 h-5 text-blue-600" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* 输入区域 */}
        <div className="p-4 sm:p-6 bg-[#f0f4fa] relative z-20">
          <div className="max-w-4xl mx-auto relative">
            {/* 快捷提示词 */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => handleQuickPrompt(prompt.text)}
                  className="flex-shrink-0 px-3 py-1.5 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg text-xs text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <prompt.icon className={`w-4 h-4 ${prompt.color}`} />
                  {prompt.text}
                </button>
              ))}
            </div>

            <div className="relative flex items-end gap-2 bg-white p-2 rounded-xl ring-1 ring-slate-200 focus-within:ring-blue-600 shadow-xl shadow-blue-900/5 transition-shadow">
              <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0">
                <PlusCircle className="w-6 h-6" />
              </button>
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="询问关于课程的问题，上传文档，或请求数据分析..."
                rows={1}
                className="w-full bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-400 resize-none py-3 max-h-32 text-base focus:outline-none"
              />
              <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0">
                <Mic className="w-6 h-6" />
              </button>
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading || isStreaming || !selectedModel}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex-shrink-0 shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-center text-[11px] text-slate-400 mt-3 opacity-80">
              AI 可能会犯错。请核对重要信息。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
