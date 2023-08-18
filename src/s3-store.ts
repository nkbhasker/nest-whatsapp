import { Injectable } from '@nestjs/common';
import { createReadStream, createWriteStream } from 'fs';
import { MongooseError } from 'mongoose';
import { Readable } from 'stream';
import { AwsS3Service } from './aws-s3.service';

@Injectable()
export class AwsS3Store {
  constructor(private readonly awsS3Service: AwsS3Service) {}

  async sessionExists(options: { session: string }) {
    return this.awsS3Service.exists(`${options.session}.zip`);
  }

  async save(options: { session: string }) {
    const { writeStream, done } = this.awsS3Service.upload(
      `${options.session}.zip`,
    );
    createReadStream(`${options.session}.zip`).pipe(writeStream);
    await done;
  }

  async extract(options: { session: string; path: string }) {
    const stream = await this.awsS3Service.download(`${options.session}.zip`);
    const body = stream.Body as Readable;
    return new Promise<void>((resolve, reject) => {
      body
        .pipe(createWriteStream(options.path))
        .on('error', (err: MongooseError) => {
          reject(err);
        })
        .on('close', () => {
          resolve();
        });
    });
  }

  async delete(options: { session: string }) {
    return this.awsS3Service.delete(`${options.session}.zip`);
  }
}
