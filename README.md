# TypeORM i18n

> **Under Development** - APIs may change without notice.

TypeORM extension for multilingual column support. Generates language-specific database columns from a single decorator and provides utilities for querying by language.

## Features

- `I18nValue<TLang, TValue>` type for compile-time language validation
- Generates columns per language (`name`, `name_es`, `name_fr`) from `@I18nColumn` decorator
- Global or per-column language configuration
- `I18nRepository` with language context - standard methods auto-translate
- `I18nQueryBuilder` with transparent i18n support
- NestJS module with request-scoped language resolution
- CQRS & Microservices support via `@I18nLanguageAware` decorator
- Works with TypeORM subscriber lifecycle
- Supports SQLite, PostgreSQL, MySQL

## Installation

```bash
npm install @sebsastianek/typeorm-i18n
```

## Quick Start

### 1. Configure Languages

```typescript
import { setI18nConfig } from '@sebsastianek/typeorm-i18n';

setI18nConfig({
  languages: ['en', 'es', 'fr'],
  default_language: 'en',
});
```

### 2. Define Entity

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { I18nColumn, I18nValue } from '@sebsastianek/typeorm-i18n';

type Languages = 'en' | 'es' | 'fr';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @I18nColumn({ type: 'varchar', length: 255 })
  name!: string;  // Current language value

  nameTranslations?: I18nValue<Languages, string>;  // All translations

  @I18nColumn({ type: 'text' })
  description!: string;

  descriptionTranslations?: I18nValue<Languages, string>;

  @Column('decimal')
  price: number;
}
```

Each `@I18nColumn` produces:
- Base property (`name`) - holds current language value based on repository context
- Virtual property (`nameTranslations`) - holds all translations as `I18nValue` object

Generated columns: `name` (default), `name_es`, `name_fr`

### 3. Register Subscriber

```typescript
import { DataSource } from 'typeorm';
import { I18nSubscriber } from '@sebsastianek/typeorm-i18n';

const dataSource = new DataSource({
  type: 'postgres',
  entities: [Product],
  subscribers: [I18nSubscriber],
});
```

### 4. Use Repository

```typescript
import { getI18nRepository } from '@sebsastianek/typeorm-i18n';

const repo = getI18nRepository(Product, dataSource);

// Set language context
repo.setLanguage('es');

// All queries now use Spanish columns automatically
const products = await repo.find({
  where: { name: 'Portátil' },  // Queries name_es column
  order: { name: 'ASC' },       // Orders by name_es column
});

console.log(products[0].name);                 // "Portátil" (current language)
console.log(products[0].nameTranslations?.en); // "Laptop" (all translations available)

repo.clearLanguage();  // Revert to default
```

> **Note:** TypeScript may show type errors for i18n properties in `where`/`order` clauses since it doesn't know about the language transformation. You can use `as any` or create typed wrappers if needed.

## CRUD Operations

```typescript
// Create with all translations
const product = new Product();
product.nameTranslations = {
  en: 'Laptop',
  es: 'Portátil',
  fr: 'Ordinateur portable',
};
product.price = 999.99;
await repo.save(product);

// Read - translations auto-populated
const loaded = await repo.findOne({ where: { id: product.id } });
console.log(loaded.name);              // Default language value
console.log(loaded.nameTranslations);  // { en: 'Laptop', es: 'Portátil', fr: '...' }

// Update translations
loaded.nameTranslations = { en: 'Gaming Laptop', es: 'Portátil Gaming', fr: 'PC Portable Gaming' };
await repo.save(loaded);  // I18nRepository handles translation columns automatically
```

## QueryBuilder

Standard QueryBuilder methods automatically translate i18n columns when language is set:

```typescript
import { Like } from 'typeorm';

repo.setLanguage('es');

const products = await repo
  .createQueryBuilder('product')
  .select(['product.id', 'product.name', 'product.price'])
  .where({ name: Like('%Portátil%') })   // Queries name_es
  .andWhere({ description: Like('%SSD%') }) // Queries description_es
  .orderBy('product.name', 'ASC')        // Orders by name_es
  .groupBy('product.name')               // Groups by name_es
  .getMany();
```

### Supported Auto-Translation Methods

**Repository methods:**
- `find`, `findOne`, `findBy`, `findOneBy`
- `findAndCount`, `findAndCountBy`
- `findOneOrFail`, `findOneByOrFail`
- `count`, `countBy`
- `exists`, `existsBy`

**QueryBuilder methods:**
- `where`, `andWhere`, `orWhere` (object syntax)
- `orderBy`, `addOrderBy`
- `select`, `addSelect`
- `groupBy`, `addGroupBy`

### Manual Column Mapping

For raw SQL or complex queries, use `getLanguageColumn()`:

```typescript
repo.setLanguage('es');
const column = repo.getLanguageColumn('name');  // Returns 'name_es'

const products = await repo
  .createQueryBuilder('product')
  .where(`product.${column} LIKE :search`, { search: '%Port%' })
  .getMany();
```

## Per-Column Language Override

Override global config for specific columns:

```typescript
@Entity()
export class Article {
  @I18nColumn({ type: 'varchar', length: 255 })
  title!: string;  // Uses global config (en, es, fr)

  titleTranslations?: I18nValue<'en' | 'es' | 'fr', string>;

  @I18nColumn({
    languages: ['en', 'de', 'ja'],  // Different languages
    default_language: 'en',
    type: 'text',
  })
  content!: string;

  contentTranslations?: I18nValue<'en' | 'de' | 'ja', string>;
}
```

## Binary Data

```typescript
@Entity()
export class Document {
  @I18nColumn({ type: 'blob' })  // 'bytea' for PostgreSQL
  file!: Buffer;

  fileTranslations?: I18nValue<'en' | 'es', Buffer>;
}

const doc = new Document();
doc.fileTranslations = {
  en: Buffer.from('English content'),
  es: Buffer.from('Contenido en español'),
};
await repo.save(doc);
```

## NestJS Integration

### Module Setup

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { I18nSubscriber } from '@sebsastianek/typeorm-i18n';
import { I18nModule } from '@sebsastianek/typeorm-i18n/nestjs';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      subscribers: [I18nSubscriber],
    }),
    I18nModule.forRoot({
      languages: ['en', 'es', 'fr'],
      defaultLanguage: 'en',
      resolveLanguage: (req) => req.headers['accept-language']?.split(',')[0] || null,
    }),
    I18nModule.forFeature([Product]),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    I18nModule.configure(consumer);
  }
}
```

### Service Usage

```typescript
import { Injectable } from '@nestjs/common';
import { I18nRepository } from '@sebsastianek/typeorm-i18n';
import { InjectI18nRepository } from '@sebsastianek/typeorm-i18n/nestjs';

@Injectable()
export class ProductService {
  constructor(
    @InjectI18nRepository(Product)
    private readonly productRepo: I18nRepository<Product>,
  ) {}

  async findAll() {
    // Language automatically set from request via middleware
    return this.productRepo.find();
  }
}
```

### Async Configuration

```typescript
I18nModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    languages: config.get('I18N_LANGUAGES').split(','),
    defaultLanguage: config.get('I18N_DEFAULT'),
    resolveLanguage: (req) => req.user?.language || null,
  }),
  inject: [ConfigService],
})
```

### Language Resolvers

Built-in resolver functions for common use cases:

```typescript
import {
  fromHeader,
  fromQuery,
  fromCookie,
  fromJwtPayload,
  chain,
  validated,
} from '@sebsastianek/typeorm-i18n/nestjs';

I18nModule.forRoot({
  languages: ['en', 'es', 'fr'],
  defaultLanguage: 'en',
  resolveLanguage: chain(
    fromQuery('lang'),              // ?lang=es
    fromHeader('x-language'),       // X-Language: es
    fromCookie('user_lang'),        // Cookie: user_lang=es
    fromJwtPayload('language'),     // JWT { language: 'es' }
    fromHeader('accept-language'),  // Accept-Language: es-ES,es;q=0.9
  ),
})

// Validate against allowed languages
I18nModule.forRoot({
  languages: ['en', 'es', 'fr'],
  defaultLanguage: 'en',
  resolveLanguage: validated(
    chain(fromQuery('lang'), fromHeader('accept-language')),
    ['en', 'es', 'fr'],  // Only allow these languages
  ),
})
```

### CQRS & Microservices

For CQRS handlers and microservice consumers, use `@I18nLanguageAware` decorator to transparently extract language from commands, queries, or message payloads:

```typescript
import { I18nLanguageAware, WithLanguage } from '@sebsastianek/typeorm-i18n/nestjs';

// Define command with language field
class CreateProductCommand implements WithLanguage {
  constructor(
    public readonly name: string,
    public readonly language?: string,  // Add language field
  ) {}
}

// CQRS Handler
@CommandHandler(CreateProductCommand)
export class CreateProductHandler {
  constructor(
    @InjectI18nRepository(Product) private productRepo: I18nRepository<Product>,
  ) {}

  @I18nLanguageAware()  // Automatically sets language on all repos
  async execute(command: CreateProductCommand) {
    return this.productRepo.save({ name: command.name });
  }
}
```

For microservices, the decorator extracts language from payload or context headers (Kafka, RabbitMQ, gRPC):

```typescript
@Controller()
export class ProductController {
  constructor(
    @InjectI18nRepository(Product) private productRepo: I18nRepository<Product>,
  ) {}

  @MessagePattern('product.create')
  @I18nLanguageAware()  // Extracts from payload.language or x-language header
  async handleCreate(@Payload() data: any, @Ctx() context: any) {
    return this.productRepo.save(data);
  }
}
```

#### Global Extraction Config

Configure field names globally instead of per-decorator:

```typescript
I18nModule.forRoot({
  languages: ['en', 'es', 'fr'],
  defaultLanguage: 'en',
  languageExtraction: {
    field: 'locale',        // Payload field (default: 'language')
    headerField: 'x-lang',  // Header field (default: 'x-language')
  },
})

// Now all handlers use 'locale' field automatically
@I18nLanguageAware()  // Uses { locale: 'es' } from payload
async execute(command: { locale?: string }) { ... }
```

Override per-handler when needed:

```typescript
@I18nLanguageAware({ field: 'customField' })  // Overrides global config
async execute(command: { customField?: string }) { ... }
```

## API Reference

### `setI18nConfig(config)`

Set global i18n configuration:

```typescript
setI18nConfig({
  languages: ['en', 'es', 'fr'],
  default_language: 'en',
});
```

### `@I18nColumn(options)`

Options:
- `type` (required): Column type ('varchar', 'text', 'blob', etc.)
- `languages`: Language codes array (defaults to global config)
- `default_language`: Default language (defaults to global config)
- `length`: Column length for varchar
- `nullable`: Allow null values
- Other TypeORM ColumnOptions

### `getI18nRepository<Entity>(entity, dataSource)`

Returns `I18nRepository<Entity>` with:
- `setLanguage(lang)`: Set query language (case-insensitive)
- `getLanguage()`: Get current language
- `clearLanguage()`: Reset to default
- `getLanguageColumn(property)`: Get column name for current language
- `createQueryBuilder(alias)`: Returns `I18nQueryBuilder` with auto-translation
- All standard TypeORM Repository methods with i18n auto-translation

### `prepareI18nUpdate(entity)`

Copies `propertyTranslations` to raw columns. Only needed with standard TypeORM repository:

```typescript
// Standard TypeORM repository - manual preparation required
const repo = dataSource.getRepository(Product);
entity.nameTranslations = { en: 'New', es: 'Nuevo', fr: 'Nouveau' };
prepareI18nUpdate(entity);
await repo.save(entity);

// I18nRepository - automatic
const i18nRepo = getI18nRepository(Product, dataSource);
entity.nameTranslations = { en: 'New', es: 'Nuevo', fr: 'Nouveau' };
await i18nRepo.save(entity);  // No prepareI18nUpdate needed
```

### `@I18nLanguageAware(options?)`

Method decorator for CQRS handlers and microservice consumers. Automatically extracts language from payload/command and sets it on all `I18nRepository` instances on the handler.

Options:
- `field`: Payload field name (default: from config or `'language'`)
- `headerField`: Header field for microservices (default: from config or `'x-language'`)
- `defaultLanguage`: Fallback language

```typescript
@I18nLanguageAware({ field: 'locale', defaultLanguage: 'en' })
async execute(command: { locale?: string }) { ... }
```

### `@I18nLanguageAwareHandler(options?)`

Class decorator alternative - wraps the `execute` method automatically:

```typescript
@CommandHandler(CreateProductCommand)
@I18nLanguageAwareHandler()
export class CreateProductHandler {
  async execute(command: CreateProductCommand) { ... }
}
```

### `I18nValue<TLang, TValue>`

Type for translation objects:

```typescript
type I18nValue<TLang extends string, TValue = string> = {
  [K in TLang]: TValue;
};
```

## Database Schema

For `@I18nColumn` with languages `['en', 'es', 'fr']` and default `'en'`:

| Column | Type | Nullable |
|--------|------|----------|
| `name` | varchar(255) | No |
| `name_es` | varchar(255) | Yes |
| `name_fr` | varchar(255) | Yes |

## Testing

```bash
npm test                    # SQLite
DB_TYPE=postgres npm test   # PostgreSQL
DB_TYPE=mysql npm test      # MySQL
```

## License

MIT
