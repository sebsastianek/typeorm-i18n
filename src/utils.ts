import { I18nValue } from './types';
import { getTranslationColumnName } from './decorator';
import { i18nMetadataStorage } from './metadata';

/**
 * Creates an I18nValue object from a flat database result.
 *
 * @template TLang - Union type of supported language codes
 * @template TValue - The type of value stored for each language
 * @param entity - The entity instance or raw database result
 * @param propertyName - The base property name (e.g., "name")
 * @param languages - Array of language codes
 * @param defaultLanguage - The default language code
 * @returns An I18nValue object with all translations
 *
 * @example
 * ```typescript
 * const result = { name: 'Hello', name_es: 'Hola', name_cn: '你好' };
 * const i18nName = createI18nValue<'en' | 'es' | 'cn', string>(result, 'name', ['en', 'es', 'cn'], 'en');
 * // Returns: { en: 'Hello', es: 'Hola', cn: '你好' }
 * ```
 */
export function createI18nValue<TLang extends string, TValue = string>(
  entity: any,
  propertyName: string,
  languages: readonly TLang[],
  defaultLanguage: TLang
): I18nValue<TLang, TValue> {
  const result: Partial<I18nValue<TLang, TValue>> = {};

  for (const lang of languages) {
    const columnName =
      lang === defaultLanguage
        ? propertyName
        : getTranslationColumnName(propertyName, lang);

    result[lang as TLang] = entity[columnName];
  }

  return result as I18nValue<TLang, TValue>;
}

/**
 * Extracts a single language value from an I18nValue object.
 *
 * @template TLang - Union type of supported language codes
 * @template TValue - The type of value stored for each language
 * @param i18nValue - The I18nValue object
 * @param language - The language code to extract
 * @param fallbackLanguage - Optional fallback language if the requested language is not available
 * @returns The translation value for the specified language
 *
 * @example
 * ```typescript
 * const name: I18nValue<'en' | 'es', string> = { en: 'Hello', es: 'Hola' };
 * const english = getTranslation(name, 'en'); // 'Hello'
 * const spanish = getTranslation(name, 'es'); // 'Hola'
 * ```
 */
export function getTranslation<TLang extends string, TValue = string>(
  i18nValue: I18nValue<TLang, TValue>,
  language: TLang,
  fallbackLanguage?: TLang
): TValue | undefined {
  return i18nValue[language] ?? (fallbackLanguage ? i18nValue[fallbackLanguage] : undefined);
}

/**
 * Flattens an I18nValue object into individual database columns.
 *
 * @template TLang - Union type of supported language codes
 * @template TValue - The type of value stored for each language
 * @param propertyName - The base property name
 * @param i18nValue - The I18nValue object to flatten
 * @param defaultLanguage - The default language code
 * @returns A flat object with separate properties for each language
 *
 * @example
 * ```typescript
 * const name: I18nValue<'en' | 'es' | 'cn', string> = {
 *   en: 'Hello',
 *   es: 'Hola',
 *   cn: '你好'
 * };
 * const flattened = flattenI18nValue('name', name, 'en');
 * // Returns: { name: 'Hello', name_es: 'Hola', name_cn: '你好' }
 * ```
 */
export function flattenI18nValue<TLang extends string, TValue = string>(
  propertyName: string,
  i18nValue: I18nValue<TLang, TValue>,
  defaultLanguage: TLang
): Record<string, TValue> {
  const result: Record<string, TValue> = {};

  for (const [lang, value] of Object.entries(i18nValue)) {
    const columnName =
      lang === defaultLanguage
        ? propertyName
        : getTranslationColumnName(propertyName, lang);

    result[columnName] = value as TValue;
  }

  return result;
}

/**
 * Transforms an entity after loading from the database, converting flat columns
 * into I18nValue objects for all decorated I18n columns.
 *
 * @param entity - The entity instance loaded from the database
 * @returns The transformed entity with I18nValue properties
 *
 * @example
 * ```typescript
 * // After loading from DB
 * const raw = { id: 1, name: 'Hello', name_es: 'Hola', name_cn: '你好' };
 * const entity = transformAfterLoad(raw);
 * // entity.name is now: { en: 'Hello', es: 'Hola', cn: '你好' }
 * ```
 */
export function transformAfterLoad<T extends object>(entity: T): T {
  if (!entity) {
    return entity;
  }

  const metadata = i18nMetadataStorage.getMetadata(entity.constructor);

  for (const meta of metadata) {
    const i18nValue = createI18nValue(
      entity,
      meta.propertyName,
      meta.options.languages,
      meta.options.default_language
    );

    (entity as any)[meta.propertyName] = i18nValue;
  }

  return entity;
}

/**
 * Transforms an entity before saving to the database, converting I18nValue objects
 * into flat columns.
 *
 * @param entity - The entity instance to save
 * @returns The transformed entity with flat column properties
 *
 * @example
 * ```typescript
 * const entity = {
 *   id: 1,
 *   name: { en: 'Hello', es: 'Hola', cn: '你好' }
 * };
 * const flattened = transformBeforeSave(entity);
 * // Returns: { id: 1, name: 'Hello', name_es: 'Hola', name_cn: '你好' }
 * ```
 */
export function transformBeforeSave<T extends object>(entity: T): T {
  if (!entity) {
    return entity;
  }

  const metadata = i18nMetadataStorage.getMetadata(entity.constructor);
  const transformed = { ...entity };

  for (const meta of metadata) {
    const i18nValue = (entity as any)[meta.propertyName];

    if (i18nValue && typeof i18nValue === 'object') {
      const flattened = flattenI18nValue(
        meta.propertyName,
        i18nValue,
        meta.options.default_language
      );

      // Remove the I18nValue property and add flattened properties
      delete (transformed as any)[meta.propertyName];
      Object.assign(transformed, flattened);
    }
  }

  return transformed;
}
