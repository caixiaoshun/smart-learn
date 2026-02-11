import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('错误: 生产环境必须设置 JWT_SECRET 环境变量！');
  process.exit(1);
} else if (!JWT_SECRET) {
  console.warn('警告: JWT_SECRET 环境变量未设置，使用默认密钥。请勿在生产环境中使用！');
}
const SECRET = JWT_SECRET || 'dev-secret-key-not-for-production';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, SECRET) as JwtPayload;
};
