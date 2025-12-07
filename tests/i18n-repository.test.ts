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
});
