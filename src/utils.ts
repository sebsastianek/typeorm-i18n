import {
  I18nValue,
  I18N_LANGUAGE_KEY,
  I18N_TRANSLATIONS_SET_KEY,
  I18N_SINGLE_SNAPSHOT_KEY,
  I18N_TRANSLATIONS_SNAPSHOT_KEY,
  I18nEntity,
} from './types';
import { getTranslationColumnName } from './decorator';
import { i18nMetadataStorage } from './metadata';

function defineHidden(entity: any, key: symbol, value: any): void {
  if (!entity[key]) {
    Object.defineProperty(entity, key, {
      value,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }
}

/**
 * Record the current single-value property so a later save can tell whether the
 * user mutated it.
 */
function snapshotSingleValue(entity: any, propertyName: string): void {
  defineHidden(entity, I18N_SINGLE_SNAPSHOT_KEY, {});
  entity[I18N_SINGLE_SNAPSHOT_KEY][propertyName] = entity[propertyName];
}

/**
 * Record a shallow copy of a translations object so a later save can persist
 * only the languages that actually changed.
 */
function snapshotTranslations(entity: any, propertyName: string, translations: any): void {
  defineHidden(entity, I18N_TRANSLATIONS_SNAPSHOT_KEY, {});
  entity[I18N_TRANSLATIONS_SNAPSHOT_KEY][propertyName] = { ...translations };
}

/**
 * Compute the translation columns whose value changed relative to the load
 * snapshot. For an entity with no snapshot (freshly created) every defined
 * translation counts as changed.
 *
 * Call mergeI18nSingleValues() first so single-value edits are reflected.
 */
export function diffI18nColumns<T extends object>(
  entity: T
): Array<{ column: string; value: any; isDefault: boolean }> {
  const metadata = i18nMetadataStorage.getMetadata(entity.constructor);
  const i18nEntity = entity as any;
  const snapshot: Record<string, Record<string, any>> | undefined =
    i18nEntity[I18N_TRANSLATIONS_SNAPSHOT_KEY];
  const changes: Array<{ column: string; value: any; isDefault: boolean }> = [];

  for (const meta of metadata) {
    const translations = i18nEntity[`${meta.propertyName}Translations`];
    if (!translations || typeof translations !== 'object') {
      continue;
    }
    const prev = snapshot?.[meta.propertyName];
    for (const lang of meta.options.languages) {
      const value = translations[lang];
      if (value === undefined) {
        continue;
      }
      if (prev && prev[lang] === value) {
        continue;
      }
      const isDefault = lang === meta.options.default_language;
      changes.push({
        column: isDefault ? meta.propertyName : getTranslationColumnName(meta.propertyName, lang),
        value,
        isDefault,
      });
    }
  }

  return changes;
}

/**
 * Fold any single-value-property edits into the translations object and reset
 * the single-value property to the default-language value.
 *
 * The single-value property (e.g. `name`) doubles as the default-language
 * column. After loading under a non-default language it holds the translated
 * value, which would otherwise leak into the default column on save. This
 * helper:
 *  - detects whether the user edited the single value (vs the load snapshot)
 *    and, if so, treats it as authoritative for the current language;
 *  - sets the single-value property back to the default-language translation
 *    so the default column is never corrupted.
 *
 * It does NOT touch non-default raw columns — update persistence of those is
 * handled by the subscriber (diff-aware), and insert persistence by
 * prepareI18nUpdate.
 *
 * @returns true if any translation value is present (i.e. there is something to persist)
 */
export function mergeI18nSingleValues<T extends object>(entity: T): boolean {
  if (!entity) {
    return false;
  }

  const metadata = i18nMetadataStorage.getMetadata(entity.constructor);
  const i18nEntity = entity as any;
  const snapshot: Record<string, any> | undefined = i18nEntity[I18N_SINGLE_SNAPSHOT_KEY];
  const language: string | undefined = i18nEntity[I18N_LANGUAGE_KEY];
  let anyTranslations = false;

  for (const meta of metadata) {
    const prop = meta.propertyName;
    const translationsKey = `${prop}Translations`;
    let translations = i18nEntity[translationsKey];
    const single = i18nEntity[prop];
    const targetLang = language || meta.options.default_language;
    const wasLoaded = snapshot != null && Object.prototype.hasOwnProperty.call(snapshot, prop);
    const hasTranslations = translations != null && typeof translations === 'object';

    if (single !== undefined) {
      const ensureTranslations = () => {
        if (!translations || typeof translations !== 'object') {
          translations = {};
          i18nEntity[translationsKey] = translations;
        }
        return translations;
      };

      if (wasLoaded) {
        // Loaded entity: a single-value edit (vs the load snapshot) is authoritative.
        if (single !== snapshot![prop]) {
          ensureTranslations()[targetLang] = single;
        }
      } else if (!hasTranslations) {
        ensureTranslations()[targetLang] = single;
      } else if (translations[targetLang] === undefined) {
        // New entity with a translations object: it wins; the scalar only fills
        // a language the object did not specify.
        translations[targetLang] = single;
      }
    }

    if (translations && typeof translations === 'object') {
      anyTranslations = true;
      // The single-value property is the default-language column; reflect the
      // default translation (which may be undefined) to avoid leaking a
      // non-default value into the default column.
      i18nEntity[prop] = translations[meta.options.default_language];
    }

    snapshotSingleValue(i18nEntity, prop);
  }

  return anyTranslations;
}

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

  // Skip if already transformed (prevents double-processing which would lose data)
  if (i18nEntity[I18N_TRANSLATIONS_SET_KEY]) {
    // Only update the language and single-value properties if language changed
    if (language && language !== i18nEntity[I18N_LANGUAGE_KEY]) {
      i18nEntity[I18N_LANGUAGE_KEY] = language;
      for (const meta of metadata) {
        const translationsKey = `${meta.propertyName}Translations`;
        const translations = (entity as any)[translationsKey];
        if (translations) {
          (entity as any)[meta.propertyName] = translations[language] ?? translations[meta.options.default_language];
          // Re-snapshot the displayed value so save() can detect later edits.
          snapshotSingleValue(entity, meta.propertyName);
        }
      }
    }
    return entity;
  }

  // Store the current language on the entity
  if (language) {
    i18nEntity[I18N_LANGUAGE_KEY] = language;
  }

  for (const meta of metadata) {
    // Create the translations object from raw columns
    const translations = createI18nValue(
      entity,
      meta.propertyName,
      meta.options.languages,
      meta.options.default_language
    );

    // Set the translations property (e.g., nameTranslations)
    const translationsKey = `${meta.propertyName}Translations`;
    (entity as any)[translationsKey] = translations;

    // Set the single-value property to the current language value.
    // Fall back to the default language so both load paths behave consistently
    // (the re-transform branch above already applies the same fallback).
    const currentLang = language || meta.options.default_language;
    (entity as any)[meta.propertyName] =
      translations[currentLang as keyof typeof translations] ??
      translations[meta.options.default_language as keyof typeof translations];

    // Remove the non-default raw columns to keep JSON output clean. The
    // translations object and the load snapshots retain every value.
    for (const lang of meta.options.languages) {
      if (lang !== meta.options.default_language) {
        delete (entity as any)[getTranslationColumnName(meta.propertyName, lang)];
      }
    }

    // Snapshot loaded values so save() persists only what actually changed.
    snapshotSingleValue(entity, meta.propertyName);
    snapshotTranslations(entity, meta.propertyName, translations);
  }

  // Mark entity as transformed to prevent double-processing
  i18nEntity[I18N_TRANSLATIONS_SET_KEY] = true;

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

  mergeI18nSingleValues(entity);

  const metadata = i18nMetadataStorage.getMetadata(entity.constructor);
  const i18nEntity = entity as any;

  for (const meta of metadata) {
    const translations = i18nEntity[`${meta.propertyName}Translations`];
    if (!translations || typeof translations !== 'object') {
      continue;
    }
    for (const lang of meta.options.languages) {
      const value = translations[lang];
      if (value === undefined) {
        continue;
      }
      const columnName = lang === meta.options.default_language
        ? meta.propertyName
        : getTranslationColumnName(meta.propertyName, lang);
      i18nEntity[columnName] = value;
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
/**
 * Recursively transforms an entity and all its loaded relations with i18n support.
 * This ensures that joined/related entities also have their single-value properties
 * set to the correct language.
 *
 * @param entity - The entity instance with potential relations
 * @param language - The language to apply to all entities
 * @param visited - Set of visited objects to prevent circular reference loops
 *
 * @example
 * ```typescript
 * // After loading with relations
 * const question = await repo
 *   .createQueryBuilder('question')
 *   .leftJoinAndSelect('question.dimension', 'dimension')
 *   .getOne();
 *
 * // Transform the entity tree with language
 * transformEntityWithRelations(question, 'de');
 * // question.text = 'German text'
 * // question.dimension.name = 'German dimension name'
 * ```
 */
export function transformEntityWithRelations<T extends object>(
  entity: T,
  language: string,
  visited: Set<object> = new Set()
): T {
  if (!entity || typeof entity !== 'object' || visited.has(entity)) {
    return entity;
  }

  visited.add(entity);

  // Transform the entity itself
  transformAfterLoad(entity, language);

  // Recursively transform all object properties (potential relations)
  for (const key of Object.keys(entity)) {
    const value = (entity as any)[key];

    if (value === null || value === undefined) {
      continue;
    }

    // Handle array relations (e.g., product.reviews)
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && !Buffer.isBuffer(item)) {
          // Check if the item might be an entity (has constructor with metadata)
          const metadata = i18nMetadataStorage.getMetadata(item.constructor);
          if (metadata.length > 0) {
            transformEntityWithRelations(item, language, visited);
          }
        }
      }
    }
    // Handle single relations (e.g., product.category)
    else if (typeof value === 'object' && !Buffer.isBuffer(value) && !(value instanceof Date)) {
      // Check if this object might be an entity with i18n metadata
      const metadata = i18nMetadataStorage.getMetadata(value.constructor);
      if (metadata.length > 0) {
        transformEntityWithRelations(value, language, visited);
      }
    }
  }

  return entity;
}

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
