import multer from 'multer';
import path from 'path';

// 使用内存存储，文件保存在内存中以便后续传给 S3
const storage = multer.memoryStorage();

// 文件过滤器 - 只允许 PDF 和 IPYNB
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ['application/pdf', 'application/x-ipynb+json'];
  const allowedExts = ['.pdf', '.ipynb'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传 PDF 或 Jupyter Notebook (.ipynb) 文件'));
  }
};

// 限制文件大小 (10MB)
const limits = {
  fileSize: 10 * 1024 * 1024,
  files: 5, // 最多5个文件
};

export const upload = multer({
  storage,
  fileFilter,
  limits,
});
