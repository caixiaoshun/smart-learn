import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { prisma } from '../index';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { id: string; name: string };
    }
  }
}

// 验证 JWT 令牌
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    // 验证用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, name: true },
    });

    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    req.user = { ...decoded, id: user.id, name: user.name };
    next();
  } catch (error) {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
};

// 验证教师身份
export const requireTeacher = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }
  if (req.user.role !== 'TEACHER') {
    return res.status(403).json({ error: '需要教师权限' });
  }
  next();
};

// 验证学生身份
export const requireStudent = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: '需要学生权限' });
  }
  next();
};
