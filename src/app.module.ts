import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigService } from './app-config.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AwsS3Service } from './aws-s3.service';
import { MongoStore } from './mongo-store';
import { AwsS3Store } from './s3-store';
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [AppModule],
      useFactory: (appConfigService: AppConfigService) => ({
        ...appConfigService.mongoConfig,
      }),
      inject: [AppConfigService],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppConfigService,
    AppService,
    AwsS3Service,
    AwsS3Store,
    MongoStore,
  ],
  exports: [AppConfigService],
})
export class AppModule {}
