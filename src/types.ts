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

/**
 * Utility type that converts I18nValue properties to their base value type.
 * This allows type-safe queries without needing `as any`.
 *
 * @template T - The entity type
 *
 * @example
 * ```typescript
 * interface Product {
 *   id: number;
 *   name: I18nValue<'en' | 'es', string>;
 *   price: number;
 * }
 *
 * // I18nWhere<Product> becomes:
 * // {
 * //   id?: number;
 * //   name?: string;
 * //   price?: number;
 * // }
 * ```
 */
export type I18nWhere<T> = {
  [K in keyof T]?: T[K] extends I18nValue<any, infer V>
    ? V | null
    : T[K] extends object
      ? T[K] | null
      : T[K] | null;
};

/**
 * Creates a type-safe where clause for I18n entities.
 * Use this helper to avoid `as any` type assertions when querying I18n columns.
 *
 * @template T - The entity type
 * @param where - The where clause with flat values for I18n columns
 * @returns The same object, properly typed for use in find operations
 *
 * @example
 * ```typescript
 * import { i18nWhere } from '@sebsastianek/typeorm-i18n';
 *
 * // Instead of:
 * const products = await repo.find({
 *   where: { name: 'Laptop' } as any  // Requires 'as any'
 * });
 *
 * // Use:
 * const products = await repo.find({
 *   where: i18nWhere<Product>({ name: 'Laptop' })  // Type-safe!
 * });
 *
 * // Also works with multiple conditions:
 * const products = await repo.find({
 *   where: i18nWhere<Product>({
 *     name: 'Laptop',
 *     isActive: true,
 *     price: 999
 *   })
 * });
 * ```
 */
export function i18nWhere<T>(where: I18nWhere<T>): any {
  return where;
}

/**
 * Creates a type-safe array of where clauses for I18n entities.
 * Use this when you need OR conditions across multiple criteria.
 *
 * @template T - The entity type
 * @param whereClauses - Array of where clauses
 * @returns The same array, properly typed for use in find operations
 *
 * @example
 * ```typescript
 * import { i18nWhereMany } from '@sebsastianek/typeorm-i18n';
 *
 * // Find products where name is 'Laptop' OR 'Mouse'
 * const products = await repo.find({
 *   where: i18nWhereMany<Product>([
 *     { name: 'Laptop' },
 *     { name: 'Mouse' }
 *   ])
 * });
 * ```
 */
export function i18nWhereMany<T>(whereClauses: I18nWhere<T>[]): any[] {
  return whereClauses;
}
