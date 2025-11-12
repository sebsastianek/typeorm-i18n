import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { I18nColumn, I18nValue } from '../../src';

export type ArticleLanguages = 'en' | 'de' | 'ja';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({
    languages: ['en', 'de', 'ja'],
    default_language: 'en',
    type: 'varchar',
    length: 500,
  })
  title!: I18nValue<ArticleLanguages, string>;

  @I18nColumn({
    languages: ['en', 'de', 'ja'],
    default_language: 'en',
    type: 'text',
  })
  content!: I18nValue<ArticleLanguages, string>;

  @Column({ type: 'integer', nullable: true })
  viewCount!: number;
}
