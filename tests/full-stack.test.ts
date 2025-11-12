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
import { I18nValue } from '../src';

describe('Full Stack Tests with Real Database', () => {
  let dataSource: DataSource;
  const dbConfig = getDatabaseConfig();
  const isSqlite = dbConfig.type === 'better-sqlite3';

  beforeAll(async () => {
    // Wait for database to be ready
    await waitForDatabase();

    // Create connection (exclude Document entity for PostgreSQL/MySQL due to binary type differences)
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
      // Query to get column names (works for both PostgreSQL and MySQL)
      const productRepo = dataSource.getRepository(Product);
      const metadata = productRepo.metadata;

      const columns = metadata.columns.map((col) => col.databaseName);

      // Check that all language columns exist
      expect(columns).toContain('name'); // default language (en)
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

      // Non-default language columns should be nullable
      expect(nameEsColumn?.isNullable).toBe(true);
      expect(nameFrColumn?.isNullable).toBe(true);
    });
  });

  describe('Complete CRUD Lifecycle', () => {
    it('should handle full product lifecycle: create -> read -> update -> delete', async () => {
      const productRepo = dataSource.getRepository(Product);

      // CREATE
      const product = productRepo.create({
        name: {
          en: 'Gaming Monitor',
          es: 'Monitor de Juegos',
          fr: 'Moniteur de Jeu',
        } as I18nValue<ProductLanguages, string>,
        description: {
          en: '27-inch 4K gaming monitor',
          es: 'Monitor de juegos 4K de 27 pulgadas',
          fr: 'Moniteur de jeu 4K de 27 pouces',
        } as I18nValue<ProductLanguages, string>,
        price: 599.99,
        isActive: true,
      });

      const saved = await productRepo.save(product);
      expect(saved.id).toBeDefined();

      // READ
      const loaded = await productRepo.findOne({ where: { id: saved.id } });
      expect(loaded).toBeDefined();
      expect(loaded?.name.en).toBe('Gaming Monitor');
      expect(loaded?.name.es).toBe('Monitor de Juegos');
      expect(loaded?.name.fr).toBe('Moniteur de Jeu');

      // UPDATE
      loaded!.name.en = 'Premium Gaming Monitor';
      loaded!.description.es = 'Monitor de juegos 4K premium de 27 pulgadas';
      loaded!.price = 649.99;

      await productRepo.save(loaded!);

      const updated = await productRepo.findOne({ where: { id: saved.id } });
      expect(updated?.name.en).toBe('Premium Gaming Monitor');
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
        expect(product.name).toHaveProperty('en');
        expect(product.name).toHaveProperty('es');
        expect(product.name).toHaveProperty('fr');
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

      // SQLite returns numbers, PostgreSQL/MySQL return strings
      const count = typeof result.count === 'string' ? parseInt(result.count) : result.count;
      expect(count).toBe(3); // 3 products in fixtures
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
      expect(page2).toHaveLength(1); // Only 3 products total

      // Verify no overlap
      const page1Ids = page1.map((p) => p.id);
      const page2Ids = page2.map((p) => p.id);
      const intersection = page1Ids.filter((id) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it('should support full-text search on I18n columns (default language)', async () => {
      const productRepo = dataSource.getRepository(Product);

      // Search in the default language column (name)
      const laptops = await productRepo
        .createQueryBuilder('product')
        .where('LOWER(product.name) LIKE LOWER(:search)', { search: '%laptop%' })
        .getMany();

      expect(laptops.length).toBeGreaterThan(0);
      expect(laptops[0].name.en.toLowerCase()).toContain('laptop');
    });

    it('should support search in Spanish translation columns', async () => {
      const productRepo = dataSource.getRepository(Product);

      // Search in Spanish column (name_es)
      const result = await productRepo
        .createQueryBuilder('product')
        .where('LOWER(product.name_es) LIKE LOWER(:search)', { search: '%portátil%' })
        .getMany();

      expect(result.length).toBe(1);
      expect(result[0].name.es).toBe('Portátil');
      expect(result[0].name.en).toBe('Laptop');
    });

    it('should support search in French translation columns', async () => {
      const productRepo = dataSource.getRepository(Product);

      // Search in French column (name_fr)
      const result = await productRepo
        .createQueryBuilder('product')
        .where('LOWER(product.name_fr) LIKE LOWER(:search)', { search: '%souris%' })
        .getMany();

      expect(result.length).toBe(1);
      expect(result[0].name.fr).toBe('Souris');
      expect(result[0].name.en).toBe('Mouse');
    });

    it('should support multi-language search with OR conditions', async () => {
      const productRepo = dataSource.getRepository(Product);

      // Search across multiple language columns
      const result = await productRepo
        .createQueryBuilder('product')
        .where('LOWER(product.name) LIKE LOWER(:search)', { search: '%keyboard%' })
        .orWhere('LOWER(product.name_es) LIKE LOWER(:search)', { search: '%teclado%' })
        .orWhere('LOWER(product.name_fr) LIKE LOWER(:search)', { search: '%clavier%' })
        .getMany();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name.en).toBe('Keyboard');
      expect(result[0].name.es).toBe('Teclado');
      expect(result[0].name.fr).toBe('Clavier');
    });

    it('should support filtering by non-default language column values', async () => {
      const productRepo = dataSource.getRepository(Product);

      // Direct equality search in Spanish column
      const result = await productRepo
        .createQueryBuilder('product')
        .where('product.name_es = :name', { name: 'Ratón' })
        .getOne();

      expect(result).toBeDefined();
      expect(result?.name.es).toBe('Ratón');
      expect(result?.name.en).toBe('Mouse');
      expect(result?.name.fr).toBe('Souris');
    });
  });

  describe('Transaction Support', () => {
    it('should commit transactions successfully', async () => {
      const productRepo = dataSource.getRepository(Product);

      await dataSource.manager.transaction(async (transactionalEM) => {
        const product1 = transactionalEM.create(Product, {
          name: {
            en: 'Product 1',
            es: 'Producto 1',
            fr: 'Produit 1',
          } as I18nValue<ProductLanguages, string>,
          description: {
            en: 'Description 1',
            es: 'Descripción 1',
            fr: 'Description 1',
          } as I18nValue<ProductLanguages, string>,
          price: 100,
          isActive: true,
        });

        const product2 = transactionalEM.create(Product, {
          name: {
            en: 'Product 2',
            es: 'Producto 2',
            fr: 'Produit 2',
          } as I18nValue<ProductLanguages, string>,
          description: {
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
          const product = transactionalEM.create(Product, {
            name: {
              en: 'Rollback Product',
              es: 'Producto Rollback',
              fr: 'Produit Rollback',
            } as I18nValue<ProductLanguages, string>,
            description: {
              en: 'Will be rolled back',
              es: 'Se revertirá',
              fr: 'Sera annulé',
            } as I18nValue<ProductLanguages, string>,
            price: 300,
            isActive: true,
          });

          await transactionalEM.save(product);

          // Force an error
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

      // Seed all entities
      await seedDatabase(dataSource, Product, productFixtures);
      await seedDatabase(dataSource, Article, articleFixtures);

      const productCount = await productRepo.count();
      const articleCount = await articleRepo.count();

      expect(productCount).toBe(3);
      expect(articleCount).toBe(2);

      // Verify different language sets
      const product = await productRepo.findOne({ where: {} });
      const article = await articleRepo.findOne({ where: {} });

      expect(product?.name).toHaveProperty('en');
      expect(product?.name).toHaveProperty('es');
      expect(product?.name).toHaveProperty('fr');

      expect(article?.title).toHaveProperty('en');
      expect(article?.title).toHaveProperty('de');
      expect(article?.title).toHaveProperty('ja');
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
        expect(doc?.binaryData.en).toBeInstanceOf(Buffer);
        expect(doc?.binaryData.es).toBeInstanceOf(Buffer);

        expect(doc?.binaryData.en.toString()).toBe('English binary data');
        expect(doc?.binaryData.es.toString()).toBe('Datos binarios en español');
      });

      it('should update Buffer data correctly', async () => {
        const documentRepo = dataSource.getRepository(Document);

        let doc = await documentRepo.findOne({ where: {} });
        expect(doc).toBeDefined();

        doc!.binaryData.en = Buffer.from('Updated English binary');
        doc!.binaryData.es = Buffer.from('Binario español actualizado');

        await documentRepo.save(doc!);

        // Reload to get transformed data
        const updated = await documentRepo.findOne({ where: { id: doc!.id } });

        expect(updated?.binaryData.en.toString()).toBe('Updated English binary');
        expect(updated?.binaryData.es.toString()).toBe('Binario español actualizado');
      });
    });
  }

  describe('Data Integrity', () => {
    it('should maintain data consistency after multiple operations', async () => {
      const productRepo = dataSource.getRepository(Product);

      // Create
      let product = await productRepo.save(
        productRepo.create({
          name: {
            en: 'Consistency Test',
            es: 'Prueba de Consistencia',
            fr: 'Test de Cohérence',
          } as I18nValue<ProductLanguages, string>,
          description: {
            en: 'Testing consistency',
            es: 'Probando consistencia',
            fr: 'Test de cohérence',
          } as I18nValue<ProductLanguages, string>,
          price: 50,
          isActive: true,
        })
      );

      const productId = product.id;

      // Multiple updates - reload entity after each save
      for (let i = 0; i < 5; i++) {
        product = await productRepo.findOne({ where: { id: productId } }) as Product;
        product.name.en = `Consistency Test ${i}`;
        product.price = 50 + i * 10;
        await productRepo.save(product);
      }

      // Verify final state
      const final = await productRepo.findOne({ where: { id: productId } });

      expect(final?.name.en).toBe('Consistency Test 4');
      expect(final?.price).toBe(90);
      expect(final?.name.es).toBe('Prueba de Consistencia');
      expect(final?.name.fr).toBe('Test de Cohérence');
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk inserts efficiently', async () => {
      const productRepo = dataSource.getRepository(Product);

      const products = Array.from({ length: 100 }, (_, i) => ({
        name: {
          en: `Product ${i}`,
          es: `Producto ${i}`,
          fr: `Produit ${i}`,
        } as I18nValue<ProductLanguages, string>,
        description: {
          en: `Description ${i}`,
          es: `Descripción ${i}`,
          fr: `Description ${i}`,
        } as I18nValue<ProductLanguages, string>,
        price: i * 10,
        isActive: i % 2 === 0,
      }));

      await productRepo.save(products.map((p) => productRepo.create(p)));

      const count = await productRepo.count();
      expect(count).toBe(100);
    });

    it('should handle bulk reads efficiently', async () => {
      const productRepo = dataSource.getRepository(Product);

      // First insert test data
      const products = Array.from({ length: 50 }, (_, i) =>
        productRepo.create({
          name: {
            en: `Product ${i}`,
            es: `Producto ${i}`,
            fr: `Produit ${i}`,
          } as I18nValue<ProductLanguages, string>,
          description: {
            en: `Description ${i}`,
            es: `Descripción ${i}`,
            fr: `Description ${i}`,
          } as I18nValue<ProductLanguages, string>,
          price: i * 10,
          isActive: true,
        })
      );
      await productRepo.save(products);

      const loaded = await productRepo.find();

      expect(loaded).toHaveLength(50);
      loaded.forEach((product) => {
        expect(product.name).toHaveProperty('en');
        expect(product.name).toHaveProperty('es');
        expect(product.name).toHaveProperty('fr');
      });
    });
  });
});
