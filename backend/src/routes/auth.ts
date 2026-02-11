import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../index';
import { generateToken } from '../utils/jwt';
import { generateVerifyCode, sendVerifyCodeEmail } from '../utils/email';
import { authenticate } from '../middleware/auth';
import { strictLimiter } from '../middleware/rateLimit';

const router = Router();

// 验证码尝试次数跟踪（内存存储）
const verifyAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_VERIFY_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10分钟窗口

function isAttemptsExceeded(email: string): boolean {
  const now = Date.now();
  const record = verifyAttempts.get(email);

  if (!record) return false;

  // 过期的记录自动清理
  if ((now - record.lastAttempt) >= ATTEMPT_WINDOW_MS) {
    verifyAttempts.delete(email);
    return false;
  }

  return record.count >= MAX_VERIFY_ATTEMPTS;
}

function recordFailedAttempt(email: string): void {
  const now = Date.now();
  const record = verifyAttempts.get(email);

  if (record && (now - record.lastAttempt) < ATTEMPT_WINDOW_MS) {
    record.count += 1;
    record.lastAttempt = now;
  } else {
    verifyAttempts.set(email, { count: 1, lastAttempt: now });
  }
}

function resetAttempts(email: string): void {
  verifyAttempts.delete(email);
}

// 发送验证码请求体验证
const sendCodeSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  type: z.enum(['register', 'login', 'reset']).default('register'),
});

// 注册请求体验证
const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  code: z.string().length(6, '验证码为6位数字'),
  password: z.string().min(8, '密码至少8位').max(32, '密码最多32位'),
  name: z.string().min(2, '姓名至少2位').max(20, '姓名最多20位'),
  role: z.enum(['TEACHER', 'STUDENT']),
});

// 登录请求体验证
const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().optional(),
  code: z.string().length(6, '验证码为6位数字').optional(),
}).refine((data) => data.password || data.code, {
  message: '请提供密码或验证码',
  path: ['password'],
});

// 重置密码请求体验证
const resetPasswordSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  code: z.string().length(6, '验证码为6位数字'),
  newPassword: z.string().min(8, '密码至少8位').max(32, '密码最多32位'),
});

// 发送验证码
router.post('/send-code', strictLimiter, async (req, res) => {
  try {
    const { email, type } = sendCodeSchema.parse(req.body);

    // 检查邮箱是否已注册（注册时）
    // 只有当用户完成了注册（有密码和姓名）才算已注册
    if (type === 'register') {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser && existingUser.password && existingUser.name) {
        return res.status(400).json({ error: '该邮箱已注册' });
      }
    }

    // 检查邮箱是否存在（登录/重置时）
    // 只有当用户完成了注册（有密码和姓名）才算存在
    if (type === 'login' || type === 'reset') {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (!existingUser || !existingUser.password || !existingUser.name) {
        return res.status(400).json({ error: '该邮箱未注册' });
      }
    }

    // 生成验证码
    const code = generateVerifyCode();
    const expireTime = new Date(Date.now() + 10 * 60 * 1000); // 10分钟有效

    // 先发送邮件，成功后再存储验证码（避免邮件发送失败时验证码已入库）
    await sendVerifyCodeEmail(email, code);

    // 邮件发送成功后，创建临时用户记录或更新验证码
    await prisma.user.upsert({
      where: { email },
      update: {
        verifyCode: code,
        verifyCodeExpire: expireTime,
      },
      create: {
        email,
        verifyCode: code,
        verifyCodeExpire: expireTime,
        password: '', // 临时占位
        name: '',
        role: 'STUDENT',
      },
    });

    res.json({ message: '验证码已发送', expireIn: 600 }); // 600秒 = 10分钟
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('发送验证码失败:', error);
    res.status(500).json({ error: '发送验证码失败' });
  }
});

// 注册
router.post('/register', strictLimiter, async (req, res) => {
  try {
    const { email, code, password, name, role } = registerSchema.parse(req.body);

    // 检查验证码尝试次数是否超限
    if (isAttemptsExceeded(email)) {
      return res.status(429).json({ error: '验证码错误次数过多，请重新获取验证码' });
    }

    // 验证验证码
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.verifyCode || user.verifyCode !== code) {
      recordFailedAttempt(email);
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    if (!user.verifyCodeExpire || user.verifyCodeExpire < new Date()) {
      return res.status(400).json({ error: '验证码已过期' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        name,
        role,
        verifyCode: null,
        verifyCodeExpire: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    // 生成 JWT
    const token = generateToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    // 注册成功后重置尝试次数
    resetAttempts(email);

    res.json({
      message: '注册成功',
      token,
      user: updatedUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 登录
router.post('/login', strictLimiter, async (req, res) => {
  try {
    const { email, password, code } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    // 只有当用户完成了注册（有密码和姓名）才能登录
    if (!user || !user.password || !user.name) {
      return res.status(400).json({ error: '该邮箱未注册' });
    }

    // 验证码登录
    if (code) {
      // 检查验证码尝试次数是否超限
      if (isAttemptsExceeded(email)) {
        return res.status(429).json({ error: '验证码错误次数过多，请重新获取验证码' });
      }
      if (!user.verifyCode || user.verifyCode !== code) {
        recordFailedAttempt(email);
        return res.status(400).json({ error: '验证码错误' });
      }
      if (!user.verifyCodeExpire || user.verifyCodeExpire < new Date()) {
        return res.status(400).json({ error: '验证码已过期' });
      }
    }
    // 密码登录
    else if (password) {
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(400).json({ error: '密码错误' });
      }
    }

    // 清除验证码
    await prisma.user.update({
      where: { email },
      data: {
        verifyCode: null,
        verifyCodeExpire: null,
      },
    });

    // 登录成功后重置尝试次数
    resetAttempts(email);

    // 生成 JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // 获取用户的班级信息
    const userWithClasses = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        classMemberships: {
          include: {
            class: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        classes: userWithClasses?.classMemberships.map(m => m.class) || [],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 重置密码
router.post('/reset-password', strictLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = resetPasswordSchema.parse(req.body);

    // 检查验证码尝试次数是否超限
    if (isAttemptsExceeded(email)) {
      return res.status(429).json({ error: '验证码错误次数过多，请重新获取验证码' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: '该邮箱未注册' });
    }

    if (!user.verifyCode || user.verifyCode !== code) {
      recordFailedAttempt(email);
      return res.status(400).json({ error: '验证码错误' });
    }

    if (!user.verifyCodeExpire || user.verifyCodeExpire < new Date()) {
      return res.status(400).json({ error: '验证码已过期' });
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        verifyCode: null,
        verifyCodeExpire: null,
      },
    });

    // 重置成功后清除尝试次数
    resetAttempts(email);

    res.json({ message: '密码重置成功' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('重置密码失败:', error);
    res.status(500).json({ error: '重置密码失败' });
  }
});

// 获取当前用户信息
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        bio: true,
        preferences: true,
        classMemberships: {
          include: {
            class: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const { classMemberships, preferences, ...rest } = user;
    res.json({
      user: {
        ...rest,
        preferences: (() => { try { return preferences ? JSON.parse(preferences) : null; } catch { return null; } })(),
        classes: classMemberships.map(m => m.class),
      },
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 更新用户资料请求体验证
const updateProfileSchema = z.object({
  name: z.string().min(2, '姓名至少2位').max(20, '姓名最多20位').optional(),
  avatar: z.string().url('头像URL格式不正确').optional().nullable(),
  bio: z.string().max(200, '个人简介最多200字').optional().nullable(),
});

// 更新密码请求体验证
const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(8, '新密码至少8位').max(32, '新密码最多32位'),
});

// 更新用户资料
router.put('/profile', authenticate, async (req, res) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
        ...(data.bio !== undefined && { bio: data.bio }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        bio: true,
        classMemberships: {
          include: {
            class: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const { classMemberships: updatedMemberships, ...rest } = updatedUser;
    res.json({
      message: '资料更新成功',
      user: {
        ...rest,
        classes: updatedMemberships.map(m => m.class),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('更新资料失败:', error);
    res.status(500).json({ error: '更新资料失败' });
  }
});

// 更新密码
router.put('/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = updatePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证当前密码
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ error: '当前密码错误' });
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { password: hashedPassword },
    });

    res.json({ message: '密码更新成功' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('更新密码失败:', error);
    res.status(500).json({ error: '更新密码失败' });
  }
});

// 获取/更新用户偏好设置
router.patch('/preferences', authenticate, async (req, res) => {
  try {
    const preferencesSchema = z.object({
      system_notification: z.boolean().optional(),
      course_notification: z.boolean().optional(),
      points_notification: z.boolean().optional(),
      ai_notification: z.boolean().optional(),
      public_progress: z.boolean().optional(),
      public_case_lib: z.boolean().optional(),
    });

    const prefs = preferencesSchema.parse(req.body);

    // Merge with existing preferences
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { preferences: true },
    });

    const existing = (() => { try { return user?.preferences ? JSON.parse(user.preferences) : {}; } catch { return {}; } })();
    const merged = { ...existing, ...prefs };

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { preferences: JSON.stringify(merged) },
      select: { preferences: true },
    });

    const result = (() => { try { return JSON.parse(updatedUser.preferences || '{}'); } catch { return {}; } })();
    res.json({ message: '偏好设置已更新', preferences: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('更新偏好设置失败:', error);
    res.status(500).json({ error: '更新偏好设置失败' });
  }
});

// 获取用户偏好设置
router.get('/preferences', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { preferences: true },
    });

    const defaults = {
      system_notification: true,
      course_notification: true,
      points_notification: false,
      ai_notification: true,
      public_progress: true,
      public_case_lib: false,
    };

    const prefs = (() => { try { return user?.preferences ? { ...defaults, ...JSON.parse(user.preferences) } : defaults; } catch { return defaults; } })();
    res.json({ preferences: prefs });
  } catch (error) {
    console.error('获取偏好设置失败:', error);
    res.status(500).json({ error: '获取偏好设置失败' });
  }
});

// 注销账号（删除用户及所有关联数据）
router.delete('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;

    // Get teacher's classes to delete their homeworks/submissions first
    const teacherClasses = await prisma.class.findMany({
      where: { teacherId: userId },
      select: { id: true },
    });
    const teacherClassIds = teacherClasses.map(c => c.id);

    // Delete user and cascading relations
    await prisma.$transaction([
      // Delete submissions for homeworks in teacher's classes
      ...(teacherClassIds.length > 0 ? [
        prisma.submission.deleteMany({ where: { homework: { classId: { in: teacherClassIds } } } }),
        prisma.homework.deleteMany({ where: { classId: { in: teacherClassIds } } }),
        prisma.classStudent.deleteMany({ where: { classId: { in: teacherClassIds } } }),
        prisma.class.deleteMany({ where: { teacherId: userId } }),
      ] : []),
      prisma.chatMessage.deleteMany({ where: { userId } }),
      prisma.submission.deleteMany({ where: { studentId: userId } }),
      prisma.resourceBookmark.deleteMany({ where: { userId } }),
      prisma.caseBookmark.deleteMany({ where: { userId } }),
      prisma.behaviorLog.deleteMany({ where: { studentId: userId } }),
      prisma.intervention.deleteMany({ where: { OR: [{ studentId: userId }, { teacherId: userId }] } }),
      prisma.classStudent.deleteMany({ where: { studentId: userId } }),
      prisma.resource.deleteMany({ where: { ownerId: userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    res.json({ message: '账号已注销' });
  } catch (error) {
    console.error('注销账号失败:', error);
    res.status(500).json({ error: '注销账号失败' });
  }
});

// 上传头像
router.post('/avatar', authenticate, async (req, res) => {
  try {
    // We'll accept a base64-encoded image from the request body
    const schema = z.object({
      avatar: z.string().min(1, '头像数据不能为空'),
    });

    const { avatar } = schema.parse(req.body);

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { avatar },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
      },
    });

    res.json({ message: '头像更新成功', user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('上传头像失败:', error);
    res.status(500).json({ error: '上传头像失败' });
  }
});

export default router;
