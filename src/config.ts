import { normalizeLanguageCode, normalizeLanguageCodes } from './language-utils';

/**
 * Global configuration for I18n columns
 */
export interface I18nGlobalConfig {
  /**
   * Default languages to use for all I18n columns.
   * Language codes are automatically normalized to lowercase.
   */
  languages?: readonly string[];

  /**
   * Default language to use as the base column.
   * Language code is automatically normalized to lowercase.
   */
  default_language?: string;
}

/**
 * Internal storage for global I18n configuration
 */
let globalConfig: I18nGlobalConfig = {};

/**
 * Set global configuration for I18n columns.
 * This configuration will be used as defaults for all @I18nColumn decorators.
 * Column-level configuration always takes precedence over global configuration.
 *
 * Language codes are automatically normalized to lowercase for consistent handling.
 * For example, 'EN', 'En', and 'en' will all be treated as 'en'.
 *
 * @param config - Global I18n configuration
 *
 * @example
 * ```typescript
 * // Set global defaults once in your application
 * setI18nConfig({
 *   languages: ['en', 'es', 'fr'],  // or ['EN', 'ES', 'FR'] - normalized to lowercase
 *   default_language: 'en',
 * });
 *
 * // Now you can omit languages in decorators
 * @I18nColumn({ type: 'varchar', length: 255 })
 * name: I18nValue<'en' | 'es' | 'fr', string>;
 *
 * // Or override for specific columns
 * @I18nColumn({
 *   languages: ['en', 'de', 'ja'],
 *   default_language: 'en',
 *   type: 'text',
 * })
 * title: I18nValue<'en' | 'de' | 'ja', string>;
 * ```
 */
export function setI18nConfig(config: I18nGlobalConfig): void {
  globalConfig = {
    languages: config.languages ? normalizeLanguageCodes(config.languages) : undefined,
    default_language: config.default_language
      ? normalizeLanguageCode(config.default_language)
      : undefined,
  };
}

/**
 * Get the current global I18n configuration
 *
 * @returns Current global configuration
 */
export function getI18nConfig(): Readonly<I18nGlobalConfig> {
  return { ...globalConfig };
}

/**
 * Reset global I18n configuration to empty
 */
export function resetI18nConfig(): void {
  globalConfig = {};
}
