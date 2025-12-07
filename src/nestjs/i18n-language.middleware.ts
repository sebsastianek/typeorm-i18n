import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { I18nLanguageService } from './i18n-language.service';
import { I18nModuleOptions, I18N_MODULE_OPTIONS } from './types';

/**
 * Middleware that extracts the language from the request and sets it
 * in the I18nLanguageService BEFORE dependency injection resolves repositories.
 *
 * This middleware must be applied to run before your routes so that
 * request-scoped I18n repositories have the correct language set.
 *
 * @example
 * ```typescript
 * // app.module.ts
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer
 *       .apply(I18nLanguageMiddleware)
 *       .forRoutes('*');
 *   }
 * }
 * ```
 */
@Injectable()
export class I18nLanguageMiddleware implements NestMiddleware {
  constructor(
    private readonly languageService: I18nLanguageService,
    @Inject(I18N_MODULE_OPTIONS)
    private readonly options: I18nModuleOptions,
  ) {}

  async use(req: any, _res: any, next: () => void) {
    let language: string | null = null;

    // Use custom resolver if provided
    if (this.options.resolveLanguage) {
      language = await this.options.resolveLanguage(req);
    }

    // Fallback to default language
    if (!language) {
      language = this.options.defaultLanguage;
    }

    this.languageService.setLanguage(language);

    next();
  }
}
