import { PrismaClient } from '@prisma/client';
import { IStorageService } from './storage/IStorageService';

/** 资源创建参数 */
export interface CreateResourceInput {
  title: string;
  description: string;
  type: 'VIDEO' | 'DEMONSTRATION' | 'NOTEBOOK' | 'CASE' | 'HOMEWORK';
  url?: string;
  points: number;
  tags: string[];
  duration?: string;
  category?: string;
}

/** 资源更新参数 */
export interface UpdateResourceInput {
  title?: string;
  description?: string;
  type?: 'VIDEO' | 'DEMONSTRATION' | 'NOTEBOOK' | 'CASE' | 'HOMEWORK';
  url?: string;
  points?: number;
  tags?: string[];
  duration?: string;
  category?: string;
}

/** 资源列表查询参数 */
export interface ListResourcesQuery {
  type?: string;
  category?: string;
  tag?: string;
  search?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

/**
 * 资源业务逻辑层
 * 注入 PrismaClient 和 IStorageService
 */
export class ResourceService {
  constructor(
    private prisma: PrismaClient,
    private storageService: IStorageService,
  ) {}

  /** 获取资源列表（分页 + 筛选） */
  async findAll(query: ListResourcesQuery) {
    const {
      type,
      category,
      tag,
      search,
      sort = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 12,
    } = query;

    const where: Record<string, unknown> = {};

    if (type && type !== 'all') {
      where.type = type.toUpperCase();
    }
    if (category) {
      where.category = category;
    }
    if (tag && tag !== 'all' && tag !== '不限') {
      where.tags = { contains: tag };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ];
    }

    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const orderBy: Record<string, string> = {};
    if (sort === 'views') {
      orderBy.views = order;
    } else if (sort === 'points') {
      orderBy.points = order;
    } else {
      orderBy.createdAt = order;
    }

    const [resources, total] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.resource.count({ where }),
    ]);

    const resourcesWithParsedTags = resources.map((r) => ({
      ...r,
      tags: JSON.parse(r.tags || '[]'),
      author: r.author || r.owner?.name || r.owner?.email || '未知',
    }));

    return {
      resources: resourcesWithParsedTags,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /** 获取资源详情并增加浏览量 */
  async findById(id: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!resource) return null;

    await this.prisma.resource.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    return {
      ...resource,
      tags: JSON.parse(resource.tags || '[]'),
      author: resource.author || resource.owner?.name || resource.owner?.email || '未知',
    };
  }

  /** 创建资源（上传文件到 S3） */
  async create(
    data: CreateResourceInput,
    file: Express.Multer.File | undefined,
    user: { userId: string; name: string },
  ) {
    let fileKey: string | null = null;

    if (file) {
      fileKey = await this.storageService.save(file);
    }

    const resource = await this.prisma.resource.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        url: data.url,
        filePath: fileKey,
        points: data.points,
        tags: JSON.stringify(data.tags),
        duration: data.duration,
        author: user.name,
        ownerId: user.userId,
        category: data.category,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      ...resource,
      tags: data.tags,
      author: resource.author || resource.owner?.name || resource.owner?.email || '未知',
    };
  }

  /** 更新资源 */
  async update(id: string, data: UpdateResourceInput, userId: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });

    if (!resource) return { error: '资源不存在', status: 404 };
    if (resource.ownerId !== userId) return { error: '无权修改此资源', status: 403 };

    const updateData: Record<string, unknown> = { ...data };
    if (data.tags) {
      updateData.tags = JSON.stringify(data.tags);
    }

    const updatedResource = await this.prisma.resource.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      resource: {
        ...updatedResource,
        tags: JSON.parse(updatedResource.tags || '[]'),
        author: updatedResource.author || updatedResource.owner?.name || updatedResource.owner?.email || '未知',
      },
    };
  }

  /** 删除资源（同时删除 S3 文件） */
  async delete(id: string, userId: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });

    if (!resource) return { error: '资源不存在', status: 404 };
    if (resource.ownerId !== userId) return { error: '无权删除此资源', status: 403 };

    // 删除 S3 中的文件
    if (resource.filePath) {
      try {
        await this.storageService.delete(resource.filePath);
      } catch (err) {
        console.error('删除 S3 文件失败:', err);
      }
    }

    await this.prisma.resource.delete({ where: { id } });
    return { message: '资源删除成功' };
  }

  /** 记录资源浏览 */
  async recordView(resourceId: string, userId: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource) return { error: '资源不存在', status: 404 };

    await this.prisma.resourceView.create({
      data: { userId, resourceId },
    });

    await this.prisma.resource.update({
      where: { id: resourceId },
      data: { views: { increment: 1 } },
    });

    return { message: '浏览已记录' };
  }

  /** 收藏资源 */
  async bookmark(resourceId: string, userId: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource) return { error: '资源不存在', status: 404 };

    const existing = await this.prisma.resourceBookmark.findUnique({
      where: { userId_resourceId: { userId, resourceId } },
    });
    if (existing) return { error: '已收藏该资源', status: 400 };

    await this.prisma.resourceBookmark.create({
      data: { userId, resourceId },
    });
    return { message: '收藏成功' };
  }

  /** 取消收藏 */
  async removeBookmark(resourceId: string, userId: string) {
    await this.prisma.resourceBookmark.delete({
      where: { userId_resourceId: { userId, resourceId } },
    });
    return { message: '取消收藏成功' };
  }

  /** 获取用户收藏列表 */
  async getUserBookmarks(userId: string) {
    const bookmarks = await this.prisma.resourceBookmark.findMany({
      where: { userId },
      include: { resource: true },
      orderBy: { createdAt: 'desc' },
    });

    return bookmarks.map((b) => ({
      ...b.resource,
      tags: JSON.parse(b.resource.tags || '[]'),
    }));
  }

  /** 检查收藏状态 */
  async checkBookmark(resourceId: string, userId: string) {
    const bookmark = await this.prisma.resourceBookmark.findUnique({
      where: { userId_resourceId: { userId, resourceId } },
    });
    return !!bookmark;
  }
}
