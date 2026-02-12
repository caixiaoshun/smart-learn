import { Router } from 'express';
import { z } from 'zod';
import { spawn } from 'child_process';
import { authenticate } from '../middleware/auth';
import { strictLimiter } from '../middleware/rateLimit';
import { prisma } from '../index';

const router = Router();

const SYSTEM_PROMPT = `你是一位专业的苏格拉底式AI教育助教，名字叫 EduBot。你的核心教学理念是启发式教学——通过提问引导学生独立思考，而不是直接给出答案。

你的行为准则：
1. 当学生提问时，先尝试用反问或提示引导他们自己发现答案。
2. 使用 Markdown 格式输出结构清晰的内容，善用标题、列表和代码块。
3. 对于数学和公式，使用 LaTeX 语法（行内用 $...$，独立公式用 $$...$$）。
4. 鼓励学生的每一次尝试，保持耐心和积极的态度。
5. 当学生明确需要帮助或多次尝试后仍无法解决时，给出清晰的解释和步骤。`;

const getAIConfig = () => {
  const baseUrl = process.env.AI_BASE_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('AI_BASE_URL 未配置');
  }
  return {
    baseUrl,
    apiKey: process.env.AI_API_KEY,
  };
};

const buildCurlHeaders = (apiKey?: string): string[] => {
  const headers = ['-H', 'Content-Type: application/json'];
  if (apiKey) {
    headers.push('-H', `Authorization: Bearer ${apiKey}`);
  }
  return headers;
};

const isEmbeddingModel = (modelId: string) => modelId.toLowerCase().includes('embedding');

// 获取模型列表
router.get('/models', authenticate, async (_req, res) => {
  try {
    const { baseUrl, apiKey } = getAIConfig();

    const curlArgs = [
      '-s', '-S',
      ...buildCurlHeaders(apiKey),
      '-w', '\n%{http_code}',
      `${baseUrl}/v1/models`,
    ];

    const { stdout, exitCode } = await new Promise<{ stdout: string; exitCode: number | null }>((resolve, reject) => {
      const proc = spawn('curl', curlArgs);
      let out = '';
      proc.stdout.on('data', (chunk: Buffer) => { out += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { console.error('curl stderr:', chunk.toString()); });
      proc.on('close', (code) => resolve({ stdout: out, exitCode: code }));
      proc.on('error', reject);
    });

    const lastNewline = stdout.lastIndexOf('\n');
    const body = lastNewline >= 0 ? stdout.substring(0, lastNewline) : stdout;
    const httpStatus = lastNewline >= 0 ? parseInt(stdout.substring(lastNewline + 1), 10) : 0;

    if (httpStatus >= 400 || exitCode !== 0) {
      let errorMessage = '获取模型列表失败';
      try {
        const errData = JSON.parse(body);
        errorMessage = errData?.error?.message || errorMessage;
      } catch {
        // body is not valid JSON
      }
      return res.status(httpStatus || 500).json({ error: errorMessage });
    }

    let data: any;
    try {
      data = JSON.parse(body);
    } catch {
      return res.status(500).json({ error: '获取模型列表失败' });
    }

    const models = (data?.data || [])
      .map((model: { id: string }) => model.id)
      .filter((id: string) => !isEmbeddingModel(id));

    res.json({ models });
  } catch (error: any) {
    console.error('获取模型列表失败:', error);
    res.status(500).json({ error: '获取模型列表失败' });
  }
});

// 流式聊天接口 (SSE)
router.post('/chat', authenticate, strictLimiter, async (req, res) => {
  try {
    const schema = z.object({
      model: z.string().min(1, '模型不能为空'),
      messages: z.array(
        z.object({
          role: z.enum(['system', 'user', 'assistant']),
          content: z.string().min(1),
        })
      ),
      context: z.string().optional(),
    });

    const { model, messages, context } = schema.parse(req.body);
    const userId = req.user?.id;

    if (isEmbeddingModel(model)) {
      return res.status(400).json({ error: '不支持 embedding 模型' });
    }

    // 插入系统提示词（含可选上下文）
    const systemContent = context
      ? `${SYSTEM_PROMPT}\n\n当前上下文信息：\n${context}`
      : SYSTEM_PROMPT;
    const messagesWithSystem = [
      { role: 'system' as const, content: systemContent },
      ...messages.filter((m) => m.role !== 'system'),
    ];

    const { baseUrl, apiKey } = getAIConfig();

    // 保存用户消息到数据库
    const lastUserMsg = messages[messages.length - 1];
    if (userId && lastUserMsg?.role === 'user') {
      await prisma.chatMessage.create({
        data: { userId, role: 'user', content: lastUserMsg.content },
      });
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const curlArgs = [
      '-s', '-S', '-N',
      '-X', 'POST',
      ...buildCurlHeaders(apiKey),
      '-d', JSON.stringify({
        model,
        messages: messagesWithSystem,
        temperature: 0.7,
        stream: true,
      }),
      `${baseUrl}/v1/chat/completions`,
    ];

    const curlProcess = spawn('curl', curlArgs);

    let fullContent = '';
    let buffer = '';
    let done = false;

    curlProcess.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          done = true;
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
        } catch {
          // skip malformed JSON chunks
        }
      }
    });

    curlProcess.on('close', async (code) => {
      if (res.writableEnded) return;
      try {
        // 保存 AI 回复到数据库
        if (userId && fullContent) {
          await prisma.chatMessage.create({
            data: { userId, role: 'assistant', content: fullContent },
          });
        }
      } catch (dbErr) {
        console.error('保存 AI 回复失败:', dbErr);
      }
      if (code !== 0 && !fullContent) {
        res.write(`data: ${JSON.stringify({ error: '流式传输中断' })}\n\n`);
      }
      if (!done) {
        res.write('data: [DONE]\n\n');
      }
      res.end();
    });

    curlProcess.stderr.on('data', (data: Buffer) => {
      console.error('curl stderr:', data.toString());
    });

    curlProcess.on('error', (err: Error) => {
      console.error('curl 进程错误:', err);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: 'AI 对话失败' })}\n\n`);
        res.end();
      }
    });

    // 客户端断开时清理
    req.on('close', () => {
      curlProcess.kill();
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('AI 对话失败:', error);
    // 如果还没发送过 SSE 头，返回 JSON 错误
    if (!res.headersSent) {
      res.status(500).json({ error: 'AI 对话失败' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'AI 对话失败' })}\n\n`);
      res.end();
    }
  }
});

// 获取聊天历史
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未认证' });
    }

    const parsedLimit = parseInt(String(req.query.limit), 10);
    const limit = Math.min(Number.isNaN(parsedLimit) ? 50 : parsedLimit, 200);

    const messages = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    // Group user messages by date for sidebar history
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const userMessages = messages.filter(m => m.role === 'user');
    const grouped: { id: string; title: string; time: string; createdAt: string }[] = [];
    for (const msg of userMessages) {
      const msgDate = new Date(msg.createdAt);
      let time: string;
      if (msgDate >= todayStart) time = '今天';
      else if (msgDate >= yesterdayStart) time = '昨天';
      else time = '更早';
      grouped.push({
        id: msg.id,
        title: msg.content.slice(0, 10) + (msg.content.length > 10 ? '...' : ''),
        time,
        createdAt: msg.createdAt.toISOString(),
      });
    }

    res.json({ messages, chatHistory: grouped });
  } catch (error) {
    console.error('获取聊天历史失败:', error);
    res.status(500).json({ error: '获取聊天历史失败' });
  }
});

// 删除单条聊天记录
router.delete('/history/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未认证' });
    }

    const { id } = req.params;

    // Verify ownership
    const message = await prisma.chatMessage.findFirst({
      where: { id, userId },
    });

    if (!message) {
      return res.status(404).json({ error: '消息不存在' });
    }

    await prisma.chatMessage.delete({ where: { id } });
    res.json({ message: '已删除' });
  } catch (error) {
    console.error('删除聊天记录失败:', error);
    res.status(500).json({ error: '删除聊天记录失败' });
  }
});

// 消息反馈（点赞/点踩）
router.patch('/history/:id/feedback', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未认证' });
    }

    const { id } = req.params;
    const schema = z.object({
      feedback: z.enum(['up', 'down']).nullable(),
    });
    const { feedback } = schema.parse(req.body);

    const result = await prisma.chatMessage.updateMany({
      where: { id, userId },
      data: { feedback },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: '消息不存在' });
    }

    res.json({ message: '反馈已保存', feedback });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('保存反馈失败:', error);
    res.status(500).json({ error: '保存反馈失败' });
  }
});

// 清空所有聊天记录
router.delete('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未认证' });
    }

    await prisma.chatMessage.deleteMany({ where: { userId } });
    res.json({ message: '聊天记录已清空' });
  } catch (error) {
    console.error('清空聊天记录失败:', error);
    res.status(500).json({ error: '清空聊天记录失败' });
  }
});

export default router;
