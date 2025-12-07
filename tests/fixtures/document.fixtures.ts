import { Document, DocumentLanguages } from '../entities/Document.entity';
import { I18nValue } from '../../src';

export const documentFixtures: Partial<Document>[] = [
  {
    contentTranslations: {
      en: 'This is an English document',
      es: 'Este es un documento en español',
    } as I18nValue<DocumentLanguages, string>,
    binaryDataTranslations: {
      en: Buffer.from('English binary data'),
      es: Buffer.from('Datos binarios en español'),
    } as I18nValue<DocumentLanguages, Buffer>,
  },
  {
    contentTranslations: {
      en: 'Another document in English',
      es: 'Otro documento en español',
    } as I18nValue<DocumentLanguages, string>,
    binaryDataTranslations: {
      en: Buffer.from('More English binary'),
      es: Buffer.from('Más binario español'),
    } as I18nValue<DocumentLanguages, Buffer>,
  },
];
