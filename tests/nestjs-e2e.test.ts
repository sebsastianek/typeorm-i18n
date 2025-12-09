import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, Injectable, Module, Param, Post, Body, Query, NestModule, MiddlewareConsumer, NestMiddleware } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import request from 'supertest';
import {
  I18nModule,
  InjectI18nRepository,
  I18nLanguageService,
  fromHeader,
  fromQuery,
  fromJwtPayload,
  fromCookie,
  chain,
  validated,
} from '../src/nestjs';
import { I18nColumn, I18nValue, I18nRepository, setI18nConfig, resetI18nConfig, I18nSubscriber } from '../src';
import { resetI18nColumnsFinalization } from '../src/decorator';

// Test Entity
type TestLanguages = 'en' | 'es' | 'de';

@Entity('e2e_products')
class E2EProduct {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({
    languages: ['en', 'es', 'de'],
    default_language: 'en',
    type: 'varchar',
    length: 255,
  })
  name!: string;

  nameTranslations?: I18nValue<TestLanguages, string>;

  @I18nColumn({
    languages: ['en', 'es', 'de'],
    default_language: 'en',
    type: 'text',
  })
  description!: string;

  descriptionTranslations?: I18nValue<TestLanguages, string>;

  @Column({ type: 'real', default: 0 })
  price!: number;
}

// Test Service
@Injectable()
class ProductService {
  constructor(
    @InjectI18nRepository(E2EProduct)
    private readonly productRepo: I18nRepository<E2EProduct>,
  ) {}

  async findAll() {
    return this.productRepo.find();
  }

  async findOne(id: number) {
    return this.productRepo.findOne({ where: { id } });
  }

  async findByName(name: string) {
    return this.productRepo.find({ where: { name } as any });
  }

  async create(data: { nameTranslations: I18nValue<TestLanguages, string>; descriptionTranslations: I18nValue<TestLanguages, string>; price: number }) {
    const product = this.productRepo.create();
    product.nameTranslations = data.nameTranslations;
    product.descriptionTranslations = data.descriptionTranslations;
    product.price = data.price;
    return this.productRepo.save(product);
  }

  getLanguage() {
    return this.productRepo.getLanguage();
  }
}

// Test Controller
@Controller('products')
class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly languageService: I18nLanguageService,
  ) {}

  @Get()
  async findAll() {
    return this.productService.findAll();
  }

  @Get('language')
  getLanguage() {
    return {
      serviceLanguage: this.languageService.getLanguage(),
      repoLanguage: this.productService.getLanguage(),
    };
  }

  @Get('search')
  async search(@Query('name') name: string) {
    return this.productService.findByName(name);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productService.findOne(parseInt(id, 10));
  }

  @Post()
  async create(@Body() data: any) {
    return this.productService.create(data);
  }
}

// Test Module
@Module({
  imports: [
    I18nModule.forFeature([E2EProduct]),
  ],
  controllers: [ProductController],
  providers: [ProductService],
})
class ProductModule {}

// Root App Module with middleware configuration
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [E2EProduct],
      synchronize: true,
      subscribers: [I18nSubscriber],
    }),
    I18nModule.forRoot({
      languages: ['en', 'es', 'de'],
      defaultLanguage: 'en',
      resolveLanguage: chain(
        fromQuery('lang'),
        fromHeader('x-language'),
        fromHeader('accept-language'),
      ),
    }),
    ProductModule,
  ],
})
class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    I18nModule.configure(consumer);
  }
}

describe('NestJS E2E Integration', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Reset any previous config
    resetI18nConfig();
    resetI18nColumnsFinalization();

    // Set global config
    setI18nConfig({
      languages: ['en', 'es', 'de'],
      default_language: 'en',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // Seed test data
    const repo = dataSource.getRepository(E2EProduct);
    await repo.save([
      {
        name: 'Laptop',
        name_es: 'Portátil',
        name_de: 'Laptop',
        description: 'High-performance laptop',
        description_es: 'Portátil de alto rendimiento',
        description_de: 'Hochleistungs-Laptop',
        price: 999.99,
      },
      {
        name: 'Mouse',
        name_es: 'Ratón',
        name_de: 'Maus',
        description: 'Wireless mouse',
        description_es: 'Ratón inalámbrico',
        description_de: 'Kabellose Maus',
        price: 29.99,
      },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    resetI18nConfig();
    resetI18nColumnsFinalization();
  });

  describe('Language Resolution from Headers', () => {
    it('should use default language when no language header', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(response.body).toHaveLength(2);
      // Default language is 'en', so name should be English
      expect(response.body[0].name).toBe('Laptop');
      expect(response.body[0].nameTranslations).toEqual({
        en: 'Laptop',
        es: 'Portátil',
        de: 'Laptop',
      });
    });

    it('should resolve language from X-Language header', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .set('X-Language', 'es')
        .expect(200);

      expect(response.body).toHaveLength(2);
      // Language is 'es', so name should be Spanish
      expect(response.body[0].name).toBe('Portátil');
      expect(response.body[1].name).toBe('Ratón');
    });

    it('should resolve language from Accept-Language header', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .set('Accept-Language', 'de-DE,de;q=0.9')
        .expect(200);

      expect(response.body).toHaveLength(2);
      // Language is 'de', so name should be German
      expect(response.body[0].name).toBe('Laptop');
      expect(response.body[1].name).toBe('Maus');
    });

    it('should resolve language from query parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/products?lang=es')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Portátil');
    });

    it('should prefer query param over header (chain order)', async () => {
      const response = await request(app.getHttpServer())
        .get('/products?lang=de')
        .set('X-Language', 'es')
        .expect(200);

      expect(response.body).toHaveLength(2);
      // Query param (de) should take precedence
      expect(response.body[0].name).toBe('Laptop');
      expect(response.body[1].name).toBe('Maus');
    });
  });

  describe('Language Service Integration', () => {
    it('should set language on both service and repository', async () => {
      const response = await request(app.getHttpServer())
        .get('/products/language')
        .set('X-Language', 'es')
        .expect(200);

      expect(response.body.serviceLanguage).toBe('es');
      expect(response.body.repoLanguage).toBe('es');
    });

    it('should use default language when no header', async () => {
      const response = await request(app.getHttpServer())
        .get('/products/language')
        .expect(200);

      // When no language header is set, the default language ('en') should be used
      expect(response.body.serviceLanguage).toBe('en');
      expect(response.body.repoLanguage).toBe('en');
    });
  });

  describe('Repository Operations with Language Context', () => {
    it('should get single product with correct language', async () => {
      const response = await request(app.getHttpServer())
        .get('/products/1')
        .set('X-Language', 'es')
        .expect(200);

      expect(response.body.name).toBe('Portátil');
      expect(response.body.description).toBe('Portátil de alto rendimiento');
      expect(response.body.nameTranslations.en).toBe('Laptop');
      expect(response.body.nameTranslations.es).toBe('Portátil');
    });

    it('should search by translated name', async () => {
      const response = await request(app.getHttpServer())
        .get('/products/search?name=Ratón')
        .set('X-Language', 'es')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Ratón');
      expect(response.body[0].price).toBe(29.99);
    });

    it('should not find when searching in wrong language', async () => {
      // Search for Spanish name but with German language
      const response = await request(app.getHttpServer())
        .get('/products/search?name=Ratón')
        .set('X-Language', 'de')
        .expect(200);

      // Should not find because 'Ratón' is Spanish, not German
      expect(response.body).toHaveLength(0);
    });
  });

  describe('Clean JSON Output', () => {
    it('should not include raw translation columns in response', async () => {
      const response = await request(app.getHttpServer())
        .get('/products/1')
        .set('X-Language', 'es')
        .expect(200);

      // Should have translations object
      expect(response.body.nameTranslations).toBeDefined();

      // Should NOT have raw columns
      expect(response.body.name_es).toBeUndefined();
      expect(response.body.name_de).toBeUndefined();
      expect(response.body.description_es).toBeUndefined();
      expect(response.body.description_de).toBeUndefined();
    });

    it('should have clean JSON for list endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .set('X-Language', 'de')
        .expect(200);

      for (const product of response.body) {
        // Check no raw columns
        expect(product.name_es).toBeUndefined();
        expect(product.name_de).toBeUndefined();
        expect(product.description_es).toBeUndefined();
        expect(product.description_de).toBeUndefined();

        // Check translations exist
        expect(product.nameTranslations).toBeDefined();
        expect(product.descriptionTranslations).toBeDefined();
      }
    });
  });

  describe('Create Operations', () => {
    it('should create product with translations', async () => {
      const newProduct = {
        nameTranslations: {
          en: 'Keyboard',
          es: 'Teclado',
          de: 'Tastatur',
        },
        descriptionTranslations: {
          en: 'Mechanical keyboard',
          es: 'Teclado mecánico',
          de: 'Mechanische Tastatur',
        },
        price: 149.99,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/products')
        .send(newProduct)
        .expect(201);

      expect(createResponse.body.id).toBeDefined();

      // Fetch with Spanish language
      const getResponse = await request(app.getHttpServer())
        .get(`/products/${createResponse.body.id}`)
        .set('X-Language', 'es')
        .expect(200);

      expect(getResponse.body.name).toBe('Teclado');
      expect(getResponse.body.nameTranslations.en).toBe('Keyboard');
      expect(getResponse.body.nameTranslations.es).toBe('Teclado');
      expect(getResponse.body.nameTranslations.de).toBe('Tastatur');
    });
  });

  describe('Language Normalization', () => {
    it('should normalize uppercase language codes', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .set('X-Language', 'ES')
        .expect(200);

      expect(response.body[0].name).toBe('Portátil');
    });

    it('should handle language code with region', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .set('Accept-Language', 'es-MX')
        .expect(200);

      // Should extract 'es' from 'es-MX'
      expect(response.body[0].name).toBe('Portátil');
    });
  });

  describe('Multiple Requests with Different Languages', () => {
    it('should handle concurrent requests with different languages', async () => {
      const [enResponse, esResponse, deResponse] = await Promise.all([
        request(app.getHttpServer()).get('/products').set('X-Language', 'en'),
        request(app.getHttpServer()).get('/products').set('X-Language', 'es'),
        request(app.getHttpServer()).get('/products').set('X-Language', 'de'),
      ]);

      expect(enResponse.body[0].name).toBe('Laptop');
      expect(esResponse.body[0].name).toBe('Portátil');
      expect(deResponse.body[0].name).toBe('Laptop');

      expect(enResponse.body[1].name).toBe('Mouse');
      expect(esResponse.body[1].name).toBe('Ratón');
      expect(deResponse.body[1].name).toBe('Maus');
    });
  });
});

// ============================================================================
// JWT Payload Language Extraction Tests
// ============================================================================

// Mock JWT middleware that adds user object to request
@Injectable()
class MockJwtMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    // Simulate JWT extraction - reads from X-Mock-Jwt-Language header to set user.language
    const jwtLang = req.headers['x-mock-jwt-language'];
    if (jwtLang) {
      req.user = { language: jwtLang, id: 123, email: 'test@example.com' };
    }
    next();
  }
}

// Entity for JWT tests (separate to avoid metadata conflicts)
@Entity('jwt_products')
class JwtProduct {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({
    languages: ['en', 'es', 'de'],
    default_language: 'en',
    type: 'varchar',
    length: 255,
  })
  name!: string;

  nameTranslations?: I18nValue<TestLanguages, string>;
}

@Injectable()
class JwtProductService {
  constructor(
    @InjectI18nRepository(JwtProduct)
    private readonly productRepo: I18nRepository<JwtProduct>,
  ) {}

  async findAll() {
    return this.productRepo.find();
  }

  getLanguage() {
    return this.productRepo.getLanguage();
  }
}

@Controller('jwt-products')
class JwtProductController {
  constructor(
    private readonly productService: JwtProductService,
    private readonly languageService: I18nLanguageService,
  ) {}

  @Get()
  async findAll() {
    return this.productService.findAll();
  }

  @Get('language')
  getLanguage() {
    return {
      serviceLanguage: this.languageService.getLanguage(),
      repoLanguage: this.productService.getLanguage(),
    };
  }
}

@Module({
  imports: [I18nModule.forFeature([JwtProduct])],
  controllers: [JwtProductController],
  providers: [JwtProductService],
})
class JwtProductModule {}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [JwtProduct],
      synchronize: true,
      subscribers: [I18nSubscriber],
    }),
    I18nModule.forRoot({
      languages: ['en', 'es', 'de'],
      defaultLanguage: 'en',
      resolveLanguage: fromJwtPayload('language'),
    }),
    JwtProductModule,
  ],
})
class JwtAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply mock JWT middleware BEFORE I18n middleware
    consumer.apply(MockJwtMiddleware).forRoutes('*');
    I18nModule.configure(consumer);
  }
}

describe('NestJS E2E - JWT Payload Language Extraction', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    resetI18nConfig();
    resetI18nColumnsFinalization();

    setI18nConfig({
      languages: ['en', 'es', 'de'],
      default_language: 'en',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [JwtAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // Seed test data
    const repo = dataSource.getRepository(JwtProduct);
    await repo.save([
      { name: 'Laptop', name_es: 'Portátil', name_de: 'Laptop' },
      { name: 'Phone', name_es: 'Teléfono', name_de: 'Telefon' },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    resetI18nConfig();
    resetI18nColumnsFinalization();
  });

  it('should extract language from JWT payload', async () => {
    const response = await request(app.getHttpServer())
      .get('/jwt-products')
      .set('X-Mock-Jwt-Language', 'es')
      .expect(200);

    expect(response.body[0].name).toBe('Portátil');
    expect(response.body[1].name).toBe('Teléfono');
  });

  it('should use default language when no JWT user', async () => {
    const response = await request(app.getHttpServer())
      .get('/jwt-products')
      .expect(200);

    expect(response.body[0].name).toBe('Laptop');
    expect(response.body[1].name).toBe('Phone');
  });

  it('should set language service from JWT', async () => {
    const response = await request(app.getHttpServer())
      .get('/jwt-products/language')
      .set('X-Mock-Jwt-Language', 'de')
      .expect(200);

    expect(response.body.serviceLanguage).toBe('de');
    expect(response.body.repoLanguage).toBe('de');
  });
});

// ============================================================================
// Cookie Language Extraction Tests
// ============================================================================

// Mock cookie parser middleware
@Injectable()
class MockCookieParserMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    // Parse cookies from Cookie header
    const cookieHeader = req.headers['cookie'];
    req.cookies = {};
    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie: string) => {
        const [name, value] = cookie.trim().split('=');
        req.cookies[name] = value;
      });
    }
    next();
  }
}

// Entity for Cookie tests
@Entity('cookie_products')
class CookieProduct {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({
    languages: ['en', 'es', 'de'],
    default_language: 'en',
    type: 'varchar',
    length: 255,
  })
  name!: string;

  nameTranslations?: I18nValue<TestLanguages, string>;
}

@Injectable()
class CookieProductService {
  constructor(
    @InjectI18nRepository(CookieProduct)
    private readonly productRepo: I18nRepository<CookieProduct>,
  ) {}

  async findAll() {
    return this.productRepo.find();
  }

  getLanguage() {
    return this.productRepo.getLanguage();
  }
}

@Controller('cookie-products')
class CookieProductController {
  constructor(
    private readonly productService: CookieProductService,
    private readonly languageService: I18nLanguageService,
  ) {}

  @Get()
  async findAll() {
    return this.productService.findAll();
  }

  @Get('language')
  getLanguage() {
    return {
      serviceLanguage: this.languageService.getLanguage(),
      repoLanguage: this.productService.getLanguage(),
    };
  }
}

@Module({
  imports: [I18nModule.forFeature([CookieProduct])],
  controllers: [CookieProductController],
  providers: [CookieProductService],
})
class CookieProductModule {}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [CookieProduct],
      synchronize: true,
      subscribers: [I18nSubscriber],
    }),
    I18nModule.forRoot({
      languages: ['en', 'es', 'de'],
      defaultLanguage: 'en',
      resolveLanguage: fromCookie('user_lang'),
    }),
    CookieProductModule,
  ],
})
class CookieAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply cookie parser BEFORE I18n middleware
    consumer.apply(MockCookieParserMiddleware).forRoutes('*');
    I18nModule.configure(consumer);
  }
}

describe('NestJS E2E - Cookie Language Extraction', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    resetI18nConfig();
    resetI18nColumnsFinalization();

    setI18nConfig({
      languages: ['en', 'es', 'de'],
      default_language: 'en',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CookieAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // Seed test data
    const repo = dataSource.getRepository(CookieProduct);
    await repo.save([
      { name: 'Book', name_es: 'Libro', name_de: 'Buch' },
      { name: 'Pen', name_es: 'Bolígrafo', name_de: 'Kugelschreiber' },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    resetI18nConfig();
    resetI18nColumnsFinalization();
  });

  it('should extract language from cookie', async () => {
    const response = await request(app.getHttpServer())
      .get('/cookie-products')
      .set('Cookie', 'user_lang=es')
      .expect(200);

    expect(response.body[0].name).toBe('Libro');
    expect(response.body[1].name).toBe('Bolígrafo');
  });

  it('should use default language when no cookie', async () => {
    const response = await request(app.getHttpServer())
      .get('/cookie-products')
      .expect(200);

    expect(response.body[0].name).toBe('Book');
    expect(response.body[1].name).toBe('Pen');
  });

  it('should handle multiple cookies', async () => {
    const response = await request(app.getHttpServer())
      .get('/cookie-products')
      .set('Cookie', 'session=abc123; user_lang=de; other=value')
      .expect(200);

    expect(response.body[0].name).toBe('Buch');
    expect(response.body[1].name).toBe('Kugelschreiber');
  });

  it('should set language service from cookie', async () => {
    const response = await request(app.getHttpServer())
      .get('/cookie-products/language')
      .set('Cookie', 'user_lang=es')
      .expect(200);

    expect(response.body.serviceLanguage).toBe('es');
    expect(response.body.repoLanguage).toBe('es');
  });
});

// ============================================================================
// Validated Resolver Tests
// ============================================================================

// Entity for validated tests
@Entity('validated_products')
class ValidatedProduct {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({
    languages: ['en', 'es', 'de'],
    default_language: 'en',
    type: 'varchar',
    length: 255,
  })
  name!: string;

  nameTranslations?: I18nValue<TestLanguages, string>;
}

@Injectable()
class ValidatedProductService {
  constructor(
    @InjectI18nRepository(ValidatedProduct)
    private readonly productRepo: I18nRepository<ValidatedProduct>,
  ) {}

  async findAll() {
    return this.productRepo.find();
  }

  getLanguage() {
    return this.productRepo.getLanguage();
  }
}

@Controller('validated-products')
class ValidatedProductController {
  constructor(
    private readonly productService: ValidatedProductService,
    private readonly languageService: I18nLanguageService,
  ) {}

  @Get()
  async findAll() {
    return this.productService.findAll();
  }

  @Get('language')
  getLanguage() {
    return {
      serviceLanguage: this.languageService.getLanguage(),
      repoLanguage: this.productService.getLanguage(),
    };
  }
}

@Module({
  imports: [I18nModule.forFeature([ValidatedProduct])],
  controllers: [ValidatedProductController],
  providers: [ValidatedProductService],
})
class ValidatedProductModule {}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [ValidatedProduct],
      synchronize: true,
      subscribers: [I18nSubscriber],
    }),
    I18nModule.forRoot({
      languages: ['en', 'es', 'de'],
      defaultLanguage: 'en',
      // Use validated wrapper - only allow 'en' and 'es', not 'de'
      resolveLanguage: validated(
        fromHeader('x-language'),
        ['en', 'es'],
      ),
    }),
    ValidatedProductModule,
  ],
})
class ValidatedAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    I18nModule.configure(consumer);
  }
}

describe('NestJS E2E - Validated Language Resolver', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    resetI18nConfig();
    resetI18nColumnsFinalization();

    setI18nConfig({
      languages: ['en', 'es', 'de'],
      default_language: 'en',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ValidatedAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // Seed test data
    const repo = dataSource.getRepository(ValidatedProduct);
    await repo.save([
      { name: 'Table', name_es: 'Mesa', name_de: 'Tisch' },
      { name: 'Chair', name_es: 'Silla', name_de: 'Stuhl' },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    resetI18nConfig();
    resetI18nColumnsFinalization();
  });

  it('should accept valid language', async () => {
    const response = await request(app.getHttpServer())
      .get('/validated-products')
      .set('X-Language', 'es')
      .expect(200);

    expect(response.body[0].name).toBe('Mesa');
    expect(response.body[1].name).toBe('Silla');
  });

  it('should reject invalid language and use default', async () => {
    // 'de' is not in the allowed list ['en', 'es']
    const response = await request(app.getHttpServer())
      .get('/validated-products')
      .set('X-Language', 'de')
      .expect(200);

    // Should fall back to default language 'en'
    expect(response.body[0].name).toBe('Table');
    expect(response.body[1].name).toBe('Chair');
  });

  it('should reject completely unknown language', async () => {
    const response = await request(app.getHttpServer())
      .get('/validated-products')
      .set('X-Language', 'fr')
      .expect(200);

    // Should fall back to default language 'en'
    expect(response.body[0].name).toBe('Table');
    expect(response.body[1].name).toBe('Chair');
  });

  it('should normalize case in validation', async () => {
    const response = await request(app.getHttpServer())
      .get('/validated-products')
      .set('X-Language', 'ES')
      .expect(200);

    // Should normalize 'ES' to 'es' and accept it
    expect(response.body[0].name).toBe('Mesa');
  });

  it('should show default language in service when invalid language provided', async () => {
    const response = await request(app.getHttpServer())
      .get('/validated-products/language')
      .set('X-Language', 'de')
      .expect(200);

    // 'de' is rejected, should fall back to 'en'
    expect(response.body.serviceLanguage).toBe('en');
    expect(response.body.repoLanguage).toBe('en');
  });
});
