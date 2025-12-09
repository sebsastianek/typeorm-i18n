import { I18nValue } from '../../src';
import { ProductWithCategory, ProductLanguages } from '../entities/ProductWithCategory.entity';

export const productWithCategoryFixtures: Partial<ProductWithCategory>[] = [
  {
    id: 1,
    nameTranslations: {
      en: 'Laptop',
      es: 'Portátil',
      fr: 'Ordinateur portable',
    } as I18nValue<ProductLanguages, string>,
    descriptionTranslations: {
      en: 'High-performance laptop with SSD',
      es: 'Portátil de alto rendimiento con SSD',
      fr: 'Ordinateur portable haute performance avec SSD',
    } as I18nValue<ProductLanguages, string>,
    price: 999.99,
    isActive: true,
    categoryId: 1, // Electronics
  },
  {
    id: 2,
    nameTranslations: {
      en: 'Mouse',
      es: 'Ratón',
      fr: 'Souris',
    } as I18nValue<ProductLanguages, string>,
    descriptionTranslations: {
      en: 'Wireless ergonomic mouse',
      es: 'Ratón ergonómico inalámbrico',
      fr: 'Souris ergonomique sans fil',
    } as I18nValue<ProductLanguages, string>,
    price: 49.99,
    isActive: true,
    categoryId: 2, // Accessories
  },
  {
    id: 3,
    nameTranslations: {
      en: 'Keyboard',
      es: 'Teclado',
      fr: 'Clavier',
    } as I18nValue<ProductLanguages, string>,
    descriptionTranslations: {
      en: 'Mechanical keyboard with RGB',
      es: 'Teclado mecánico con RGB',
      fr: 'Clavier mécanique avec RGB',
    } as I18nValue<ProductLanguages, string>,
    price: 149.99,
    isActive: true,
    categoryId: 2, // Accessories
  },
  {
    id: 4,
    nameTranslations: {
      en: 'Monitor',
      es: 'Monitor',
      fr: 'Moniteur',
    } as I18nValue<ProductLanguages, string>,
    descriptionTranslations: {
      en: '27-inch 4K display',
      es: 'Pantalla 4K de 27 pulgadas',
      fr: 'Écran 4K de 27 pouces',
    } as I18nValue<ProductLanguages, string>,
    price: 399.99,
    isActive: true,
    categoryId: 1, // Electronics
  },
];
