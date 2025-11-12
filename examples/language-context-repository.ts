/**
 * Language Context Repository Example
 *
 * This example demonstrates how to use I18nRepository to:
 * - Set a current language context
 * - Query automatically using the correct language column
 * - Switch languages dynamically
 * - Use QueryBuilder with language context
 */

import { DataSource, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  setI18nConfig,
  I18nColumn,
  I18nValue,
  I18nSubscriber,
  getI18nRepository,
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

  console.log('=== Example 1: Querying in English (default) ===');
  const englishProducts = await repo.find({
    where: { name: 'Laptop' } as any,
  });
  console.log(`Found ${englishProducts.length} product(s) with name "Laptop"`);
  console.log('Product:', englishProducts[0]?.name.en, '\n');

  console.log('=== Example 2: Set language to Spanish ===');
  repo.setLanguage('es');
  console.log('Current language:', repo.getLanguage());

  const spanishProducts = await repo.find({
    where: { name: 'Ratón' } as any,
  });
  console.log(`Found ${spanishProducts.length} product(s) with name "Ratón"`);
  console.log('Product English name:', spanishProducts[0]?.name.en);
  console.log('Product Spanish name:', spanishProducts[0]?.name.es, '\n');

  console.log('=== Example 3: Switch to French ===');
  repo.setLanguage('fr');
  console.log('Current language:', repo.getLanguage());

  const frenchProducts = await repo.find({
    where: { name: 'Clavier' } as any,
  });
  console.log(`Found ${frenchProducts.length} product(s) with name "Clavier"`);
  console.log('Product English name:', frenchProducts[0]?.name.en);
  console.log('Product French name:', frenchProducts[0]?.name.fr, '\n');

  console.log('=== Example 4: Method chaining ===');
  const result = await repo
    .setLanguage('es')
    .find({ where: { name: 'Teclado' } as any });
  console.log(`Found ${result.length} product(s) with chained setLanguage()`);
  console.log('Product:', result[0]?.name.es, '\n');

  console.log('=== Example 5: Using with findOne ===');
  repo.setLanguage('fr');
  const oneProduct = await repo.findOne({
    where: { name: 'Souris' } as any,
  });
  console.log('Found product:', oneProduct?.name.fr);
  console.log('Price:', oneProduct?.price, '\n');

  console.log('=== Example 6: Mixed conditions (i18n + regular columns) ===');
  repo.setLanguage('es');
  const filtered = await repo.find({
    where: {
      category: 'Electronics',
      name: 'Portátil' as any,
    },
  });
  console.log(`Found ${filtered.length} Electronics with name "Portátil"`);
  console.log('Product:', filtered[0]?.name.es, '\n');

  console.log('=== Example 7: Clear language (revert to default) ===');
  repo.clearLanguage();
  console.log('Current language:', repo.getLanguage());
  const defaultProducts = await repo.find({
    where: { name: 'Mouse' } as any,
  });
  console.log(`Found ${defaultProducts.length} product(s) with name "Mouse"`);
  console.log('Product:', defaultProducts[0]?.name.en, '\n');

  console.log('=== Example 8: Using QueryBuilder with getLanguageColumn ===');
  repo.setLanguage('es');

  const nameColumn = repo.getLanguageColumn('name');
  console.log('Language column for "name":', nameColumn);

  const qbProducts = await repo
    .createQueryBuilder('product')
    .where(`product.${nameColumn} LIKE :search`, { search: '%át%' })
    .getMany();

  console.log(`Found ${qbProducts.length} product(s) with QueryBuilder`);
  qbProducts.forEach((p: Product) => {
    console.log('-', p.name.es);
  });
  console.log();

  console.log('=== Example 9: getLanguageColumn for different languages ===');
  console.log('English (default) - name column:', repo.setLanguage('en').getLanguageColumn('name'));
  console.log('Spanish - name column:', repo.setLanguage('es').getLanguageColumn('name'));
  console.log('French - name column:', repo.setLanguage('fr').getLanguageColumn('name'));
  console.log('Non-i18n column:', repo.getLanguageColumn('price'), '\n');

  await dataSource.destroy();
  console.log('Database connection closed');
}

main().catch(console.error);
