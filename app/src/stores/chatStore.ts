import { create } from 'zustand';
import type { ChatMessage, ChatSession, ChatHistoryItem } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import api, { authFetch, API_URL } from '@/lib/api';

interface ChatState {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  models: string[];
  selectedModel: string | null;
  isLoadingModels: boolean;
  isStreaming: boolean;
  chatHistory: ChatHistoryItem[];
  sendMessage: (content: string) => Promise<void>;
  createSession: () => Promise<void>;
  selectSession: (session: ChatSession) => void;
  fetchModels: () => Promise<void>;
  setSelectedModel: (model: string) => void;
  fetchHistory: () => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<void>;
  submitFeedback: (id: string, feedback: 'up' | 'down' | null) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  models: [],
  selectedModel: null,
  isLoadingModels: false,
  isStreaming: false,
  chatHistory: [],

  fetchHistory: async () => {
    try {
      const response = await api.get('/ai/history');
      const chatHistory: ChatHistoryItem[] = (response.data.chatHistory || []).map(
        (h: { id: string; title: string; time: string; createdAt: string }) => ({
          id: h.id,
          title: h.title,
          time: h.time,
          createdAt: h.createdAt,
        }),
      );
      set({ chatHistory });
    } catch (error) {
      console.error('获取聊天历史失败:', error);
    }
  },

  sendMessage: async (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      isAI: false,
      createdAt: new Date().toISOString(),
    };

    const token = useAuthStore.getState().token;
    const selectedModel = get().selectedModel;

    set((state) => ({
      messages: [...state.messages, userMessage],
    }));

    if (!token) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: '请先登录再使用 AI 助手。',
        isAI: true,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({
        messages: [...state.messages, errorMessage],
      }));
      return;
    }

    if (!selectedModel) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: '未选择可用模型，请先刷新模型列表。',
        isAI: true,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({
        messages: [...state.messages, errorMessage],
      }));
      return;
    }

    // 创建一条空的 AI 占位消息，用于流式追加
    const aiMessageId = (Date.now() + 1).toString();
    const aiPlaceholder: ChatMessage = {
      id: aiMessageId,
      content: '',
      isAI: true,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      messages: [...state.messages, aiPlaceholder],
      isStreaming: true,
    }));

    try {
      const history = get()
        .messages.filter((m) => m.id !== aiMessageId)
        .map((message) => ({
          role: message.isAI ? ('assistant' as const) : ('user' as const),
          content: message.content,
        }));

      // 使用原生 fetch + ReadableStream 处理 SSE 流式响应
      const response = await authFetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: history,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'AI 回复失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.content) {
              set((state) => ({
                messages: state.messages.map((m) =>
                  m.id === aiMessageId ? { ...m, content: m.content + parsed.content } : m,
                ),
              }));
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (error) {
      // 如果占位消息仍为空，替换为错误信息；否则追加错误
      const errText = error instanceof Error && !/^(Request failed|Failed to fetch|Unexpected)/.test(error.message)
        ? error.message
        : 'AI 回复失败，请稍后再试';
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === aiMessageId
            ? { ...m, content: m.content || errText }
            : m,
        ),
      }));
    } finally {
      set({ isStreaming: false });
    }
  },

  createSession: async () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      sessions: [newSession, ...state.sessions],
      currentSession: newSession,
      messages: [],
    }));
  },

  selectSession: (session: ChatSession) => {
    set({
      currentSession: session,
      messages: session.messages,
    });
  },

  fetchModels: async () => {
    set({ isLoadingModels: true });
    try {
      const response = await api.get('/ai/models');
      const models = [...new Set<string>(response.data.models || [])];

      set((state) => {
        const selectedModel =
          state.selectedModel && models.includes(state.selectedModel)
            ? state.selectedModel
            : models[0] || null;
        return { models, selectedModel };
      });
    } catch (error) {
      console.error('获取模型失败:', error);
      set({ models: [], selectedModel: null });
    } finally {
      set({ isLoadingModels: false });
    }
  },

  setSelectedModel: (model: string) => {
    set({ selectedModel: model });
  },

  deleteHistoryItem: async (id: string) => {
    try {
      await api.delete(`/ai/history/${id}`);
      set((state) => ({
        chatHistory: state.chatHistory.filter((item) => item.id !== id),
        messages: state.messages.filter((m) => m.id !== id),
      }));
    } catch (error) {
      console.error('删除聊天记录失败:', error);
    }
  },

  submitFeedback: async (id: string, feedback: 'up' | 'down' | null) => {
    try {
      await api.patch(`/ai/history/${id}/feedback`, { feedback });
    } catch (error) {
      console.error('提交反馈失败:', error);
    }
  },
}));
