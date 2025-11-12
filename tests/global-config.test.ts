import { DataSource, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { setI18nConfig, resetI18nConfig, I18nColumn, I18nValue } from '../src';
import { createE2EDataSource, closeE2EDataSource } from './db-helper';

describe('Global Configuration', () => {
  let dataSource: DataSource;

  afterEach(async () => {
    // Reset global config after each test
    resetI18nConfig();

    if (dataSource && dataSource.isInitialized) {
      await closeE2EDataSource(dataSource);
    }
  });

  it('should use global configuration when column options are not provided', async () => {
    // Set global config
    setI18nConfig({
      languages: ['en', 'es', 'fr'],
      default_language: 'en',
    });

    type GlobalLanguages = 'en' | 'es' | 'fr';

    @Entity('test_products_global')
    class TestProduct {
      @PrimaryGeneratedColumn()
      id!: number;

      // No languages specified - should use global config
      @I18nColumn({
        type: 'varchar',
        length: 255,
      })
      name!: I18nValue<GlobalLanguages, string>;

      @I18nColumn({
        type: 'text',
      })
      description!: I18nValue<GlobalLanguages, string>;
    }

    dataSource = await createE2EDataSource([TestProduct]);
    const repo = dataSource.getRepository(TestProduct);

    // Test creating and reading
    const product = repo.create({
      name: {
        en: 'Test Product',
        es: 'Producto de Prueba',
        fr: 'Produit Test',
      },
      description: {
        en: 'Description',
        es: 'Descripción',
        fr: 'Description',
      },
    });

    const saved = await repo.save(product);
    const loaded = await repo.findOne({ where: { id: saved.id } });

    expect(loaded).toBeDefined();
    expect(loaded?.name.en).toBe('Test Product');
    expect(loaded?.name.es).toBe('Producto de Prueba');
    expect(loaded?.name.fr).toBe('Produit Test');
  });

  it('should override global configuration with column-level options', async () => {
    // Set global config
    setI18nConfig({
      languages: ['en', 'es'],
      default_language: 'en',
    });

    type GlobalLanguages = 'en' | 'es';
    type CustomLanguages = 'en' | 'de' | 'ja';

    @Entity('test_articles_override')
    class TestArticle {
      @PrimaryGeneratedColumn()
      id!: number;

      // Uses global config
      @I18nColumn({
        type: 'varchar',
        length: 255,
      })
      title!: I18nValue<GlobalLanguages, string>;

      // Overrides with custom languages
      @I18nColumn({
        languages: ['en', 'de', 'ja'],
        default_language: 'en',
        type: 'text',
      })
      content!: I18nValue<CustomLanguages, string>;
    }

    dataSource = await createE2EDataSource([TestArticle]);
    const repo = dataSource.getRepository(TestArticle);

    const article = repo.create({
      title: {
        en: 'Title',
        es: 'Título',
      },
      content: {
        en: 'Content',
        de: 'Inhalt',
        ja: 'コンテンツ',
      },
    });

    const saved = await repo.save(article);
    const loaded = await repo.findOne({ where: { id: saved.id } });

    expect(loaded).toBeDefined();
    // Title uses global config (en, es)
    expect(loaded?.title.en).toBe('Title');
    expect(loaded?.title.es).toBe('Título');
    // Content uses custom config (en, de, ja)
    expect(loaded?.content.en).toBe('Content');
    expect(loaded?.content.de).toBe('Inhalt');
    expect(loaded?.content.ja).toBe('コンテンツ');
  });

  it('should throw error when no global config and no column-level config', async () => {
    // Don't set any global config
    resetI18nConfig();

    type TestLanguages = 'en' | 'es';

    expect(() => {
      @Entity('test_no_config')
      class TestEntity {
        @PrimaryGeneratedColumn()
        id!: number;

        // No languages specified and no global config
        @I18nColumn({
          type: 'varchar',
        })
        name!: I18nValue<TestLanguages, string>;
      }

      // Suppress unused variable warning
      void TestEntity;
    }).toThrow('I18nColumn requires at least one language');
  });

  it('should support partial override (only languages)', async () => {
    // Set global config with both languages and default_language
    setI18nConfig({
      languages: ['en', 'es', 'fr'],
      default_language: 'en',
    });

    type CustomLanguages = 'en' | 'de';

    @Entity('test_partial_override')
    class TestEntity {
      @PrimaryGeneratedColumn()
      id!: number;

      // Override only languages, keep default_language from global
      @I18nColumn({
        languages: ['en', 'de'],
        type: 'varchar',
        length: 255,
      })
      name!: I18nValue<CustomLanguages, string>;
    }

    dataSource = await createE2EDataSource([TestEntity]);
    const repo = dataSource.getRepository(TestEntity);

    const entity = repo.create({
      name: {
        en: 'English',
        de: 'Deutsch',
      },
    });

    const saved = await repo.save(entity);
    const loaded = await repo.findOne({ where: { id: saved.id } });

    expect(loaded).toBeDefined();
    expect(loaded?.name.en).toBe('English');
    expect(loaded?.name.de).toBe('Deutsch');
  });

  it('should verify schema has correct columns with global config', async () => {
    setI18nConfig({
      languages: ['en', 'es', 'fr'],
      default_language: 'en',
    });

    type GlobalLanguages = 'en' | 'es' | 'fr';

    @Entity('test_schema_check')
    class TestEntity {
      @PrimaryGeneratedColumn()
      id!: number;

      @I18nColumn({
        type: 'varchar',
        length: 255,
      })
      name!: I18nValue<GlobalLanguages, string>;
    }

    dataSource = await createE2EDataSource([TestEntity]);
    const metadata = dataSource.getRepository(TestEntity).metadata;
    const columnNames = metadata.columns.map((col) => col.databaseName);

    // Should have base column and translation columns
    expect(columnNames).toContain('name'); // default (en)
    expect(columnNames).toContain('name_es');
    expect(columnNames).toContain('name_fr');
  });
});
