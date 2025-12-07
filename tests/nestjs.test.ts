import { DataSource, Like } from 'typeorm';
import {
  I18nLanguageService,
  I18nModuleOptions,
  I18N_MODULE_OPTIONS,
  getI18nRepositoryToken,
  InjectI18nRepository,
  I18nLanguageInterceptor,
  fromJwtPayload,
  fromHeader,
  fromQuery,
  fromCookie,
  chain,
  validated,
  // CQRS
  WithLanguage,
  withLanguageFrom,
  setLanguageFrom,
  createLanguageHandler,
  I18nHandler,
  I18nLanguage,
  I18nAwareHandler,
  // Microservices
  extractLanguageFromPayload,
  extractLanguageFromKafka,
  extractLanguageFromRabbitMQ,
  extractLanguageFromGrpc,
  extractLanguage,
  withMessageLanguage,
  applyMessageLanguage,
} from '../src/nestjs';
import { I18nLanguageMiddleware } from '../src/nestjs/i18n-language.middleware';
import { I18nModule } from '../src/nestjs/i18n.module';
import { getI18nRepository, setI18nConfig, resetI18nConfig } from '../src';
import { createE2EDataSource, closeE2EDataSource, seedDatabase } from './db-helper';
import { Product } from './entities/Product.entity';
import { productFixtures } from './fixtures/product.fixtures';

describe('NestJS Integration', () => {
  describe('I18nLanguageService', () => {
    let service: I18nLanguageService;

    beforeEach(() => {
      service = new I18nLanguageService();
    });

    it('should initialize with no language set', () => {
      expect(service.getLanguage()).toBeNull();
      expect(service.hasLanguage()).toBe(false);
    });

    it('should set and get language', () => {
      service.setLanguage('es');
      expect(service.getLanguage()).toBe('es');
      expect(service.hasLanguage()).toBe(true);
    });

    it('should normalize language to lowercase', () => {
      service.setLanguage('ES');
      expect(service.getLanguage()).toBe('es');

      service.setLanguage('Fr');
      expect(service.getLanguage()).toBe('fr');
    });

    it('should allow changing language', () => {
      service.setLanguage('en');
      expect(service.getLanguage()).toBe('en');

      service.setLanguage('fr');
      expect(service.getLanguage()).toBe('fr');
    });
  });

  describe('I18nLanguageMiddleware', () => {
    let languageService: I18nLanguageService;

    beforeEach(() => {
      languageService = new I18nLanguageService();
    });

    it('should set language from custom resolver', async () => {
      const options: I18nModuleOptions = {
        languages: ['en', 'es', 'fr'],
        defaultLanguage: 'en',
        resolveLanguage: (req) => req.headers['x-language'],
      };

      const middleware = new I18nLanguageMiddleware(languageService, options);
      const req = { headers: { 'x-language': 'es' } };
      const res = {};
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(languageService.getLanguage()).toBe('es');
      expect(next).toHaveBeenCalled();
    });

    it('should use default language when resolver returns null', async () => {
      const options: I18nModuleOptions = {
        languages: ['en', 'es', 'fr'],
        defaultLanguage: 'en',
        resolveLanguage: () => null,
      };

      const middleware = new I18nLanguageMiddleware(languageService, options);
      const req = {};
      const res = {};
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(languageService.getLanguage()).toBe('en');
      expect(next).toHaveBeenCalled();
    });

    it('should use default language when no resolver is provided', async () => {
      const options: I18nModuleOptions = {
        languages: ['en', 'es', 'fr'],
        defaultLanguage: 'fr',
      };

      const middleware = new I18nLanguageMiddleware(languageService, options);
      const req = {};
      const res = {};
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(languageService.getLanguage()).toBe('fr');
      expect(next).toHaveBeenCalled();
    });

    it('should support async resolver', async () => {
      const options: I18nModuleOptions = {
        languages: ['en', 'es', 'fr'],
        defaultLanguage: 'en',
        resolveLanguage: async (req) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return req.user?.language;
        },
      };

      const middleware = new I18nLanguageMiddleware(languageService, options);
      const req = { user: { language: 'fr' } };
      const res = {};
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(languageService.getLanguage()).toBe('fr');
      expect(next).toHaveBeenCalled();
    });

    it('should handle resolver that accesses nested request properties', async () => {
      const options: I18nModuleOptions = {
        languages: ['en', 'es', 'fr'],
        defaultLanguage: 'en',
        resolveLanguage: (req) => {
          // Simulate extracting from Accept-Language header
          const header = req.headers?.['accept-language'];
          if (!header) return null;
          return header.split(',')[0]?.split('-')[0] || null;
        },
      };

      const middleware = new I18nLanguageMiddleware(languageService, options);
      const req = { headers: { 'accept-language': 'es-ES,es;q=0.9,en;q=0.8' } };
      const res = {};
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(languageService.getLanguage()).toBe('es');
    });

    it('should handle resolver that returns undefined', async () => {
      const options: I18nModuleOptions = {
        languages: ['en', 'es', 'fr'],
        defaultLanguage: 'en',
        resolveLanguage: () => undefined as any,
      };

      const middleware = new I18nLanguageMiddleware(languageService, options);
      const req = {};
      const res = {};
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(languageService.getLanguage()).toBe('en');
    });
  });

  describe('getI18nRepositoryToken', () => {
    it('should generate token from entity class', () => {
      class TestEntity {}
      const token = getI18nRepositoryToken(TestEntity);
      expect(token).toBe('I18nRepository_TestEntity');
    });

    it('should generate unique tokens for different entities', () => {
      class EntityA {}
      class EntityB {}
      const tokenA = getI18nRepositoryToken(EntityA);
      const tokenB = getI18nRepositoryToken(EntityB);
      expect(tokenA).not.toBe(tokenB);
    });
  });

  describe('I18nModule.forRoot', () => {
    it('should create a dynamic module with correct providers', () => {
      const result = I18nModule.forRoot({
        languages: ['en', 'es'],
        defaultLanguage: 'en',
      });

      expect(result.module).toBe(I18nModule);
      expect(result.global).toBe(true);
      expect(result.providers).toBeDefined();
      expect(result.exports).toBeDefined();
    });

    it('should include I18N_MODULE_OPTIONS in exports', () => {
      const result = I18nModule.forRoot({
        languages: ['en', 'es'],
        defaultLanguage: 'en',
      });

      expect(result.exports).toContain(I18N_MODULE_OPTIONS);
    });
  });

  describe('I18nModule.forFeature', () => {
    it('should create providers for entities', () => {
      class TestEntity {}
      const result = I18nModule.forFeature([TestEntity]);

      expect(result.module).toBe(I18nModule);
      expect(result.providers).toHaveLength(1);
      expect(result.exports).toContain(getI18nRepositoryToken(TestEntity));
    });

    it('should create providers for multiple entities', () => {
      class EntityA {}
      class EntityB {}
      class EntityC {}
      const result = I18nModule.forFeature([EntityA, EntityB, EntityC]);

      expect(result.providers).toHaveLength(3);
      expect(result.exports).toHaveLength(3);
      expect(result.exports).toContain(getI18nRepositoryToken(EntityA));
      expect(result.exports).toContain(getI18nRepositoryToken(EntityB));
      expect(result.exports).toContain(getI18nRepositoryToken(EntityC));
    });
  });

  describe('I18nModule.forRootAsync', () => {
    it('should create a dynamic module with factory', () => {
      const result = I18nModule.forRootAsync({
        useFactory: () => ({
          languages: ['en', 'es'],
          defaultLanguage: 'en',
        }),
      });

      expect(result.module).toBe(I18nModule);
      expect(result.global).toBe(true);
      expect(result.providers).toBeDefined();
    });

    it('should include inject dependencies', () => {
      const CONFIG_TOKEN = 'CONFIG';
      const result = I18nModule.forRootAsync({
        useFactory: (config: any) => ({
          languages: config.languages,
          defaultLanguage: config.default,
        }),
        inject: [CONFIG_TOKEN],
      });

      expect(result.providers).toBeDefined();
    });
  });

  describe('Integration with I18nRepository', () => {
    let dataSource: DataSource;

    beforeAll(() => {
      setI18nConfig({
        languages: ['en', 'es', 'fr'],
        default_language: 'en',
      });
    });

    afterAll(() => {
      resetI18nConfig();
    });

    beforeEach(async () => {
      dataSource = await createE2EDataSource([Product]);
      await seedDatabase(dataSource, Product, productFixtures);
    });

    afterEach(async () => {
      if (dataSource && dataSource.isInitialized) {
        await closeE2EDataSource(dataSource);
      }
    });

    it('should use language from service when creating repository', async () => {
      const languageService = new I18nLanguageService();
      languageService.setLanguage('es');

      // Simulate what the NestJS provider factory does
      const repo = getI18nRepository(Product, dataSource);
      const language = languageService.getLanguage();
      if (language) {
        repo.setLanguage(language);
      }

      expect(repo.getLanguage()).toBe('es');

      const products = await repo
        .createQueryBuilder('product')
        .where({ name: 'Portátil' })
        .getMany();

      expect(products).toHaveLength(1);
    });

    it('should work with different languages from service', async () => {
      const languageService = new I18nLanguageService();

      // French
      languageService.setLanguage('fr');
      const repoFr = getI18nRepository(Product, dataSource);
      repoFr.setLanguage(languageService.getLanguage()!);

      const frProducts = await repoFr
        .createQueryBuilder('product')
        .where({ name: 'Ordinateur portable' })
        .getMany();
      expect(frProducts).toHaveLength(1);

      // Spanish
      languageService.setLanguage('es');
      const repoEs = getI18nRepository(Product, dataSource);
      repoEs.setLanguage(languageService.getLanguage()!);

      const esProducts = await repoEs
        .createQueryBuilder('product')
        .where({ name: 'Portátil' })
        .getMany();
      expect(esProducts).toHaveLength(1);
    });

    it('should simulate full request flow', async () => {
      // 1. Create language service (request-scoped)
      const languageService = new I18nLanguageService();

      // 2. Middleware extracts language from request
      const options: I18nModuleOptions = {
        languages: ['en', 'es', 'fr'],
        defaultLanguage: 'en',
        resolveLanguage: (req) => req.query?.lang,
      };
      const middleware = new I18nLanguageMiddleware(languageService, options);
      const req = { query: { lang: 'es' } };
      await middleware.use(req, {}, () => {});

      // 3. Repository is created with language from service
      const repo = getI18nRepository(Product, dataSource);
      const language = languageService.getLanguage();
      if (language) {
        repo.setLanguage(language);
      }

      // 4. Query uses Spanish column
      const products = await repo
        .createQueryBuilder('product')
        .where({ name: Like('%Portátil%') })
        .getMany();

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.es).toBe('Portátil');
      // With language set to 'es', the single-value property should have Spanish value
      expect(products[0].name).toBe('Portátil');
    });
  });

  describe('InjectI18nRepository decorator', () => {
    it('should return Inject decorator with correct token', () => {
      class TestEntity {}
      const decorator = InjectI18nRepository(TestEntity);
      expect(decorator).toBeDefined();
      expect(typeof decorator).toBe('function');
    });

    it('should generate correct token for entity', () => {
      class MyProduct {}
      // The decorator wraps Inject with the token
      const token = getI18nRepositoryToken(MyProduct);
      expect(token).toBe('I18nRepository_MyProduct');
    });
  });

  describe('I18nLanguageInterceptor', () => {
    let languageService: I18nLanguageService;

    beforeEach(() => {
      languageService = new I18nLanguageService();
    });

    it('should set language from custom resolver', async () => {
      const options: I18nModuleOptions = {
        languages: ['en', 'es', 'fr'],
        defaultLanguage: 'en',
        resolveLanguage: (req) => req.headers['x-language'],
      };

      const interceptor = new I18nLanguageInterceptor(languageService, options);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-language': 'fr' } }),
        }),
      };

      const mockNext = {
        handle: () => ({ pipe: jest.fn() }),
      };

      await interceptor.intercept(mockContext as any, mockNext as any);

      expect(languageService.getLanguage()).toBe('fr');
    });

    it('should use default language when resolver returns null', async () => {
      const options: I18nModuleOptions = {
        languages: ['en', 'es', 'fr'],
        defaultLanguage: 'es',
        resolveLanguage: () => null,
      };

      const interceptor = new I18nLanguageInterceptor(languageService, options);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      };

      const mockNext = {
        handle: () => ({ pipe: jest.fn() }),
      };

      await interceptor.intercept(mockContext as any, mockNext as any);

      expect(languageService.getLanguage()).toBe('es');
    });

    it('should support async resolver', async () => {
      const options: I18nModuleOptions = {
        languages: ['en', 'es', 'fr'],
        defaultLanguage: 'en',
        resolveLanguage: async () => {
          await new Promise((r) => setTimeout(r, 5));
          return 'fr';
        },
      };

      const interceptor = new I18nLanguageInterceptor(languageService, options);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      };

      const mockNext = {
        handle: () => ({ pipe: jest.fn() }),
      };

      await interceptor.intercept(mockContext as any, mockNext as any);

      expect(languageService.getLanguage()).toBe('fr');
    });
  });

  describe('Language Resolvers', () => {
    describe('fromJwtPayload', () => {
      it('should extract language from user object with default field', () => {
        const resolver = fromJwtPayload();
        const req = { user: { language: 'es' } };
        expect(resolver(req)).toBe('es');
      });

      it('should extract language from custom field', () => {
        const resolver = fromJwtPayload('lang');
        const req = { user: { lang: 'fr' } };
        expect(resolver(req)).toBe('fr');
      });

      it('should return null when user is missing', () => {
        const resolver = fromJwtPayload();
        const req = {};
        expect(resolver(req)).toBeNull();
      });

      it('should return null when field is missing', () => {
        const resolver = fromJwtPayload('lang');
        const req = { user: { otherField: 'value' } };
        expect(resolver(req)).toBeNull();
      });
    });

    describe('fromHeader', () => {
      it('should extract language from custom header', () => {
        const resolver = fromHeader('x-language');
        const req = { headers: { 'x-language': 'es' } };
        expect(resolver(req)).toBe('es');
      });

      it('should parse Accept-Language header', () => {
        const resolver = fromHeader('accept-language');
        const req = { headers: { 'accept-language': 'es-ES,es;q=0.9,en;q=0.8' } };
        expect(resolver(req)).toBe('es');
      });

      it('should handle simple Accept-Language', () => {
        const resolver = fromHeader();
        const req = { headers: { 'accept-language': 'fr' } };
        expect(resolver(req)).toBe('fr');
      });

      it('should return null when header is missing', () => {
        const resolver = fromHeader('x-language');
        const req = { headers: {} };
        expect(resolver(req)).toBeNull();
      });

      it('should handle case-insensitive header names', () => {
        const resolver = fromHeader('X-Language');
        const req = { headers: { 'x-language': 'de' } };
        expect(resolver(req)).toBe('de');
      });
    });

    describe('fromQuery', () => {
      it('should extract language from query param with default name', () => {
        const resolver = fromQuery();
        const req = { query: { lang: 'es' } };
        expect(resolver(req)).toBe('es');
      });

      it('should extract language from custom query param', () => {
        const resolver = fromQuery('language');
        const req = { query: { language: 'fr' } };
        expect(resolver(req)).toBe('fr');
      });

      it('should return null when query is missing', () => {
        const resolver = fromQuery();
        const req = {};
        expect(resolver(req)).toBeNull();
      });

      it('should return null when param is missing', () => {
        const resolver = fromQuery('lang');
        const req = { query: { other: 'value' } };
        expect(resolver(req)).toBeNull();
      });
    });

    describe('fromCookie', () => {
      it('should extract language from cookie with default name', () => {
        const resolver = fromCookie();
        const req = { cookies: { language: 'es' } };
        expect(resolver(req)).toBe('es');
      });

      it('should extract language from custom cookie', () => {
        const resolver = fromCookie('user_lang');
        const req = { cookies: { user_lang: 'fr' } };
        expect(resolver(req)).toBe('fr');
      });

      it('should return null when cookies are missing', () => {
        const resolver = fromCookie();
        const req = {};
        expect(resolver(req)).toBeNull();
      });

      it('should return null when cookie is missing', () => {
        const resolver = fromCookie('lang');
        const req = { cookies: { other: 'value' } };
        expect(resolver(req)).toBeNull();
      });
    });

    describe('chain', () => {
      it('should return first non-null result', async () => {
        const resolver = chain(
          () => null,
          () => 'es',
          () => 'fr',
        );
        expect(await resolver({})).toBe('es');
      });

      it('should try all resolvers in order', async () => {
        const calls: string[] = [];
        const resolver = chain(
          () => { calls.push('first'); return null; },
          () => { calls.push('second'); return null; },
          () => { calls.push('third'); return 'fr'; },
        );
        await resolver({});
        expect(calls).toEqual(['first', 'second', 'third']);
      });

      it('should return null when all resolvers return null', async () => {
        const resolver = chain(
          () => null,
          () => null,
        );
        expect(await resolver({})).toBeNull();
      });

      it('should work with async resolvers', async () => {
        const resolver = chain(
          async () => null,
          async () => {
            await new Promise((r) => setTimeout(r, 5));
            return 'es';
          },
        );
        expect(await resolver({})).toBe('es');
      });

      it('should work with mixed sync and async resolvers', async () => {
        const resolver = chain(
          () => null,
          async () => 'fr',
        );
        expect(await resolver({})).toBe('fr');
      });
    });

    describe('validated', () => {
      it('should return language when in allowed list', async () => {
        const resolver = validated(
          () => 'es',
          ['en', 'es', 'fr'],
        );
        expect(await resolver({})).toBe('es');
      });

      it('should return null when not in allowed list', async () => {
        const resolver = validated(
          () => 'de',
          ['en', 'es', 'fr'],
        );
        expect(await resolver({})).toBeNull();
      });

      it('should normalize language to lowercase', async () => {
        const resolver = validated(
          () => 'ES',
          ['en', 'es', 'fr'],
        );
        expect(await resolver({})).toBe('es');
      });

      it('should handle case-insensitive allowed list', async () => {
        const resolver = validated(
          () => 'es',
          ['EN', 'ES', 'FR'],
        );
        expect(await resolver({})).toBe('es');
      });

      it('should return null when wrapped resolver returns null', async () => {
        const resolver = validated(
          () => null,
          ['en', 'es', 'fr'],
        );
        expect(await resolver({})).toBeNull();
      });

      it('should work with async wrapped resolver', async () => {
        const resolver = validated(
          async () => 'fr',
          ['en', 'es', 'fr'],
        );
        expect(await resolver({})).toBe('fr');
      });
    });

    describe('combined resolvers', () => {
      it('should work with chain and validated', async () => {
        const resolver = validated(
          chain(
            fromQuery('lang'),
            fromHeader('x-language'),
            fromJwtPayload(),
          ),
          ['en', 'es', 'fr'],
        );

        // Query param present
        expect(await resolver({ query: { lang: 'es' } })).toBe('es');

        // Fall back to header
        expect(await resolver({
          query: {},
          headers: { 'x-language': 'fr' }
        })).toBe('fr');

        // Fall back to JWT
        expect(await resolver({
          query: {},
          headers: {},
          user: { language: 'en' }
        })).toBe('en');

        // Invalid language filtered out
        expect(await resolver({ query: { lang: 'de' } })).toBeNull();
      });
    });
  });

  describe('CQRS Support', () => {
    let dataSource: DataSource;

    beforeAll(() => {
      setI18nConfig({
        languages: ['en', 'es', 'fr'],
        default_language: 'en',
      });
    });

    afterAll(() => {
      resetI18nConfig();
    });

    beforeEach(async () => {
      dataSource = await createE2EDataSource([Product]);
      await seedDatabase(dataSource, Product, productFixtures);
    });

    afterEach(async () => {
      if (dataSource && dataSource.isInitialized) {
        await closeE2EDataSource(dataSource);
      }
    });

    describe('WithLanguage interface', () => {
      it('should define language property', () => {
        const command: WithLanguage = { language: 'es' };
        expect(command.language).toBe('es');
      });

      it('should allow optional language', () => {
        const command: WithLanguage = {};
        expect(command.language).toBeUndefined();
      });
    });

    describe('withLanguageFrom', () => {
      it('should set language on repository from command', async () => {
        const repo = getI18nRepository(Product, dataSource);
        const command = { name: 'Test', language: 'es' };

        withLanguageFrom(command, repo);

        expect(repo.getLanguage()).toBe('es');
      });

      it('should use default language when command has no language', async () => {
        const repo = getI18nRepository(Product, dataSource);
        const command: WithLanguage = { language: undefined };

        withLanguageFrom(command, repo, 'fr');

        expect(repo.getLanguage()).toBe('fr');
      });

      it('should not set language when no language and no default', async () => {
        const repo = getI18nRepository(Product, dataSource);
        const command: WithLanguage = {};

        withLanguageFrom(command, repo);

        expect(repo.getLanguage()).toBeNull();
      });

      it('should work with actual queries', async () => {
        const repo = getI18nRepository(Product, dataSource);
        const command = { name: 'Portátil', language: 'es' };

        withLanguageFrom(command, repo);

        const products = await repo.find({ where: { name: 'Portátil' } as any });
        expect(products).toHaveLength(1);
        expect(products[0].name).toBe('Portátil');
      });
    });

    describe('setLanguageFrom', () => {
      it('should set language on language service from command', () => {
        const languageService = new I18nLanguageService();
        const command = { name: 'Test', language: 'fr' };

        setLanguageFrom(command, languageService);

        expect(languageService.getLanguage()).toBe('fr');
      });

      it('should use default language when command has no language', () => {
        const languageService = new I18nLanguageService();
        const command: WithLanguage = {};

        setLanguageFrom(command, languageService, 'es');

        expect(languageService.getLanguage()).toBe('es');
      });
    });

    describe('createLanguageHandler', () => {
      it('should set language before executing handler', async () => {
        const languageService = new I18nLanguageService();
        const handler = createLanguageHandler(languageService);

        const command = { name: 'Test', language: 'es' };
        let capturedLanguage: string | null = null;

        await handler(command, async () => {
          capturedLanguage = languageService.getLanguage();
          return 'result';
        });

        expect(capturedLanguage).toBe('es');
      });

      it('should return handler result', async () => {
        const languageService = new I18nLanguageService();
        const handler = createLanguageHandler(languageService);

        const result = await handler({ language: 'es' }, async () => {
          return { id: 1, name: 'Product' };
        });

        expect(result).toEqual({ id: 1, name: 'Product' });
      });
    });

    describe('I18nHandler base class', () => {
      it('should provide executeWithLanguage method', async () => {
        const languageService = new I18nLanguageService();

        class TestHandler extends I18nHandler {
          async execute(command: WithLanguage) {
            return this.executeWithLanguage(command, async () => {
              return this.languageService.getLanguage();
            });
          }
        }

        const handler = new TestHandler(languageService, 'en');
        const result = await handler.execute({ language: 'fr' });

        expect(result).toBe('fr');
      });

      it('should use default language when command has none', async () => {
        const languageService = new I18nLanguageService();

        class TestHandler extends I18nHandler {
          async execute(command: WithLanguage) {
            return this.executeWithLanguage(command, async () => {
              return this.languageService.getLanguage();
            });
          }
        }

        const handler = new TestHandler(languageService, 'es');
        const result = await handler.execute({});

        expect(result).toBe('es');
      });
    });

    describe('@I18nLanguage() method decorator', () => {
      it('should extract language from command and set on service', async () => {
        const languageService = new I18nLanguageService();

        class TestHandler {
          i18nLanguageService = languageService;

          @I18nLanguage()
          async execute(_command: WithLanguage) {
            return this.i18nLanguageService.getLanguage();
          }
        }

        const handler = new TestHandler();
        const result = await handler.execute({ language: 'es' });

        expect(result).toBe('es');
      });

      it('should work with custom field name', async () => {
        const languageService = new I18nLanguageService();

        class TestHandler {
          languageService = languageService;

          @I18nLanguage({ field: 'lang' })
          async execute(_command: { lang?: string }) {
            return this.languageService.getLanguage();
          }
        }

        const handler = new TestHandler();
        const result = await handler.execute({ lang: 'fr' });

        expect(result).toBe('fr');
      });

      it('should use default language when command has none', async () => {
        const languageService = new I18nLanguageService();

        class TestHandler {
          languageService = languageService;

          @I18nLanguage({ defaultLanguage: 'de' })
          async execute(_command: WithLanguage) {
            return this.languageService.getLanguage();
          }
        }

        const handler = new TestHandler();
        const result = await handler.execute({});

        expect(result).toBe('de');
      });

      it('should work with repositories', async () => {
        const languageService = new I18nLanguageService();
        const repo = getI18nRepository(Product, dataSource);

        class TestHandler {
          i18nLanguageService = languageService;

          @I18nLanguage()
          async execute(_command: WithLanguage) {
            // Manually sync repo with service (in real NestJS this is automatic)
            const lang = this.i18nLanguageService.getLanguage();
            if (lang) repo.setLanguage(lang);
            return repo.find({ where: { name: 'Portátil' } as any });
          }
        }

        const handler = new TestHandler();
        const products = await handler.execute({ language: 'es' });

        expect(products).toHaveLength(1);
        expect(products[0].name).toBe('Portátil');
      });
    });

    describe('@I18nAwareHandler() class decorator', () => {
      it('should wrap execute method to extract language', async () => {
        const languageService = new I18nLanguageService();

        @I18nAwareHandler()
        class TestHandler {
          languageService = languageService;

          async execute(_command: WithLanguage) {
            return this.languageService.getLanguage();
          }
        }

        const handler = new TestHandler();
        const result = await handler.execute({ language: 'fr' });

        expect(result).toBe('fr');
      });

      it('should work with custom options', async () => {
        const languageService = new I18nLanguageService();

        @I18nAwareHandler({ field: 'locale', defaultLanguage: 'en' })
        class TestHandler {
          languageService = languageService;

          async execute(_command: { locale?: string }) {
            return this.languageService.getLanguage();
          }
        }

        const handler = new TestHandler();

        // With locale
        expect(await handler.execute({ locale: 'es' })).toBe('es');

        // Without locale (uses default)
        const handler2 = new TestHandler();
        expect(await handler2.execute({})).toBe('en');
      });
    });
  });

  describe('Microservices Support', () => {
    let dataSource: DataSource;

    beforeAll(() => {
      setI18nConfig({
        languages: ['en', 'es', 'fr'],
        default_language: 'en',
      });
    });

    afterAll(() => {
      resetI18nConfig();
    });

    beforeEach(async () => {
      dataSource = await createE2EDataSource([Product]);
      await seedDatabase(dataSource, Product, productFixtures);
    });

    afterEach(async () => {
      if (dataSource && dataSource.isInitialized) {
        await closeE2EDataSource(dataSource);
      }
    });

    describe('extractLanguageFromPayload', () => {
      it('should extract language from payload', () => {
        const payload = { name: 'Test', language: 'es' };
        expect(extractLanguageFromPayload(payload)).toBe('es');
      });

      it('should use custom field name', () => {
        const payload = { name: 'Test', lang: 'fr' };
        expect(extractLanguageFromPayload(payload, { payloadField: 'lang' })).toBe('fr');
      });

      it('should return null when field is missing', () => {
        const payload = { name: 'Test' };
        expect(extractLanguageFromPayload(payload)).toBeNull();
      });

      it('should return null for non-object payload', () => {
        expect(extractLanguageFromPayload(null)).toBeNull();
        expect(extractLanguageFromPayload('string')).toBeNull();
        expect(extractLanguageFromPayload(123)).toBeNull();
      });
    });

    describe('extractLanguageFromKafka', () => {
      it('should extract language from Kafka headers', () => {
        const context = {
          getMessage: () => ({
            headers: { 'x-language': 'es' },
          }),
        };
        expect(extractLanguageFromKafka(context)).toBe('es');
      });

      it('should handle Buffer headers', () => {
        const context = {
          getMessage: () => ({
            headers: { 'x-language': Buffer.from('fr') },
          }),
        };
        expect(extractLanguageFromKafka(context)).toBe('fr');
      });

      it('should use custom header field', () => {
        const context = {
          getMessage: () => ({
            headers: { 'language': 'es' },
          }),
        };
        expect(extractLanguageFromKafka(context, 'language')).toBe('es');
      });

      it('should return null when header is missing', () => {
        const context = {
          getMessage: () => ({ headers: {} }),
        };
        expect(extractLanguageFromKafka(context)).toBeNull();
      });

      it('should handle missing context methods', () => {
        expect(extractLanguageFromKafka({})).toBeNull();
        expect(extractLanguageFromKafka(null)).toBeNull();
      });
    });

    describe('extractLanguageFromRabbitMQ', () => {
      it('should extract language from RabbitMQ headers', () => {
        const context = {
          getMessage: () => ({
            properties: {
              headers: { 'x-language': 'es' },
            },
          }),
        };
        expect(extractLanguageFromRabbitMQ(context)).toBe('es');
      });

      it('should use custom header field', () => {
        const context = {
          getMessage: () => ({
            properties: {
              headers: { 'lang': 'fr' },
            },
          }),
        };
        expect(extractLanguageFromRabbitMQ(context, 'lang')).toBe('fr');
      });

      it('should return null when header is missing', () => {
        const context = {
          getMessage: () => ({
            properties: { headers: {} },
          }),
        };
        expect(extractLanguageFromRabbitMQ(context)).toBeNull();
      });
    });

    describe('extractLanguageFromGrpc', () => {
      it('should extract language from gRPC metadata', () => {
        const metadata = {
          get: (key: string) => key === 'x-language' ? ['es'] : [],
        };
        expect(extractLanguageFromGrpc(metadata)).toBe('es');
      });

      it('should use custom metadata key', () => {
        const metadata = {
          get: (key: string) => key === 'lang' ? ['fr'] : [],
        };
        expect(extractLanguageFromGrpc(metadata, 'lang')).toBe('fr');
      });

      it('should return null when metadata is missing', () => {
        const metadata = {
          get: () => [],
        };
        expect(extractLanguageFromGrpc(metadata)).toBeNull();
      });

      it('should handle missing get method', () => {
        expect(extractLanguageFromGrpc({})).toBeNull();
        expect(extractLanguageFromGrpc(null)).toBeNull();
      });
    });

    describe('extractLanguage (universal)', () => {
      it('should try payload first', () => {
        const payload = { language: 'es' };
        const context = {
          getMessage: () => ({ headers: { 'x-language': 'fr' } }),
        };
        expect(extractLanguage(payload, context)).toBe('es');
      });

      it('should fall back to context when payload has no language', () => {
        const payload = { name: 'Test' };
        const context = {
          getMessage: () => ({ headers: { 'x-language': 'fr' } }),
        };
        expect(extractLanguage(payload, context)).toBe('fr');
      });

      it('should return default when nothing found', () => {
        const payload = { name: 'Test' };
        expect(extractLanguage(payload, null, { defaultLanguage: 'es' })).toBe('es');
      });

      it('should use "en" as ultimate default', () => {
        expect(extractLanguage({}, null)).toBe('en');
      });
    });

    describe('withMessageLanguage', () => {
      it('should set language on repository from message', async () => {
        const repo = getI18nRepository(Product, dataSource);
        const payload = { name: 'Test', language: 'es' };

        withMessageLanguage(payload, repo);

        expect(repo.getLanguage()).toBe('es');
      });

      it('should extract from context when payload has no language', async () => {
        const repo = getI18nRepository(Product, dataSource);
        const payload = { name: 'Test' };
        const context = {
          getMessage: () => ({ headers: { 'x-language': 'fr' } }),
        };

        withMessageLanguage(payload, repo, context);

        expect(repo.getLanguage()).toBe('fr');
      });

      it('should work with actual queries', async () => {
        const repo = getI18nRepository(Product, dataSource);
        const payload = { language: 'es' };

        withMessageLanguage(payload, repo);

        const products = await repo.find({ where: { name: 'Portátil' } as any });
        expect(products).toHaveLength(1);
      });
    });

    describe('applyMessageLanguage', () => {
      it('should set language on language service', () => {
        const languageService = new I18nLanguageService();
        const payload = { language: 'fr' };

        applyMessageLanguage(payload, languageService);

        expect(languageService.getLanguage()).toBe('fr');
      });

      it('should extract from context when payload has no language', () => {
        const languageService = new I18nLanguageService();
        const payload = { name: 'Test' };
        const context = {
          getMessage: () => ({
            properties: { headers: { 'x-language': 'es' } },
          }),
        };

        applyMessageLanguage(payload, languageService, context);

        expect(languageService.getLanguage()).toBe('es');
      });
    });
  });
});
