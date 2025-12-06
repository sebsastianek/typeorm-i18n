/**
 * Language Context Repository Example
 *
 * This example demonstrates how to use I18nRepository to:
 * - Set a current language context (case-insensitive)
 * - Query automatically using the correct language column
 * - Switch languages dynamically
 * - Use QueryBuilder with language context
 * - Use ergonomic QueryBuilder methods (whereLanguage, orderByLanguage, etc.)
 * - Use type-safe i18nWhere helper
 */

import { DataSource, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  setI18nConfig,
  I18nColumn,
  I18nValue,
  I18nSubscriber,
  getI18nRepository,
  i18nWhere,
  i18nWhereMany,
} from '../src';

type SupportedLanguages = 'en' | 'es' | 'fr';

setI18nConfig({
  languages: ['en', 'es', 'fr'],
  default_language: 'en',
});

@Entity()
class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({ type: 'varchar', length: 255 })
  name!: I18nValue<SupportedLanguages, string>;

  @I18nColumn({ type: 'text' })
  description!: I18nValue<SupportedLanguages, string>;

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;

  @Column('varchar', { length: 50 })
  category!: string;
}

async function main() {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [Product],
    subscribers: [I18nSubscriber],
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();
  console.log('Database connected\n');

  // Seed some products
  const products = [
    {
      name: { en: 'Laptop', es: 'Portátil', fr: 'Ordinateur portable' },
      description: { en: 'Powerful laptop', es: 'Portátil potente', fr: 'Ordinateur puissant' },
      price: 999.99,
      category: 'Electronics',
    },
    {
      name: { en: 'Mouse', es: 'Ratón', fr: 'Souris' },
      description: { en: 'Wireless mouse', es: 'Ratón inalámbrico', fr: 'Souris sans fil' },
      price: 29.99,
      category: 'Electronics',
    },
    {
      name: { en: 'Keyboard', es: 'Teclado', fr: 'Clavier' },
      description: { en: 'Mechanical keyboard', es: 'Teclado mecánico', fr: 'Clavier mécanique' },
      price: 79.99,
      category: 'Electronics',
    },
  ];

  for (const data of products) {
    const product = dataSource.manager.create(Product, data);
    await dataSource.manager.save(product);
  }

  console.log('Seeded 3 products\n');

  // Create I18nRepository with language context
  const repo = getI18nRepository(Product, dataSource);

  console.log('=== Example 1: Querying with type-safe i18nWhere ===');
  const englishProducts = await repo.find({
    where: i18nWhere<Product>({ name: 'Laptop' }),
  });
  console.log(`Found ${englishProducts.length} product(s) with name "Laptop"`);
  console.log('Product:', englishProducts[0]?.name.en, '\n');

  console.log('=== Example 2: Set language to Spanish ===');
  repo.setLanguage('es');
  console.log('Current language:', repo.getLanguage());

  const spanishProducts = await repo.find({
    where: i18nWhere<Product>({ name: 'Ratón' }),
  });
  console.log(`Found ${spanishProducts.length} product(s) with name "Ratón"`);
  console.log('Product English name:', spanishProducts[0]?.name.en);
  console.log('Product Spanish name:', spanishProducts[0]?.name.es, '\n');

  console.log('=== Example 3: Switch to French ===');
  repo.setLanguage('fr');
  console.log('Current language:', repo.getLanguage());

  const frenchProducts = await repo.find({
    where: i18nWhere<Product>({ name: 'Clavier' }),
  });
  console.log(`Found ${frenchProducts.length} product(s) with name "Clavier"`);
  console.log('Product English name:', frenchProducts[0]?.name.en);
  console.log('Product French name:', frenchProducts[0]?.name.fr, '\n');

  console.log('=== Example 4: Method chaining ===');
  const result = await repo
    .setLanguage('es')
    .find({ where: i18nWhere<Product>({ name: 'Teclado' }) });
  console.log(`Found ${result.length} product(s) with chained setLanguage()`);
  console.log('Product:', result[0]?.name.es, '\n');

  console.log('=== Example 5: Using i18nWhereMany for OR conditions ===');
  repo.setLanguage('es');
  const multiProducts = await repo.find({
    where: i18nWhereMany<Product>([{ name: 'Portátil' }, { name: 'Ratón' }]),
  });
  console.log(`Found ${multiProducts.length} products matching "Portátil" OR "Ratón"`);
  multiProducts.forEach((p: Product) => {
    console.log('-', p.name.es);
  });
  console.log();

  console.log('=== Example 6: Mixed conditions (i18n + regular columns) ===');
  repo.setLanguage('es');
  const filtered = await repo.find({
    where: i18nWhere<Product>({
      category: 'Electronics',
      name: 'Portátil',
    }),
  });
  console.log(`Found ${filtered.length} Electronics with name "Portátil"`);
  console.log('Product:', filtered[0]?.name.es, '\n');

  console.log('=== Example 7: Ergonomic QueryBuilder - whereLanguage ===');
  repo.setLanguage('es');

  const qbProducts = await repo
    .createQueryBuilder('product')
    .whereLanguage('name', 'LIKE', '%át%')
    .getMany();

  console.log(`Found ${qbProducts.length} product(s) with whereLanguage`);
  qbProducts.forEach((p: Product) => {
    console.log('-', p.name.es);
  });
  console.log();

  console.log('=== Example 8: QueryBuilder - andWhereLanguage & orWhereLanguage ===');
  repo.setLanguage('es');

  const complexQuery = await repo
    .createQueryBuilder('product')
    .whereLanguage('name', '=', 'Portátil')
    .orWhereLanguage('name', '=', 'Ratón')
    .getMany();

  console.log(`Found ${complexQuery.length} products with OR condition`);
  complexQuery.forEach((p: Product) => {
    console.log('-', p.name.es);
  });
  console.log();

  console.log('=== Example 9: QueryBuilder - orderByLanguage ===');
  repo.setLanguage('es');

  const orderedProducts = await repo
    .createQueryBuilder('product')
    .orderByLanguage('name', 'ASC')
    .getMany();

  console.log('Products ordered by Spanish name:');
  orderedProducts.forEach((p: Product) => {
    console.log('-', p.name.es);
  });
  console.log();

  console.log('=== Example 10: Traditional getLanguageColumn approach ===');
  repo.setLanguage('es');

  const nameColumn = repo.getLanguageColumn('name');
  console.log('Language column for "name":', nameColumn);

  const traditionalQb = await repo
    .createQueryBuilder('product')
    .where(`product.${nameColumn} LIKE :search`, { search: '%át%' })
    .getMany();

  console.log(`Found ${traditionalQb.length} product(s) with traditional approach`);
  console.log();

  console.log('=== Example 11: getLanguageColumn for different languages ===');
  console.log('English (default) - name column:', repo.setLanguage('en').getLanguageColumn('name'));
  console.log('Spanish - name column:', repo.setLanguage('es').getLanguageColumn('name'));
  console.log('French - name column:', repo.setLanguage('fr').getLanguageColumn('name'));
  console.log('Non-i18n column:', repo.getLanguageColumn('price'), '\n');

  await dataSource.destroy();
  console.log('Database connection closed');
}

main().catch(console.error);
