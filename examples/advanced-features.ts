/**
 * Advanced Features Example
 *
 * This example demonstrates:
 * - Column-level configuration override
 * - Working with binary data (Buffer)
 * - Different data types (string, number, Buffer)
 * - Helper function (getTranslation with fallback)
 * - Configuration management
 */

import { DataSource, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  setI18nConfig,
  resetI18nConfig,
  I18nColumn,
  I18nValue,
  I18nSubscriber,
  getTranslation,
} from '../src';

// Set global configuration
setI18nConfig({
  languages: ['en', 'es', 'fr'],
  default_language: 'en',
});

type GlobalLanguages = 'en' | 'es' | 'fr';
type ExtendedLanguages = 'en' | 'de' | 'ja';

@Entity()
class Article {
  @PrimaryGeneratedColumn()
  id!: number;

  // Uses global configuration
  @I18nColumn({ type: 'varchar', length: 255 })
  title!: I18nValue<GlobalLanguages, string>;

  // Override with different languages
  @I18nColumn({
    languages: ['en', 'de', 'ja'],
    default_language: 'en',
    type: 'text',
  })
  content!: I18nValue<ExtendedLanguages, string>;

  // Numeric i18n column (for localized numbers, IDs, etc.)
  @I18nColumn({ type: 'int' })
  viewCount!: I18nValue<GlobalLanguages, number>;

  @Column('datetime', { default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

@Entity()
class Document {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({ type: 'varchar', length: 255 })
  name!: I18nValue<GlobalLanguages, string>;

  // Binary data (use 'blob' for SQLite/MySQL, 'bytea' for PostgreSQL)
  @I18nColumn({ type: 'blob' })
  file!: I18nValue<GlobalLanguages, Buffer>;
}

async function main() {
  console.log('=== Advanced Features Example ===\n');

  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [Article, Document],
    subscribers: [I18nSubscriber],
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();
  console.log('Database connected\n');

  // ===== Example 1: Column-level override =====
  console.log('=== Example 1: Column-level Language Override ===');

  const article = new Article();

  // Title uses global languages (en, es, fr)
  article.title = {
    en: 'Hello World',
    es: 'Hola Mundo',
    fr: 'Bonjour le monde',
  };

  // Content uses custom languages (en, de, ja)
  article.content = {
    en: 'Welcome to our platform',
    de: 'Willkommen auf unserer Plattform',
    ja: 'プラットフォームへようこそ',
  };

  article.viewCount = {
    en: 100,
    es: 150,
    fr: 200,
  };

  await dataSource.manager.save(article);
  console.log('Article saved with different language configurations');

  const loaded = await dataSource.manager.findOne(Article, {
    where: { id: article.id },
  });

  console.log('\nTitle translations (en, es, fr):');
  console.log('  English:', loaded?.title.en);
  console.log('  Spanish:', loaded?.title.es);
  console.log('  French:', loaded?.title.fr);

  console.log('\nContent translations (en, de, ja):');
  console.log('  English:', loaded?.content.en);
  console.log('  German:', loaded?.content.de);
  console.log('  Japanese:', loaded?.content.ja);

  console.log('\nView counts by region:');
  console.log('  English regions:', loaded?.viewCount.en);
  console.log('  Spanish regions:', loaded?.viewCount.es);
  console.log('  French regions:', loaded?.viewCount.fr);
  console.log();

  // ===== Example 2: Binary data =====
  console.log('=== Example 2: Working with Binary Data ===');

  const doc = new Document();
  doc.name = {
    en: 'Report',
    es: 'Informe',
    fr: 'Rapport',
  };

  doc.file = {
    en: Buffer.from('English PDF content'),
    es: Buffer.from('Contenido PDF en español'),
    fr: Buffer.from('Contenu PDF français'),
  };

  await dataSource.manager.save(doc);
  console.log('Document saved with binary data');

  const loadedDoc = await dataSource.manager.findOne(Document, {
    where: { id: doc.id },
  });

  console.log('\nDocument name:', loadedDoc?.name.en);
  console.log('File sizes:');
  console.log('  English:', loadedDoc?.file.en.length, 'bytes');
  console.log('  Spanish:', loadedDoc?.file.es.length, 'bytes');
  console.log('  French:', loadedDoc?.file.fr.length, 'bytes');

  console.log('\nEnglish file content:', loadedDoc?.file.en.toString());
  console.log('Spanish file content:', loadedDoc?.file.es.toString());
  console.log();

  // ===== Example 3: Helper functions =====
  console.log('=== Example 3: Helper Function - getTranslation ===');

  // Create an I18nValue manually
  const productName: I18nValue<GlobalLanguages, string> = {
    en: 'Computer',
    es: 'Computadora',
    fr: 'Ordinateur',
  };

  console.log('Created I18nValue:', productName);

  // getTranslation - get translation with fallback
  const esTranslation = getTranslation(productName, 'es', 'en');
  console.log('\nSpanish translation:', esTranslation);

  // Fallback to default when translation is missing
  const partialName: I18nValue<GlobalLanguages, string> = {
    en: 'Hello',
    es: null as any,
    fr: null as any,
  };
  const fallbackTranslation = getTranslation(partialName, 'es', 'en');
  console.log('Fallback translation (es -> en):', fallbackTranslation);
  console.log();

  // ===== Example 4: Configuration management =====
  console.log('=== Example 4: Configuration Management ===');

  console.log('Current global config:', {
    languages: ['en', 'es', 'fr'],
    default_language: 'en',
  });

  // Reset configuration (useful in tests)
  resetI18nConfig();
  console.log('Configuration reset');
  console.log();

  await dataSource.destroy();
  console.log('Database connection closed');
}

main().catch(console.error);
