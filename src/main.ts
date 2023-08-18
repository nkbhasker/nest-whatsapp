import { NestFactory } from '@nestjs/core';
import { AppConfigService } from './app-config.service';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(AppConfigService);
  const port = configService.get('PORT');

  app.enableShutdownHooks();

  await app.listen(port);
}
bootstrap();
