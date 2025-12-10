import { DataSource } from 'typeorm';
import { getI18nRepository, setI18nConfig, resetI18nConfig } from '../src';
import { createE2EDataSource, closeE2EDataSource, seedDatabase } from './db-helper';
import { Product } from './entities/Product.entity';
import { productFixtures } from './fixtures/product.fixtures';

describe('I18nRepository', () => {
  let dataSource: DataSource;

  beforeAll(() => {
    setI18nConfig({
      languages: ['en', 'es', 'fr'],
      default_language: 'en',
    });
  });

  afterAll(() => {
    resetI18nConfig();
  });

  beforeEach(async () => {
    dataSource = await createE2EDataSource([Product]);
    await seedDatabase(dataSource, Product, productFixtures);
  });

  afterEach(async () => {
    if (dataSource && dataSource.isInitialized) {
      await closeE2EDataSource(dataSource);
    }
  });

  describe('Language Context', () => {
    it('should set and get current language', () => {
      const repo = getI18nRepository(Product, dataSource);

      expect(repo.getLanguage()).toBeNull();

      repo.setLanguage('es');
      expect(repo.getLanguage()).toBe('es');

      repo.clearLanguage();
      expect(repo.getLanguage()).toBeNull();
    });

    it('should allow method chaining', () => {
      const repo = getI18nRepository(Product, dataSource);

      const result = repo.setLanguage('es');
      expect(result).toBe(repo);
    });
  });

  describe('Find Operations', () => {
    it('should query English column by default (no language set)', async () => {
      const repo = getI18nRepository(Product, dataSource);

      const products = await repo.find({
        where: { name: 'Laptop' } as any,
      });

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.en).toBe('Laptop');
      expect(products[0].name).toBe('Laptop'); // Default language in single-value prop
    });

    it('should query Spanish column when language is set to "es"', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        where: { name: 'Portátil' } as any,
      });

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.en).toBe('Laptop');
      expect(products[0].nameTranslations?.es).toBe('Portátil');
      expect(products[0].name).toBe('Portátil'); // Current language in single-value prop
    });

    it('should query French column when language is set to "fr"', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('fr');

      const products = await repo.find({
        where: { name: 'Ordinateur portable' } as any,
      });

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.en).toBe('Laptop');
      expect(products[0].nameTranslations?.fr).toBe('Ordinateur portable');
      expect(products[0].name).toBe('Ordinateur portable');
    });

    it('should work with findOne', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const product = await repo.findOne({
        where: { name: 'Ratón' } as any,
      });

      expect(product).toBeDefined();
      expect(product?.nameTranslations?.en).toBe('Mouse');
      expect(product?.nameTranslations?.es).toBe('Ratón');
      expect(product?.name).toBe('Ratón');
    });

    it('should work with findOneBy', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const product = await repo.findOneBy({ name: 'Ratón' } as any);

      expect(product).toBeDefined();
      expect(product?.nameTranslations?.en).toBe('Mouse');
      expect(product?.name).toBe('Ratón');
    });

    it('should work with findBy', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.findBy({ name: 'Teclado' } as any);

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.en).toBe('Keyboard');
      expect(products[0].name).toBe('Teclado');
    });

    it('should not affect non-i18n columns', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        where: { isActive: true },
      });

      expect(products.length).toBeGreaterThan(0);
      products.forEach((p) => expect(p.isActive).toBe(true));
    });

    it('should handle multiple conditions with mixed i18n and regular columns', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        where: {
          name: 'Ratón' as any,
          isActive: true,
        },
      });

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.es).toBe('Ratón');
      expect(products[0].isActive).toBe(true);
    });
  });

  describe('getLanguageColumn', () => {
    it('should return base column name for default language', () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('en');

      expect(repo.getLanguageColumn('name')).toBe('name');
      expect(repo.getLanguageColumn('description')).toBe('description');
    });

    it('should return translated column name for non-default language', () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      expect(repo.getLanguageColumn('name')).toBe('name_es');
      expect(repo.getLanguageColumn('description')).toBe('description_es');
    });

    it('should return base column name when no language is set', () => {
      const repo = getI18nRepository(Product, dataSource);

      expect(repo.getLanguageColumn('name')).toBe('name');
    });

    it('should return property name for non-i18n columns', () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      expect(repo.getLanguageColumn('price')).toBe('price');
      expect(repo.getLanguageColumn('isActive')).toBe('isActive');
    });

    it('should work with QueryBuilder', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const nameColumn = repo.getLanguageColumn('name');

      const products = await repo
        .createQueryBuilder('product')
        .where(`product.${nameColumn} = :name`, { name: 'Ratón' })
        .getMany();

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.es).toBe('Ratón');
    });
  });

  describe('Language Switching', () => {
    it('should switch languages dynamically', async () => {
      const repo = getI18nRepository(Product, dataSource);

      // Query in English
      repo.setLanguage('en');
      let product = await repo.findOne({ where: { name: 'Laptop' } as any });
      expect(product).toBeDefined();
      expect(product?.name).toBe('Laptop');

      // Switch to Spanish
      repo.setLanguage('es');
      product = await repo.findOne({ where: { name: 'Portátil' } as any });
      expect(product).toBeDefined();
      expect(product?.name).toBe('Portátil');

      // Switch to French
      repo.setLanguage('fr');
      product = await repo.findOne({ where: { name: 'Ordinateur portable' } as any });
      expect(product).toBeDefined();
      expect(product?.name).toBe('Ordinateur portable');
    });

    it('should clear language and revert to default behavior', async () => {
      const repo = getI18nRepository(Product, dataSource);

      // Set language
      repo.setLanguage('es');
      let product = await repo.findOne({ where: { name: 'Ratón' } as any });
      expect(product).toBeDefined();

      // Clear language - should use default (en)
      repo.clearLanguage();
      product = await repo.findOne({ where: { name: 'Mouse' } as any });
      expect(product).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array when no results match in target language', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        where: { name: 'NonExistentProduct' as any },
      });

      expect(products).toHaveLength(0);
    });

    it('should handle null/undefined where clause', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find();

      expect(products.length).toBeGreaterThan(0);
    });
  });

  describe('findAndCount', () => {
    it('should translate where clause in findAndCount', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const [products, count] = await repo.findAndCount({
        where: { name: 'Portátil' } as any,
      });

      expect(count).toBe(1);
      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.es).toBe('Portátil');
      expect(products[0].name).toBe('Portátil');
    });

    it('should translate order clause in findAndCount', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const [products, count] = await repo.findAndCount({
        order: { name: 'ASC' } as any,
      });

      expect(count).toBeGreaterThan(0);
      const names = products.map((p) => p.nameTranslations?.es);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should work with findAndCountBy', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const [products, count] = await repo.findAndCountBy({ name: 'Ratón' } as any);

      expect(count).toBe(1);
      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.es).toBe('Ratón');
    });
  });

  describe('findOneOrFail / findOneByOrFail', () => {
    it('should translate where clause in findOneOrFail', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const product = await repo.findOneOrFail({
        where: { name: 'Portátil' } as any,
      });

      expect(product.nameTranslations?.es).toBe('Portátil');
      expect(product.name).toBe('Portátil');
    });

    it('should throw when not found in findOneOrFail', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      await expect(
        repo.findOneOrFail({ where: { name: 'NonExistent' } as any })
      ).rejects.toThrow();
    });

    it('should translate where clause in findOneByOrFail', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('fr');

      const product = await repo.findOneByOrFail({ name: 'Ordinateur portable' } as any);

      expect(product.nameTranslations?.fr).toBe('Ordinateur portable');
      expect(product.name).toBe('Ordinateur portable');
    });

    it('should throw when not found in findOneByOrFail', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      await expect(
        repo.findOneByOrFail({ name: 'NonExistent' } as any)
      ).rejects.toThrow();
    });
  });

  describe('count / countBy', () => {
    it('should translate where clause in count', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const count = await repo.count({
        where: { name: 'Portátil' } as any,
      });

      expect(count).toBe(1);
    });

    it('should count all when no where clause', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const count = await repo.count();

      expect(count).toBe(productFixtures.length);
    });

    it('should translate where clause in countBy', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const count = await repo.countBy({ name: 'Ratón' } as any);

      expect(count).toBe(1);
    });

    it('should return 0 when no matches', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const count = await repo.countBy({ name: 'NonExistent' } as any);

      expect(count).toBe(0);
    });
  });

  describe('exists / existsBy', () => {
    it('should translate where clause in exists', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const exists = await repo.exists({
        where: { name: 'Portátil' } as any,
      });

      expect(exists).toBe(true);
    });

    it('should return false when not exists', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const exists = await repo.exists({
        where: { name: 'NonExistent' } as any,
      });

      expect(exists).toBe(false);
    });

    it('should translate where clause in existsBy', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('fr');

      const exists = await repo.existsBy({ name: 'Souris' } as any);

      expect(exists).toBe(true);
    });

    it('should return false in existsBy when not found', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('fr');

      const exists = await repo.existsBy({ name: 'NonExistent' } as any);

      expect(exists).toBe(false);
    });
  });

  describe('order option in find', () => {
    it('should translate order clause in find options', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        order: { name: 'ASC' } as any,
      });

      expect(products.length).toBeGreaterThan(0);
      const names = products.map((p) => p.nameTranslations?.es);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should translate order clause descending', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        order: { name: 'DESC' } as any,
      });

      expect(products.length).toBeGreaterThan(0);
      const names = products.map((p) => p.nameTranslations?.es);
      const sortedNames = [...names].sort().reverse();
      expect(names).toEqual(sortedNames);
    });

    it('should handle mixed i18n and non-i18n order columns', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        order: {
          isActive: 'DESC',
          name: 'ASC',
        } as any,
      });

      expect(products.length).toBeGreaterThan(0);
    });

    it('should work with where and order together', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        where: { isActive: true },
        order: { name: 'ASC' } as any,
      });

      expect(products.length).toBeGreaterThan(0);
      products.forEach((p) => expect(p.isActive).toBe(true));
      const names = products.map((p) => p.nameTranslations?.es);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });

  describe('Default Language Edge Cases', () => {
    it('should use base column when language is set to default', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('en'); // Default language

      // Should query 'name' column, not 'name_en'
      const products = await repo.find({
        where: { name: 'Laptop' } as any,
      });

      expect(products).toHaveLength(1);
      expect(products[0].name).toBe('Laptop');
    });

    it('should use base column in order when language is default', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('en');

      const products = await repo.find({
        order: { name: 'ASC' } as any,
      });

      expect(products.length).toBeGreaterThan(0);
      const names = products.map((p) => p.nameTranslations?.en);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('getLanguageColumn should return base name for default language', () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('en');

      expect(repo.getLanguageColumn('name')).toBe('name');
      expect(repo.getLanguageColumn('description')).toBe('description');
    });
  });

  describe('Array Where (OR conditions)', () => {
    it('should translate array where in findAndCount', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const [products, count] = await repo.findAndCount({
        where: [{ name: 'Portátil' }, { name: 'Ratón' }] as any,
      });

      expect(count).toBe(2);
      expect(products).toHaveLength(2);
    });

    it('should translate array where in count', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const count = await repo.count({
        where: [{ name: 'Portátil' }, { name: 'Ratón' }] as any,
      });

      expect(count).toBe(2);
    });

    it('should translate array where in exists', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const exists = await repo.exists({
        where: [{ name: 'Portátil' }, { name: 'NonExistent' }] as any,
      });

      expect(exists).toBe(true);
    });
  });

  describe('Multiple i18n Columns', () => {
    it('should translate multiple i18n columns in where', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        where: {
          name: 'Portátil',
          description: 'Portátil de alto rendimiento con SSD',
        } as any,
      });

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.es).toBe('Portátil');
    });

    it('should translate multiple i18n columns in order', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        order: {
          name: 'ASC',
          description: 'DESC',
        } as any,
      });

      expect(products.length).toBeGreaterThan(0);
    });

    it('should translate i18n columns in both where and order', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('fr');

      const products = await repo.find({
        where: { name: 'Ordinateur portable' } as any,
        order: { description: 'ASC' } as any,
      });

      expect(products).toHaveLength(1);
    });
  });

  describe('Empty Results Handling', () => {
    it('should handle empty results in findAndCount', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const [products, count] = await repo.findAndCount({
        where: { name: 'NonExistent' } as any,
      });

      expect(count).toBe(0);
      expect(products).toHaveLength(0);
    });

    it('should handle empty results in findAndCountBy', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const [products, count] = await repo.findAndCountBy({ name: 'NonExistent' } as any);

      expect(count).toBe(0);
      expect(products).toHaveLength(0);
    });
  });

  describe('No Language Set Behavior', () => {
    it('should use default column in findAndCount when no language set', async () => {
      const repo = getI18nRepository(Product, dataSource);
      // No language set - should use default (en)

      const [products, count] = await repo.findAndCount({
        where: { name: 'Laptop' } as any,
      });

      expect(count).toBe(1);
      expect(products[0].nameTranslations?.en).toBe('Laptop');
    });

    it('should use default column in count when no language set', async () => {
      const repo = getI18nRepository(Product, dataSource);

      const count = await repo.count({
        where: { name: 'Laptop' } as any,
      });

      expect(count).toBe(1);
    });

    it('should use default column in exists when no language set', async () => {
      const repo = getI18nRepository(Product, dataSource);

      const exists = await repo.exists({
        where: { name: 'Laptop' } as any,
      });

      expect(exists).toBe(true);
    });
  });

  describe('Clean JSON Output', () => {
    it('should not include raw translation columns in loaded entity', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const product = await repo.findOne({ where: { id: 1 } });

      expect(product).toBeDefined();
      // Translations should be in the translations object only
      expect(product!.nameTranslations).toBeDefined();
      expect(product!.nameTranslations?.en).toBe('Laptop');
      expect(product!.nameTranslations?.es).toBe('Portátil');
      expect(product!.nameTranslations?.fr).toBe('Ordinateur portable');

      // Raw translation columns should NOT be present
      expect((product as any).name_es).toBeUndefined();
      expect((product as any).name_fr).toBeUndefined();
      expect((product as any).description_es).toBeUndefined();
      expect((product as any).description_fr).toBeUndefined();

      // Base property should have current language value
      expect(product!.name).toBe('Portátil');
    });

    it('should produce clean JSON without raw translation columns', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('fr');

      const product = await repo.findOne({ where: { id: 1 } });
      const json = JSON.parse(JSON.stringify(product));

      // Should have translations object
      expect(json.nameTranslations).toEqual({
        en: 'Laptop',
        es: 'Portátil',
        fr: 'Ordinateur portable',
      });

      // Should NOT have raw columns
      expect(json.name_es).toBeUndefined();
      expect(json.name_fr).toBeUndefined();
      expect(json.description_es).toBeUndefined();
      expect(json.description_fr).toBeUndefined();

      // Should have the base property with current language value
      expect(json.name).toBe('Ordinateur portable');
    });

    it('should clean up raw columns for all i18n properties', async () => {
      const repo = getI18nRepository(Product, dataSource);

      const products = await repo.find();

      for (const product of products) {
        // Check that no raw translation columns exist
        const keys = Object.keys(product);
        const rawTranslationColumns = keys.filter(
          (key) => key.includes('_es') || key.includes('_fr')
        );

        expect(rawTranslationColumns).toHaveLength(0);

        // Translations should be accessible via translations object
        expect(product.nameTranslations).toBeDefined();
        expect(product.descriptionTranslations).toBeDefined();
      }
    });

    it('should work correctly with QueryBuilder results', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo
        .createQueryBuilder('product')
        .where({ name: 'Portátil' })
        .getMany();

      expect(products).toHaveLength(1);
      const product = products[0];

      // Raw columns should not be present
      expect((product as any).name_es).toBeUndefined();
      expect((product as any).name_fr).toBeUndefined();

      // Translations should be in the object
      expect(product.nameTranslations?.es).toBe('Portátil');
    });
  });

  describe('create() with translations', () => {
    it('should create entity with translations passed directly', async () => {
      const repo = getI18nRepository(Product, dataSource);

      const input = {
        nameTranslations: {
          en: 'Direct Create EN',
          es: 'Direct Create ES',
          fr: 'Direct Create FR',
        },
        descriptionTranslations: {
          en: 'Description EN',
          es: 'Descripción ES',
          fr: 'Description FR',
        },
        price: 199.99,
        isActive: true,
      };
      const product = repo.create(input as any);

      // Entity should have translations set
      expect(product.nameTranslations).toBeDefined();
      expect(product.nameTranslations?.en).toBe('Direct Create EN');
      expect(product.nameTranslations?.es).toBe('Direct Create ES');
      expect(product.nameTranslations?.fr).toBe('Direct Create FR');

      // Raw columns should be populated for TypeORM
      expect((product as any).name).toBe('Direct Create EN');
      expect((product as any).name_es).toBe('Direct Create ES');
      expect((product as any).name_fr).toBe('Direct Create FR');

      // Save and verify persistence
      const saved = await repo.save(product);
      expect(saved.id).toBeDefined();

      const loaded = await repo.findOne({ where: { id: saved.id } });
      expect(loaded?.nameTranslations?.en).toBe('Direct Create EN');
      expect(loaded?.nameTranslations?.es).toBe('Direct Create ES');
      expect(loaded?.nameTranslations?.fr).toBe('Direct Create FR');
    });

    it('should create entity with partial translations', async () => {
      const repo = getI18nRepository(Product, dataSource);

      const input = {
        nameTranslations: {
          en: 'English Only',
        },
        descriptionTranslations: {
          en: 'English Description',
        },
        price: 99.99,
        isActive: true,
      };
      const product = repo.create(input as any);

      expect(product.nameTranslations?.en).toBe('English Only');
      expect((product as any).name).toBe('English Only');

      const saved = await repo.save(product);
      const loaded = await repo.findOne({ where: { id: saved.id } });

      expect(loaded?.nameTranslations?.en).toBe('English Only');
      // Database NULL values come back as null, not undefined
      expect(loaded?.nameTranslations?.es).toBeNull();
      expect(loaded?.nameTranslations?.fr).toBeNull();
    });

    it('should create multiple entities with translations using array', async () => {
      const repo = getI18nRepository(Product, dataSource);

      const inputs: any[] = [
        {
          nameTranslations: { en: 'Product 1', es: 'Producto 1', fr: 'Produit 1' },
          descriptionTranslations: { en: 'Desc 1', es: 'Desc 1', fr: 'Desc 1' },
          price: 100,
          isActive: true,
        },
        {
          nameTranslations: { en: 'Product 2', es: 'Producto 2', fr: 'Produit 2' },
          descriptionTranslations: { en: 'Desc 2', es: 'Desc 2', fr: 'Desc 2' },
          price: 200,
          isActive: true,
        },
      ];
      const products = repo.create(inputs);

      expect(products).toHaveLength(2);
      expect(products[0].nameTranslations?.en).toBe('Product 1');
      expect(products[1].nameTranslations?.es).toBe('Producto 2');

      // Raw columns should be populated
      expect((products[0] as any).name).toBe('Product 1');
      expect((products[1] as any).name_es).toBe('Producto 2');

      // Save and verify
      const saved = await repo.save(products);
      expect(saved).toHaveLength(2);

      const loaded = await repo.find({ order: { price: 'ASC' } });
      const newProducts = loaded.filter((p) => p.price >= 100);
      expect(newProducts.length).toBeGreaterThanOrEqual(2);
    });

    it('should create empty entity when called without arguments', () => {
      const repo = getI18nRepository(Product, dataSource);

      const product = repo.create();

      expect(product).toBeDefined();
      expect(product.id).toBeUndefined();
      expect(product.name).toBeUndefined();
    });

    it('should handle mixed translations and regular column properties', async () => {
      const repo = getI18nRepository(Product, dataSource);

      const input = {
        nameTranslations: { en: 'Mixed Product', es: 'Producto Mixto', fr: 'Produit Mixte' },
        descriptionTranslations: { en: 'Mixed Desc', es: 'Desc Mixta', fr: 'Desc Mixte' },
        price: 299.99,
        isActive: false,
      };
      const product = repo.create(input as any);

      // Translations should be set
      expect(product.nameTranslations?.en).toBe('Mixed Product');

      // Regular columns should also be set
      expect(product.price).toBe(299.99);
      expect(product.isActive).toBe(false);

      const saved = await repo.save(product);
      const loaded = await repo.findOne({ where: { id: saved.id } });

      expect(loaded?.nameTranslations?.en).toBe('Mixed Product');
      expect(loaded?.price).toBe(299.99);
      expect(loaded?.isActive).toBe(false);
    });

    it('should work with language context after create and save', async () => {
      const repo = getI18nRepository(Product, dataSource);

      const input = {
        nameTranslations: { en: 'Context Test', es: 'Prueba Contexto', fr: 'Test Contexte' },
        descriptionTranslations: { en: 'Desc EN', es: 'Desc ES', fr: 'Desc FR' },
        price: 50,
        isActive: true,
      };
      const product = repo.create(input as any);

      const saved = await repo.save(product);

      // Query with Spanish context
      repo.setLanguage('es');
      const loadedEs = await repo.findOne({ where: { name: 'Prueba Contexto' } as any });
      expect(loadedEs?.id).toBe(saved.id);
      expect(loadedEs?.name).toBe('Prueba Contexto');

      // Query with French context
      repo.setLanguage('fr');
      const loadedFr = await repo.findOne({ where: { name: 'Test Contexte' } as any });
      expect(loadedFr?.id).toBe(saved.id);
      expect(loadedFr?.name).toBe('Test Contexte');
    });
  });
});
