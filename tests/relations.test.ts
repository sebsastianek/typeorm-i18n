import { DataSource } from 'typeorm';
import { getI18nRepository, setI18nConfig, resetI18nConfig } from '../src';
import { createE2EDataSource, closeE2EDataSource, seedDatabase } from './db-helper';
import { Category } from './entities/Category.entity';
import { ProductWithCategory } from './entities/ProductWithCategory.entity';
import { Order } from './entities/Order.entity';
import { categoryFixtures } from './fixtures/category.fixtures';
import { productWithCategoryFixtures } from './fixtures/productWithCategory.fixtures';
import { orderFixtures } from './fixtures/order.fixtures';

describe('I18n Relations Support', () => {
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
    dataSource = await createE2EDataSource([Category, ProductWithCategory]);
    // Seed categories first, then products (due to foreign key)
    await seedDatabase(dataSource, Category, categoryFixtures);
    await seedDatabase(dataSource, ProductWithCategory, productWithCategoryFixtures);
  });

  afterEach(async () => {
    if (dataSource && dataSource.isInitialized) {
      await closeE2EDataSource(dataSource);
    }
  });

  describe('ManyToOne Relations with leftJoinAndSelect', () => {
    it('should translate both product and category when using leftJoinAndSelect', async () => {
      const repo = getI18nRepository(ProductWithCategory, dataSource);
      repo.setLanguage('es');

      const products = await repo
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .getMany();

      expect(products.length).toBeGreaterThan(0);

      const laptop = products.find((p) => p.nameTranslations?.en === 'Laptop');
      expect(laptop).toBeDefined();

      // Product should have Spanish translation in single-value property
      expect(laptop?.name).toBe('Portátil');
      expect(laptop?.nameTranslations?.es).toBe('Portátil');

      // Category should ALSO have Spanish translation in single-value property
      expect(laptop?.category).toBeDefined();
      expect(laptop?.category?.name).toBe('Electrónica');
      expect(laptop?.category?.nameTranslations?.es).toBe('Electrónica');
      expect(laptop?.category?.nameTranslations?.en).toBe('Electronics');
    });

    it('should translate relations in French', async () => {
      const repo = getI18nRepository(ProductWithCategory, dataSource);
      repo.setLanguage('fr');

      const product = await repo
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .where('product.id = :id', { id: 1 })
        .getOne();

      expect(product).toBeDefined();

      // Product in French
      expect(product?.name).toBe('Ordinateur portable');

      // Category in French
      expect(product?.category?.name).toBe('Électronique');
      expect(product?.category?.description).toBe('Appareils électroniques et gadgets');
    });

    it('should use default language when no language set on joined relations', async () => {
      const repo = getI18nRepository(ProductWithCategory, dataSource);
      // No language set - should use default (English)

      const product = await repo
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .where('product.id = :id', { id: 1 })
        .getOne();

      expect(product).toBeDefined();
      expect(product?.name).toBe('Laptop');
      expect(product?.category?.name).toBe('Electronics');
    });
  });

  describe('OneToMany Relations (reverse direction)', () => {
    it('should translate category with all its products', async () => {
      const repo = getI18nRepository(Category, dataSource);
      repo.setLanguage('es');

      const category = await repo
        .createQueryBuilder('category')
        .leftJoinAndSelect('category.products', 'product')
        .where('category.id = :id', { id: 2 }) // Accessories
        .getOne();

      expect(category).toBeDefined();

      // Category should be in Spanish
      expect(category?.name).toBe('Accesorios');

      // Products should also be in Spanish
      expect(category?.products).toBeDefined();
      expect(category?.products?.length).toBe(2); // Mouse and Keyboard

      const productNames = category?.products?.map((p) => p.name);
      expect(productNames).toContain('Ratón');
      expect(productNames).toContain('Teclado');
    });
  });

  describe('Repository find with relations option', () => {
    it('should translate relations when using find with relations option', async () => {
      const repo = getI18nRepository(ProductWithCategory, dataSource);
      repo.setLanguage('es');

      const products = await repo.find({
        relations: ['category'],
      });

      expect(products.length).toBeGreaterThan(0);

      const laptop = products.find((p) => p.id === 1);
      expect(laptop).toBeDefined();

      // Product in Spanish
      expect(laptop?.name).toBe('Portátil');

      // Category also in Spanish
      expect(laptop?.category?.name).toBe('Electrónica');
    });

    it('should translate relations when using findOne with relations option', async () => {
      const repo = getI18nRepository(ProductWithCategory, dataSource);
      repo.setLanguage('fr');

      const product = await repo.findOne({
        where: { id: 2 },
        relations: ['category'],
      });

      expect(product).toBeDefined();

      // Product in French
      expect(product?.name).toBe('Souris');

      // Category in French
      expect(product?.category?.name).toBe('Accessoires');
    });
  });

  describe('Multiple levels of relations', () => {
    it('should handle switching languages on same entity tree', async () => {
      const repo = getI18nRepository(ProductWithCategory, dataSource);

      // First query in Spanish
      repo.setLanguage('es');
      let product = await repo
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .where('product.id = :id', { id: 1 })
        .getOne();

      expect(product?.name).toBe('Portátil');
      expect(product?.category?.name).toBe('Electrónica');

      // Second query in French
      repo.setLanguage('fr');
      product = await repo
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .where('product.id = :id', { id: 1 })
        .getOne();

      expect(product?.name).toBe('Ordinateur portable');
      expect(product?.category?.name).toBe('Électronique');
    });
  });

  describe('Clean JSON output with relations', () => {
    it('should produce clean JSON without raw translation columns on relations', async () => {
      const repo = getI18nRepository(ProductWithCategory, dataSource);
      repo.setLanguage('es');

      const product = await repo
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .where('product.id = :id', { id: 1 })
        .getOne();

      const json = JSON.parse(JSON.stringify(product));

      // Product should not have raw columns
      expect(json.name_es).toBeUndefined();
      expect(json.name_fr).toBeUndefined();
      expect(json.nameTranslations).toBeDefined();

      // Category should not have raw columns either
      expect(json.category.name_es).toBeUndefined();
      expect(json.category.name_fr).toBeUndefined();
      expect(json.category.nameTranslations).toBeDefined();

      // Single-value properties should have current language
      expect(json.name).toBe('Portátil');
      expect(json.category.name).toBe('Electrónica');
    });
  });

  describe('Null relations', () => {
    it('should handle null relations gracefully', async () => {
      // Create a product without a category
      const productRepo = dataSource.getRepository(ProductWithCategory);
      const orphanProduct = productRepo.create();
      Object.assign(orphanProduct, {
        nameTranslations: {
          en: 'Orphan Product',
          es: 'Producto Huérfano',
          fr: 'Produit Orphelin',
        },
        descriptionTranslations: {
          en: 'No category',
          es: 'Sin categoría',
          fr: 'Sans catégorie',
        },
        price: 10,
        isActive: true,
        categoryId: null,
      });
      await productRepo.save(orphanProduct);

      const repo = getI18nRepository(ProductWithCategory, dataSource);
      repo.setLanguage('es');

      const product = await repo
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .where('product.name = :name', { name: 'Orphan Product' })
        .getOne();

      expect(product).toBeDefined();
      expect(product?.name).toBe('Producto Huérfano');
      expect(product?.category).toBeNull();
    });
  });
});

describe('Non-i18n root entity with i18n relations', () => {
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
    // Order entity has NO i18n columns, but relates to entities that do
    dataSource = await createE2EDataSource([Category, ProductWithCategory, Order]);
    // Seed in order: categories -> products -> orders (due to foreign keys)
    await seedDatabase(dataSource, Category, categoryFixtures);
    await seedDatabase(dataSource, ProductWithCategory, productWithCategoryFixtures);
    await seedDatabase(dataSource, Order, orderFixtures);
  });

  afterEach(async () => {
    if (dataSource && dataSource.isInitialized) {
      await closeE2EDataSource(dataSource);
    }
  });

  describe('Root entity without i18n, joined entities with i18n', () => {
    it('should translate joined i18n entities when root has no i18n metadata (QueryBuilder)', async () => {
      // Order has NO @I18nColumn decorators
      // ProductWithCategory and Category DO have @I18nColumn decorators
      const repo = getI18nRepository(Order, dataSource);
      repo.setLanguage('es');

      const orders = await repo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.product', 'product')
        .leftJoinAndSelect('order.category', 'category')
        .leftJoinAndSelect('product.category', 'productCategory')
        .getMany();

      expect(orders.length).toBeGreaterThan(0);

      // Find the order for Laptop
      const laptopOrder = orders.find((o) => o.orderNumber === 'ORD-001');
      expect(laptopOrder).toBeDefined();

      // Order itself should NOT have translation properties (it has no i18n columns)
      expect((laptopOrder as any).orderNumberTranslations).toBeUndefined();

      // But the joined product SHOULD have Spanish translations
      expect(laptopOrder?.product).toBeDefined();
      expect(laptopOrder?.product?.name).toBe('Portátil');
      expect(laptopOrder?.product?.nameTranslations?.es).toBe('Portátil');
      expect(laptopOrder?.product?.nameTranslations?.en).toBe('Laptop');

      // And the directly joined category should also be in Spanish
      expect(laptopOrder?.category).toBeDefined();
      expect(laptopOrder?.category?.name).toBe('Electrónica');
      expect(laptopOrder?.category?.nameTranslations?.es).toBe('Electrónica');

      // Product's nested category should also be translated
      expect(laptopOrder?.product?.category).toBeDefined();
      expect(laptopOrder?.product?.category?.name).toBe('Electrónica');
    });

    it('should translate joined i18n entities in French when root has no i18n metadata', async () => {
      const repo = getI18nRepository(Order, dataSource);
      repo.setLanguage('fr');

      const order = await repo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.product', 'product')
        .leftJoinAndSelect('order.category', 'category')
        .where('order.id = :id', { id: 2 }) // Mouse order
        .getOne();

      expect(order).toBeDefined();
      expect(order?.orderNumber).toBe('ORD-002');

      // Product should be in French
      expect(order?.product?.name).toBe('Souris');
      expect(order?.product?.description).toBe('Souris ergonomique sans fil');

      // Category should be in French
      expect(order?.category?.name).toBe('Accessoires');
    });

    it('should use default language for joined entities when no language set', async () => {
      const repo = getI18nRepository(Order, dataSource);
      // No language set - should use default (English)

      const order = await repo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.product', 'product')
        .where('order.id = :id', { id: 1 })
        .getOne();

      expect(order).toBeDefined();
      // Product should be in default language (English)
      expect(order?.product?.name).toBe('Laptop');
    });

    it('should translate joined i18n entities when using find with relations option', async () => {
      const repo = getI18nRepository(Order, dataSource);
      repo.setLanguage('es');

      const orders = await repo.find({
        relations: ['product', 'category'],
      });

      expect(orders.length).toBeGreaterThan(0);

      const keyboardOrder = orders.find((o) => o.orderNumber === 'ORD-003');
      expect(keyboardOrder).toBeDefined();

      // Order fields are NOT translated (no i18n metadata)
      expect(keyboardOrder?.orderNumber).toBe('ORD-003');

      // But product IS translated
      expect(keyboardOrder?.product?.name).toBe('Teclado');
      expect(keyboardOrder?.product?.nameTranslations?.en).toBe('Keyboard');

      // And category IS translated
      expect(keyboardOrder?.category?.name).toBe('Accesorios');
    });

    it('should translate using findOne with relations option', async () => {
      const repo = getI18nRepository(Order, dataSource);
      repo.setLanguage('fr');

      const order = await repo.findOne({
        where: { id: 3 },
        relations: ['product', 'category'],
      });

      expect(order).toBeDefined();

      // Product in French
      expect(order?.product?.name).toBe('Clavier');
      expect(order?.product?.description).toBe('Clavier mécanique avec RGB');

      // Category in French
      expect(order?.category?.name).toBe('Accessoires');
    });

    it('should produce clean JSON without raw translation columns on joined entities', async () => {
      const repo = getI18nRepository(Order, dataSource);
      repo.setLanguage('es');

      const order = await repo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.product', 'product')
        .leftJoinAndSelect('order.category', 'category')
        .where('order.id = :id', { id: 1 })
        .getOne();

      const json = JSON.parse(JSON.stringify(order));

      // Order should have its normal fields
      expect(json.orderNumber).toBe('ORD-001');
      expect(json.quantity).toBe(2);

      // Product should not have raw columns, but should have translations
      expect(json.product.name_es).toBeUndefined();
      expect(json.product.name_fr).toBeUndefined();
      expect(json.product.nameTranslations).toBeDefined();
      expect(json.product.name).toBe('Portátil');

      // Category should not have raw columns, but should have translations
      expect(json.category.name_es).toBeUndefined();
      expect(json.category.name_fr).toBeUndefined();
      expect(json.category.nameTranslations).toBeDefined();
      expect(json.category.name).toBe('Electrónica');
    });

    it('should handle mixed null and present relations', async () => {
      const repo = getI18nRepository(Order, dataSource);
      repo.setLanguage('es');

      // Order 4 has product but no direct category relation
      const order = await repo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.product', 'product')
        .leftJoinAndSelect('order.category', 'category')
        .where('order.id = :id', { id: 4 })
        .getOne();

      expect(order).toBeDefined();
      expect(order?.orderNumber).toBe('ORD-004');

      // Product should be translated
      expect(order?.product).toBeDefined();
      expect(order?.product?.name).toBe('Monitor');

      // Direct category relation should be null
      expect(order?.category).toBeNull();
    });
  });
});
