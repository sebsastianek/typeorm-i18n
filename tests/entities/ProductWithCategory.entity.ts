import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { I18nColumn, I18nValue } from '../../src';
import { Category } from './Category.entity';

export type ProductLanguages = 'en' | 'es' | 'fr';

@Entity('products_with_category')
export class ProductWithCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({
    languages: ['en', 'es', 'fr'],
    default_language: 'en',
    type: 'varchar',
    length: 255,
  })
  name!: string;

  nameTranslations?: I18nValue<ProductLanguages, string>;

  @I18nColumn({
    languages: ['en', 'es', 'fr'],
    default_language: 'en',
    type: 'text',
  })
  description!: string;

  descriptionTranslations?: I18nValue<ProductLanguages, string>;

  @Column({ type: 'real' })
  price!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  categoryId!: number | null;

  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'categoryId' })
  category?: Category;
}
