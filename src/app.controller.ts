import { Controller, Get } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello(I18nContext.current()?.lang);
  }
}
