/**
 * Basic Usage Example
 *
 * This example demonstrates the core functionality of typeorm-i18n:
 * - Setting up global configuration
 * - Creating entities with I18nColumn
 * - Saving and loading multilingual data
 */

import { DataSource, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  setI18nConfig,
  I18nColumn,
  I18nValue,
  I18nSubscriber,
} from '../src';

// Define supported languages
type SupportedLanguages = 'en' | 'es' | 'fr';

// Configure i18n globally (do this once at app startup)
setI18nConfig({
  languages: ['en', 'es', 'fr'],
  default_language: 'en',
});

// Define your entity with multilingual columns
@Entity()
class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({
    type: 'varchar',
    length: 255,
  })
  name!: I18nValue<SupportedLanguages, string>;

  @I18nColumn({
    type: 'text',
  })
  description!: I18nValue<SupportedLanguages, string>;

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;

  @Column('boolean', { default: true })
  isActive!: boolean;
}

async function main() {
  // Initialize DataSource
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [Product],
    subscribers: [I18nSubscriber],
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();
  console.log('Database connected');

  // Create a new product with translations
  const product = new Product();
  product.name = {
    en: 'Laptop',
    es: 'Portátil',
    fr: 'Ordinateur portable',
  };
  product.description = {
    en: 'Powerful laptop for work and gaming',
    es: 'Portátil potente para trabajo y juegos',
    fr: 'Ordinateur portable puissant pour le travail et les jeux',
  };
  product.price = 999.99;
  product.isActive = true;

  // Save the product
  const saved = await dataSource.manager.save(product);
  console.log('\nProduct saved with ID:', saved.id);

  // Load the product (subscriber automatically reconstructs I18nValue objects)
  const loaded = await dataSource.manager.findOne(Product, {
    where: { id: saved.id },
  });

  if (loaded) {
    console.log('\nLoaded product:');
    console.log('English name:', loaded.name.en);
    console.log('Spanish name:', loaded.name.es);
    console.log('French name:', loaded.name.fr);
    console.log('Price:', loaded.price);

    console.log('\nEnglish description:', loaded.description.en);
    console.log('Spanish description:', loaded.description.es);
    console.log('French description:', loaded.description.fr);
  }

  // Update a translation
  if (loaded) {
    loaded.name.es = 'Computadora portátil';
    await dataSource.manager.save(loaded);
    console.log('\nSpanish translation updated');

    // Reload to verify
    const updated = await dataSource.manager.findOne(Product, {
      where: { id: saved.id },
    });
    console.log('Updated Spanish name:', updated?.name.es);
  }

  // Find all products
  const allProducts = await dataSource.manager.find(Product);
  console.log('\nTotal products:', allProducts.length);

  await dataSource.destroy();
  console.log('\nDatabase connection closed');
}

// Run the example
main().catch(console.error);
