import { DataSource } from 'typeorm';
import {
  createE2EDataSource,
  closeE2EDataSource,
  cleanDatabase,
  seedDatabase,
  waitForDatabase,
  getDatabaseConfig,
} from './db-helper';
import { Product, ProductLanguages } from './entities/Product.entity';
import { Article } from './entities/Article.entity';
import { Document } from './entities/Document.entity';
import { productFixtures } from './fixtures/product.fixtures';
import { articleFixtures } from './fixtures/article.fixtures';
import { documentFixtures } from './fixtures/document.fixtures';
import { I18nValue, prepareI18nUpdate } from '../src';

describe('Full Stack Tests with Real Database', () => {
  let dataSource: DataSource;
  const dbConfig = getDatabaseConfig();
  const isSqlite = dbConfig.type === 'better-sqlite3';

  beforeAll(async () => {
    await waitForDatabase();
    const entities = isSqlite ? [Product, Article, Document] : [Product, Article];
    dataSource = await createE2EDataSource(entities);
  });

  afterAll(async () => {
    await closeE2EDataSource(dataSource);
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
  });

  describe('Database Schema Generation', () => {
    it('should create correct table structure for I18n columns', async () => {
      const productRepo = dataSource.getRepository(Product);
      const metadata = productRepo.metadata;
      const columns = metadata.columns.map((col) => col.databaseName);

      expect(columns).toContain('name');
      expect(columns).toContain('name_es');
      expect(columns).toContain('name_fr');
      expect(columns).toContain('description');
      expect(columns).toContain('description_es');
      expect(columns).toContain('description_fr');
      expect(columns).toContain('price');
      expect(columns).toContain('isActive');
    });

    it('should create nullable columns for non-default languages', async () => {
      const productRepo = dataSource.getRepository(Product);
      const metadata = productRepo.metadata;

      const nameEsColumn = metadata.columns.find((col) => col.databaseName === 'name_es');
      const nameFrColumn = metadata.columns.find((col) => col.databaseName === 'name_fr');

      expect(nameEsColumn?.isNullable).toBe(true);
      expect(nameFrColumn?.isNullable).toBe(true);
    });
  });

  describe('Complete CRUD Lifecycle', () => {
    it('should handle full product lifecycle: create -> read -> update -> delete', async () => {
      const productRepo = dataSource.getRepository(Product);

      // CREATE with all translations
      const product = productRepo.create();
      Object.assign(product, {
        nameTranslations: {
          en: 'Gaming Monitor',
          es: 'Monitor de Juegos',
          fr: 'Moniteur de Jeu',
        } as I18nValue<ProductLanguages, string>,
        descriptionTranslations: {
          en: '27-inch 4K gaming monitor',
          es: 'Monitor de juegos 4K de 27 pulgadas',
          fr: 'Moniteur de jeu 4K de 27 pouces',
        } as I18nValue<ProductLanguages, string>,
        price: 599.99,
        isActive: true,
      });

      const saved = await productRepo.save(product);
      expect(saved.id).toBeDefined();

      // READ - check all translations available
      const loaded = await productRepo.findOne({ where: { id: saved.id } });
      expect(loaded).toBeDefined();
      expect(loaded?.nameTranslations?.en).toBe('Gaming Monitor');
      expect(loaded?.nameTranslations?.es).toBe('Monitor de Juegos');
      expect(loaded?.nameTranslations?.fr).toBe('Moniteur de Jeu');
      // Default language value in single-value property
      expect(loaded?.name).toBe('Gaming Monitor');

      // UPDATE all translations
      loaded!.nameTranslations = {
        en: 'Premium Gaming Monitor',
        es: 'Monitor de Juegos Premium',
        fr: 'Moniteur de Jeu Premium',
      };
      loaded!.price = 649.99;

      await productRepo.save(loaded!);

      const updated = await productRepo.findOne({ where: { id: saved.id } });
      expect(updated?.nameTranslations?.en).toBe('Premium Gaming Monitor');
      expect(updated?.price).toBe(649.99);

      // DELETE
      await productRepo.remove(updated!);
      const deleted = await productRepo.findOne({ where: { id: saved.id } });
      expect(deleted).toBeNull();
    });
  });

  describe('Complex Queries and Operations', () => {
    beforeEach(async () => {
      await seedDatabase(dataSource, Product, productFixtures);
    });

    it('should handle complex WHERE clauses', async () => {
      const productRepo = dataSource.getRepository(Product);

      const expensiveProducts = await productRepo
        .createQueryBuilder('product')
        .where('product.price > :minPrice', { minPrice: 100 })
        .andWhere('product.isActive = :active', { active: true })
        .orderBy('product.price', 'DESC')
        .getMany();

      expect(expensiveProducts.length).toBeGreaterThan(0);
      expensiveProducts.forEach((product) => {
        expect(product.price).toBeGreaterThan(100);
        expect(product.isActive).toBe(true);
        expect(product.nameTranslations).toHaveProperty('en');
        expect(product.nameTranslations).toHaveProperty('es');
        expect(product.nameTranslations).toHaveProperty('fr');
      });
    });

    it('should support aggregate functions', async () => {
      const productRepo = dataSource.getRepository(Product);

      const result = await productRepo
        .createQueryBuilder('product')
        .select('COUNT(*)', 'count')
        .addSelect('AVG(product.price)', 'avgPrice')
        .addSelect('MAX(product.price)', 'maxPrice')
        .addSelect('MIN(product.price)', 'minPrice')
        .getRawOne();

      const count = typeof result.count === 'string' ? parseInt(result.count) : result.count;
      expect(count).toBe(3);
      expect(parseFloat(result.avgPrice)).toBeGreaterThan(0);
      expect(parseFloat(result.maxPrice)).toBeGreaterThan(parseFloat(result.minPrice));
    });

    it('should handle pagination correctly', async () => {
      const productRepo = dataSource.getRepository(Product);

      const page1 = await productRepo.find({
        take: 2,
        skip: 0,
        order: { price: 'ASC' },
      });

      const page2 = await productRepo.find({
        take: 2,
        skip: 2,
        order: { price: 'ASC' },
      });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);

      const page1Ids = page1.map((p) => p.id);
      const page2Ids = page2.map((p) => p.id);
      const intersection = page1Ids.filter((id) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it('should support full-text search on I18n columns (default language)', async () => {
      const productRepo = dataSource.getRepository(Product);

      const laptops = await productRepo
        .createQueryBuilder('product')
        .where('LOWER(product.name) LIKE LOWER(:search)', { search: '%laptop%' })
        .getMany();

      expect(laptops.length).toBeGreaterThan(0);
      expect(laptops[0].nameTranslations?.en.toLowerCase()).toContain('laptop');
    });

    it('should support search in Spanish translation columns', async () => {
      const productRepo = dataSource.getRepository(Product);

      const result = await productRepo
        .createQueryBuilder('product')
        .where('LOWER(product.name_es) LIKE LOWER(:search)', { search: '%portátil%' })
        .getMany();

      expect(result.length).toBe(1);
      expect(result[0].nameTranslations?.es).toBe('Portátil');
      expect(result[0].nameTranslations?.en).toBe('Laptop');
    });

    it('should support search in French translation columns', async () => {
      const productRepo = dataSource.getRepository(Product);

      const result = await productRepo
        .createQueryBuilder('product')
        .where('LOWER(product.name_fr) LIKE LOWER(:search)', { search: '%souris%' })
        .getMany();

      expect(result.length).toBe(1);
      expect(result[0].nameTranslations?.fr).toBe('Souris');
      expect(result[0].nameTranslations?.en).toBe('Mouse');
    });

    it('should support multi-language search with OR conditions', async () => {
      const productRepo = dataSource.getRepository(Product);

      const result = await productRepo
        .createQueryBuilder('product')
        .where('LOWER(product.name) LIKE LOWER(:search)', { search: '%keyboard%' })
        .orWhere('LOWER(product.name_es) LIKE LOWER(:search)', { search: '%teclado%' })
        .orWhere('LOWER(product.name_fr) LIKE LOWER(:search)', { search: '%clavier%' })
        .getMany();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].nameTranslations?.en).toBe('Keyboard');
      expect(result[0].nameTranslations?.es).toBe('Teclado');
      expect(result[0].nameTranslations?.fr).toBe('Clavier');
    });

    it('should support filtering by non-default language column values', async () => {
      const productRepo = dataSource.getRepository(Product);

      const result = await productRepo
        .createQueryBuilder('product')
        .where('product.name_es = :name', { name: 'Ratón' })
        .getOne();

      expect(result).toBeDefined();
      expect(result?.nameTranslations?.es).toBe('Ratón');
      expect(result?.nameTranslations?.en).toBe('Mouse');
      expect(result?.nameTranslations?.fr).toBe('Souris');
    });
  });

  describe('Transaction Support', () => {
    it('should commit transactions successfully', async () => {
      const productRepo = dataSource.getRepository(Product);

      await dataSource.manager.transaction(async (transactionalEM) => {
        const product1 = transactionalEM.create(Product);
        Object.assign(product1, {
          nameTranslations: {
            en: 'Product 1',
            es: 'Producto 1',
            fr: 'Produit 1',
          } as I18nValue<ProductLanguages, string>,
          descriptionTranslations: {
            en: 'Description 1',
            es: 'Descripción 1',
            fr: 'Description 1',
          } as I18nValue<ProductLanguages, string>,
          price: 100,
          isActive: true,
        });

        const product2 = transactionalEM.create(Product);
        Object.assign(product2, {
          nameTranslations: {
            en: 'Product 2',
            es: 'Producto 2',
            fr: 'Produit 2',
          } as I18nValue<ProductLanguages, string>,
          descriptionTranslations: {
            en: 'Description 2',
            es: 'Descripción 2',
            fr: 'Description 2',
          } as I18nValue<ProductLanguages, string>,
          price: 200,
          isActive: true,
        });

        await transactionalEM.save([product1, product2]);
      });

      const count = await productRepo.count();
      expect(count).toBe(2);
    });

    it('should rollback transactions on error', async () => {
      const productRepo = dataSource.getRepository(Product);

      try {
        await dataSource.manager.transaction(async (transactionalEM) => {
          const product = transactionalEM.create(Product);
          Object.assign(product, {
            nameTranslations: {
              en: 'Rollback Product',
              es: 'Producto Rollback',
              fr: 'Produit Rollback',
            } as I18nValue<ProductLanguages, string>,
            descriptionTranslations: {
              en: 'Will be rolled back',
              es: 'Se revertirá',
              fr: 'Sera annulé',
            } as I18nValue<ProductLanguages, string>,
            price: 300,
            isActive: true,
          });

          await transactionalEM.save(product);
          throw new Error('Intentional rollback');
        });
      } catch (error: any) {
        expect(error.message).toBe('Intentional rollback');
      }

      const count = await productRepo.count();
      expect(count).toBe(0);
    });
  });

  describe('Multi-Entity Operations', () => {
    it('should handle operations across multiple entity types', async () => {
      const productRepo = dataSource.getRepository(Product);
      const articleRepo = dataSource.getRepository(Article);

      await seedDatabase(dataSource, Product, productFixtures);
      await seedDatabase(dataSource, Article, articleFixtures);

      const productCount = await productRepo.count();
      const articleCount = await articleRepo.count();

      expect(productCount).toBe(3);
      expect(articleCount).toBe(2);

      const product = await productRepo.findOne({ where: {} });
      const article = await articleRepo.findOne({ where: {} });

      expect(product?.nameTranslations).toHaveProperty('en');
      expect(product?.nameTranslations).toHaveProperty('es');
      expect(product?.nameTranslations).toHaveProperty('fr');

      expect(article?.titleTranslations).toHaveProperty('en');
      expect(article?.titleTranslations).toHaveProperty('de');
      expect(article?.titleTranslations).toHaveProperty('ja');
    });
  });

  // Binary data tests only for SQLite (blob type compatibility)
  if (isSqlite) {
    describe('Binary Data (Buffer) Support', () => {
      beforeEach(async () => {
        await seedDatabase(dataSource, Document, documentFixtures);
      });

      afterEach(async () => {
        const documentRepo = dataSource.getRepository(Document);
        await documentRepo.clear();
      });

      it('should store and retrieve Buffer data correctly', async () => {
        const documentRepo = dataSource.getRepository(Document);
        const doc = await documentRepo.findOne({ where: {} });

        expect(doc).toBeDefined();
        expect(doc?.binaryDataTranslations?.en).toBeInstanceOf(Buffer);
        expect(doc?.binaryDataTranslations?.es).toBeInstanceOf(Buffer);

        expect(doc?.binaryDataTranslations?.en.toString()).toBe('English binary data');
        expect(doc?.binaryDataTranslations?.es.toString()).toBe('Datos binarios en español');
      });

      it('should update Buffer data correctly', async () => {
        const documentRepo = dataSource.getRepository(Document);
        let doc = await documentRepo.findOne({ where: {} });
        expect(doc).toBeDefined();

        doc!.binaryDataTranslations = {
          en: Buffer.from('Updated English binary'),
          es: Buffer.from('Binario español actualizado'),
        };

        // Prepare the entity for update - copies translations to raw columns
        prepareI18nUpdate(doc!);

        await documentRepo.save(doc!);
        const updated = await documentRepo.findOne({ where: { id: doc!.id } });

        expect(updated?.binaryDataTranslations?.en.toString()).toBe('Updated English binary');
        expect(updated?.binaryDataTranslations?.es.toString()).toBe('Binario español actualizado');
      });
    });
  }

  describe('Data Integrity', () => {
    it('should maintain data consistency after multiple operations', async () => {
      const productRepo = dataSource.getRepository(Product);

      const newProduct = productRepo.create();
      Object.assign(newProduct, {
        nameTranslations: {
          en: 'Consistency Test',
          es: 'Prueba de Consistencia',
          fr: 'Test de Cohérence',
        } as I18nValue<ProductLanguages, string>,
        descriptionTranslations: {
          en: 'Testing consistency',
          es: 'Probando consistencia',
          fr: 'Test de cohérence',
        } as I18nValue<ProductLanguages, string>,
        price: 50,
        isActive: true,
      });
      let product = await productRepo.save(newProduct);

      const productId = product.id;

      for (let i = 0; i < 5; i++) {
        product = await productRepo.findOne({ where: { id: productId } }) as Product;
        product.nameTranslations = {
          ...product.nameTranslations!,
          en: `Consistency Test ${i}`,
        };
        product.price = 50 + i * 10;
        await productRepo.save(product);
      }

      const final = await productRepo.findOne({ where: { id: productId } });

      expect(final?.nameTranslations?.en).toBe('Consistency Test 4');
      expect(final?.price).toBe(90);
      expect(final?.nameTranslations?.es).toBe('Prueba de Consistencia');
      expect(final?.nameTranslations?.fr).toBe('Test de Cohérence');
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk inserts efficiently', async () => {
      const productRepo = dataSource.getRepository(Product);

      const products = Array.from({ length: 100 }, (_, i) => {
        const p = productRepo.create();
        Object.assign(p, {
          nameTranslations: {
            en: `Product ${i}`,
            es: `Producto ${i}`,
            fr: `Produit ${i}`,
          } as I18nValue<ProductLanguages, string>,
          descriptionTranslations: {
            en: `Description ${i}`,
            es: `Descripción ${i}`,
            fr: `Description ${i}`,
          } as I18nValue<ProductLanguages, string>,
          price: i * 10,
          isActive: i % 2 === 0,
        });
        return p;
      });

      await productRepo.save(products);

      const count = await productRepo.count();
      expect(count).toBe(100);
    });

    it('should handle bulk reads efficiently', async () => {
      const productRepo = dataSource.getRepository(Product);

      const products = Array.from({ length: 50 }, (_, i) => {
        const p = productRepo.create();
        Object.assign(p, {
          nameTranslations: {
            en: `Product ${i}`,
            es: `Producto ${i}`,
            fr: `Produit ${i}`,
          } as I18nValue<ProductLanguages, string>,
          descriptionTranslations: {
            en: `Description ${i}`,
            es: `Descripción ${i}`,
            fr: `Description ${i}`,
          } as I18nValue<ProductLanguages, string>,
          price: i * 10,
          isActive: true,
        });
        return p;
      });
      await productRepo.save(products);

      const loaded = await productRepo.find();

      expect(loaded).toHaveLength(50);
      loaded.forEach((product) => {
        expect(product.nameTranslations).toHaveProperty('en');
        expect(product.nameTranslations).toHaveProperty('es');
        expect(product.nameTranslations).toHaveProperty('fr');
      });
    });
  });
});
