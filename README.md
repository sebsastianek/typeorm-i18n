# TypeORM i18n

> **Under Development** - APIs may change without notice.

TypeORM extension for multilingual column support. Generates language-specific database columns from a single decorator and provides utilities for querying by language.

## Features

- `I18nValue<TLang, TValue>` type for compile-time language validation
- Generates columns per language (`name`, `name_es`, `name_fr`) from `@I18nColumn` decorator
- Global or per-column language configuration
- `I18nRepository` with language context for queries
- `I18nQueryBuilder` with `whereLanguage()`, `orderByLanguage()` methods
- `i18nWhere<T>()` helper for typed where clauses
- NestJS module with request-scoped language resolution
- Works with TypeORM subscriber lifecycle
- Supports SQLite, PostgreSQL, MySQL

## Setup

### 1. Global Configuration

```typescript
import { setI18nConfig } from '@sebsastianek/typeorm-i18n';

setI18nConfig({
  languages: ['en', 'es', 'fr'],
  default_language: 'en',
});
```

### 2. Entity Definition

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

Generated columns:
- `name` (default language)
- `name_es`
- `name_fr`

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

### 4. Repository Usage

```typescript
import { getI18nRepository, i18nWhere } from '@sebsastianek/typeorm-i18n';

const repo = getI18nRepository(Product, dataSource);

// Set language context (case-insensitive)
repo.setLanguage('es');

// Queries use language-specific columns
const products = await repo.find({
  where: i18nWhere<Product>({ name: 'Portátil' })  // Queries name_es
});

// Loaded entities have language-specific values
console.log(products[0].name);  // "Portátil"
console.log(products[0].nameTranslations?.en);  // "Laptop"

repo.clearLanguage();  // Revert to default
```

### 5. CRUD Operations

```typescript
// Create
const product = new Product();
product.nameTranslations = {
  en: 'Laptop',
  es: 'Portátil',
  fr: 'Ordinateur portable',
};
product.price = 999.99;
await repo.save(product);

// Read
const loaded = await repo.findOne({ where: { id: product.id } });
console.log(loaded.name);  // Default language value
console.log(loaded.nameTranslations);  // All translations

// Update - requires prepareI18nUpdate()
import { prepareI18nUpdate } from '@sebsastianek/typeorm-i18n';

loaded.nameTranslations = { en: 'New Name', es: 'Nuevo', fr: 'Nouveau' };
prepareI18nUpdate(loaded);  // Copies translations to raw columns for TypeORM change detection
await repo.save(loaded);
```

## QueryBuilder

### Language-Aware Methods

```typescript
repo.setLanguage('es');

const products = await repo
  .createQueryBuilder('product')
  .whereLanguage('name', '=', 'Portátil')
  .andWhereLanguage('description', 'LIKE', '%laptop%')
  .orderByLanguage('name', 'ASC')
  .getMany();
```

Available methods:
- `whereLanguage(property, operator, value)`
- `andWhereLanguage(property, operator, value)`
- `orWhereLanguage(property, operator, value)`
- `orderByLanguage(property, 'ASC' | 'DESC')`
- `addOrderByLanguage(property, 'ASC' | 'DESC')`
- `selectLanguage([properties])`
- `addSelectLanguage([properties])`

### Manual Column Mapping

```typescript
repo.setLanguage('es');
const column = repo.getLanguageColumn('name');  // Returns 'name_es'

const products = await repo
  .createQueryBuilder('product')
  .where(`product.${column} LIKE :search`, { search: '%Port%' })
  .getMany();
```

## Type Helpers

```typescript
import { i18nWhere, i18nWhereMany } from '@sebsastianek/typeorm-i18n';

// Single condition
const products = await repo.find({
  where: i18nWhere<Product>({ name: 'Portátil' })
});

// OR conditions
const products = await repo.find({
  where: i18nWhereMany<Product>([
    { name: 'Portátil' },
    { name: 'Ratón' }
  ])
});
```

## Per-Column Language Override

```typescript
@Entity()
export class Article {
  @I18nColumn({ type: 'varchar', length: 255 })
  title!: string;  // Uses global config

  titleTranslations?: I18nValue<'en' | 'es' | 'fr', string>;

  @I18nColumn({
    languages: ['en', 'de', 'ja'],  // Override
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
  en: Buffer.from('English'),
  es: Buffer.from('Español'),
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
    // Language set from request via middleware
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

## API Reference

### `setI18nConfig(config)`

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
- `length`: Column length
- `nullable`: Allow null values
- Other TypeORM ColumnOptions

### `getI18nRepository<Entity>(entity, dataSource)`

Returns `I18nRepository` with methods:
- `setLanguage(lang)`: Set query language
- `getLanguage()`: Get current language
- `clearLanguage()`: Reset to default
- `getLanguageColumn(property)`: Get column name for current language
- `createQueryBuilder(alias)`: Returns `I18nQueryBuilder`
- Standard TypeORM Repository methods

### `prepareI18nUpdate(entity)`

Copies `propertyTranslations` values to raw columns. Required before `save()` when updating translations. TypeORM change detection compares raw column values.

```typescript
entity.nameTranslations = { en: 'New', es: 'Nuevo', fr: 'Nouveau' };
prepareI18nUpdate(entity);
await repo.save(entity);
```

### `I18nValue<TLang, TValue>`

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
