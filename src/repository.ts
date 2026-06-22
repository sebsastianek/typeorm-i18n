import { Repository, DataSource, FindManyOptions, FindOneOptions, FindOptionsWhere, DeepPartial, SaveOptions, FindOptionsOrder, FindOperator, EntityMetadata, UpdateResult, InsertResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { i18nMetadataStorage } from './metadata';
import { LANGUAGE_DELIMITER } from './constants';
import { getTranslationColumnName } from './decorator';
import { I18nQueryBuilder, createI18nQueryBuilder } from './query-builder';
import { normalizeLanguageCode, assertValidLanguageCode } from './language-utils';
import {
  prepareI18nUpdate,
  mergeI18nSingleValues,
  diffI18nColumns,
  transformEntityWithRelations,
} from './utils';
import {
  I18N_LANGUAGE_KEY,
  I18N_TRANSLATIONS_SNAPSHOT_KEY,
  I18N_SKIP_SUBSCRIBER_UPDATE_KEY,
} from './types';

/**
 * Extended repository with i18n support.
 * Allows setting a current language to automatically query the appropriate translation columns.
 */
export class I18nRepository<Entity extends object> extends Repository<Entity> {
  private currentLanguage: string | null = null;

  constructor(
    target: Function,
    dataSource: DataSource,
    _defaultLanguage?: string
  ) {
    super(target, dataSource.manager);
    void _defaultLanguage; // Reserved for future use
  }

  /**
   * Set the current language for queries.
   * When set, all find operations will use the specified language's columns.
   * Language codes are automatically normalized to lowercase for consistent handling.
   *
   * @param language - The language code to use for queries (case-insensitive)
   *
   * @example
   * ```typescript
   * const repo = getI18nRepository(Product, dataSource);
   * repo.setLanguage('es');  // or 'ES', 'Es' - all normalized to 'es'
   *
   * // Now queries automatically use Spanish columns
   * const products = await repo.find({ where: { name: 'Portátil' } });
   * // Queries name_es column instead of name
   * ```
   */
  setLanguage(language: string): this {
    const normalized = normalizeLanguageCode(language);
    this.assertLanguageAllowed(normalized);
    this.currentLanguage = normalized;
    return this;
  }

  /**
   * Validate a (normalized) language code before it is stored and used to build
   * column identifiers.
   */
  private assertLanguageAllowed(language: string): void {
    assertValidLanguageCode(language);

    const metadata = i18nMetadataStorage.getMetadata(this.target as Function);
    if (metadata.length === 0) {
      return;
    }

    const allowed = new Set<string>();
    for (const meta of metadata) {
      for (const lang of meta.options.languages) {
        allowed.add(lang);
      }
    }

    if (!allowed.has(language)) {
      throw new Error(
        `Language "${language}" is not configured for ${(this.target as Function).name}. ` +
        `Configured languages: ${Array.from(allowed).join(', ')}.`
      );
    }
  }

  /**
   * Get the currently set language
   */
  getLanguage(): string | null {
    return this.currentLanguage;
  }

  /**
   * Clear the current language, reverting to default behavior
   */
  clearLanguage(): this {
    this.currentLanguage = null;
    return this;
  }

  /**
   * Find entities with automatic language column mapping.
   * Loaded entities will have their i18n properties set based on current language.
   */
  override async find(options?: FindManyOptions<Entity>): Promise<Entity[]> {
    const lang = this.currentLanguage;
    const transformedOptions = this.transformFindOptions(options);
    const entities = await super.find(transformedOptions);
    return this.setLanguageOnEntities(entities, lang);
  }

  /**
   * Find one entity with automatic language column mapping.
   * Loaded entity will have its i18n properties set based on current language.
   */
  override async findOne(options: FindOneOptions<Entity>): Promise<Entity | null> {
    const lang = this.currentLanguage;
    const transformedOptions = this.transformFindOptions(options) || options;
    const entity = await super.findOne(transformedOptions);
    return entity ? this.setLanguageOnEntity(entity, lang) : null;
  }

  /**
   * Find one entity by ID or conditions
   */
  override async findOneBy(where: FindOptionsWhere<Entity>): Promise<Entity | null> {
    const lang = this.currentLanguage;
    const transformedWhere = this.transformWhereClause(where);
    const entity = await super.findOneBy(transformedWhere);
    return entity ? this.setLanguageOnEntity(entity, lang) : null;
  }

  /**
   * Find entities by conditions
   */
  override async findBy(where: FindOptionsWhere<Entity>): Promise<Entity[]> {
    const lang = this.currentLanguage;
    const transformedWhere = this.transformWhereClause(where);
    const entities = await super.findBy(transformedWhere);
    return this.setLanguageOnEntities(entities, lang);
  }

  /**
   * Find entities and count with automatic language column mapping.
   */
  override async findAndCount(options?: FindManyOptions<Entity>): Promise<[Entity[], number]> {
    const lang = this.currentLanguage;
    const transformedOptions = this.transformFindOptions(options);
    const [entities, count] = await super.findAndCount(transformedOptions);
    return [this.setLanguageOnEntities(entities, lang), count];
  }

  /**
   * Find entities and count by conditions
   */
  override async findAndCountBy(where: FindOptionsWhere<Entity>): Promise<[Entity[], number]> {
    const lang = this.currentLanguage;
    const transformedWhere = this.transformWhereClause(where);
    const [entities, count] = await super.findAndCountBy(transformedWhere);
    return [this.setLanguageOnEntities(entities, lang), count];
  }

  /**
   * Find one entity or fail with automatic language column mapping.
   */
  override async findOneOrFail(options: FindOneOptions<Entity>): Promise<Entity> {
    const lang = this.currentLanguage;
    const transformedOptions = this.transformFindOptions(options) || options;
    const entity = await super.findOneOrFail(transformedOptions);
    return this.setLanguageOnEntity(entity, lang);
  }

  /**
   * Find one entity by conditions or fail
   */
  override async findOneByOrFail(where: FindOptionsWhere<Entity>): Promise<Entity> {
    const lang = this.currentLanguage;
    const transformedWhere = this.transformWhereClause(where);
    const entity = await super.findOneByOrFail(transformedWhere);
    return this.setLanguageOnEntity(entity, lang);
  }

  /**
   * Count entities with automatic language column mapping.
   */
  override async count(options?: FindManyOptions<Entity>): Promise<number> {
    const transformedOptions = this.transformFindOptions(options);
    return super.count(transformedOptions);
  }

  /**
   * Count entities by conditions
   */
  override async countBy(where: FindOptionsWhere<Entity>): Promise<number> {
    const transformedWhere = this.transformWhereClause(where);
    return super.countBy(transformedWhere);
  }

  /**
   * Check if entity exists with automatic language column mapping.
   */
  override async exists(options?: FindManyOptions<Entity>): Promise<boolean> {
    const transformedOptions = this.transformFindOptions(options);
    return super.exists(transformedOptions);
  }

  /**
   * Check if entity exists by conditions
   */
  override async existsBy(where: FindOptionsWhere<Entity>): Promise<boolean> {
    const transformedWhere = this.transformWhereClause(where);
    return super.existsBy(transformedWhere);
  }

  /**
   * Update with i18n support. Both the criteria and the partial values have
   * their i18n properties mapped to the correct language column(s). A
   * `nameTranslations` object is expanded into all language columns; a scalar
   * `name` is routed to the current language's column.
   */
  override update(
    criteria: Parameters<Repository<Entity>['update']>[0],
    partialEntity: QueryDeepPartialEntity<Entity>
  ): Promise<UpdateResult> {
    const transformedCriteria =
      criteria && typeof criteria === 'object' && !Array.isArray(criteria) && !(criteria instanceof FindOperator)
        ? this.transformWhereClause(criteria)
        : criteria;
    return super.update(
      transformedCriteria as any,
      this.transformPartialEntity(partialEntity) as QueryDeepPartialEntity<Entity>
    );
  }

  /**
   * Insert with i18n support. i18n properties in the values are mapped to their
   * language columns (and translation objects expanded).
   */
  override insert(
    entity: QueryDeepPartialEntity<Entity> | QueryDeepPartialEntity<Entity>[]
  ): Promise<InsertResult> {
    const transformed = Array.isArray(entity)
      ? entity.map((e) => this.transformPartialEntity(e))
      : this.transformPartialEntity(entity);
    return super.insert(transformed as any);
  }

  /**
   * Upsert with i18n support (i18n properties mapped to language columns).
   */
  override upsert(
    entityOrEntities: QueryDeepPartialEntity<Entity> | QueryDeepPartialEntity<Entity>[],
    conflictPathsOrOptions: Parameters<Repository<Entity>['upsert']>[1]
  ): Promise<InsertResult> {
    const transformed = Array.isArray(entityOrEntities)
      ? entityOrEntities.map((e) => this.transformPartialEntity(e))
      : this.transformPartialEntity(entityOrEntities);
    return super.upsert(transformed as any, conflictPathsOrOptions);
  }

  /**
   * Map i18n properties in a partial entity to their language columns. A scalar
   * `<prop>` is routed to the current language (or default) column; a
   * `<prop>Translations` object expands into every language column. When both
   * are present, the translations object wins for the languages it specifies.
   */
  private transformPartialEntity(partial: any): any {
    if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
      return partial;
    }

    const metadata = i18nMetadataStorage.getMetadata(this.target as Function);
    if (metadata.length === 0) {
      return partial;
    }

    const isTranslationsKey = (key: string) =>
      metadata.some((m) => `${m.propertyName}Translations` === key);

    const result: any = {};

    // Pass 1: scalar i18n properties + passthrough of non-i18n properties.
    for (const [key, value] of Object.entries(partial)) {
      if (isTranslationsKey(key)) {
        continue; // applied in pass 2 so it takes precedence
      }
      const meta = metadata.find((m) => m.propertyName === key);
      if (meta) {
        const lang = this.currentLanguage || meta.options.default_language;
        result[lang === meta.options.default_language ? key : getTranslationColumnName(key, lang)] = value;
      } else {
        result[key] = value;
      }
    }

    // Pass 2: translations objects override any scalar value for the same column.
    for (const [key, value] of Object.entries(partial)) {
      const translationsMeta = metadata.find((m) => `${m.propertyName}Translations` === key);
      if (!translationsMeta || !value || typeof value !== 'object') {
        continue;
      }
      const { propertyName, options } = translationsMeta;
      for (const lang of options.languages) {
        const langValue = (value as any)[lang];
        if (langValue === undefined) {
          continue;
        }
        result[lang === options.default_language ? propertyName : getTranslationColumnName(propertyName, lang)] = langValue;
      }
    }

    return result;
  }

  /**
   * Preload an entity with i18n support.
   * Creates a new entity from the given partial with ID, loading from DB if exists.
   * Loaded entity will have its i18n properties set based on current language.
   */
  override async preload(entityLike: DeepPartial<Entity>): Promise<Entity | undefined> {
    const lang = this.currentLanguage;
    const entity = await super.preload(entityLike);
    return entity ? this.setLanguageOnEntity(entity, lang) : undefined;
  }

  /**
   * Create a new entity instance with i18n support.
   * Unlike TypeORM's default create(), this method properly handles translation properties
   * (e.g., nameTranslations) by copying them to the entity and preparing raw columns.
   *
   * @example
   * ```typescript
   * const repo = getI18nRepository(Product, dataSource);
   *
   * // Create with translations - works correctly
   * const product = repo.create({
   *   nameTranslations: { en: 'Laptop', es: 'Portátil', fr: 'Ordinateur portable' },
   *   descriptionTranslations: { en: 'A laptop', es: 'Un portátil', fr: 'Un ordinateur' },
   *   price: 999.99,
   *   isActive: true
   * });
   *
   * await repo.save(product);
   * ```
   */
  override create(): Entity;
  override create(entityLike: DeepPartial<Entity>): Entity;
  override create(entityLikeArray: DeepPartial<Entity>[]): Entity[];
  override create(entityLike?: DeepPartial<Entity> | DeepPartial<Entity>[]): Entity | Entity[] {
    if (entityLike === undefined) {
      return super.create();
    }

    if (Array.isArray(entityLike)) {
      return entityLike.map((item) => this.createSingleEntity(item));
    }

    return this.createSingleEntity(entityLike);
  }

  /**
   * Create a single entity with i18n support.
   */
  private createSingleEntity(entityLike: DeepPartial<Entity>): Entity {
    // First, let TypeORM create the base entity with column properties
    const entity = super.create(entityLike);

    // Get i18n metadata to find translation properties
    const metadata = i18nMetadataStorage.getMetadata(this.target as Function);

    // Copy translation properties from input to entity
    for (const meta of metadata) {
      const translationsKey = `${meta.propertyName}Translations`;
      const translations = (entityLike as any)[translationsKey];

      if (translations && typeof translations === 'object') {
        // Set the translations property on the entity
        (entity as any)[translationsKey] = translations;
      }
    }

    // Stamp the active language so single-value inputs route to the right
    // column at save time, then prepare raw columns from translations.
    this.stampLanguage(entity as object);
    prepareI18nUpdate(entity as object);

    return entity;
  }

  /**
   * Save entity with automatic i18n preparation.
   * Copies translations to raw columns before saving so TypeORM detects changes.
   */
  override save<T extends DeepPartial<Entity>>(
    entities: T[],
    options?: SaveOptions
  ): Promise<(T & Entity)[]>;
  override save<T extends DeepPartial<Entity>>(
    entity: T,
    options?: SaveOptions
  ): Promise<T & Entity>;
  override async save<T extends DeepPartial<Entity>>(
    entityOrEntities: T | T[],
    options?: SaveOptions
  ): Promise<(T & Entity) | (T & Entity)[]> {
    if (Array.isArray(entityOrEntities)) {
      const entities = entityOrEntities as T[];
      const wasLoaded = entities.map((e) => this.prepareForSave(e as object));
      const saved = await super.save(entities, options);
      await this.finishSave(saved as object[], wasLoaded);
      return saved;
    }
    const entity = entityOrEntities as T;
    const wasLoaded = this.prepareForSave(entity as object);
    const saved = await super.save(entity, options);
    await this.finishSave([saved as object], [wasLoaded]);
    return saved;
  }

  /**
   * Stamp the active language, fold single-value edits into translations, and
   * mark loaded entities so the subscriber leaves their translation columns to
   * this repository. Returns whether the entity was loaded (i.e. an update).
   */
  private prepareForSave(entity: object): boolean {
    const wasLoaded = (entity as any)[I18N_TRANSLATIONS_SNAPSHOT_KEY] !== undefined;
    this.stampLanguage(entity);
    mergeI18nSingleValues(entity);
    if (wasLoaded) {
      (entity as any)[I18N_SKIP_SUBSCRIBER_UPDATE_KEY] = true;
    }
    return wasLoaded;
  }

  private async finishSave(entities: object[], wasLoaded: boolean[]): Promise<void> {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (wasLoaded[i]) {
        delete (entity as any)[I18N_SKIP_SUBSCRIBER_UPDATE_KEY];
        await this.persistChangedTranslations(entity);
      }
      this.restoreDisplayLanguage(entity);
    }
  }

  /**
   * Persist the non-default translation columns that changed since load, keyed
   * on the full primary key. Only changed languages are written, so a concurrent
   * writer that touched a different language is not clobbered. The default
   * column is persisted by TypeORM's own UPDATE (it is the single-value column).
   */
  private async persistChangedTranslations(entity: object): Promise<void> {
    const changes = diffI18nColumns(entity).filter((c) => !c.isDefault);
    if (changes.length === 0) {
      return;
    }

    const where: Record<string, any> = {};
    for (const pc of this.metadata.primaryColumns) {
      const value = (entity as any)[pc.propertyName];
      if (value === undefined || value === null) {
        return;
      }
      where[pc.propertyName] = value;
    }
    if (Object.keys(where).length === 0) {
      return;
    }

    const values: Record<string, any> = {};
    for (const change of changes) {
      values[change.column] = change.value;
    }

    await this.manager
      .createQueryBuilder()
      .update(this.metadata.target)
      .set(values)
      .where(where)
      .execute();
  }

  /**
   * Stamp the repository's current language onto an entity (without overwriting
   * a language already present from a previous load). This is what lets a
   * single-value write under setLanguage() land in the correct language column.
   */
  private stampLanguage(entity: object): void {
    if (this.currentLanguage && (entity as any)[I18N_LANGUAGE_KEY] === undefined) {
      (entity as any)[I18N_LANGUAGE_KEY] = this.currentLanguage;
    }
  }

  /**
   * After a save, re-apply the current language so the returned entity's
   * single-value properties reflect the active language.
   */
  private restoreDisplayLanguage(entity: object): void {
    if (this.currentLanguage) {
      transformEntityWithRelations(entity, this.currentLanguage);
    }
  }

  /**
   * Re-transform a loaded entity (and its relations) for the given language.
   * The language is passed in (snapshotted by the caller before its await) so a
   * concurrent setLanguage() on a shared instance cannot affect an in-flight read.
   */
  private setLanguageOnEntity(entity: Entity, language: string | null): Entity {
    if (language) {
      transformEntityWithRelations(entity, language);
    }
    return entity;
  }

  /**
   * Re-transform multiple loaded entities (and their relations) for the language.
   */
  private setLanguageOnEntities(entities: Entity[], language: string | null): Entity[] {
    if (language) {
      for (const entity of entities) {
        transformEntityWithRelations(entity, language);
      }
    }
    return entities;
  }

  /**
   * Transform find options to use the current language's columns
   */
  private transformFindOptions<T extends FindManyOptions<Entity> | FindOneOptions<Entity>>(
    options?: T
  ): T | undefined {
    if (!options || !this.currentLanguage) {
      return options;
    }

    const transformed = { ...options };

    if (transformed.where) {
      transformed.where = this.transformWhereClause(transformed.where);
    }

    if ((transformed as FindManyOptions<Entity>).order) {
      (transformed as FindManyOptions<Entity>).order = this.transformOrderClause(
        (transformed as FindManyOptions<Entity>).order!
      );
    }

    return transformed;
  }

  /**
   * Map an i18n property to its language column for the current language.
   */
  private languageColumnFor(propertyName: string, defaultLanguage: string): string {
    return this.currentLanguage === defaultLanguage
      ? propertyName
      : `${propertyName}${LANGUAGE_DELIMITER}${this.currentLanguage}`;
  }

  /**
   * Whether a value is a nested condition object worth recursing into (i.e. a
   * relation condition), as opposed to a FindOperator / Date / Buffer leaf.
   */
  private isNestedConditions(value: any): boolean {
    return (
      value != null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof FindOperator) &&
      !(value instanceof Date) &&
      !Buffer.isBuffer(value)
    );
  }

  /**
   * Transform order clause to use language-specific columns (root + relations).
   */
  private transformOrderClause(order: FindOptionsOrder<Entity>): FindOptionsOrder<Entity> {
    if (!order || !this.currentLanguage) {
      return order;
    }
    return this.transformConditionsForMetadata(order, this.metadata);
  }

  /**
   * Transform where clause to use language-specific columns (root + relations).
   */
  private transformWhereClause(where: any): any {
    if (!where || !this.currentLanguage) {
      return where;
    }
    if (Array.isArray(where)) {
      return where.map((w) => this.transformWhereClause(w));
    }
    return this.transformConditionsForMetadata(where, this.metadata);
  }

  /**
   * Recursively transform a where/order object: i18n properties become their
   * language column, and relation properties are recursed using the relation's
   * own entity metadata.
   */
  private transformConditionsForMetadata(conditions: any, entityMetadata: EntityMetadata): any {
    if (!this.isNestedConditions(conditions)) {
      return conditions;
    }

    const i18nMeta = i18nMetadataStorage.getMetadata(entityMetadata.target as Function);
    const transformed: any = {};

    for (const [key, value] of Object.entries(conditions)) {
      const meta = i18nMeta.find((m) => m.propertyName === key);
      if (meta) {
        transformed[this.languageColumnFor(key, meta.options.default_language)] = value;
        continue;
      }

      const relation = entityMetadata.findRelationWithPropertyPath(key);
      if (relation && this.isNestedConditions(value)) {
        transformed[key] = this.transformConditionsForMetadata(value, relation.inverseEntityMetadata);
      } else {
        transformed[key] = value;
      }
    }

    return transformed;
  }

  /**
   * Create an I18nQueryBuilder with language context.
   * Standard methods like where(), orderBy(), select() automatically
   * translate i18n column names to the current language.
   *
   * @param alias - Optional alias for the entity
   * @returns An I18nQueryBuilder with automatic i18n translation
   *
   * @example
   * ```typescript
   * const repo = getI18nRepository(Product, dataSource);
   * repo.setLanguage('es');
   *
   * // Standard methods auto-translate i18n columns
   * const products = await repo
   *   .createQueryBuilder('product')
   *   .where({ name: 'Portátil' })           // Queries name_es
   *   .orderBy('product.name', 'ASC')        // Orders by name_es
   *   .getMany();
   * ```
   */
  override createQueryBuilder(alias?: string): I18nQueryBuilder<Entity> {
    const qb = super.createQueryBuilder(alias);
    return createI18nQueryBuilder(qb, this.currentLanguage, this.target as Function, alias);
  }

  /**
   * Get the column name for a property in the current language
   *
   * @param propertyName - The i18n property name
   * @returns The database column name for the current language
   *
   * @example
   * ```typescript
   * const repo = getI18nRepository(Product, dataSource);
   * repo.setLanguage('es');
   *
   * const columnName = repo.getLanguageColumn('name'); // Returns 'name_es'
   *
   * // Use in QueryBuilder
   * const products = await repo
   *   .createQueryBuilder('product')
   *   .where(`product.${columnName} = :name`, { name: 'Portátil' })
   *   .getMany();
   * ```
   */
  getLanguageColumn(propertyName: string): string {
    if (!this.currentLanguage) {
      return propertyName;
    }

    const metadata = i18nMetadataStorage.getMetadata(this.target as Function);
    const i18nMeta = metadata.find((m) => m.propertyName === propertyName);

    if (!i18nMeta) {
      // Not an i18n column
      return propertyName;
    }

    const { options } = i18nMeta;

    if (this.currentLanguage === options.default_language) {
      return propertyName;
    }

    return `${propertyName}${LANGUAGE_DELIMITER}${this.currentLanguage}`;
  }
}

/**
 * Create an I18nRepository instance for an entity
 *
 * @param entity - The entity class
 * @param dataSource - The TypeORM DataSource
 * @param defaultLanguage - Optional default language
 *
 * @example
 * ```typescript
 * import { getI18nRepository } from '@sebsastianek/typeorm-i18n';
 *
 * const productRepo = getI18nRepository(Product, dataSource);
 *
 * // Set language context
 * productRepo.setLanguage('es');
 *
 * // Queries now use Spanish columns
 * const products = await productRepo.find({
 *   where: { name: 'Portátil' }
 * });
 * ```
 */
export function getI18nRepository<Entity extends object>(
  entity: new () => Entity,
  dataSource: DataSource,
  defaultLanguage?: string
): I18nRepository<Entity> {
  return new I18nRepository(entity, dataSource, defaultLanguage);
}
