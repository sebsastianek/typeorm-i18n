import { getMetadataArgsStorage, Column, ColumnOptions } from 'typeorm';
import { I18nColumnOptions } from './types';
import { LANGUAGE_DELIMITER } from './constants';
import { i18nMetadataStorage } from './metadata';
import { getI18nConfig } from './config';
import { normalizeLanguageCode, normalizeLanguageCodes } from './language-utils';

/**
 * Generates the column name for a specific language translation.
 *
 * @param propertyName - The base property name
 * @param language - The language code
 * @returns The column name with language suffix (e.g., "name_es", "title_en")
 */
export function getTranslationColumnName(propertyName: string, language: string): string {
  return `${propertyName}${LANGUAGE_DELIMITER}${language}`;
}

/**
 * Decorator for marking a column as translatable with strong type support.
 *
 * This decorator automatically creates additional database columns for each specified language
 * and applies the @Column decorator, so you don't need to use both decorators.
 * The default language uses the base column name, while other languages use the pattern:
 * {columnName}_{languageCode}
 *
 * @template T - Union type of supported language codes
 * @param options - Configuration options for the I18n column (includes all TypeORM ColumnOptions)
 *
 * @example
 * ```typescript
 * type SupportedLanguages = 'en' | 'es' | 'cn';
 *
 * @Entity()
 * class Product {
 *   @I18nColumn({
 *     languages: ['en', 'es', 'cn'],
 *     default_language: 'en',
 *     type: 'varchar',
 *     length: 255,
 *   })
 *   name: I18nValue<SupportedLanguages, string>;
 * }
 * ```
 *
 * This will create columns: name (for 'en'), name_es, name_cn
 */
export function I18nColumn<T extends string>(
  options: I18nColumnOptions<T>
): PropertyDecorator {
  return function (target: Object, propertyName: string | symbol) {
    if (typeof propertyName !== 'string') {
      throw new Error('I18nColumn can only be applied to string property names');
    }

    // Get global configuration
    const globalConfig = getI18nConfig();

    // Merge global config with column-level config (column-level has priority)
    // Normalize language codes to lowercase for consistent handling
    const rawLanguages = options.languages ?? (globalConfig.languages as readonly T[] | undefined);
    const rawDefaultLanguage = options.default_language ?? (globalConfig.default_language as T | undefined);

    // Normalize language codes to lowercase
    const languages = rawLanguages ? normalizeLanguageCodes(rawLanguages) as T[] : undefined;
    const default_language = rawDefaultLanguage
      ? (normalizeLanguageCode(rawDefaultLanguage) as T)
      : undefined;

    // Validate i18n-specific options
    if (!languages || languages.length === 0) {
      throw new Error(
        'I18nColumn requires at least one language in the languages array. ' +
        'Either provide it in the decorator or set it globally via setI18nConfig().'
      );
    }

    if (!default_language) {
      throw new Error(
        'I18nColumn requires a default_language to be specified. ' +
        'Either provide it in the decorator or set it globally via setI18nConfig().'
      );
    }

    if (!languages.includes(default_language)) {
      throw new Error(
        `default_language "${default_language}" must be included in the languages array`
      );
    }

    if (!options.type) {
      throw new Error('I18nColumn requires a type to be specified (e.g., "varchar", "text", "int")');
    }

    // Extract i18n-specific options from the original options object
    const { languages: _langs, default_language: _defLang, ...columnOptions } = options;

    // Store metadata for this I18n column with resolved values
    i18nMetadataStorage.addMetadata({
      target: target.constructor,
      propertyName,
      options: { languages, default_language },
    });

    // Apply @Column decorator for the default language
    Column(columnOptions as ColumnOptions)(target, propertyName);

    // Get TypeORM's metadata storage
    const metadataArgsStorage = getMetadataArgsStorage();

    // Find the original column definition we just created
    const originalColumn = metadataArgsStorage.columns.find(
      (column) =>
        column.target === target.constructor && column.propertyName === propertyName
    );

    if (!originalColumn) {
      throw new Error(
        `Failed to create column for ${target.constructor.name}.${propertyName}`
      );
    }

    // Create additional columns for non-default languages
    const additionalLanguages = languages.filter(
      (lang) => lang !== default_language
    );

    for (const language of additionalLanguages) {
      const translationPropertyName = getTranslationColumnName(propertyName, language);

      // Check if column already exists to avoid duplicates
      const exists = metadataArgsStorage.columns.some(
        (column) =>
          column.target === target.constructor &&
          column.propertyName === translationPropertyName
      );

      if (!exists) {
        // Create a new column metadata for this language
        metadataArgsStorage.columns.push({
          ...originalColumn,
          propertyName: translationPropertyName,
          options: {
            ...originalColumn.options,
            // Make additional language columns nullable by default
            nullable: true,
          },
        });
      }
    }
  };
}
