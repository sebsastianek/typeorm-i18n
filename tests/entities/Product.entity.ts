import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { I18nColumn, I18nValue } from '../../src';

export type ProductLanguages = 'en' | 'es' | 'fr';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({
    languages: ['en', 'es', 'fr'],
    default_language: 'en',
    type: 'varchar',
    length: 255,
  })
  name!: string;

  // Auto-populated with all translations after load
  nameTranslations?: I18nValue<ProductLanguages, string>;

  @I18nColumn({
    languages: ['en', 'es', 'fr'],
    default_language: 'en',
    type: 'text',
  })
  description!: string;

  // Auto-populated with all translations after load
  descriptionTranslations?: I18nValue<ProductLanguages, string>;

  @Column({ type: 'real' })
  price!: number;

  @Column({ default: true })
  isActive!: boolean;
}
