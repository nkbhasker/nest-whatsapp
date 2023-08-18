import * as fs from 'fs';
import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, MongooseError, mongo } from 'mongoose';

@Injectable()
export class MongoStore {
  constructor(@InjectConnection() private connection: Connection) {}

  async sessionExists(options: { session: string }) {
    const multiDeviceCollection = this.connection.db.collection(
      `whatsapp-${options.session}.files`,
    );
    const hasExistingSession = await multiDeviceCollection.countDocuments();
    return !!hasExistingSession;
  }

  async save(options: { session: string }) {
    const bucket = new mongo.GridFSBucket(this.connection.db, {
      bucketName: `whatsapp-${options.session}`,
    });
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(`${options.session}.zip`)
        .pipe(bucket.openUploadStream(`${options.session}.zip`))
        .on('error', (err: MongooseError) => reject(err))
        .on('close', () => resolve());
    });

    await this.#deletePrevious(options, bucket);
  }

  async extract(options: { session: string; path: string }) {
    const bucket = new mongo.GridFSBucket(this.connection.db, {
      bucketName: `whatsapp-${options.session}`,
    });
    return new Promise<void>((resolve, reject) => {
      bucket
        .openDownloadStreamByName(`${options.session}.zip`)
        .pipe(fs.createWriteStream(options.path))
        .on('error', (err: MongooseError) => {
          reject(err);
        })
        .on('close', () => {
          resolve();
        });
    });
  }

  async delete(options: { session: string }) {
    const bucket = new mongo.GridFSBucket(this.connection.db, {
      bucketName: `whatsapp-${options.session}`,
    });
    const documents = await bucket
      .find({
        filename: `${options.session}.zip`,
      })
      .toArray();

    documents.map(async (doc) => {
      return bucket.delete(doc._id);
    });
  }

  async #deletePrevious(
    options: { session: string },
    bucket: mongo.GridFSBucket,
  ) {
    const documents = await bucket
      .find({
        filename: `${options.session}.zip`,
      })
      .toArray();
    if (documents.length > 1) {
      const oldSession = documents.reduce((a, b) =>
        a.uploadDate < b.uploadDate ? a : b,
      );
      return bucket.delete(oldSession._id);
    }
  }
}
