# TypeORM i18n

> **⚠️ Under Development**
> This library is currently under active development and is not yet production-ready. APIs may change without notice.

TypeORM extension for multilingual database support with strong typing and automatic column management.

## Features

- Strong typing with `I18nValue<TLang, TValue>` for compile-time safety
- Automatic column generation - creates `name_es`, `name_fr`, etc. from a single decorator
- Global configuration - define languages once, use everywhere
- Language context repository - set current language and query automatically
- Transparent transformations - works with TypeORM lifecycle
- Multiple database support - SQLite, PostgreSQL, MySQL, and more
- Decorator-based API

## Installation

```bash
npm install @sebsastianek/typeorm-i18n
```

## Quick Start

### 1. Configure Global Settings (Optional but Recommended)

```typescript
import { setI18nConfig } from '@sebsastianek/typeorm-i18n';

// Set once at application startup
setI18nConfig({
  languages: ['en', 'es', 'fr'],
  default_language: 'en',
});
```

### 2. Define Your Entity

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { I18nColumn, I18nValue } from '@sebsastianek/typeorm-i18n';

type SupportedLanguages = 'en' | 'es' | 'fr';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @I18nColumn({
    type: 'varchar',
    length: 255,
  })
  name: I18nValue<SupportedLanguages, string>;

  @I18nColumn({
    type: 'text',
  })
  description: I18nValue<SupportedLanguages, string>;

  @Column('decimal')
  price: number;
}
```

This automatically creates database columns:
- `name` (English - default language)
- `name_es` (Spanish)
- `name_fr` (French)
- `description` (English)
- `description_es` (Spanish)
- `description_fr` (French)

### 3. Register the Subscriber

```typescript
import { DataSource } from 'typeorm';
import { I18nSubscriber } from '@sebsastianek/typeorm-i18n';

const dataSource = new DataSource({
  type: 'postgres',
  // ... other options
  entities: [Product],
  subscribers: [I18nSubscriber],
});
```

### 4. Use Language-Context Repository

```typescript
import { getI18nRepository } from '@sebsastianek/typeorm-i18n';

// Create repository with language context
const productRepo = getI18nRepository(Product, dataSource);

// Set current language
productRepo.setLanguage('es');

// Query automatically uses Spanish columns
const products = await productRepo.find({
  where: { name: 'Portátil' }  // Searches name_es column
});

// Switch language dynamically
productRepo.setLanguage('fr');
const frenchProducts = await productRepo.find({
  where: { name: 'Ordinateur portable' }  // Searches name_fr column
});

// Clear language context (reverts to default)
productRepo.clearLanguage();
```

### 5. Working with Data

```typescript
// Create a product
const product = new Product();
product.name = {
  en: 'Laptop',
  es: 'Portátil',
  fr: 'Ordinateur portable',
};
product.description = {
  en: 'Powerful laptop',
  es: 'Portátil potente',
  fr: 'Ordinateur portable puissant',
};
product.price = 999.99;

await dataSource.manager.save(product);

// Load and access translations
const loaded = await dataSource.manager.findOne(Product, {
  where: { id: product.id }
});

console.log(loaded.name.en);  // "Laptop"
console.log(loaded.name.es);  // "Portátil"
console.log(loaded.name.fr);  // "Ordinateur portable"
```

## Advanced Usage

### Using QueryBuilder with Language Context

```typescript
const repo = getI18nRepository(Product, dataSource);
repo.setLanguage('es');

// Get the language-specific column name
const nameColumn = repo.getLanguageColumn('name');  // Returns 'name_es'

const products = await repo
  .createQueryBuilder('product')
  .where(`product.${nameColumn} LIKE :search`, { search: '%Port%' })
  .getMany();
```

### Column-Level Configuration Override

You can override global configuration per column:

```typescript
@Entity()
export class Article {
  // Uses global configuration
  @I18nColumn({
    type: 'varchar',
    length: 255,
  })
  title: I18nValue<SupportedLanguages, string>;

  // Override with different languages for this column
  @I18nColumn({
    languages: ['en', 'de', 'ja'],
    default_language: 'en',
    type: 'text',
  })
  content: I18nValue<'en' | 'de' | 'ja', string>;
}
```

### Working with Binary Data

```typescript
type Languages = 'en' | 'es' | 'fr';

@Entity()
export class Document {
  @I18nColumn({
    type: 'blob',  // Use 'bytea' for PostgreSQL
  })
  file: I18nValue<Languages, Buffer>;
}

// Usage
const doc = new Document();
doc.file = {
  en: Buffer.from('English content'),
  es: Buffer.from('Contenido en español'),
  fr: Buffer.from('Contenu français'),
};
```

### Helper Functions

```typescript
import {
  createI18nValue,
  getTranslation,
  flattenI18nValue,
} from '@sebsastianek/typeorm-i18n';

// Create an I18nValue object
const name = createI18nValue<'en' | 'es' | 'fr', string>({
  en: 'Hello',
  es: 'Hola',
  fr: 'Bonjour',
});

// Get translation with fallback
const translation = getTranslation(name, 'es', 'en');  // Returns 'Hola'

// Flatten to database format
const flattened = flattenI18nValue('name', name, 'en');
// Returns: { name: 'Hello', name_es: 'Hola', name_fr: 'Bonjour' }
```

## API Reference

### `setI18nConfig(config: I18nGlobalConfig)`

Set global configuration for all I18nColumn decorators.

```typescript
setI18nConfig({
  languages: ['en', 'es', 'fr'],
  default_language: 'en',
});
```

### `@I18nColumn(options: I18nColumnOptions)`

Decorator for multilingual columns. Combines both TypeORM `@Column` and i18n functionality.

**Options:**
- `type` (required): Database column type ('varchar', 'text', 'int', 'blob', etc.)
- `languages` (optional): Array of language codes (uses global config if not provided)
- `default_language` (optional): Default language code (uses global config if not provided)
- `length` (optional): Column length for varchar types
- `nullable` (optional): Whether column is nullable
- All other TypeORM ColumnOptions are supported

### `getI18nRepository<Entity>(entity, dataSource, defaultLanguage?)`

Create an I18nRepository instance with language context support.

**Methods:**
- `setLanguage(lang: string)`: Set current language for queries (chainable)
- `getLanguage()`: Get current language
- `clearLanguage()`: Clear language context
- `getLanguageColumn(propertyName: string)`: Get database column name for current language
- All standard TypeORM Repository methods (find, findOne, findBy, etc.)

### `I18nValue<TLang, TValue>`

Type representing multilingual values.

```typescript
type I18nValue<TLang extends string, TValue = string> = {
  [K in TLang]: TValue;
};
```

## Testing

The library includes comprehensive E2E tests with real databases.

```bash
# Run tests with SQLite (default)
npm test

# Run tests with PostgreSQL
DB_TYPE=postgres npm test

# Run tests with MySQL
DB_TYPE=mysql npm test
```

## Database Schema Example

For this entity:

```typescript
@Entity()
class Product {
  @I18nColumn({ type: 'varchar', length: 255 })
  name: I18nValue<'en' | 'es' | 'fr', string>;
}
```

The following columns are created:

| Column Name | Type | Nullable | Description |
|-------------|------|----------|-------------|
| `name` | varchar(255) | No | English (default) |
| `name_es` | varchar(255) | Yes | Spanish |
| `name_fr` | varchar(255) | Yes | French |

## License

MIT

## Contributing

Contributions are welcome! Please ensure all tests pass before submitting a PR.

```bash
npm test
```
