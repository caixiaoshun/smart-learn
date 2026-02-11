import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// 缓存的邮件传输器
let cachedTransporter: Transporter | null = null;

// 获取发件人地址
const getFromAddress = (): string => {
  const fromName = process.env.SMTP_FROM_NAME || '智慧教育AI平台';
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@edu-platform.com';
  return `"${fromName}" <${fromEmail}>`;
};

// 创建邮件传输器（单例模式）
const getTransporter = async (): Promise<Transporter> => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  // 如果提供了 SMTP 凭据，使用它们
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = parseInt(process.env.SMTP_PORT || '587');
    // 使用 SMTP_SECURE 环境变量，如果未设置则根据端口自动判断 (465端口默认使用SSL)
    const secure = process.env.SMTP_SECURE !== undefined 
      ? process.env.SMTP_SECURE === 'true' 
      : port === 465;
    
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: port,
      secure: secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000, // 10秒连接超时
      socketTimeout: 30000, // 30秒socket超时
    });
  } else {
    // 开发模式：创建测试账户
    console.log('SMTP 凭据未配置，使用 Ethereal 测试账户...');
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  return cachedTransporter;
};

// 重置传输器（用于连接错误后重新创建）
const resetTransporter = (): void => {
  cachedTransporter = null;
};

// 发送验证码邮件
export const sendVerifyCodeEmail = async (email: string, code: string) => {
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const transporter = await getTransporter();

      const info = await transporter.sendMail({
        from: getFromAddress(),
        to: email,
        subject: '您的验证码',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563EB;">智慧教育AI平台</h2>
            <p>您好！</p>
            <p>您的验证码是：</p>
            <div style="background: #F3F4F6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
              ${code}
            </div>
            <p>验证码有效期为 10 分钟，请勿泄露给他人。</p>
            <p style="color: #6B7280; font-size: 12px;">如非本人操作，请忽略此邮件。</p>
          </div>
        `,
      });

      console.log('验证码邮件已发送:', nodemailer.getTestMessageUrl(info));
      return info;
    } catch (error) {
      lastError = error as Error;
      console.error(`发送邮件失败 (尝试 ${attempt}/${maxAttempts}):`, error);
      
      // 如果是连接相关错误，重置传输器并重试
      if (attempt < maxAttempts) {
        resetTransporter();
      }
    }
  }

  throw lastError || new Error('发送验证码邮件失败');
};

// 发送作业提醒邮件
export const sendHomeworkReminderEmail = async (
  email: string,
  studentName: string,
  homeworkTitle: string,
  deadline: Date,
  className: string
) => {
  const maxAttempts = 3;
  let lastError: Error | null = null;

  const deadlineStr = deadline.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const transporter = await getTransporter();

      const info = await transporter.sendMail({
        from: getFromAddress(),
        to: email,
        subject: `【作业提醒】${homeworkTitle} 即将截止`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563EB;">作业提醒</h2>
            <p>亲爱的 ${studentName} 同学：</p>
            <p>您班级 <strong>${className}</strong> 的作业 <strong>${homeworkTitle}</strong> 即将截止！</p>
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>截止时间：</strong>${deadlineStr}</p>
            </div>
            <p>您尚未提交此作业，请尽快完成并提交。</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/homeworks" 
               style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
              去提交作业
            </a>
            <p style="color: #6B7280; font-size: 12px; margin-top: 30px;">此邮件由系统自动发送，请勿回复。</p>
          </div>
        `,
      });

      console.log('提醒邮件已发送:', nodemailer.getTestMessageUrl(info));
      return info;
    } catch (error) {
      lastError = error as Error;
      console.error(`发送提醒邮件失败 (尝试 ${attempt}/${maxAttempts}):`, error);
      
      // 如果是连接相关错误，重置传输器并重试
      if (attempt < maxAttempts) {
        resetTransporter();
      }
    }
  }

  throw lastError || new Error('发送作业提醒邮件失败');
};

// 生成6位验证码
export const generateVerifyCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
