/**
 * TypeORM i18n Extension
 *
 * A TypeORM extension for multilingual support with strong typing.
 * Automatically creates database columns for each language and provides
 * type-safe I18nValue objects for working with translations.
 *
 * @packageDocumentation
 */

// Export types
export type {
  I18nValue,
  I18nColumnOptions,
  I18nColumnMetadata,
  I18nEntity,
  TranslationsKey,
} from './types';
export type { I18nGlobalConfig } from './config';

// Export symbols
export { I18N_LANGUAGE_KEY } from './types';

// Export decorator
export { I18nColumn, getTranslationColumnName } from './decorator';

// Export configuration
export { setI18nConfig, getI18nConfig, resetI18nConfig } from './config';

// Export utilities
export {
  createI18nValue,
  getTranslation,
  flattenI18nValue,
  transformAfterLoad,
  transformBeforeSave,
  prepareI18nUpdate,
} from './utils';

// Language utilities are internal - language codes are normalized automatically

// Export subscriber
export { I18nSubscriber } from './subscriber';

// Export repository and query builder
export { I18nRepository, getI18nRepository } from './repository';
export { I18nQueryBuilder } from './query-builder';

// Export metadata storage (for advanced usage)
export { i18nMetadataStorage } from './metadata';

// Export constants
export { LANGUAGE_DELIMITER, I18N_METADATA_KEY } from './constants';
