import {
  DynamicModule,
  Module,
  Provider,
  Scope,
  Type,
  MiddlewareConsumer,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { I18nLanguageService } from './i18n-language.service';
import { I18nLanguageInterceptor } from './i18n-language.interceptor';
import { I18nLanguageMiddleware } from './i18n-language.middleware';
import { I18nRepository, getI18nRepository } from '../repository';
import { setI18nConfig } from '../config';
import {
  I18nModuleOptions,
  I18nModuleAsyncOptions,
  I18nModuleOptionsFactory,
  I18N_MODULE_OPTIONS,
  getI18nRepositoryToken,
} from './types';

/**
 * Route configuration for middleware
 */
export type RouteInfo = string | Type<any> | { path: string; method?: any };

/**
 * NestJS module for typeorm-i18n integration.
 *
 * Provides request-scoped I18n repositories that automatically use
 * the language from the current request context.
 *
 * @example
 * ```typescript
 * // app.module.ts
 * @Module({
 *   imports: [
 *     TypeOrmModule.forRoot({
 *       // ... your TypeORM config
 *       subscribers: [I18nSubscriber],
 *     }),
 *     I18nModule.forRoot({
 *       languages: ['en', 'es', 'fr'],
 *       defaultLanguage: 'en',
 *       resolveLanguage: (request) => {
 *         // Extract from JWT payload
 *         return request.user?.language || request.headers['accept-language'];
 *       },
 *     }),
 *     I18nModule.forFeature([Product, Category]),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class I18nModule {
  /**
   * Configure the I18n module with static options.
   *
   * @param options - Module configuration
   */
  static forRoot(options: I18nModuleOptions): DynamicModule {
    // Set global config for the library
    setI18nConfig({
      languages: options.languages,
      default_language: options.defaultLanguage,
    });

    return {
      module: I18nModule,
      global: true,
      providers: [
        {
          provide: I18N_MODULE_OPTIONS,
          useValue: options,
        },
        I18nLanguageService,
        I18nLanguageInterceptor,
      ],
      exports: [
        I18N_MODULE_OPTIONS,
        I18nLanguageService,
        I18nLanguageInterceptor,
      ],
    };
  }

  /**
   * Configure the I18n module with async options.
   *
   * @param options - Async module configuration
   *
   * @example
   * ```typescript
   * I18nModule.forRootAsync({
   *   imports: [ConfigModule],
   *   useFactory: (config: ConfigService) => ({
   *     languages: config.get('I18N_LANGUAGES').split(','),
   *     defaultLanguage: config.get('I18N_DEFAULT'),
   *     resolveLanguage: (req) => req.user?.language,
   *   }),
   *   inject: [ConfigService],
   * })
   * ```
   */
  static forRootAsync(options: I18nModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);

    return {
      module: I18nModule,
      global: true,
      imports: options.imports || [],
      providers: [
        ...asyncProviders,
        I18nLanguageService,
        I18nLanguageInterceptor,
        {
          provide: 'I18N_CONFIG_INIT',
          useFactory: (opts: I18nModuleOptions) => {
            setI18nConfig({
              languages: opts.languages,
              default_language: opts.defaultLanguage,
            });
            return true;
          },
          inject: [I18N_MODULE_OPTIONS],
        },
      ],
      exports: [
        I18N_MODULE_OPTIONS,
        I18nLanguageService,
        I18nLanguageInterceptor,
      ],
    };
  }

  /**
   * Register I18n repositories for specific entities.
   * Use this in feature modules to inject I18n repositories.
   *
   * @param entities - Array of entity classes
   * @param dataSourceName - Optional DataSource name (for multiple connections)
   *
   * @example
   * ```typescript
   * // products.module.ts
   * @Module({
   *   imports: [
   *     TypeOrmModule.forFeature([Product]),
   *     I18nModule.forFeature([Product]),
   *   ],
   *   providers: [ProductService],
   * })
   * export class ProductsModule {}
   * ```
   */
  static forFeature(
    entities: Function[],
    dataSourceName?: string,
  ): DynamicModule {
    const providers = entities.map((entity) =>
      this.createRepositoryProvider(entity, dataSourceName),
    );
    const tokens = entities.map((entity) => getI18nRepositoryToken(entity));

    return {
      module: I18nModule,
      providers,
      exports: tokens,
    };
  }

  /**
   * Configure middleware for language extraction.
   * Call this in your AppModule's configure() method.
   *
   * @param consumer - The MiddlewareConsumer from NestJS
   * @param routes - Routes to apply middleware to (defaults to all routes)
   *
   * @example
   * ```typescript
   * // Apply to all routes
   * export class AppModule implements NestModule {
   *   configure(consumer: MiddlewareConsumer) {
   *     I18nModule.configure(consumer);
   *   }
   * }
   *
   * // Apply to specific routes
   * export class AppModule implements NestModule {
   *   configure(consumer: MiddlewareConsumer) {
   *     I18nModule.configure(consumer, ['products', 'users']);
   *   }
   * }
   *
   * // Apply to controller classes
   * export class AppModule implements NestModule {
   *   configure(consumer: MiddlewareConsumer) {
   *     I18nModule.configure(consumer, [ProductController, UserController]);
   *   }
   * }
   * ```
   */
  static configure(
    consumer: MiddlewareConsumer,
    routes: RouteInfo | RouteInfo[] = '*',
  ): void {
    const routeArray = Array.isArray(routes) ? routes : [routes];
    consumer.apply(I18nLanguageMiddleware).forRoutes(...routeArray as any[]);
  }

  private static createAsyncProviders(
    options: I18nModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    if (options.useClass) {
      return [
        this.createAsyncOptionsProvider(options),
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ];
    }

    return [];
  }

  private static createAsyncOptionsProvider(
    options: I18nModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: I18N_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    const inject = options.useExisting || options.useClass;
    return {
      provide: I18N_MODULE_OPTIONS,
      useFactory: async (optionsFactory: I18nModuleOptionsFactory) =>
        await optionsFactory.createI18nOptions(),
      inject: inject ? [inject] : [],
    };
  }

  private static createRepositoryProvider(
    entity: Function,
    dataSourceName?: string,
  ): Provider {
    return {
      provide: getI18nRepositoryToken(entity),
      scope: Scope.REQUEST,
      useFactory: (
        dataSource: DataSource,
        languageService: I18nLanguageService,
      ): I18nRepository<any> => {
        const repo = getI18nRepository(entity as new () => any, dataSource);

        // Set language from the request-scoped service
        const language = languageService.getLanguage();
        if (language) {
          repo.setLanguage(language);
        }

        return repo;
      },
      inject: [
        getDataSourceToken(dataSourceName),
        I18nLanguageService,
      ],
    };
  }
}
