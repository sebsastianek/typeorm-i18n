import { DataSource } from 'typeorm';
import { getI18nRepository, setI18nConfig, resetI18nConfig } from '../src';
import { createE2EDataSource, closeE2EDataSource, seedDatabase } from './db-helper';
import { Category } from './entities/Category.entity';
import { ProductWithCategory } from './entities/ProductWithCategory.entity';
import { categoryFixtures } from './fixtures/category.fixtures';
import { productWithCategoryFixtures } from './fixtures/productWithCategory.fixtures';

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
