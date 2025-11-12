import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  LoadEvent,
  UpdateEvent,
} from 'typeorm';
import { transformAfterLoad, transformBeforeSave } from './utils';

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
   * Transforms flat columns into I18nValue objects.
   */
  afterLoad(entity: any, _event?: LoadEvent<any>): void {
    transformAfterLoad(entity);
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
   */
  beforeUpdate(event: UpdateEvent<any>): void {
    if (event.entity) {
      const transformed = transformBeforeSave(event.entity);
      Object.assign(event.entity, transformed);
    }
  }
}
