import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { I18nColumn, I18nValue } from '../../src';
import { ProductWithCategory } from './ProductWithCategory.entity';

export type CategoryLanguages = 'en' | 'es' | 'fr';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({
    languages: ['en', 'es', 'fr'],
    default_language: 'en',
    type: 'varchar',
    length: 255,
  })
  name!: string;

  nameTranslations?: I18nValue<CategoryLanguages, string>;

  @I18nColumn({
    languages: ['en', 'es', 'fr'],
    default_language: 'en',
    type: 'text',
    nullable: true,
  })
  description!: string | null;

  descriptionTranslations?: I18nValue<CategoryLanguages, string | null>;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => ProductWithCategory, (product) => product.category)
  products?: ProductWithCategory[];
}
