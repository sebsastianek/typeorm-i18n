import { Test, TestingModule } from '@nestjs/testing';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule, CommandHandler, ICommandHandler, QueryHandler, IQueryHandler, CommandBus, QueryBus } from '@nestjs/cqrs';
import { DataSource, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  I18nModule,
  InjectI18nRepository,
  I18nLanguageService,
  I18nLanguageAware,
  I18nLanguageAwareHandler,
  WithLanguage,
} from '../src/nestjs';
import { I18nColumn, I18nValue, I18nRepository, setI18nConfig, resetI18nConfig, I18nSubscriber } from '../src';
import { resetI18nColumnsFinalization } from '../src/decorator';

// ============================================================================
// Test Entity
// ============================================================================

type TestLanguages = 'en' | 'es' | 'de';

@Entity('cqrs_products')
class CqrsProduct {
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
}

// ============================================================================
// Commands & Queries
// ============================================================================

// Command with language field
class CreateProductCommand implements WithLanguage {
  constructor(
    public readonly nameTranslations: I18nValue<TestLanguages, string>,
    public readonly descriptionTranslations: I18nValue<TestLanguages, string>,
    public readonly language?: string,
  ) {}
}

// Query with language field
class GetProductQuery implements WithLanguage {
  constructor(
    public readonly id: number,
    public readonly language?: string,
  ) {}
}

// Query for all products
class GetAllProductsQuery implements WithLanguage {
  constructor(public readonly language?: string) {}
}

// Command with custom language field name
class UpdateProductCommand {
  constructor(
    public readonly id: number,
    public readonly nameTranslations: I18nValue<TestLanguages, string>,
    public readonly lang?: string, // Custom field name
  ) {}
}

// ============================================================================
// Command Handlers with @I18nLanguageAware method decorator
// ============================================================================

@CommandHandler(CreateProductCommand)
class CreateProductHandler implements ICommandHandler<CreateProductCommand> {
  constructor(
    @InjectI18nRepository(CqrsProduct)
    private readonly productRepo: I18nRepository<CqrsProduct>,
  ) {}

  @I18nLanguageAware()
  async execute(command: CreateProductCommand): Promise<CqrsProduct> {
    const product = this.productRepo.create();
    product.nameTranslations = command.nameTranslations;
    product.descriptionTranslations = command.descriptionTranslations;
    return this.productRepo.save(product);
  }
}

@CommandHandler(UpdateProductCommand)
class UpdateProductHandler implements ICommandHandler<UpdateProductCommand> {
  constructor(
    @InjectI18nRepository(CqrsProduct)
    private readonly productRepo: I18nRepository<CqrsProduct>,
  ) {}

  // Custom field name for language
  @I18nLanguageAware({ field: 'lang' })
  async execute(command: UpdateProductCommand): Promise<CqrsProduct | null> {
    const product = await this.productRepo.findOne({ where: { id: command.id } });
    if (!product) return null;
    product.nameTranslations = command.nameTranslations;
    return this.productRepo.save(product);
  }
}

// ============================================================================
// Query Handlers with @I18nLanguageAware method decorator
// ============================================================================

@QueryHandler(GetProductQuery)
class GetProductHandler implements IQueryHandler<GetProductQuery> {
  constructor(
    @InjectI18nRepository(CqrsProduct)
    private readonly productRepo: I18nRepository<CqrsProduct>,
  ) {}

  @I18nLanguageAware()
  async execute(query: GetProductQuery): Promise<CqrsProduct | null> {
    return this.productRepo.findOne({ where: { id: query.id } });
  }
}

@QueryHandler(GetAllProductsQuery)
class GetAllProductsHandler implements IQueryHandler<GetAllProductsQuery> {
  constructor(
    @InjectI18nRepository(CqrsProduct)
    private readonly productRepo: I18nRepository<CqrsProduct>,
  ) {}

  @I18nLanguageAware()
  async execute(_query: GetAllProductsQuery): Promise<CqrsProduct[]> {
    return this.productRepo.find();
  }
}

// ============================================================================
// Handler with @I18nLanguageAwareHandler class decorator
// ============================================================================

class GetProductByNameQuery implements WithLanguage {
  constructor(
    public readonly name: string,
    public readonly language?: string,
  ) {}
}

@QueryHandler(GetProductByNameQuery)
@I18nLanguageAwareHandler()
class GetProductByNameHandler implements IQueryHandler<GetProductByNameQuery> {
  constructor(
    @InjectI18nRepository(CqrsProduct)
    private readonly productRepo: I18nRepository<CqrsProduct>,
  ) {}

  async execute(query: GetProductByNameQuery): Promise<CqrsProduct[]> {
    // Note: This searches in the current language column
    return this.productRepo.find({ where: { name: query.name } as any });
  }
}

// ============================================================================
// Handler with I18nLanguageService injection
// ============================================================================

class GetLanguageQuery implements WithLanguage {
  constructor(public readonly language?: string) {}
}

@QueryHandler(GetLanguageQuery)
class GetLanguageHandler implements IQueryHandler<GetLanguageQuery> {
  constructor(
    @InjectI18nRepository(CqrsProduct)
    private readonly productRepo: I18nRepository<CqrsProduct>,
    private readonly i18nLanguageService: I18nLanguageService,
  ) {}

  @I18nLanguageAware()
  async execute(_query: GetLanguageQuery): Promise<{ serviceLanguage: string | null; repoLanguage: string | null }> {
    return {
      serviceLanguage: this.i18nLanguageService.getLanguage(),
      repoLanguage: this.productRepo.getLanguage(),
    };
  }
}

// ============================================================================
// Test Module Setup
// ============================================================================

@Module({
  imports: [
    I18nModule.forFeature([CqrsProduct]),
    CqrsModule,
  ],
  providers: [
    CreateProductHandler,
    UpdateProductHandler,
    GetProductHandler,
    GetAllProductsHandler,
    GetProductByNameHandler,
    GetLanguageHandler,
  ],
})
class CqrsProductModule {}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [CqrsProduct],
      synchronize: true,
      subscribers: [I18nSubscriber],
    }),
    I18nModule.forRoot({
      languages: ['en', 'es', 'de'],
      defaultLanguage: 'en',
    }),
    CqrsProductModule,
  ],
})
class CqrsAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    I18nModule.configure(consumer);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('CQRS E2E - Language-Aware Handlers', () => {
  let moduleRef: TestingModule;
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let dataSource: DataSource;

  beforeAll(async () => {
    resetI18nConfig();
    resetI18nColumnsFinalization();

    setI18nConfig({
      languages: ['en', 'es', 'de'],
      default_language: 'en',
    });

    moduleRef = await Test.createTestingModule({
      imports: [CqrsAppModule],
    }).compile();

    await moduleRef.init();

    commandBus = moduleRef.get(CommandBus);
    queryBus = moduleRef.get(QueryBus);
    dataSource = moduleRef.get(DataSource);

    // Seed test data
    const repo = dataSource.getRepository(CqrsProduct);
    await repo.save([
      {
        name: 'Laptop',
        name_es: 'Portátil',
        name_de: 'Laptop',
        description: 'High-performance laptop',
        description_es: 'Portátil de alto rendimiento',
        description_de: 'Hochleistungs-Laptop',
      },
      {
        name: 'Mouse',
        name_es: 'Ratón',
        name_de: 'Maus',
        description: 'Wireless mouse',
        description_es: 'Ratón inalámbrico',
        description_de: 'Kabellose Maus',
      },
    ]);
  });

  afterAll(async () => {
    await moduleRef?.close();
    resetI18nConfig();
    resetI18nColumnsFinalization();
  });

  describe('@I18nLanguageAware Method Decorator', () => {
    describe('Query Handlers', () => {
      it('should extract language from query and return translated product', async () => {
        const result = await queryBus.execute(new GetProductQuery(1, 'es'));

        expect(result).toBeDefined();
        expect(result.name).toBe('Portátil');
        expect(result.description).toBe('Portátil de alto rendimiento');
        expect(result.nameTranslations).toEqual({
          en: 'Laptop',
          es: 'Portátil',
          de: 'Laptop',
        });
      });

      it('should use default language when no language specified', async () => {
        const result = await queryBus.execute(new GetProductQuery(1));

        expect(result).toBeDefined();
        expect(result.name).toBe('Laptop');
        expect(result.description).toBe('High-performance laptop');
      });

      it('should return all products in specified language', async () => {
        const results = await queryBus.execute(new GetAllProductsQuery('de'));

        expect(results).toHaveLength(2);
        expect(results[0].name).toBe('Laptop');
        expect(results[1].name).toBe('Maus');
      });

      it('should set language on both service and repository', async () => {
        const result = await queryBus.execute(new GetLanguageQuery('es'));

        expect(result.serviceLanguage).toBe('es');
        expect(result.repoLanguage).toBe('es');
      });
    });

    describe('Command Handlers', () => {
      it('should create product with language context', async () => {
        const command = new CreateProductCommand(
          { en: 'Keyboard', es: 'Teclado', de: 'Tastatur' },
          { en: 'Mechanical keyboard', es: 'Teclado mecánico', de: 'Mechanische Tastatur' },
          'es',
        );

        const created = await commandBus.execute(command);

        expect(created.id).toBeDefined();
        // All translations should be saved correctly
        expect(created.nameTranslations).toEqual({
          en: 'Keyboard',
          es: 'Teclado',
          de: 'Tastatur',
        });

        // Verify by querying with Spanish language
        const fetched = await queryBus.execute(new GetProductQuery(created.id, 'es'));
        expect(fetched.name).toBe('Teclado');
      });

      it('should use custom field name for language', async () => {
        // First create a product to update
        const createCommand = new CreateProductCommand(
          { en: 'Monitor', es: 'Monitor', de: 'Monitor' },
          { en: 'LCD Monitor', es: 'Monitor LCD', de: 'LCD-Monitor' },
        );
        const created = await commandBus.execute(createCommand);

        // Update with custom 'lang' field
        const updateCommand = new UpdateProductCommand(
          created.id,
          { en: 'Display', es: 'Pantalla', de: 'Bildschirm' },
          'de', // Using 'lang' field instead of 'language'
        );

        const updated = await commandBus.execute(updateCommand);

        expect(updated).toBeDefined();
        // All translations should be updated correctly
        expect(updated.nameTranslations.en).toBe('Display');
        expect(updated.nameTranslations.es).toBe('Pantalla');
        expect(updated.nameTranslations.de).toBe('Bildschirm');

        // Verify by querying with German language
        const fetched = await queryBus.execute(new GetProductQuery(created.id, 'de'));
        expect(fetched.name).toBe('Bildschirm');
      });
    });
  });

  describe('@I18nLanguageAwareHandler Class Decorator', () => {
    it('should extract language from query in class-decorated handler', async () => {
      const results = await queryBus.execute(new GetProductByNameQuery('Portátil', 'es'));

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Portátil');
      expect(results[0].nameTranslations.en).toBe('Laptop');
    });

    it('should search in default language when no language specified', async () => {
      const results = await queryBus.execute(new GetProductByNameQuery('Mouse'));

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Mouse');
    });

    it('should not find when searching with wrong language context', async () => {
      // Search for Spanish name with German language context
      const results = await queryBus.execute(new GetProductByNameQuery('Ratón', 'de'));

      expect(results).toHaveLength(0);
    });
  });

  describe('Language Isolation Between Queries', () => {
    it('should handle sequential queries with different languages', async () => {
      const esResult = await queryBus.execute(new GetProductQuery(2, 'es'));
      const deResult = await queryBus.execute(new GetProductQuery(2, 'de'));
      const enResult = await queryBus.execute(new GetProductQuery(2, 'en'));

      expect(esResult.name).toBe('Ratón');
      expect(deResult.name).toBe('Maus');
      expect(enResult.name).toBe('Mouse');
    });
  });
});

// ============================================================================
// Microservice Message Handler Tests (Unit Tests for Decorator Behavior)
// ============================================================================

// Simulated Kafka message context
function createKafkaContext(headers: Record<string, string>) {
  return {
    getMessage: () => ({
      headers: Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k, Buffer.from(v)])
      ),
    }),
  };
}

// Simulated RabbitMQ message context
function createRabbitMQContext(headers: Record<string, string>) {
  return {
    getMessage: () => ({
      properties: { headers },
    }),
  };
}

// Mock repository that tracks language
class MockI18nRepository {
  private language: string | null = null;

  setLanguage(lang: string) {
    this.language = lang;
  }

  getLanguage() {
    return this.language;
  }

  async find() {
    return [{ id: 1, name: this.language === 'es' ? 'Portátil' : this.language === 'de' ? 'Laptop-DE' : 'Laptop' }];
  }
}

// Mock language service
class MockLanguageService {
  private language: string | null = null;

  setLanguage(lang: string) {
    this.language = lang;
  }

  getLanguage() {
    return this.language;
  }
}

// Handler class with decorator applied manually for testing
class TestMessageHandler {
  // Public properties that @I18nLanguageAware looks for
  public productRepo = new MockI18nRepository();
  public i18nLanguageService = new MockLanguageService();

  @I18nLanguageAware()
  async handleMessage(_payload: any, _context?: any): Promise<{ products: any[]; repoLanguage: string | null; serviceLanguage: string | null }> {
    return {
      products: await this.productRepo.find(),
      repoLanguage: this.productRepo.getLanguage(),
      serviceLanguage: this.i18nLanguageService.getLanguage(),
    };
  }

  @I18nLanguageAware({ headerField: 'x-lang' })
  async handleMessageCustomHeader(_payload: any, _context?: any): Promise<{ repoLanguage: string | null }> {
    return {
      repoLanguage: this.productRepo.getLanguage(),
    };
  }

  @I18nLanguageAware({ field: 'lang', defaultLanguage: 'fr' })
  async handleMessageWithDefaults(_payload: any, _context?: any): Promise<{ repoLanguage: string | null }> {
    return {
      repoLanguage: this.productRepo.getLanguage(),
    };
  }
}

describe('Microservice - @I18nLanguageAware Decorator Behavior', () => {
  let handler: TestMessageHandler;

  beforeEach(() => {
    handler = new TestMessageHandler();
  });

  describe('Payload Language Extraction', () => {
    it('should extract language from message payload', async () => {
      const result = await handler.handleMessage({ language: 'es' });

      expect(result.repoLanguage).toBe('es');
      expect(result.serviceLanguage).toBe('es');
      expect(result.products[0].name).toBe('Portátil');
    });

    it('should not set language when no language in payload', async () => {
      const result = await handler.handleMessage({});

      expect(result.repoLanguage).toBeNull();
      expect(result.serviceLanguage).toBeNull();
    });

    it('should use custom field name for language', async () => {
      const result = await handler.handleMessageWithDefaults({ lang: 'de' });

      expect(result.repoLanguage).toBe('de');
    });

    it('should use default language when no language found', async () => {
      const result = await handler.handleMessageWithDefaults({});

      expect(result.repoLanguage).toBe('fr'); // Default from decorator options
    });
  });

  describe('Kafka Context Language Extraction', () => {
    it('should extract language from Kafka message headers', async () => {
      const context = createKafkaContext({ 'x-language': 'de' });
      const result = await handler.handleMessage({}, context);

      expect(result.repoLanguage).toBe('de');
      expect(result.products[0].name).toBe('Laptop-DE');
    });

    it('should prefer payload language over context header', async () => {
      const context = createKafkaContext({ 'x-language': 'de' });
      const result = await handler.handleMessage({ language: 'es' }, context);

      expect(result.repoLanguage).toBe('es');
      expect(result.products[0].name).toBe('Portátil');
    });
  });

  describe('RabbitMQ Context Language Extraction', () => {
    it('should extract language from RabbitMQ message headers', async () => {
      const context = createRabbitMQContext({ 'x-language': 'es' });
      const result = await handler.handleMessage({}, context);

      expect(result.repoLanguage).toBe('es');
      expect(result.products[0].name).toBe('Portátil');
    });
  });

  describe('Custom Header Field', () => {
    it('should use custom header field name', async () => {
      const context = createKafkaContext({ 'x-lang': 'de' });
      const result = await handler.handleMessageCustomHeader({}, context);

      expect(result.repoLanguage).toBe('de');
    });

    it('should not find language with wrong header field', async () => {
      // Using default 'x-language' header, but handler expects 'x-lang'
      const context = createKafkaContext({ 'x-language': 'es' });
      const result = await handler.handleMessageCustomHeader({}, context);

      expect(result.repoLanguage).toBeNull();
    });
  });

  describe('Sets Language on All Repos', () => {
    it('should set language on multiple repos', async () => {
      // Add a second repo
      const secondRepo = new MockI18nRepository();
      (handler as any).anotherRepo = secondRepo;

      await handler.handleMessage({ language: 'es' });

      expect(handler.productRepo.getLanguage()).toBe('es');
      expect(secondRepo.getLanguage()).toBe('es');
    });
  });
});
