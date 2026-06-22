import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  LoadEvent,
  UpdateEvent,
} from 'typeorm';
import {
  transformAfterLoad,
  prepareI18nUpdate,
  mergeI18nSingleValues,
  diffI18nColumns,
} from './utils';
import {
  I18N_LANGUAGE_KEY,
  I18N_SKIP_SUBSCRIBER_UPDATE_KEY,
  I18nEntity,
} from './types';
import { i18nMetadataStorage } from './metadata';

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
   * Flatten translations (and any single-value edit) into the raw per-language
   * columns so the INSERT carries every translation.
   */
  beforeInsert(event: InsertEvent<any>): void {
    if (event.entity && i18nMetadataStorage.getMetadata(event.entity.constructor).length > 0) {
      prepareI18nUpdate(event.entity);
    }
  }

  /**
   * Persist changed translation columns on update.
   *
   * TypeORM computes its column diff before this hook, so i18n columns are
   * written with an explicit UPDATE keyed on the full primary key (composite-key
   * safe). Only languages that changed since load are written, so a concurrent
   * writer that touched a different language is not clobbered.
   *
   * Skipped when I18nRepository has already persisted the change itself.
   */
  async beforeUpdate(event: UpdateEvent<any>): Promise<void> {
    const entity = event.entity as any;
    if (!entity || entity[I18N_SKIP_SUBSCRIBER_UPDATE_KEY]) {
      return;
    }
    if (i18nMetadataStorage.getMetadata(entity.constructor).length === 0) {
      return;
    }

    mergeI18nSingleValues(entity);
    const changes = diffI18nColumns(entity);
    if (changes.length === 0) {
      return;
    }

    const where: Record<string, any> = {};
    for (const pc of event.metadata.primaryColumns) {
      const value = entity[pc.propertyName];
      if (value === undefined || value === null) {
        return;
      }
      where[pc.propertyName] = value;
    }
    if (Object.keys(where).length === 0) {
      return;
    }

    const updateValues: Record<string, any> = {};
    for (const change of changes) {
      updateValues[change.column] = change.value;
    }

    await event.manager
      .createQueryBuilder()
      .update(event.metadata.target)
      .set(updateValues)
      .where(where)
      .execute();
  }
}
