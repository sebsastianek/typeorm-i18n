/**
 * Represents a multilingual value with strong typing support for specified languages and value types.
 *
 * @template TLang - Union type of supported language codes (e.g., 'en' | 'es' | 'cn')
 * @template TValue - The type of value stored for each language (e.g., string, Buffer, number)
 *
 * @example
 * ```typescript
 * type SupportedLanguages = 'en' | 'es' | 'cn';
 *
 * // String values (most common)
 * const name: I18nValue<SupportedLanguages, string> = {
 *   en: 'Hello',
 *   es: 'Hola',
 *   cn: '你好'
 * };
 *
 * // Buffer values for binary data
 * const image: I18nValue<SupportedLanguages, Buffer> = {
 *   en: Buffer.from('...'),
 *   es: Buffer.from('...'),
 *   cn: Buffer.from('...')
 * };
 *
 * // Number values
 * const count: I18nValue<SupportedLanguages, number> = {
 *   en: 100,
 *   es: 100,
 *   cn: 100
 * };
 * ```
 */
export type I18nValue<TLang extends string, TValue = string> = {
  [K in TLang]: TValue;
};

/**
 * Configuration options for the @I18nColumn decorator.
 * Extends TypeORM's ColumnOptions to include all column configuration options.
 *
 * If languages and default_language are not provided, they will be taken from
 * the global configuration set via setI18nConfig().
 *
 * @template T - Union type of supported language codes
 */
export interface I18nColumnOptions<T extends string = string> {
  /**
   * Array of supported language codes.
   * These will be used to create database columns with the pattern: {columnName}_{language}
   * If not provided, uses global configuration from setI18nConfig().
   *
   * @example ['en', 'es', 'cn']
   */
  languages?: readonly T[];

  /**
   * The default language code.
   * This language will use the base column name without a suffix.
   * If not provided, uses global configuration from setI18nConfig().
   *
   * @example 'en'
   */
  default_language?: T;

  /**
   * Database column type (varchar, text, int, blob, etc.)
   * This is required to properly create the database columns.
   *
   * @example 'varchar', 'text', 'int', 'blob', 'bytea'
   */
  type: string;

  /**
   * Column length (for varchar, etc.)
   */
  length?: string | number;

  /**
   * Whether the default language column should be nullable.
   * Additional language columns are always nullable.
   */
  nullable?: boolean;

  /**
   * Default value for the column
   */
  default?: any;

  /**
   * Additional TypeORM column options
   */
  [key: string]: any;
}

/**
 * Resolved I18n column options with required languages and default_language.
 * Used internally for storing metadata after merging global and column-level config.
 */
export interface ResolvedI18nColumnOptions<T extends string = string> {
  languages: readonly T[];
  default_language: T;
}

/**
 * Internal metadata stored for each I18nColumn.
 */
export interface I18nColumnMetadata<T extends string = string> {
  target: Function;
  propertyName: string;
  options: ResolvedI18nColumnOptions<T>;
}
