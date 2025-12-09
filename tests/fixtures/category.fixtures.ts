import { I18nValue } from '../../src';
import { Category, CategoryLanguages } from '../entities/Category.entity';

export const categoryFixtures: Partial<Category>[] = [
  {
    id: 1,
    nameTranslations: {
      en: 'Electronics',
      es: 'Electrónica',
      fr: 'Électronique',
    } as I18nValue<CategoryLanguages, string>,
    descriptionTranslations: {
      en: 'Electronic devices and gadgets',
      es: 'Dispositivos electrónicos y gadgets',
      fr: 'Appareils électroniques et gadgets',
    } as I18nValue<CategoryLanguages, string | null>,
    isActive: true,
  },
  {
    id: 2,
    nameTranslations: {
      en: 'Accessories',
      es: 'Accesorios',
      fr: 'Accessoires',
    } as I18nValue<CategoryLanguages, string>,
    descriptionTranslations: {
      en: 'Computer accessories',
      es: 'Accesorios de computadora',
      fr: 'Accessoires informatiques',
    } as I18nValue<CategoryLanguages, string | null>,
    isActive: true,
  },
  {
    id: 3,
    nameTranslations: {
      en: 'Office Supplies',
      es: 'Suministros de Oficina',
      fr: 'Fournitures de Bureau',
    } as I18nValue<CategoryLanguages, string>,
    descriptionTranslations: {
      en: 'Office and desk supplies',
      es: 'Suministros de oficina y escritorio',
      fr: 'Fournitures de bureau et de bureau',
    } as I18nValue<CategoryLanguages, string | null>,
    isActive: false,
  },
];
