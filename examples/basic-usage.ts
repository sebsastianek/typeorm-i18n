/**
 * Basic Usage Example
 *
 * Demonstrates:
 * - Entity definition with @I18nColumn
 * - Create, read, update operations
 * - Accessing translations
 */

import { DataSource, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  setI18nConfig,
  I18nColumn,
  I18nValue,
  I18nSubscriber,
  getI18nRepository,
} from '../src';

type Languages = 'en' | 'es' | 'fr';

setI18nConfig({
  languages: ['en', 'es', 'fr'],
  default_language: 'en',
});

@Entity()
class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({ type: 'varchar', length: 255 })
  name!: string;

  nameTranslations?: I18nValue<Languages, string>;

  @I18nColumn({ type: 'text' })
  description!: string;

  descriptionTranslations?: I18nValue<Languages, string>;

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;
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
  const repo = getI18nRepository(Product, dataSource);

  // Create
  const product = new Product();
  product.nameTranslations = {
    en: 'Laptop',
    es: 'Portátil',
    fr: 'Ordinateur portable',
  };
  product.descriptionTranslations = {
    en: 'Powerful laptop',
    es: 'Portátil potente',
    fr: 'Ordinateur puissant',
  };
  product.price = 999.99;

  const saved = await repo.save(product);
  console.log('Saved product ID:', saved.id);

  // Read
  const loaded = await repo.findOne({ where: { id: saved.id } });
  console.log('\nLoaded:');
  console.log('  name (default):', loaded?.name);
  console.log('  nameTranslations.en:', loaded?.nameTranslations?.en);
  console.log('  nameTranslations.es:', loaded?.nameTranslations?.es);
  console.log('  nameTranslations.fr:', loaded?.nameTranslations?.fr);

  // Update - I18nRepository.save() handles translations automatically
  loaded!.nameTranslations = {
    en: 'Gaming Laptop',
    es: 'Portátil Gaming',
    fr: 'Ordinateur portable Gaming',
  };
  await repo.save(loaded!);

  const updated = await repo.findOne({ where: { id: saved.id } });
  console.log('\nUpdated:');
  console.log('  nameTranslations.en:', updated?.nameTranslations?.en);

  await dataSource.destroy();
}

main().catch(console.error);
