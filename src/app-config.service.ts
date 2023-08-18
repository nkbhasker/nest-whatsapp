import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isNil } from 'lodash';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  private getString(key: string): string {
    return this.get(key);
  }

  get nodeEnv(): string {
    return this.getString('NODE_ENV').toUpperCase();
  }

  get mongoConfig() {
    return {
      uri: this.getString('MONGODB_URI'),
    };
  }

  get awsBaseConfig() {
    return {
      accessKeyId: this.getString('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.getString('AWS_SECRET_ACCESS_KEY'),
      region: this.getString('AWS_REGION'),
    };
  }

  get awsS3Config() {
    return {
      bucketName: this.getString('AWS_S3_BUCKET_NAME'),
    };
  }

  get appConfig() {
    return {
      port: this.getString('PORT'),
    };
  }

  get(key: string): string {
    const value = this.configService.get<string>(key);

    if (isNil(value)) {
      throw new TypeError(key + ' environment variable is not set');
    }

    return value;
  }
}
