import { DataSource, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { setI18nConfig, resetI18nConfig, I18nColumn, I18nValue } from '../src';
import { resetI18nColumnsFinalization } from '../src/decorator';
import { createE2EDataSource, closeE2EDataSource } from './db-helper';

describe('Global Configuration', () => {
  let dataSource: DataSource;

  afterEach(async () => {
    resetI18nConfig();
    resetI18nColumnsFinalization();

    if (dataSource && dataSource.isInitialized) {
      await closeE2EDataSource(dataSource);
    }
  });

  it('should use global configuration when column options are not provided', async () => {
    setI18nConfig({
      languages: ['en', 'es', 'fr'],
      default_language: 'en',
    });

    type GlobalLanguages = 'en' | 'es' | 'fr';

    @Entity('test_products_global')
    class TestProduct {
      @PrimaryGeneratedColumn()
      id!: number;

      @I18nColumn({
        type: 'varchar',
        length: 255,
      })
      name!: string;

      nameTranslations?: I18nValue<GlobalLanguages, string>;

      @I18nColumn({
        type: 'text',
      })
      description!: string;

      descriptionTranslations?: I18nValue<GlobalLanguages, string>;
    }

    dataSource = await createE2EDataSource([TestProduct]);
    const repo = dataSource.getRepository(TestProduct);

    const product = repo.create();
    Object.assign(product, {
      nameTranslations: {
        en: 'Test Product',
        es: 'Producto de Prueba',
        fr: 'Produit Test',
      },
      descriptionTranslations: {
        en: 'Description',
        es: 'Descripción',
        fr: 'Description',
      },
    });

    const saved = await repo.save(product);
    const loaded = await repo.findOne({ where: { id: saved.id } });

    expect(loaded).toBeDefined();
    expect(loaded?.nameTranslations?.en).toBe('Test Product');
    expect(loaded?.nameTranslations?.es).toBe('Producto de Prueba');
    expect(loaded?.nameTranslations?.fr).toBe('Produit Test');
    expect(loaded?.name).toBe('Test Product'); // Default language value
  });

  it('should override global configuration with column-level options', async () => {
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

      @I18nColumn({
        type: 'varchar',
        length: 255,
      })
      title!: string;

      titleTranslations?: I18nValue<GlobalLanguages, string>;

      @I18nColumn({
        languages: ['en', 'de', 'ja'],
        default_language: 'en',
        type: 'text',
      })
      content!: string;

      contentTranslations?: I18nValue<CustomLanguages, string>;
    }

    dataSource = await createE2EDataSource([TestArticle]);
    const repo = dataSource.getRepository(TestArticle);

    const article = repo.create();
    Object.assign(article, {
      titleTranslations: {
        en: 'Title',
        es: 'Título',
      },
      contentTranslations: {
        en: 'Content',
        de: 'Inhalt',
        ja: 'コンテンツ',
      },
    });

    const saved = await repo.save(article);
    const loaded = await repo.findOne({ where: { id: saved.id } });

    expect(loaded).toBeDefined();
    expect(loaded?.titleTranslations?.en).toBe('Title');
    expect(loaded?.titleTranslations?.es).toBe('Título');
    expect(loaded?.contentTranslations?.en).toBe('Content');
    expect(loaded?.contentTranslations?.de).toBe('Inhalt');
    expect(loaded?.contentTranslations?.ja).toBe('コンテンツ');
  });

  it('should queue columns when no config and finalize when config is set', async () => {
    // Start with no config
    resetI18nConfig();
    resetI18nColumnsFinalization();

    type TestLanguages = 'en' | 'es';

    // Define entity without config - columns are queued (no error thrown)
    @Entity('test_deferred_config')
    class TestEntity {
      @PrimaryGeneratedColumn()
      id!: number;

      @I18nColumn({
        type: 'varchar',
      })
      name!: string;

      nameTranslations?: I18nValue<TestLanguages, string>;
    }

    // Now set config - this triggers finalization and columns inherit from global config
    setI18nConfig({
      languages: ['en', 'es'],
      default_language: 'en',
    });

    // Verify the entity works with the inherited config
    dataSource = await createE2EDataSource([TestEntity]);

    const repo = dataSource.getRepository(TestEntity);
    const entity = repo.create();
    // Use proper API: set translations
    (entity as any).nameTranslations = { en: 'Test', es: 'Prueba' };
    await repo.save(entity);

    const loaded = await repo.findOne({ where: { id: entity.id } });
    expect(loaded).toBeDefined();
    // Verify translations are loaded correctly
    expect(loaded!.nameTranslations?.en).toBe('Test');
    expect(loaded!.nameTranslations?.es).toBe('Prueba');
  });

  it('should support partial override (only languages)', async () => {
    setI18nConfig({
      languages: ['en', 'es', 'fr'],
      default_language: 'en',
    });

    type CustomLanguages = 'en' | 'de';

    @Entity('test_partial_override')
    class TestEntity {
      @PrimaryGeneratedColumn()
      id!: number;

      @I18nColumn({
        languages: ['en', 'de'],
        type: 'varchar',
        length: 255,
      })
      name!: string;

      nameTranslations?: I18nValue<CustomLanguages, string>;
    }

    dataSource = await createE2EDataSource([TestEntity]);
    const repo = dataSource.getRepository(TestEntity);

    const entity = repo.create();
    Object.assign(entity, {
      nameTranslations: {
        en: 'English',
        de: 'Deutsch',
      },
    });

    const saved = await repo.save(entity);
    const loaded = await repo.findOne({ where: { id: saved.id } });

    expect(loaded).toBeDefined();
    expect(loaded?.nameTranslations?.en).toBe('English');
    expect(loaded?.nameTranslations?.de).toBe('Deutsch');
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
      name!: string;

      nameTranslations?: I18nValue<GlobalLanguages, string>;
    }

    dataSource = await createE2EDataSource([TestEntity]);
    const metadata = dataSource.getRepository(TestEntity).metadata;
    const columnNames = metadata.columns.map((col) => col.databaseName);

    expect(columnNames).toContain('name');
    expect(columnNames).toContain('name_es');
    expect(columnNames).toContain('name_fr');
  });
});
