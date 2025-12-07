/**
 * NestJS integration for typeorm-i18n
 *
 * Provides seamless integration with NestJS's dependency injection system
 * for request-scoped I18n repositories.
 *
 * @example
 * ```typescript
 * // app.module.ts
 * import { I18nModule, I18nSubscriber } from '@sebsastianek/typeorm-i18n';
 * import { fromJwtPayload } from '@sebsastianek/typeorm-i18n/nestjs';
 *
 * @Module({
 *   imports: [
 *     TypeOrmModule.forRoot({
 *       // ...config
 *       subscribers: [I18nSubscriber],
 *     }),
 *     I18nModule.forRoot({
 *       languages: ['en', 'es', 'fr'],
 *       defaultLanguage: 'en',
 *       resolveLanguage: fromJwtPayload('language'),
 *     }),
 *     I18nModule.forFeature([Product]),
 *   ],
 * })
 * export class AppModule {}
 *
 * // product.service.ts
 * import { InjectI18nRepository, I18nRepository } from '@sebsastianek/typeorm-i18n';
 *
 * @Injectable()
 * export class ProductService {
 *   constructor(
 *     @InjectI18nRepository(Product)
 *     private readonly productRepo: I18nRepository<Product>,
 *   ) {}
 *
 *   findAll() {
 *     // Language automatically set from JWT
 *     return this.productRepo.find();
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

// Module
export { I18nModule, RouteInfo } from './i18n.module';

// Decorators
export { InjectI18nRepository } from './decorators';

// Services
export { I18nLanguageService } from './i18n-language.service';

// Interceptors
export { I18nLanguageInterceptor } from './i18n-language.interceptor';

// Middleware
export { I18nLanguageMiddleware } from './i18n-language.middleware';

// Types
export {
  I18nModuleOptions,
  I18nModuleAsyncOptions,
  I18nModuleOptionsFactory,
  I18N_MODULE_OPTIONS,
  I18N_LANGUAGE,
  getI18nRepositoryToken,
} from './types';

// Language resolvers
export {
  fromJwtPayload,
  fromHeader,
  fromQuery,
  fromCookie,
  chain,
  validated,
} from './language-resolvers';
