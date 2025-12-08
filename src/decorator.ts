import { getMetadataArgsStorage, Column, ColumnOptions } from 'typeorm';
import { I18nColumnOptions } from './types';
import { LANGUAGE_DELIMITER } from './constants';
import { i18nMetadataStorage } from './metadata';
import { getI18nConfig, onI18nConfigSet } from './config';
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

// Queue of pending column creations (for when config isn't set yet)
interface PendingColumn {
  target: Object;
  propertyName: string;
  options: I18nColumnOptions<any>;
  originalColumn: any;
}

const pendingColumns: PendingColumn[] = [];
let columnsFinalized = false;

/**
 * Finalize all pending I18n columns. Called automatically when config is set
 * or can be called manually before DataSource.initialize().
 */
export function finalizeI18nColumns(): void {
  if (columnsFinalized) return;

  const globalConfig = getI18nConfig();
  if (!globalConfig.languages || globalConfig.languages.length === 0) {
    // Config not set yet, can't finalize
    return;
  }

  const metadataArgsStorage = getMetadataArgsStorage();

  for (const pending of pendingColumns) {
    const { target, propertyName, options, originalColumn } = pending;

    // Resolve languages from options or global config
    const rawLanguages = options.languages ?? (globalConfig.languages as readonly string[]);
    const rawDefaultLanguage = options.default_language ?? (globalConfig.default_language as string);

    const languages = rawLanguages ? normalizeLanguageCodes(rawLanguages) : [];
    const default_language = rawDefaultLanguage ? normalizeLanguageCode(rawDefaultLanguage) : undefined;

    // Validate
    if (!languages || languages.length === 0) {
      throw new Error(
        `I18nColumn on ${(target.constructor as any).name}.${propertyName} requires at least one language. ` +
        'Either provide it in the decorator or set it globally via setI18nConfig().'
      );
    }

    if (!default_language) {
      throw new Error(
        `I18nColumn on ${(target.constructor as any).name}.${propertyName} requires a default_language. ` +
        'Either provide it in the decorator or set it globally via setI18nConfig().'
      );
    }

    if (!languages.includes(default_language)) {
      throw new Error(
        `default_language "${default_language}" must be included in the languages array`
      );
    }

    // Update metadata with resolved values
    i18nMetadataStorage.addMetadata({
      target: target.constructor,
      propertyName,
      options: { languages, default_language },
    });

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
        metadataArgsStorage.columns.push({
          ...originalColumn,
          propertyName: translationPropertyName,
          options: {
            ...originalColumn.options,
            nullable: true,
          },
        });
      }
    }
  }

  pendingColumns.length = 0;
  columnsFinalized = true;
}

/**
 * Reset finalization state (for testing)
 * @internal
 */
export function resetI18nColumnsFinalization(): void {
  columnsFinalized = false;
  pendingColumns.length = 0;
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

    if (!options.type) {
      throw new Error('I18nColumn requires a type to be specified (e.g., "varchar", "text", "int")');
    }

    // Extract i18n-specific options from the original options object
    const { languages: _langs, default_language: _defLang, ...columnOptions } = options;

    // Apply @Column decorator for the default language (always needed)
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

    // Check if global config is already set
    const globalConfig = getI18nConfig();
    const hasConfig = (options.languages && options.languages.length > 0) ||
                      (globalConfig.languages && globalConfig.languages.length > 0);

    if (hasConfig) {
      // Config available - create columns immediately
      const rawLanguages = options.languages ?? (globalConfig.languages as readonly T[]);
      const rawDefaultLanguage = options.default_language ?? (globalConfig.default_language as T);

      const languages = rawLanguages ? normalizeLanguageCodes(rawLanguages) as T[] : [];
      const default_language = rawDefaultLanguage
        ? (normalizeLanguageCode(rawDefaultLanguage) as T)
        : undefined;

      // Validate
      if (!languages || languages.length === 0) {
        throw new Error(
          `I18nColumn on ${target.constructor.name}.${propertyName} requires at least one language. ` +
          'Either provide it in the decorator or set it globally via setI18nConfig().'
        );
      }

      if (!default_language) {
        throw new Error(
          `I18nColumn on ${target.constructor.name}.${propertyName} requires a default_language. ` +
          'Either provide it in the decorator or set it globally via setI18nConfig().'
        );
      }

      if (!languages.includes(default_language)) {
        throw new Error(
          `default_language "${default_language}" must be included in the languages array`
        );
      }

      // Store metadata
      i18nMetadataStorage.addMetadata({
        target: target.constructor,
        propertyName,
        options: { languages, default_language },
      });

      // Create additional columns for non-default languages
      const additionalLanguages = languages.filter(
        (lang) => lang !== default_language
      );

      for (const language of additionalLanguages) {
        const translationPropertyName = getTranslationColumnName(propertyName, language);

        const exists = metadataArgsStorage.columns.some(
          (column) =>
            column.target === target.constructor &&
            column.propertyName === translationPropertyName
        );

        if (!exists) {
          metadataArgsStorage.columns.push({
            ...originalColumn,
            propertyName: translationPropertyName,
            options: {
              ...originalColumn.options,
              nullable: true,
            },
          });
        }
      }
    } else {
      // Config not available yet - queue for later
      pendingColumns.push({
        target,
        propertyName,
        options,
        originalColumn,
      });
    }
  };
}

// Register callback to finalize pending columns when config is set
onI18nConfigSet(finalizeI18nColumns);
