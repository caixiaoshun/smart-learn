import { S3Client, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import path from 'path';
import { IStorageService } from './IStorageService';

/**
 * MinIO (S3 协议) 存储服务实现
 * 使用 @aws-sdk/client-s3 连接 MinIO 进行文件存储
 */
export class MinioStorageService implements IStorageService {
  private client: S3Client;
  private bucket: string;
  private endpoint: string;
  private bucketEnsured = false;

  constructor() {
    this.endpoint = process.env.S3_ENDPOINT || 'http://127.0.0.1:9000';
    this.bucket = process.env.S3_BUCKET_NAME || 'smart-learn';

    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;

    if (!accessKeyId || !secretAccessKey) {
      console.warn('S3_ACCESS_KEY 或 S3_SECRET_KEY 未配置，文件上传功能将不可用');
    }

    this.client = new S3Client({
      region: 'us-east-1', // MinIO 默认 region
      endpoint: this.endpoint,
      forcePathStyle: true, // 连接 MinIO 必须项
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });
  }

  /**
   * 确保 S3 Bucket 存在，不存在则自动创建
   */
  private async ensureBucket(): Promise<void> {
    if (this.bucketEnsured) return;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err: unknown) {
      const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (error.name === 'NotFound' || error.name === 'NoSuchBucket' || error.$metadata?.httpStatusCode === 404) {
        console.log(`Bucket "${this.bucket}" 不存在，正在自动创建...`);
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
          console.log(`Bucket "${this.bucket}" 创建成功`);
        } catch (createErr: unknown) {
          const ce = createErr as { name?: string };
          if (ce.name !== 'BucketAlreadyOwnedByYou' && ce.name !== 'BucketAlreadyExists') {
            throw createErr;
          }
        }
      } else {
        throw err;
      }
    }

    this.bucketEnsured = true;
  }

  /**
   * 使用流式上传将文件保存到 MinIO
   * @param prefix 存储子目录，默认 'resources'
   * @returns 存储的 key（对象名）
   */
  async save(file: Express.Multer.File, prefix: string = 'resources'): Promise<string> {
    await this.ensureBucket();

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const key = `${prefix}/${uniqueSuffix}${ext}`;

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    await upload.done();
    return key;
  }

  /**
   * 从 MinIO 删除文件
   */
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  /**
   * 获取文件的完整 HTTP URL
   */
  getUrl(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  /**
   * 获取带有时效限制的预签名 URL（默认 1 小时）
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
