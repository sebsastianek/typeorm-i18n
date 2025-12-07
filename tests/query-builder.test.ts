import { DataSource, Like, Not } from 'typeorm';
import {
  getI18nRepository,
  setI18nConfig,
  resetI18nConfig,
  I18nQueryBuilder,
} from '../src';
import { normalizeLanguageCode, normalizeLanguageCodes } from '../src/language-utils';
import { createE2EDataSource, closeE2EDataSource, seedDatabase } from './db-helper';
import { Product } from './entities/Product.entity';
import { productFixtures } from './fixtures/product.fixtures';

describe('QueryBuilder and Type Helpers', () => {
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

  describe('I18nQueryBuilder', () => {
    describe('where() with object syntax', () => {
      it('should query using the current language column with equals', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: 'Portátil' })
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].nameTranslations?.en).toBe('Laptop');
        expect(products[0].nameTranslations?.es).toBe('Portátil');
      });

      it('should query using the default language when language is set to default', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('en');

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: 'Laptop' })
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].nameTranslations?.en).toBe('Laptop');
      });

      it('should work with LIKE operator using TypeORM Like()', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: Like('%tátil%') })
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].nameTranslations?.es).toBe('Portátil');
      });

      it('should work with Not() operator', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: Not('Portátil') })
          .getMany();

        expect(products.length).toBeGreaterThan(0);
        products.forEach((p: Product) => expect(p.nameTranslations?.es).not.toBe('Portátil'));
      });
    });

    describe('andWhere() with object syntax', () => {
      it('should add AND condition with language column', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where('product.isActive = :active', { active: true })
          .andWhere({ name: 'Ratón' })
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].nameTranslations?.es).toBe('Ratón');
        expect(products[0].isActive).toBe(true);
      });

      it('should chain multiple andWhere calls', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: Not('Portátil') })
          .andWhere({ description: Like('%ratón%') })
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].nameTranslations?.es).toBe('Ratón');
      });
    });

    describe('orWhere() with object syntax', () => {
      it('should add OR condition with language column', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: 'Portátil' })
          .orWhere({ name: 'Ratón' })
          .getMany();

        expect(products).toHaveLength(2);
        const names = products.map((p: Product) => p.nameTranslations?.es);
        expect(names).toContain('Portátil');
        expect(names).toContain('Ratón');
      });
    });

    describe('orderBy() with auto-translation', () => {
      it('should order by language column ascending', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .orderBy('product.name', 'ASC')
          .getMany();

        expect(products.length).toBeGreaterThan(0);
        const names = products.map((p: Product) => p.nameTranslations?.es);
        const sortedNames = [...names].sort();
        expect(names).toEqual(sortedNames);
      });

      it('should order by language column descending', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .orderBy('product.name', 'DESC')
          .getMany();

        expect(products.length).toBeGreaterThan(0);
        const names = products.map((p: Product) => p.nameTranslations?.es);
        const sortedNames = [...names].sort().reverse();
        expect(names).toEqual(sortedNames);
      });
    });

    describe('addOrderBy() with auto-translation', () => {
      it('should add secondary order by language column', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .orderBy('product.isActive', 'DESC')
          .addOrderBy('product.name', 'ASC')
          .getMany();

        expect(products.length).toBeGreaterThan(0);
      });
    });

    describe('select() with auto-translation', () => {
      it('should translate column in select with string', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const results = await repo
          .createQueryBuilder('product')
          .select('product.name')
          .getRawMany();

        expect(results.length).toBeGreaterThan(0);
        // Raw result should have Spanish column
        expect(results[0]).toHaveProperty('product_name_es');
      });

      it('should translate columns in select with array', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('fr');

        const results = await repo
          .createQueryBuilder('product')
          .select(['product.name', 'product.description'])
          .getRawMany();

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('product_name_fr');
        expect(results[0]).toHaveProperty('product_description_fr');
      });

      it('should not translate non-i18n columns', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const results = await repo
          .createQueryBuilder('product')
          .select(['product.id', 'product.price', 'product.name'])
          .getRawMany();

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('product_id');
        expect(results[0]).toHaveProperty('product_price');
        expect(results[0]).toHaveProperty('product_name_es');
      });

      it('should use default column when no language set', async () => {
        const repo = getI18nRepository(Product, dataSource);
        // No language set

        const results = await repo
          .createQueryBuilder('product')
          .select('product.name')
          .getRawMany();

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('product_name');
      });
    });

    describe('addSelect() with auto-translation', () => {
      it('should translate column in addSelect with string', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const results = await repo
          .createQueryBuilder('product')
          .select('product.id')
          .addSelect('product.name')
          .getRawMany();

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('product_id');
        expect(results[0]).toHaveProperty('product_name_es');
      });

      it('should translate columns in addSelect with array', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('fr');

        const results = await repo
          .createQueryBuilder('product')
          .select('product.id')
          .addSelect(['product.name', 'product.description'])
          .getRawMany();

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('product_id');
        expect(results[0]).toHaveProperty('product_name_fr');
        expect(results[0]).toHaveProperty('product_description_fr');
      });
    });

    describe('groupBy() with auto-translation', () => {
      it('should translate column in groupBy', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const results = await repo
          .createQueryBuilder('product')
          .select('product.name')
          .addSelect('COUNT(*)', 'count')
          .groupBy('product.name')
          .getRawMany();

        expect(results.length).toBeGreaterThan(0);
        // Each unique Spanish name should have a count
        results.forEach((r: any) => {
          expect(r).toHaveProperty('product_name_es');
          expect(r).toHaveProperty('count');
        });
      });

      it('should use default column when no language set', async () => {
        const repo = getI18nRepository(Product, dataSource);
        // No language set

        const results = await repo
          .createQueryBuilder('product')
          .select('product.name')
          .addSelect('COUNT(*)', 'count')
          .groupBy('product.name')
          .getRawMany();

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('product_name');
      });
    });

    describe('addGroupBy() with auto-translation', () => {
      it('should translate column in addGroupBy', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const results = await repo
          .createQueryBuilder('product')
          .select(['product.isActive', 'product.name'])
          .addSelect('COUNT(*)', 'count')
          .groupBy('product.isActive')
          .addGroupBy('product.name')
          .getRawMany();

        expect(results.length).toBeGreaterThan(0);
        results.forEach((r: any) => {
          expect(r).toHaveProperty('product_name_es');
          expect(r).toHaveProperty('count');
        });
      });
    });

    describe('getOne / getOneOrFail with transformation', () => {
      it('should transform entity in getOne', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const product = await repo
          .createQueryBuilder('product')
          .where({ name: 'Portátil' })
          .getOne();

        expect(product).not.toBeNull();
        expect(product?.name).toBe('Portátil');
        expect(product?.nameTranslations?.en).toBe('Laptop');
      });

      it('should transform entity in getOneOrFail', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const product = await repo
          .createQueryBuilder('product')
          .where({ name: 'Portátil' })
          .getOneOrFail();

        expect(product.name).toBe('Portátil');
        expect(product.nameTranslations?.en).toBe('Laptop');
      });

      it('should throw in getOneOrFail when not found', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        await expect(
          repo
            .createQueryBuilder('product')
            .where({ name: 'NonExistent' })
            .getOneOrFail()
        ).rejects.toThrow();
      });
    });

    describe('Default Language in QueryBuilder', () => {
      it('should use base column in where when language is default', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('en'); // Default

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: 'Laptop' })
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].name).toBe('Laptop');
      });

      it('should use base column in orderBy when language is default', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('en');

        const products = await repo
          .createQueryBuilder('product')
          .orderBy('product.name', 'ASC')
          .getMany();

        expect(products.length).toBeGreaterThan(0);
      });

      it('should use base column in select when language is default', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('en');

        const results = await repo
          .createQueryBuilder('product')
          .select('product.name')
          .getRawMany();

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('product_name');
        expect(results[0]).not.toHaveProperty('product_name_en');
      });
    });

    describe('Multiple i18n Columns in QueryBuilder', () => {
      it('should translate multiple i18n columns in where', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: 'Portátil' })
          .andWhere({ description: Like('%portátil%') })
          .getMany();

        expect(products).toHaveLength(1);
      });

      it('should translate multiple i18n columns in select', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('fr');

        const results = await repo
          .createQueryBuilder('product')
          .select(['product.name', 'product.description'])
          .getRawMany();

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('product_name_fr');
        expect(results[0]).toHaveProperty('product_description_fr');
      });

      it('should translate multiple i18n columns in orderBy', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .orderBy('product.name', 'ASC')
          .addOrderBy('product.description', 'DESC')
          .getMany();

        expect(products.length).toBeGreaterThan(0);
      });
    });

    describe('Combined Operations', () => {
      it('should translate all parts of a complex query', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .select(['product.id', 'product.name', 'product.price', 'product.isActive'])
          .where({ name: Like('%a%') })
          .andWhere('product.isActive = :active', { active: true })
          .orderBy('product.name', 'ASC')
          .getMany();

        expect(products.length).toBeGreaterThan(0);
        products.forEach((p) => {
          expect(p.isActive).toBe(true);
        });
      });

      it('should work with mixed string and object syntax', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: 'Ratón' })
          .andWhere('product.price > :price', { price: 0 })
          .orderBy('product.name', 'ASC')
          .getMany();

        expect(products).toHaveLength(1);
      });
    });

    describe('edge cases', () => {
      it('should handle non-i18n columns gracefully', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where('product.price > :price', { price: 0 })
          .getMany();

        expect(products.length).toBeGreaterThan(0);
      });

      it('should work without language set (uses base column)', async () => {
        const repo = getI18nRepository(Product, dataSource);

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: 'Laptop' })
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].nameTranslations?.en).toBe('Laptop');
      });

      it('should return empty array when no matches found', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: 'NonExistentProduct' })
          .getMany();

        expect(products).toHaveLength(0);
      });

      it('should handle multiple orWhere calls', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: 'Portátil' })
          .orWhere({ name: 'Ratón' })
          .orWhere({ name: 'Teclado' })
          .getMany();

        expect(products).toHaveLength(3);
      });

      it('should handle complex chained queries', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: Like('%a%') })
          .andWhere({ description: Like('%a%') })
          .orderBy('product.name', 'ASC')
          .addOrderBy('product.description', 'DESC')
          .getMany();

        expect(products.length).toBeGreaterThan(0);
      });
    });

    it('should return I18nQueryBuilder from createQueryBuilder', () => {
      const repo = getI18nRepository(Product, dataSource);
      const qb = repo.createQueryBuilder('product');

      expect(qb).toBeInstanceOf(I18nQueryBuilder);
      // Standard methods are available
      expect(typeof qb.where).toBe('function');
      expect(typeof qb.andWhere).toBe('function');
      expect(typeof qb.orWhere).toBe('function');
      expect(typeof qb.orderBy).toBe('function');
      expect(typeof qb.addOrderBy).toBe('function');
    });

    it('should have all standard QueryBuilder methods available', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const qb = repo.createQueryBuilder('product');

      expect(typeof qb.where).toBe('function');
      expect(typeof qb.andWhere).toBe('function');
      expect(typeof qb.orWhere).toBe('function');
      expect(typeof qb.orderBy).toBe('function');
      expect(typeof qb.getMany).toBe('function');
      expect(typeof qb.getOne).toBe('function');

      const products = await qb
        .where({ name: 'Ratón' })
        .andWhere('product.price > :minPrice', { minPrice: 0 })
        .getMany();

      expect(products).toHaveLength(1);
    });
  });

  describe('Repository find methods', () => {
    it('should auto-transform where clause in find()', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        where: { name: 'Portátil' } as any,
      });

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.es).toBe('Portátil');
    });

    it('should work with multiple conditions', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        where: {
          name: 'Ratón',
          isActive: true,
        } as any,
      });

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.es).toBe('Ratón');
    });

    it('should work with findOne', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const product = await repo.findOne({
        where: { name: 'Teclado' } as any,
      });

      expect(product).toBeDefined();
      expect(product?.nameTranslations?.es).toBe('Teclado');
    });

    it('should work with findOneBy', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('fr');

      const product = await repo.findOneBy(
        { name: 'Ordinateur portable' } as any
      );

      expect(product).toBeDefined();
      expect(product?.nameTranslations?.fr).toBe('Ordinateur portable');
    });

    it('should work with findBy', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.findBy(
        { name: 'Portátil' } as any
      );

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.es).toBe('Portátil');
    });

    it('should return null when findOne has no match', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const product = await repo.findOne({
        where: { name: 'NonExistent' } as any,
      });

      expect(product).toBeNull();
    });

    it('should work without setting language (uses default)', async () => {
      const repo = getI18nRepository(Product, dataSource);

      const products = await repo.find({
        where: { name: 'Laptop' } as any,
      });

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.en).toBe('Laptop');
    });

    it('should handle OR conditions with array where', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        where: [{ name: 'Portátil' }, { name: 'Ratón' }] as any,
      });

      expect(products).toHaveLength(2);
      const names = products.map((p) => p.nameTranslations?.es);
      expect(names).toContain('Portátil');
      expect(names).toContain('Ratón');
    });
  });

  describe('Case-Insensitive Language Codes', () => {
    describe('normalizeLanguageCode', () => {
      it('should convert uppercase to lowercase', () => {
        expect(normalizeLanguageCode('EN')).toBe('en');
        expect(normalizeLanguageCode('ES')).toBe('es');
        expect(normalizeLanguageCode('FR')).toBe('fr');
      });

      it('should handle mixed case', () => {
        expect(normalizeLanguageCode('En')).toBe('en');
        expect(normalizeLanguageCode('eS')).toBe('es');
        expect(normalizeLanguageCode('Fr')).toBe('fr');
      });

      it('should keep lowercase unchanged', () => {
        expect(normalizeLanguageCode('en')).toBe('en');
        expect(normalizeLanguageCode('es')).toBe('es');
      });

      it('should handle language codes with regions', () => {
        expect(normalizeLanguageCode('ZH-CN')).toBe('zh-cn');
        expect(normalizeLanguageCode('en-US')).toBe('en-us');
        expect(normalizeLanguageCode('pt-BR')).toBe('pt-br');
      });
    });

    describe('normalizeLanguageCodes', () => {
      it('should normalize an array of language codes', () => {
        const result = normalizeLanguageCodes(['EN', 'ES', 'FR']);
        expect(result).toEqual(['en', 'es', 'fr']);
      });

      it('should handle mixed case codes', () => {
        const result = normalizeLanguageCodes(['En', 'eS', 'FR']);
        expect(result).toEqual(['en', 'es', 'fr']);
      });
    });

    describe('setLanguage with case insensitivity', () => {
      it('should normalize uppercase language codes', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('ES');

        expect(repo.getLanguage()).toBe('es');

        const products = await repo.find({
          where: { name: 'Portátil' } as any,
        });

        expect(products).toHaveLength(1);
        expect(products[0].nameTranslations?.es).toBe('Portátil');
      });

      it('should normalize mixed case language codes', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('Es');

        expect(repo.getLanguage()).toBe('es');
      });

      it('should work with QueryBuilder after case normalization', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('ES');

        const products = await repo
          .createQueryBuilder('product')
          .where({ name: 'Ratón' })
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].nameTranslations?.es).toBe('Ratón');
      });
    });

    describe('setI18nConfig with case insensitivity', () => {
      afterEach(() => {
        setI18nConfig({
          languages: ['en', 'es', 'fr'],
          default_language: 'en',
        });
      });

      it('should normalize uppercase language codes in global config', () => {
        setI18nConfig({
          languages: ['EN', 'ES', 'FR'],
          default_language: 'EN',
        });

        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        expect(repo.getLanguageColumn('name')).toBe('name_es');
      });

      it('should normalize mixed case in global config', () => {
        setI18nConfig({
          languages: ['En', 'eS', 'FR'],
          default_language: 'En',
        });

        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('FR');

        expect(repo.getLanguageColumn('name')).toBe('name_fr');
      });
    });

    describe('getLanguageColumn with case insensitivity', () => {
      it('should return correct column after case normalization', () => {
        const repo = getI18nRepository(Product, dataSource);

        repo.setLanguage('ES');
        expect(repo.getLanguageColumn('name')).toBe('name_es');

        repo.setLanguage('Fr');
        expect(repo.getLanguageColumn('name')).toBe('name_fr');

        repo.setLanguage('EN');
        expect(repo.getLanguageColumn('name')).toBe('name');
      });
    });

    describe('integration with find operations', () => {
      it('should find products using uppercase language code', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('FR');

        const products = await repo.find({
          where: { name: 'Ordinateur portable' } as any,
        });

        expect(products).toHaveLength(1);
        expect(products[0].nameTranslations?.fr).toBe('Ordinateur portable');
      });

      it('should find products using mixed case language code', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('Es');

        const products = await repo.find({
          where: { name: 'Ratón' } as any,
        });

        expect(products).toHaveLength(1);
        expect(products[0].nameTranslations?.es).toBe('Ratón');
      });
    });
  });

  describe('Combined Usage', () => {
    it('should work with QueryBuilder methods', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('ES');

      const products = await repo
        .createQueryBuilder('product')
        .where({ name: Like('%atón%') })
        .andWhere('product.isActive = :active', { active: true })
        .orderBy('product.name', 'ASC')
        .getMany();

      expect(products).toHaveLength(1);
      expect(products[0].nameTranslations?.es).toBe('Ratón');
    });

    it('should maintain language context across multiple operations', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products1 = await repo.find({
        where: { name: 'Portátil' } as any,
      });
      expect(products1).toHaveLength(1);

      const products2 = await repo
        .createQueryBuilder('product')
        .where({ name: 'Ratón' })
        .getMany();
      expect(products2).toHaveLength(1);

      const products3 = await repo.findOne({
        where: { name: 'Teclado' } as any,
      });
      expect(products3).not.toBeNull();

      expect(repo.getLanguage()).toBe('es');
    });

    it('should switch languages correctly between queries', async () => {
      const repo = getI18nRepository(Product, dataSource);

      repo.setLanguage('es');
      const spanishProduct = await repo.findOne({
        where: { name: 'Portátil' } as any,
      });
      expect(spanishProduct).not.toBeNull();
      expect(spanishProduct?.nameTranslations?.en).toBe('Laptop');

      repo.setLanguage('fr');
      const frenchProduct = await repo.findOne({
        where: { name: 'Ordinateur portable' } as any,
      });
      expect(frenchProduct).not.toBeNull();
      expect(frenchProduct?.nameTranslations?.en).toBe('Laptop');

      expect(spanishProduct?.id).toBe(frenchProduct?.id);
    });

    it('should handle complex real-world scenario', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const products = await repo
        .createQueryBuilder('product')
        .where({ name: Like('%a%') })
        .andWhere('product.isActive = :active', { active: true })
        .andWhere('product.price > :minPrice', { minPrice: 10 })
        .orderBy('product.name', 'ASC')
        .getMany();

      expect(products.length).toBeGreaterThan(0);
      products.forEach((p) => {
        expect(p.isActive).toBe(true);
        expect(p.price).toBeGreaterThan(10);
        expect(p.nameTranslations?.es.toLowerCase()).toContain('a');
      });

      const names = products.map((p) => p.nameTranslations?.es);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });
});
