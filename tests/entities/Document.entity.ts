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

  // String values
  @I18nColumn({
    languages: ['en', 'es'],
    default_language: 'en',
    type: 'text',
  })
  content!: I18nValue<DocumentLanguages, string>;

  // Buffer values (blob for SQLite)
  @I18nColumn({
    languages: ['en', 'es'],
    default_language: 'en',
    type: 'blob',
    nullable: true,
  })
  binaryData!: I18nValue<DocumentLanguages, Buffer>;
}
