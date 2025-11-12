# Examples

This directory contains comprehensive examples demonstrating all features of `@sebsastianek/typeorm-i18n`.

## Running the Examples

You can run any example using `ts-node`:

```bash
# Install ts-node if you haven't already
npm install -g ts-node

# Run an example
ts-node examples/basic-usage.ts
ts-node examples/language-context-repository.ts
ts-node examples/advanced-features.ts
```

## Examples Overview

### 1. basic-usage.ts

**What it demonstrates:**
- Setting up global i18n configuration
- Creating entities with `@I18nColumn` decorator
- Saving multilingual data
- Loading and accessing translations
- Updating specific language values

**Key concepts:**
- `setI18nConfig()` for global configuration
- `I18nColumn` decorator with various column types
- `I18nValue<TLang, TValue>` type for strong typing
- Automatic transformation via `I18nSubscriber`

**Best for:** Beginners getting started with the library

---

### 2. language-context-repository.ts

**What it demonstrates:**
- Creating `I18nRepository` with language context
- Setting current language with `setLanguage()`
- Querying data using language-specific columns automatically
- Switching languages dynamically
- Using `getLanguageColumn()` with QueryBuilder
- Method chaining for fluent API
- Mixed conditions (i18n + regular columns)

**Key concepts:**
- `getI18nRepository()` factory function
- Language context management (`setLanguage`, `getLanguage`, `clearLanguage`)
- Automatic column mapping in queries
- QueryBuilder integration

**Best for:** Applications that need to query data in different languages

---

### 3. advanced-features.ts

**What it demonstrates:**
- Column-level configuration override
- Working with binary data (`Buffer`)
- Different i18n value types (string, number, Buffer)
- Helper utility functions
- Configuration management

**Key concepts:**
- Overriding global languages per column
- Using `I18nValue<TLang, Buffer>` for binary data
- `createI18nValue()` helper
- `getTranslation()` with fallback
- `flattenI18nValue()` for database format
- `resetI18nConfig()` for testing

**Best for:** Advanced use cases and understanding all library features

---

## Common Patterns

### Pattern 1: Request-Scoped Language Context

```typescript
// In your HTTP request handler (Express example)
app.get('/products', async (req, res) => {
  const language = req.headers['accept-language'] || 'en';
  const repo = getI18nRepository(Product, dataSource);
  repo.setLanguage(language);

  const products = await repo.find();
  res.json(products);
});
```

### Pattern 2: Multi-Language Search

```typescript
// Search across multiple languages using QueryBuilder
const repo = getI18nRepository(Product, dataSource);
const searchTerm = 'laptop';

const results = await repo
  .createQueryBuilder('product')
  .where(`product.name LIKE :search`, { search: `%${searchTerm}%` })
  .orWhere(`product.name_es LIKE :search`, { search: `%${searchTerm}%` })
  .orWhere(`product.name_fr LIKE :search`, { search: `%${searchTerm}%` })
  .getMany();
```

### Pattern 3: Partial Translations

```typescript
// Some languages can be null/undefined - they're nullable by default
const product = new Product();
product.name = {
  en: 'Laptop',
  es: 'Portátil',
  fr: null,  // Translation not ready yet
};

await dataSource.manager.save(product);

// Later, add the missing translation
product.name.fr = 'Ordinateur portable';
await dataSource.manager.save(product);
```

### Pattern 4: Fallback Logic

```typescript
import { getTranslation } from '@sebsastianek/typeorm-i18n';

const product = await repo.findOne({ where: { id: 1 } });

// Get translation with fallback to English
const displayName = getTranslation(
  product.name,
  userLanguage,
  'en'  // fallback language
);
```

## Database Support

All examples use `better-sqlite3` for simplicity (in-memory database, no setup required), but the library supports:

- **SQLite** / **better-sqlite3** (as shown in examples)
- **PostgreSQL** (change `blob` to `bytea` for binary data)
- **MySQL** (change `blob` to `longblob` for large binary data)
- **MariaDB**
- Any database supported by TypeORM

### Adapting for PostgreSQL

```typescript
const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'your_username',
  password: 'your_password',
  database: 'your_database',
  entities: [Product],
  subscribers: [I18nSubscriber],
  synchronize: true,
});

// For binary data, use 'bytea' instead of 'blob'
@I18nColumn({ type: 'bytea' })
file: I18nValue<Languages, Buffer>;
```

### Adapting for MySQL

```typescript
const dataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'your_username',
  password: 'your_password',
  database: 'your_database',
  entities: [Product],
  subscribers: [I18nSubscriber],
  synchronize: true,
});

// For large binary data, use 'longblob'
@I18nColumn({ type: 'longblob' })
file: I18nValue<Languages, Buffer>;
```

## Tips and Best Practices

1. **Set global configuration once** at application startup to avoid repetition
2. **Use TypeScript's strict mode** to catch type errors at compile time
3. **Define language types** as union types for autocomplete and type safety
4. **Use I18nRepository** when you need language-specific queries
5. **Register I18nSubscriber** to enable automatic transformations
6. **Make additional language columns nullable** (they are by default) to allow partial translations
7. **Use getLanguageColumn()** when building custom QueryBuilder queries

## Troubleshooting

### Issue: Translations not loading

**Solution:** Make sure `I18nSubscriber` is registered in your DataSource:
```typescript
new DataSource({
  // ...
  subscribers: [I18nSubscriber],
})
```

### Issue: Type errors with where clauses

**Solution:** Use type assertion when querying with I18nRepository:
```typescript
const products = await repo.find({
  where: { name: 'Laptop' } as any
});
```

### Issue: Binary data not saving correctly

**Solution:** Use the correct column type for your database:
- SQLite/MySQL: `blob` or `longblob`
- PostgreSQL: `bytea`

## Need Help?

- Check the main [README](../README.md) for API documentation
- Review the [tests](../tests) for more usage examples
- Open an issue on GitHub for questions or bugs
