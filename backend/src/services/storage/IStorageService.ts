/**
 * 存储服务接口
 * 定义文件上传、删除和获取 URL 的统一接口
 */
export interface IStorageService {
  /** 保存文件，返回存储 key/路径。prefix 用于指定存储子目录 */
  save(file: Express.Multer.File, prefix?: string): Promise<string>;

  /** 根据 key 删除文件 */
  delete(key: string): Promise<void>;

  /** 根据 key 获取文件的完整访问 URL */
  getUrl(key: string): string;
}
