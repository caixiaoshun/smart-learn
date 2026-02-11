import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireTeacher } from '../middleware/auth';

const router = Router();

// 获取案例列表
router.get('/', async (req, res) => {
  try {
    const {
      category,
      theme,
      difficulty,
      search,
      sort = 'createdAt',
      order = 'desc',
      page = '1',
      limit = '12',
    } = req.query;

    const where: Record<string, unknown> = {};

    // 分类筛选
    if (category) {
      where.category = String(category);
    }

    // 主题筛选
    if (theme) {
      where.theme = { contains: String(theme) };
    }

    // 难度筛选
    if (difficulty) {
      where.difficulty = String(difficulty).toUpperCase();
    }

    // 搜索
    if (search) {
      where.OR = [
        { title: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
        { tags: { contains: String(search), mode: 'insensitive' } },
        { category: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    // 分页
    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));
    const skip = (pageNum - 1) * limitNum;

    // 排序
    const orderBy: Record<string, string> = {};
    if (sort === 'views') {
      orderBy.views = String(order);
    } else if (sort === 'rating') {
      orderBy.rating = String(order);
    } else if (sort === 'difficulty') {
      orderBy.difficulty = String(order);
    } else {
      orderBy.createdAt = String(order);
    }

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.case.count({ where }),
    ]);

    // 解析 JSON 字段
    const casesWithParsedFields = cases.map(c => ({
      ...c,
      theme: JSON.parse(c.theme || '[]'),
      tags: JSON.parse(c.tags || '[]'),
    }));

    res.json({
      cases: casesWithParsedFields,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('获取案例列表失败:', error);
    res.status(500).json({ error: '获取案例列表失败' });
  }
});

// 获取案例详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const caseData = await prisma.case.findUnique({
      where: { id },
    });

    if (!caseData) {
      return res.status(404).json({ error: '案例不存在' });
    }

    // 增加浏览量
    await prisma.case.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    res.json({
      case: {
        ...caseData,
        theme: JSON.parse(caseData.theme || '[]'),
        tags: JSON.parse(caseData.tags || '[]'),
      },
    });
  } catch (error) {
    console.error('获取案例详情失败:', error);
    res.status(500).json({ error: '获取案例详情失败' });
  }
});

// 创建案例（教师）
router.post('/', authenticate, requireTeacher, async (req, res) => {
  try {
    const schema = z.object({
      title: z.string().min(2, '标题至少2位').max(100, '标题最多100位'),
      description: z.string().min(10, '描述至少10位').max(1000, '描述最多1000字'),
      content: z.string().optional(),
      category: z.string().min(1, '分类不能为空'),
      theme: z.array(z.string()).min(1, '至少选择一个主题'),
      tags: z.array(z.string()).default([]),
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
      duration: z.number().int().min(1).max(100).default(2),
      codeExample: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const newCase = await prisma.case.create({
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
        category: data.category,
        theme: JSON.stringify(data.theme),
        tags: JSON.stringify(data.tags),
        difficulty: data.difficulty,
        duration: data.duration,
        codeExample: data.codeExample,
      },
    });

    res.status(201).json({
      message: '案例创建成功',
      case: {
        ...newCase,
        theme: data.theme,
        tags: data.tags,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('创建案例失败:', error);
    res.status(500).json({ error: '创建案例失败' });
  }
});

// 更新案例（教师）
router.put('/:id', authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      title: z.string().min(2).max(100).optional(),
      description: z.string().min(10).max(1000).optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      theme: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
      duration: z.number().int().min(1).max(100).optional(),
      codeExample: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const caseData = await prisma.case.findUnique({
      where: { id },
    });

    if (!caseData) {
      return res.status(404).json({ error: '案例不存在' });
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.theme) {
      updateData.theme = JSON.stringify(data.theme);
    }
    if (data.tags) {
      updateData.tags = JSON.stringify(data.tags);
    }

    const updatedCase = await prisma.case.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: '案例更新成功',
      case: {
        ...updatedCase,
        theme: JSON.parse(updatedCase.theme || '[]'),
        tags: JSON.parse(updatedCase.tags || '[]'),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('更新案例失败:', error);
    res.status(500).json({ error: '更新案例失败' });
  }
});

// 删除案例（教师）
router.delete('/:id', authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    const caseData = await prisma.case.findUnique({
      where: { id },
    });

    if (!caseData) {
      return res.status(404).json({ error: '案例不存在' });
    }

    await prisma.case.delete({ where: { id } });

    res.json({ message: '案例删除成功' });
  } catch (error) {
    console.error('删除案例失败:', error);
    res.status(500).json({ error: '删除案例失败' });
  }
});

// 收藏案例
router.post('/:id/bookmark', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const caseData = await prisma.case.findUnique({
      where: { id },
    });

    if (!caseData) {
      return res.status(404).json({ error: '案例不存在' });
    }

    // 检查是否已收藏
    const existing = await prisma.caseBookmark.findUnique({
      where: {
        userId_caseId: {
          userId: req.user!.userId,
          caseId: id,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: '已收藏该案例' });
    }

    await prisma.caseBookmark.create({
      data: {
        userId: req.user!.userId,
        caseId: id,
      },
    });

    res.json({ message: '收藏成功' });
  } catch (error) {
    console.error('收藏案例失败:', error);
    res.status(500).json({ error: '收藏案例失败' });
  }
});

// 取消收藏案例
router.delete('/:id/bookmark', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.caseBookmark.delete({
      where: {
        userId_caseId: {
          userId: req.user!.userId,
          caseId: id,
        },
      },
    });

    res.json({ message: '取消收藏成功' });
  } catch (error) {
    console.error('取消收藏案例失败:', error);
    res.status(500).json({ error: '取消收藏案例失败' });
  }
});

// 获取用户收藏的案例
router.get('/user/bookmarks', authenticate, async (req, res) => {
  try {
    const bookmarks = await prisma.caseBookmark.findMany({
      where: { userId: req.user!.userId },
      include: { case: true },
      orderBy: { createdAt: 'desc' },
    });

    const cases = bookmarks.map(b => ({
      ...b.case,
      theme: JSON.parse(b.case.theme || '[]'),
      tags: JSON.parse(b.case.tags || '[]'),
    }));

    res.json({ cases });
  } catch (error) {
    console.error('获取收藏案例失败:', error);
    res.status(500).json({ error: '获取收藏案例失败' });
  }
});

// 检查用户是否收藏了案例
router.get('/:id/bookmark/check', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const bookmark = await prisma.caseBookmark.findUnique({
      where: {
        userId_caseId: {
          userId: req.user!.userId,
          caseId: id,
        },
      },
    });

    res.json({ isBookmarked: !!bookmark });
  } catch (error) {
    console.error('检查收藏状态失败:', error);
    res.status(500).json({ error: '检查收藏状态失败' });
  }
});

// 为案例评分
router.post('/:id/rate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      rating: z.number().min(1).max(5),
    });

    const { rating } = schema.parse(req.body);

    const caseData = await prisma.case.findUnique({
      where: { id },
    });

    if (!caseData) {
      return res.status(404).json({ error: '案例不存在' });
    }

    // 简单的评分更新（实际应该维护评分记录表）
    // 这里使用简化的方式：新评分 = (旧评分 * 0.9) + (新评分 * 0.1)
    const newRating = caseData.rating * 0.9 + rating * 0.1;

    await prisma.case.update({
      where: { id },
      data: { rating: Math.round(newRating * 10) / 10 },
    });

    res.json({ message: '评分成功', rating: newRating });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('评分失败:', error);
    res.status(500).json({ error: '评分失败' });
  }
});

// 获取案例评论
router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await prisma.caseComment.findMany({
      where: { caseId: id },
      include: { user: { select: { id: true, name: true, avatar: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      comments: comments.map(c => ({
        id: c.id,
        userId: c.userId,
        username: c.user?.name || '匿名',
        avatar: c.user?.avatar,
        role: c.user?.role,
        content: c.content,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error('获取案例评论失败:', error);
    res.status(500).json({ error: '获取案例评论失败' });
  }
});

// 发表案例评论
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      content: z.string().min(1, '评论内容不能为空').max(2000, '评论不能超过2000字'),
    });
    const { content } = schema.parse(req.body);

    const caseData = await prisma.case.findUnique({ where: { id } });
    if (!caseData) {
      return res.status(404).json({ error: '案例不存在' });
    }

    const comment = await prisma.caseComment.create({
      data: {
        content,
        userId: req.user!.userId,
        caseId: id,
      },
      include: { user: { select: { id: true, name: true, avatar: true, role: true } } },
    });

    res.status(201).json({
      comment: {
        id: comment.id,
        userId: comment.userId,
        username: comment.user?.name || '匿名',
        avatar: comment.user?.avatar,
        role: comment.user?.role,
        content: comment.content,
        createdAt: comment.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('发表案例评论失败:', error);
    res.status(500).json({ error: '发表案例评论失败' });
  }
});

// 删除案例评论
router.delete('/:id/comments/:commentId', authenticate, async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await prisma.caseComment.findUnique({ where: { id: commentId } });
    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    // 只有评论作者或教师可以删除
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (comment.userId !== req.user!.userId && user?.role !== 'TEACHER') {
      return res.status(403).json({ error: '无权删除该评论' });
    }

    await prisma.caseComment.delete({ where: { id: commentId } });
    res.json({ message: '评论删除成功' });
  } catch (error) {
    console.error('删除案例评论失败:', error);
    res.status(500).json({ error: '删除案例评论失败' });
  }
});

export default router;
