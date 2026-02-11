import { Request, Response } from 'express';
import { z } from 'zod';
import { ResourceService } from '../services/ResourceService';

/**
 * 资源控制器
 * 只负责处理 Request / Response，调用 ResourceService 完成业务逻辑
 */
export class ResourceController {
  constructor(private resourceService: ResourceService) {
    // 绑定 this，确保路由回调中 this 指向正确
    this.list = this.list.bind(this);
    this.getById = this.getById.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
    this.recordView = this.recordView.bind(this);
    this.bookmark = this.bookmark.bind(this);
    this.removeBookmark = this.removeBookmark.bind(this);
    this.getUserBookmarks = this.getUserBookmarks.bind(this);
    this.checkBookmark = this.checkBookmark.bind(this);
  }

  /** GET / - 获取资源列表 */
  async list(req: Request, res: Response) {
    try {
      const result = await this.resourceService.findAll({
        type: req.query.type as string | undefined,
        category: req.query.category as string | undefined,
        tag: req.query.tag as string | undefined,
        search: req.query.search as string | undefined,
        sort: (req.query.sort as string) || 'createdAt',
        order: (req.query.order as string) || 'desc',
        page: parseInt(String(req.query.page || '1')),
        limit: parseInt(String(req.query.limit || '12')),
      });

      res.json(result);
    } catch (error) {
      console.error('获取资源列表失败:', error);
      res.status(500).json({ error: '获取资源列表失败' });
    }
  }

  /** GET /:id - 获取资源详情 */
  async getById(req: Request, res: Response) {
    try {
      const resource = await this.resourceService.findById(req.params.id);
      if (!resource) {
        return res.status(404).json({ error: '资源不存在' });
      }
      res.json({ resource });
    } catch (error) {
      console.error('获取资源详情失败:', error);
      res.status(500).json({ error: '获取资源详情失败' });
    }
  }

  /** POST / - 创建资源 */
  async create(req: Request, res: Response) {
    try {
      const schema = z.object({
        title: z.string().min(2, '标题至少2位').max(100, '标题最多100位'),
        description: z.string().min(5, '描述至少5位').max(500, '描述最多500字'),
        type: z.enum(['VIDEO', 'DEMONSTRATION', 'NOTEBOOK', 'CASE', 'HOMEWORK']),
        url: z.string().url().optional(),
        points: z.number().int().min(0).max(1000).default(10),
        tags: z.array(z.string()).default([]),
        duration: z.string().optional(),
        category: z.string().optional(),
      });

      const body = {
        ...req.body,
        points: req.body.points ? parseInt(req.body.points) : 10,
        tags: req.body.tags ? JSON.parse(req.body.tags) : [],
      };

      const data = schema.parse(body);
      const file = req.file;

      const resource = await this.resourceService.create(
        data,
        file,
        { userId: req.user!.userId, name: req.user!.name },
      );

      res.status(201).json({ message: '资源创建成功', resource });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error('创建资源失败:', error);
      res.status(500).json({ error: '创建资源失败' });
    }
  }

  /** PUT /:id - 更新资源 */
  async update(req: Request, res: Response) {
    try {
      const schema = z.object({
        title: z.string().min(2).max(100).optional(),
        description: z.string().min(5).max(500).optional(),
        type: z.enum(['VIDEO', 'DEMONSTRATION', 'NOTEBOOK', 'CASE', 'HOMEWORK']).optional(),
        url: z.string().url().optional(),
        points: z.number().int().min(0).max(1000).optional(),
        tags: z.array(z.string()).optional(),
        duration: z.string().optional(),
        category: z.string().optional(),
      });

      const data = schema.parse(req.body);
      const result = await this.resourceService.update(req.params.id, data, req.user!.userId);

      if ('error' in result) {
        return res.status(result.status!).json({ error: result.error });
      }

      res.json({ message: '资源更新成功', resource: result.resource });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error('更新资源失败:', error);
      res.status(500).json({ error: '更新资源失败' });
    }
  }

  /** DELETE /:id - 删除资源 */
  async delete(req: Request, res: Response) {
    try {
      const result = await this.resourceService.delete(req.params.id, req.user!.userId);

      if ('error' in result) {
        return res.status(result.status!).json({ error: result.error });
      }

      res.json(result);
    } catch (error) {
      console.error('删除资源失败:', error);
      res.status(500).json({ error: '删除资源失败' });
    }
  }

  /** POST /:id/view - 记录资源浏览 */
  async recordView(req: Request, res: Response) {
    try {
      const result = await this.resourceService.recordView(req.params.id, req.user!.userId);

      if ('error' in result) {
        return res.status(result.status!).json({ error: result.error });
      }

      res.json(result);
    } catch (error) {
      console.error('记录浏览失败:', error);
      res.status(500).json({ error: '记录浏览失败' });
    }
  }

  /** POST /:id/bookmark - 收藏资源 */
  async bookmark(req: Request, res: Response) {
    try {
      const result = await this.resourceService.bookmark(req.params.id, req.user!.userId);

      if ('error' in result) {
        return res.status(result.status!).json({ error: result.error });
      }

      res.json(result);
    } catch (error) {
      console.error('收藏资源失败:', error);
      res.status(500).json({ error: '收藏资源失败' });
    }
  }

  /** DELETE /:id/bookmark - 取消收藏 */
  async removeBookmark(req: Request, res: Response) {
    try {
      const result = await this.resourceService.removeBookmark(req.params.id, req.user!.userId);
      res.json(result);
    } catch (error) {
      console.error('取消收藏资源失败:', error);
      res.status(500).json({ error: '取消收藏资源失败' });
    }
  }

  /** GET /user/bookmarks - 获取用户收藏 */
  async getUserBookmarks(req: Request, res: Response) {
    try {
      const resources = await this.resourceService.getUserBookmarks(req.user!.userId);
      res.json({ resources });
    } catch (error) {
      console.error('获取收藏资源失败:', error);
      res.status(500).json({ error: '获取收藏资源失败' });
    }
  }

  /** GET /:id/bookmark/check - 检查收藏状态 */
  async checkBookmark(req: Request, res: Response) {
    try {
      const isBookmarked = await this.resourceService.checkBookmark(req.params.id, req.user!.userId);
      res.json({ isBookmarked });
    } catch (error) {
      console.error('检查收藏状态失败:', error);
      res.status(500).json({ error: '检查收藏状态失败' });
    }
  }
}
