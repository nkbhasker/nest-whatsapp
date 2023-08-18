import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('client')
  createClient(@Body() body: { mobile: string }) {
    return this.appService.createClient(body);
  }
}
