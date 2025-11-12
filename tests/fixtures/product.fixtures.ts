import { Product, ProductLanguages } from '../entities/Product.entity';
import { I18nValue } from '../../src';

export const productFixtures: Partial<Product>[] = [
  {
    name: {
      en: 'Laptop',
      es: 'Portátil',
      fr: 'Ordinateur portable',
    } as I18nValue<ProductLanguages, string>,
    description: {
      en: 'High-performance laptop with SSD',
      es: 'Portátil de alto rendimiento con SSD',
      fr: 'Ordinateur portable haute performance avec SSD',
    } as I18nValue<ProductLanguages, string>,
    price: 999.99,
    isActive: true,
  },
  {
    name: {
      en: 'Mouse',
      es: 'Ratón',
      fr: 'Souris',
    } as I18nValue<ProductLanguages, string>,
    description: {
      en: 'Wireless optical mouse',
      es: 'Ratón óptico inalámbrico',
      fr: 'Souris optique sans fil',
    } as I18nValue<ProductLanguages, string>,
    price: 29.99,
    isActive: true,
  },
  {
    name: {
      en: 'Keyboard',
      es: 'Teclado',
      fr: 'Clavier',
    } as I18nValue<ProductLanguages, string>,
    description: {
      en: 'Mechanical gaming keyboard',
      es: 'Teclado mecánico para juegos',
      fr: 'Clavier mécanique de jeu',
    } as I18nValue<ProductLanguages, string>,
    price: 149.99,
    isActive: false,
  },
];
