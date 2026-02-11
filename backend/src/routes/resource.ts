import { Router } from 'express';
import path from 'path';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireTeacher } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { MinioStorageService } from '../services/storage/MinioStorageService';
import { ResourceService } from '../services/ResourceService';
import { ResourceController } from '../controllers/ResourceController';

const router = Router();

// 实例化 Service / Controller
const storageService = new MinioStorageService();
const resourceService = new ResourceService(prisma, storageService);
const controller = new ResourceController(resourceService);

// 路由定义

// 获取用户收藏（需放在 /:id 之前，避免被匹配为 id）
router.get('/user/bookmarks', authenticate, controller.getUserBookmarks);

// 资源列表 & 详情
router.get('/', controller.list);
router.get('/:id', controller.getById);

// 创建 / 更新 / 删除（教师）
router.post('/', authenticate, requireTeacher, upload.single('file'), controller.create);
router.put('/:id', authenticate, requireTeacher, controller.update);
router.delete('/:id', authenticate, requireTeacher, controller.delete);

// 从作业提交创建资源（教师将优秀作业添加到资源中心）
router.post('/from-homework', authenticate, requireTeacher, async (req, res) => {
  try {
    const schema = z.object({
      title: z.string().min(2, '标题至少2位').max(100, '标题最多100位'),
      description: z.string().min(5, '描述至少5位').max(500, '描述最多500字'),
      homeworkId: z.string().cuid('作业ID格式不正确'),
      submissionId: z.string().cuid('提交ID格式不正确'),
      fileKey: z.string().min(1, '文件路径不能为空'),
      tags: z.array(z.string()).default([]),
      category: z.string().optional(),
    });

    const data = schema.parse(req.body);

    // 验证作业存在且属于该教师
    const homework = await prisma.homework.findUnique({
      where: { id: data.homeworkId },
      include: {
        class: true,
      },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (homework.class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权操作此作业' });
    }

    // 验证提交存在且属于该作业
    const submission = await prisma.submission.findUnique({
      where: { id: data.submissionId },
      include: {
        student: { select: { id: true, name: true } },
      },
    });

    if (!submission || submission.homeworkId !== data.homeworkId) {
      return res.status(404).json({ error: '提交不存在' });
    }

    // 验证文件属于该提交
    let files: string[] = [];
    try {
      const parsed = JSON.parse(submission.files || '[]');
      files = Array.isArray(parsed) ? parsed : [];
    } catch {
      return res.status(400).json({ error: '提交文件数据异常' });
    }
    if (!files.includes(data.fileKey)) {
      return res.status(400).json({ error: '文件不属于该提交' });
    }

    // 创建资源记录（复用已有的 MinIO 文件）
    const resource = await prisma.resource.create({
      data: {
        title: data.title,
        description: data.description,
        type: 'HOMEWORK',
        filePath: data.fileKey,
        points: 10,
        tags: JSON.stringify(data.tags),
        author: submission.student?.name || '学生作业',
        ownerId: req.user!.userId,
        category: data.category,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({
      message: '作业已添加到资源中心',
      resource: {
        ...resource,
        tags: data.tags,
        author: resource.author || resource.owner?.name || '未知',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('从作业创建资源失败:', error);
    res.status(500).json({ error: '添加到资源中心失败' });
  }
});

// 预览资源文件（返回预签名 URL）
router.get('/:id/preview', authenticate, async (req, res) => {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
    });

    if (!resource) {
      return res.status(404).json({ error: '资源不存在' });
    }

    if (!resource.filePath) {
      return res.status(404).json({ error: '该资源没有关联文件' });
    }

    const ext = path.extname(resource.filePath).toLowerCase();
    if (ext === '.pdf' || ext === '.ipynb') {
      const signedUrl = await storageService.getSignedUrl(resource.filePath);
      res.json({ url: signedUrl, fileType: ext.slice(1) });
    } else {
      res.status(400).json({ error: '不支持的文件格式' });
    }
  } catch (error) {
    console.error('预览资源文件失败:', error);
    res.status(500).json({ error: '预览资源文件失败' });
  }
});

// 浏览 & 收藏
router.post('/:id/view', authenticate, controller.recordView);
router.post('/:id/bookmark', authenticate, controller.bookmark);
router.delete('/:id/bookmark', authenticate, controller.removeBookmark);
router.get('/:id/bookmark/check', authenticate, controller.checkBookmark);

// 评论
router.get('/:id/comments', authenticate, async (req, res) => {
  try {
    const comments = await prisma.resourceComment.findMany({
      where: { resourceId: req.params.id },
      include: {
        user: { select: { id: true, name: true, avatar: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ comments });
  } catch (error) {
    console.error('获取评论失败:', error);
    res.status(500).json({ error: '获取评论失败' });
  }
});

router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      content: z.string().min(1, '评论不能为空').max(1000, '评论最多1000字'),
    });
    const { content } = schema.parse(req.body);

    const resource = await prisma.resource.findUnique({ where: { id: req.params.id } });
    if (!resource) {
      return res.status(404).json({ error: '资源不存在' });
    }

    const comment = await prisma.resourceComment.create({
      data: {
        content,
        userId: req.user!.userId,
        resourceId: req.params.id,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true, role: true } },
      },
    });
    res.status(201).json({ comment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('发表评论失败:', error);
    res.status(500).json({ error: '发表评论失败' });
  }
});

router.delete('/:id/comments/:commentId', authenticate, async (req, res) => {
  try {
    const comment = await prisma.resourceComment.findUnique({
      where: { id: req.params.commentId },
    });
    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }
    if (comment.userId !== req.user!.userId && req.user!.role !== 'TEACHER') {
      return res.status(403).json({ error: '无权删除此评论' });
    }
    await prisma.resourceComment.delete({ where: { id: req.params.commentId } });
    res.json({ message: '评论已删除' });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.status(500).json({ error: '删除评论失败' });
  }
});

export default router;
