import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  LoadEvent,
  UpdateEvent,
} from 'typeorm';
import { transformAfterLoad, transformBeforeSave } from './utils';
import { I18N_LANGUAGE_KEY, I18nEntity } from './types';
import { i18nMetadataStorage } from './metadata';
import { getTranslationColumnName } from './decorator';

/**
 * TypeORM entity subscriber that automatically transforms I18n columns
 * between I18nValue objects and flat database columns.
 *
 * This subscriber handles the conversion:
 * - After Load: Converts flat columns (name, name_es, name_cn) to I18nValue objects
 * - Before Insert/Update: Converts I18nValue objects to flat columns
 *
 * @example
 * To use this subscriber, register it in your TypeORM connection options:
 * ```typescript
 * import { I18nSubscriber } from '@sebsastianek/typeorm-i18n';
 *
 * createConnection({
 *   // ... other options
 *   subscribers: [I18nSubscriber],
 * });
 * ```
 */
@EventSubscriber()
export class I18nSubscriber implements EntitySubscriberInterface {
  /**
   * Called after an entity is loaded from the database.
   * Transforms flat columns into single-value property and translations object.
   */
  afterLoad(entity: any, _event?: LoadEvent<any>): void {
    // Get the language from the entity if it was set by I18nRepository
    const language = (entity as I18nEntity)[I18N_LANGUAGE_KEY];
    transformAfterLoad(entity, language);
  }

  /**
   * Called before an entity is inserted into the database.
   * Transforms I18nValue objects into flat columns.
   */
  beforeInsert(event: InsertEvent<any>): void {
    if (event.entity) {
      const transformed = transformBeforeSave(event.entity);
      Object.assign(event.entity, transformed);
    }
  }

  /**
   * Called before an entity is updated in the database.
   * Transforms I18nValue objects into flat columns.
   *
   * Note: TypeORM calculates changed columns before this hook runs.
   * We need to execute our own update for i18n columns to ensure changes are persisted.
   */
  async beforeUpdate(event: UpdateEvent<any>): Promise<void> {
    if (!event.entity) {
      return;
    }

    const metadata = i18nMetadataStorage.getMetadata(event.entity.constructor);
    if (metadata.length === 0) {
      return;
    }

    // Build update values from translations
    const updateValues: Record<string, any> = {};
    let hasI18nUpdates = false;

    for (const meta of metadata) {
      const translationsKey = `${meta.propertyName}Translations`;
      const translations: Record<string, any> | undefined = event.entity[translationsKey];

      if (translations && typeof translations === 'object') {
        hasI18nUpdates = true;
        // Flatten translations to column values
        for (const [lang, value] of Object.entries(translations) as [string, any][]) {
          const columnName = lang === meta.options.default_language
            ? meta.propertyName
            : getTranslationColumnName(meta.propertyName, lang);
          updateValues[columnName] = value;
        }
      }
    }

    // Execute direct update for i18n columns if there are changes
    if (hasI18nUpdates && event.metadata.primaryColumns.length > 0) {
      const primaryColumn = event.metadata.primaryColumns[0];
      const primaryValue = event.entity[primaryColumn.propertyName];

      if (primaryValue !== undefined) {
        await event.manager
          .createQueryBuilder()
          .update(event.metadata.target)
          .set(updateValues)
          .where({ [primaryColumn.propertyName]: primaryValue })
          .execute();
      }
    }

    // Also transform for any other processing
    const transformed = transformBeforeSave(event.entity);
    Object.assign(event.entity, transformed);
  }
}
