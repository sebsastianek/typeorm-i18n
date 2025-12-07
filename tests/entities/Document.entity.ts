import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { I18nColumn, I18nValue } from '../../src';

export type DocumentLanguages = 'en' | 'es';

/**
 * Test entity with different value types
 */
@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({
    languages: ['en', 'es'],
    default_language: 'en',
    type: 'text',
  })
  content!: string;

  contentTranslations?: I18nValue<DocumentLanguages, string>;

  @I18nColumn({
    languages: ['en', 'es'],
    default_language: 'en',
    type: 'blob',
    nullable: true,
  })
  binaryData!: Buffer;

  binaryDataTranslations?: I18nValue<DocumentLanguages, Buffer>;
}
