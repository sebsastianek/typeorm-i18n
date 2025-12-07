import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { I18nLanguageService } from './i18n-language.service';
import { I18nModuleOptions, I18N_MODULE_OPTIONS } from './types';

/**
 * Interceptor that extracts the language from the request and sets it
 * in the I18nLanguageService for the current request scope.
 *
 * Apply this globally or per-controller to enable automatic language detection.
 *
 * @example
 * ```typescript
 * // Apply globally in main.ts
 * const app = await NestFactory.create(AppModule);
 * app.useGlobalInterceptors(app.get(I18nLanguageInterceptor));
 *
 * // Or apply per-controller
 * @UseInterceptors(I18nLanguageInterceptor)
 * @Controller('products')
 * export class ProductController {}
 * ```
 */
@Injectable()
export class I18nLanguageInterceptor implements NestInterceptor {
  constructor(
    private readonly languageService: I18nLanguageService,
    @Inject(I18N_MODULE_OPTIONS)
    private readonly options: I18nModuleOptions,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    let language: string | null = null;

    // Use custom resolver if provided
    if (this.options.resolveLanguage) {
      language = await this.options.resolveLanguage(request);
    }

    // Fallback to default language
    if (!language) {
      language = this.options.defaultLanguage;
    }

    this.languageService.setLanguage(language);

    return next.handle();
  }
}
