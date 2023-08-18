import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Injectable } from '@nestjs/common';
import { PassThrough } from 'stream';
import { AppConfigService } from './app-config.service';

@Injectable()
export class AwsS3Service {
  private readonly s3Clinet: S3Client;

  constructor(private appConfigService: AppConfigService) {
    const { region, accessKeyId, secretAccessKey } =
      this.appConfigService.awsBaseConfig;
    this.s3Clinet = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  upload(key: string) {
    const pass = new PassThrough();
    const upload = new Upload({
      client: this.s3Clinet,
      params: {
        Bucket: this.appConfigService.awsS3Config.bucketName,
        Key: key,
        Body: pass,
      },
    });

    return {
      writeStream: pass,
      done: upload.done(),
    };
  }

  async exists(key: string) {
    try {
      const { $metadata } = await this.s3Clinet.send(
        new HeadObjectCommand({
          Bucket: this.appConfigService.awsS3Config.bucketName,
          Key: key,
        }),
      );
      return $metadata.httpStatusCode === 200;
    } catch (error) {
      if (error instanceof S3ServiceException) {
        return !(error.$metadata.httpStatusCode === 404);
      } else {
        throw error;
      }
    }
  }

  download(key: string) {
    return this.s3Clinet.send(
      new GetObjectCommand({
        Bucket: this.appConfigService.awsS3Config.bucketName,
        Key: key,
      }),
    );
  }

  delete(key: string) {
    return this.s3Clinet.send(
      new DeleteObjectCommand({
        Bucket: this.appConfigService.awsS3Config.bucketName,
        Key: key,
      }),
    );
  }
}
