import {
  I18nValue,
  I18N_LANGUAGE_KEY,
  I18N_TRANSLATIONS_SET_KEY,
  I18nEntity,
} from './types';
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
 * Transforms an entity after loading from the database.
 * Sets up both the single-value property and the translations property.
 *
 * @param entity - The entity instance loaded from the database
 * @param language - Optional current language (if not set, uses default)
 * @returns The transformed entity
 *
 * @example
 * ```typescript
 * // After loading from DB with language 'es'
 * const raw = { id: 1, name: 'Hello', name_es: 'Hola', name_fr: 'Bonjour' };
 * const entity = transformAfterLoad(raw, 'es');
 * // entity.name = 'Hola' (current language value)
 * // entity.nameTranslations = { en: 'Hello', es: 'Hola', fr: 'Bonjour' }
 * ```
 */
export function transformAfterLoad<T extends object>(entity: T, language?: string): T {
  if (!entity) {
    return entity;
  }

  const metadata = i18nMetadataStorage.getMetadata(entity.constructor);
  const i18nEntity = entity as T & I18nEntity;

  // Store the current language on the entity
  if (language) {
    i18nEntity[I18N_LANGUAGE_KEY] = language;
  }

  for (const meta of metadata) {
    // Create the translations object
    const translations = createI18nValue(
      entity,
      meta.propertyName,
      meta.options.languages,
      meta.options.default_language
    );

    // Set the translations property (e.g., nameTranslations)
    const translationsKey = `${meta.propertyName}Translations`;
    (entity as any)[translationsKey] = translations;

    // Set the single-value property to the current language value
    const currentLang = language || meta.options.default_language;
    (entity as any)[meta.propertyName] = translations[currentLang as keyof typeof translations];
  }

  return entity;
}

/**
 * Prepares an entity for update by copying translations to raw columns.
 * Call this before repo.save() when updating entities with modified translations.
 *
 * TypeORM's change detection compares raw column values, so we need to update
 * those values when translations change.
 *
 * @param entity - The entity instance with modified translations
 * @returns The same entity with raw columns updated
 *
 * @example
 * ```typescript
 * const product = await repo.findOne({ where: { id: 1 } });
 * product.nameTranslations = { en: 'New Name', es: 'Nuevo Nombre', fr: 'Nouveau Nom' };
 * prepareI18nUpdate(product); // Updates raw columns
 * await repo.save(product);
 * ```
 */
export function prepareI18nUpdate<T extends object>(entity: T): T {
  if (!entity) {
    return entity;
  }

  const metadata = i18nMetadataStorage.getMetadata(entity.constructor);

  for (const meta of metadata) {
    const translationsKey = `${meta.propertyName}Translations`;
    const translations = (entity as any)[translationsKey];

    if (translations && typeof translations === 'object') {
      // Copy translations to raw columns
      for (const lang of meta.options.languages) {
        const value = translations[lang];
        if (value !== undefined) {
          const columnName = lang === meta.options.default_language
            ? meta.propertyName
            : getTranslationColumnName(meta.propertyName, lang);
          (entity as any)[columnName] = value;
        }
      }
    }
  }

  return entity;
}

/**
 * Transforms an entity before saving to the database.
 *
 * Behavior:
 * - If `propertyTranslations` is set, all translations are saved
 * - If only `property` is set, saves to the current language column only
 *
 * @param entity - The entity instance to save
 * @returns The transformed entity with flat column properties
 *
 * @example
 * ```typescript
 * // Saving all translations via nameTranslations
 * const entity = {
 *   name: 'Hello',
 *   nameTranslations: { en: 'Hello', es: 'Hola', fr: 'Bonjour' }
 * };
 * const flattened = transformBeforeSave(entity);
 * // Returns: { name: 'Hello', name_es: 'Hola', name_fr: 'Bonjour' }
 *
 * // Saving single value (current language only)
 * const entity2 = { name: 'New Name', [I18N_LANGUAGE_KEY]: 'es' };
 * const flattened2 = transformBeforeSave(entity2);
 * // Returns: { name_es: 'New Name' }
 * ```
 */
export function transformBeforeSave<T extends object>(entity: T): T {
  if (!entity) {
    return entity;
  }

  const metadata = i18nMetadataStorage.getMetadata(entity.constructor);
  const transformed = { ...entity };
  const i18nEntity = entity as T & I18nEntity;
  const currentLanguage = i18nEntity[I18N_LANGUAGE_KEY];

  for (const meta of metadata) {
    const translationsKey = `${meta.propertyName}Translations`;
    const translations = (entity as any)[translationsKey];
    const singleValue = (entity as any)[meta.propertyName];

    // Remove both properties from transformed output
    delete (transformed as any)[meta.propertyName];
    delete (transformed as any)[translationsKey];

    if (translations && typeof translations === 'object') {
      // If translations object is set, flatten all values
      const flattened = flattenI18nValue(
        meta.propertyName,
        translations,
        meta.options.default_language
      );
      Object.assign(transformed, flattened);
    } else if (singleValue !== undefined) {
      // Only single value is set - save to current language column
      const targetLang = currentLanguage || meta.options.default_language;
      const columnName = targetLang === meta.options.default_language
        ? meta.propertyName
        : getTranslationColumnName(meta.propertyName, targetLang);
      (transformed as any)[columnName] = singleValue;
    }
  }

  // Remove internal i18n symbols from transformed object
  delete (transformed as any)[I18N_LANGUAGE_KEY];
  delete (transformed as any)[I18N_TRANSLATIONS_SET_KEY];

  return transformed;
}
