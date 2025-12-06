import { DataSource } from 'typeorm';
import {
  getI18nRepository,
  setI18nConfig,
  resetI18nConfig,
  i18nWhere,
  i18nWhereMany,
  I18nQueryBuilder,
} from '../src';
import { normalizeLanguageCode, normalizeLanguageCodes } from '../src/language-utils';
import { createE2EDataSource, closeE2EDataSource, seedDatabase } from './db-helper';
import { Product } from './entities/Product.entity';
import { productFixtures } from './fixtures/product.fixtures';

describe('New Features', () => {
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
    describe('whereLanguage', () => {
      it('should query using the current language column with equals operator', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .whereLanguage('name', '=', 'Portátil')
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].name.en).toBe('Laptop');
        expect(products[0].name.es).toBe('Portátil');
      });

      it('should query using the default language when language is set to default', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('en');

        const products = await repo
          .createQueryBuilder('product')
          .whereLanguage('name', '=', 'Laptop')
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].name.en).toBe('Laptop');
      });

      it('should work with LIKE operator', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .whereLanguage('name', 'LIKE', '%tátil%')
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].name.es).toBe('Portátil');
      });

      it('should work with != operator', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .whereLanguage('name', '!=', 'Portátil')
          .getMany();

        expect(products.length).toBeGreaterThan(0);
        products.forEach((p) => expect(p.name.es).not.toBe('Portátil'));
      });
    });

    describe('andWhereLanguage', () => {
      it('should add AND condition with language column', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .where('product.isActive = :active', { active: true })
          .andWhereLanguage('name', '=', 'Ratón')
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].name.es).toBe('Ratón');
        expect(products[0].isActive).toBe(true);
      });

      it('should chain multiple andWhereLanguage calls', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .whereLanguage('name', '!=', 'Portátil')
          .andWhereLanguage('description', 'LIKE', '%ratón%')
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].name.es).toBe('Ratón');
      });
    });

    describe('orWhereLanguage', () => {
      it('should add OR condition with language column', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .whereLanguage('name', '=', 'Portátil')
          .orWhereLanguage('name', '=', 'Ratón')
          .getMany();

        expect(products).toHaveLength(2);
        const names = products.map((p) => p.name.es);
        expect(names).toContain('Portátil');
        expect(names).toContain('Ratón');
      });
    });

    describe('orderByLanguage', () => {
      it('should order by language column ascending', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .orderByLanguage('name', 'ASC')
          .getMany();

        expect(products.length).toBeGreaterThan(0);
        // Verify ordering is applied (first product should come before last alphabetically)
        const names = products.map((p) => p.name.es);
        const sortedNames = [...names].sort();
        expect(names).toEqual(sortedNames);
      });

      it('should order by language column descending', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .orderByLanguage('name', 'DESC')
          .getMany();

        expect(products.length).toBeGreaterThan(0);
        const names = products.map((p) => p.name.es);
        const sortedNames = [...names].sort().reverse();
        expect(names).toEqual(sortedNames);
      });
    });

    describe('addOrderByLanguage', () => {
      it('should add secondary order by language column', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .orderBy('product.isActive', 'DESC')
          .addOrderByLanguage('name', 'ASC')
          .getMany();

        expect(products.length).toBeGreaterThan(0);
      });
    });

    describe('selectLanguage', () => {
      it('should select only language-specific columns', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .selectLanguage(['name'])
          .getRawMany();

        expect(products.length).toBeGreaterThan(0);
        // Raw results should have the Spanish column
        expect(products[0]).toHaveProperty('product_name_es');
      });

      it('should select multiple language columns', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('fr');

        const products = await repo
          .createQueryBuilder('product')
          .selectLanguage(['name', 'description'])
          .getRawMany();

        expect(products.length).toBeGreaterThan(0);
        expect(products[0]).toHaveProperty('product_name_fr');
        expect(products[0]).toHaveProperty('product_description_fr');
      });
    });

    describe('addSelectLanguage', () => {
      it('should add language columns to existing selection', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .select(['product.id', 'product.price'])
          .addSelectLanguage(['name'])
          .getRawMany();

        expect(products.length).toBeGreaterThan(0);
        expect(products[0]).toHaveProperty('product_id');
        expect(products[0]).toHaveProperty('product_price');
        expect(products[0]).toHaveProperty('product_name_es');
      });
    });

    describe('edge cases', () => {
      it('should handle non-i18n columns gracefully', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        // price is not an i18n column, should work without error
        const products = await repo
          .createQueryBuilder('product')
          .whereLanguage('price', '>', 0)
          .getMany();

        expect(products.length).toBeGreaterThan(0);
      });

      it('should work without language set (uses base column)', async () => {
        const repo = getI18nRepository(Product, dataSource);
        // Not setting language

        const products = await repo
          .createQueryBuilder('product')
          .whereLanguage('name', '=', 'Laptop')
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].name.en).toBe('Laptop');
      });

      it('should return empty array when no matches found', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .whereLanguage('name', '=', 'NonExistentProduct')
          .getMany();

        expect(products).toHaveLength(0);
      });

      it('should handle multiple orWhereLanguage calls', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .whereLanguage('name', '=', 'Portátil')
          .orWhereLanguage('name', '=', 'Ratón')
          .orWhereLanguage('name', '=', 'Teclado')
          .getMany();

        expect(products).toHaveLength(3);
      });

      it('should handle complex chained queries', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo
          .createQueryBuilder('product')
          .whereLanguage('name', 'LIKE', '%a%')
          .andWhereLanguage('description', 'LIKE', '%a%')
          .orderByLanguage('name', 'ASC')
          .addOrderByLanguage('description', 'DESC')
          .getMany();

        expect(products.length).toBeGreaterThan(0);
      });
    });

    it('should return I18nQueryBuilder from createQueryBuilder', () => {
      const repo = getI18nRepository(Product, dataSource);
      const qb = repo.createQueryBuilder('product');

      expect(qb).toBeInstanceOf(I18nQueryBuilder);
      expect(typeof qb.whereLanguage).toBe('function');
      expect(typeof qb.andWhereLanguage).toBe('function');
      expect(typeof qb.orWhereLanguage).toBe('function');
      expect(typeof qb.orderByLanguage).toBe('function');
      expect(typeof qb.addOrderByLanguage).toBe('function');
      expect(typeof qb.selectLanguage).toBe('function');
      expect(typeof qb.addSelectLanguage).toBe('function');
    });

    it('should have all standard QueryBuilder methods available', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      const qb = repo.createQueryBuilder('product');

      // Verify standard methods still work
      expect(typeof qb.where).toBe('function');
      expect(typeof qb.andWhere).toBe('function');
      expect(typeof qb.orWhere).toBe('function');
      expect(typeof qb.orderBy).toBe('function');
      expect(typeof qb.getMany).toBe('function');
      expect(typeof qb.getOne).toBe('function');

      // Actually execute a query mixing both
      const products = await qb
        .whereLanguage('name', '=', 'Ratón')
        .andWhere('product.price > :minPrice', { minPrice: 0 })
        .getMany();

      expect(products).toHaveLength(1);
    });
  });

  describe('Type Assertion Helpers', () => {
    describe('i18nWhere', () => {
      it('should allow type-safe queries without as any', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo.find({
          where: i18nWhere<Product>({ name: 'Portátil' }),
        });

        expect(products).toHaveLength(1);
        expect(products[0].name.es).toBe('Portátil');
      });

      it('should work with multiple conditions', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo.find({
          where: i18nWhere<Product>({
            name: 'Ratón',
            isActive: true,
          }),
        });

        expect(products).toHaveLength(1);
        expect(products[0].name.es).toBe('Ratón');
      });

      it('should work with findOne', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const product = await repo.findOne({
          where: i18nWhere<Product>({ name: 'Teclado' }),
        });

        expect(product).toBeDefined();
        expect(product?.name.es).toBe('Teclado');
      });

      it('should work with findOneBy', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('fr');

        const product = await repo.findOneBy(
          i18nWhere<Product>({ name: 'Ordinateur portable' })
        );

        expect(product).toBeDefined();
        expect(product?.name.fr).toBe('Ordinateur portable');
      });
    });

    describe('i18nWhereMany', () => {
      it('should allow OR conditions with type safety', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo.find({
          where: i18nWhereMany<Product>([{ name: 'Portátil' }, { name: 'Ratón' }]),
        });

        expect(products).toHaveLength(2);
        const names = products.map((p) => p.name.es);
        expect(names).toContain('Portátil');
        expect(names).toContain('Ratón');
      });

      it('should work with three or more conditions', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo.find({
          where: i18nWhereMany<Product>([
            { name: 'Portátil' },
            { name: 'Ratón' },
            { name: 'Teclado' },
          ]),
        });

        expect(products).toHaveLength(3);
      });

      it('should return empty array when no matches', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo.find({
          where: i18nWhereMany<Product>([
            { name: 'NonExistent1' },
            { name: 'NonExistent2' },
          ]),
        });

        expect(products).toHaveLength(0);
      });

      it('should work with mixed i18n and regular columns', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo.find({
          where: i18nWhereMany<Product>([
            { name: 'Portátil', isActive: true },
            { name: 'Ratón', isActive: true },
          ]),
        });

        expect(products).toHaveLength(2);
        products.forEach((p) => expect(p.isActive).toBe(true));
      });
    });

    describe('edge cases', () => {
      it('should work with findBy using i18nWhere', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo.findBy(
          i18nWhere<Product>({ name: 'Portátil' })
        );

        expect(products).toHaveLength(1);
        expect(products[0].name.es).toBe('Portátil');
      });

      it('should return null when findOne has no match', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const product = await repo.findOne({
          where: i18nWhere<Product>({ name: 'NonExistent' }),
        });

        expect(product).toBeNull();
      });

      it('should work without setting language (uses default)', async () => {
        const repo = getI18nRepository(Product, dataSource);
        // Not setting language - should use default (en)

        const products = await repo.find({
          where: i18nWhere<Product>({ name: 'Laptop' }),
        });

        expect(products).toHaveLength(1);
        expect(products[0].name.en).toBe('Laptop');
      });

      it('should work with numeric comparisons on non-i18n fields', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('es');

        const products = await repo.find({
          where: i18nWhere<Product>({ name: 'Portátil' }),
        });

        expect(products).toHaveLength(1);
        expect(products[0].price).toBeGreaterThan(0);
      });
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
        repo.setLanguage('ES'); // Uppercase

        expect(repo.getLanguage()).toBe('es'); // Should be lowercase

        const products = await repo.find({
          where: { name: 'Portátil' } as any,
        });

        expect(products).toHaveLength(1);
        expect(products[0].name.es).toBe('Portátil');
      });

      it('should normalize mixed case language codes', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('Es'); // Mixed case

        expect(repo.getLanguage()).toBe('es');
      });

      it('should work with QueryBuilder after case normalization', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('ES'); // Uppercase

        const products = await repo
          .createQueryBuilder('product')
          .whereLanguage('name', '=', 'Ratón')
          .getMany();

        expect(products).toHaveLength(1);
        expect(products[0].name.es).toBe('Ratón');
      });
    });

    describe('setI18nConfig with case insensitivity', () => {
      afterEach(() => {
        // Restore original config
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

        // If normalization works, it should find the column correctly
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
          where: i18nWhere<Product>({ name: 'Ordinateur portable' }),
        });

        expect(products).toHaveLength(1);
        expect(products[0].name.fr).toBe('Ordinateur portable');
      });

      it('should find products using mixed case language code', async () => {
        const repo = getI18nRepository(Product, dataSource);
        repo.setLanguage('Es');

        const products = await repo.find({
          where: i18nWhere<Product>({ name: 'Ratón' }),
        });

        expect(products).toHaveLength(1);
        expect(products[0].name.es).toBe('Ratón');
      });
    });
  });

  describe('Combined Usage', () => {
    it('should work with QueryBuilder methods and type helpers together', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('ES'); // Uppercase - should be normalized

      // Using QueryBuilder with language-aware methods
      const products = await repo
        .createQueryBuilder('product')
        .whereLanguage('name', 'LIKE', '%atón%')
        .andWhere('product.isActive = :active', { active: true })
        .orderByLanguage('name', 'ASC')
        .getMany();

      expect(products).toHaveLength(1);
      expect(products[0].name.es).toBe('Ratón');
    });

    it('should allow mixing standard and language-aware methods', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('fr');

      const products = await repo
        .createQueryBuilder('product')
        .select(['product.id', 'product.price'])
        .addSelectLanguage(['name', 'description'])
        .whereLanguage('name', '=', 'Ordinateur portable')
        .getMany();

      expect(products).toHaveLength(1);
    });

    it('should work with all three features combined', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('ES'); // Case insensitive

      // Use i18nWhere for type safety
      const findResults = await repo.find({
        where: i18nWhere<Product>({ name: 'Portátil' }),
      });
      expect(findResults).toHaveLength(1);

      // Use QueryBuilder with language methods
      const qbResults = await repo
        .createQueryBuilder('product')
        .whereLanguage('name', '=', 'Portátil')
        .getMany();
      expect(qbResults).toHaveLength(1);

      // Both should return the same product
      expect(findResults[0].id).toBe(qbResults[0].id);
    });

    it('should maintain language context across multiple operations', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      // First query
      const products1 = await repo.find({
        where: i18nWhere<Product>({ name: 'Portátil' }),
      });
      expect(products1).toHaveLength(1);

      // Second query with same language context
      const products2 = await repo
        .createQueryBuilder('product')
        .whereLanguage('name', '=', 'Ratón')
        .getMany();
      expect(products2).toHaveLength(1);

      // Third query
      const products3 = await repo.findOne({
        where: i18nWhere<Product>({ name: 'Teclado' }),
      });
      expect(products3).not.toBeNull();

      // Language should still be 'es'
      expect(repo.getLanguage()).toBe('es');
    });

    it('should switch languages correctly between queries', async () => {
      const repo = getI18nRepository(Product, dataSource);

      // Query in Spanish
      repo.setLanguage('es');
      const spanishProduct = await repo.findOne({
        where: i18nWhere<Product>({ name: 'Portátil' }),
      });
      expect(spanishProduct).not.toBeNull();
      expect(spanishProduct?.name.en).toBe('Laptop');

      // Query in French
      repo.setLanguage('fr');
      const frenchProduct = await repo.findOne({
        where: i18nWhere<Product>({ name: 'Ordinateur portable' }),
      });
      expect(frenchProduct).not.toBeNull();
      expect(frenchProduct?.name.en).toBe('Laptop');

      // Both should be the same product
      expect(spanishProduct?.id).toBe(frenchProduct?.id);
    });

    it('should handle complex real-world scenario', async () => {
      const repo = getI18nRepository(Product, dataSource);
      repo.setLanguage('es');

      // Find all active products with Spanish name containing 'a', ordered by name
      const products = await repo
        .createQueryBuilder('product')
        .whereLanguage('name', 'LIKE', '%a%')
        .andWhere('product.isActive = :active', { active: true })
        .andWhere('product.price > :minPrice', { minPrice: 10 })
        .orderByLanguage('name', 'ASC')
        .getMany();

      expect(products.length).toBeGreaterThan(0);
      products.forEach((p) => {
        expect(p.isActive).toBe(true);
        expect(p.price).toBeGreaterThan(10);
        expect(p.name.es.toLowerCase()).toContain('a');
      });

      // Verify order
      const names = products.map((p) => p.name.es);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });
});
