import { Repository, DataSource, FindManyOptions, FindOneOptions, FindOptionsWhere, DeepPartial, SaveOptions, FindOptionsOrder } from 'typeorm';
import { i18nMetadataStorage } from './metadata';
import { LANGUAGE_DELIMITER } from './constants';
import { I18nQueryBuilder, createI18nQueryBuilder } from './query-builder';
import { normalizeLanguageCode } from './language-utils';
import { prepareI18nUpdate, transformEntityWithRelations } from './utils';

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
    this.currentLanguage = normalizeLanguageCode(language);
    return this;
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
    const transformedOptions = this.transformFindOptions(options);
    const entities = await super.find(transformedOptions);
    return this.setLanguageOnEntities(entities);
  }

  /**
   * Find one entity with automatic language column mapping.
   * Loaded entity will have its i18n properties set based on current language.
   */
  override async findOne(options: FindOneOptions<Entity>): Promise<Entity | null> {
    const transformedOptions = this.transformFindOptions(options) || options;
    const entity = await super.findOne(transformedOptions);
    return entity ? this.setLanguageOnEntity(entity) : null;
  }

  /**
   * Find one entity by ID or conditions
   */
  override async findOneBy(where: FindOptionsWhere<Entity>): Promise<Entity | null> {
    const transformedWhere = this.transformWhereClause(where);
    const entity = await super.findOneBy(transformedWhere);
    return entity ? this.setLanguageOnEntity(entity) : null;
  }

  /**
   * Find entities by conditions
   */
  override async findBy(where: FindOptionsWhere<Entity>): Promise<Entity[]> {
    const transformedWhere = this.transformWhereClause(where);
    const entities = await super.findBy(transformedWhere);
    return this.setLanguageOnEntities(entities);
  }

  /**
   * Find entities and count with automatic language column mapping.
   */
  override async findAndCount(options?: FindManyOptions<Entity>): Promise<[Entity[], number]> {
    const transformedOptions = this.transformFindOptions(options);
    const [entities, count] = await super.findAndCount(transformedOptions);
    return [this.setLanguageOnEntities(entities), count];
  }

  /**
   * Find entities and count by conditions
   */
  override async findAndCountBy(where: FindOptionsWhere<Entity>): Promise<[Entity[], number]> {
    const transformedWhere = this.transformWhereClause(where);
    const [entities, count] = await super.findAndCountBy(transformedWhere);
    return [this.setLanguageOnEntities(entities), count];
  }

  /**
   * Find one entity or fail with automatic language column mapping.
   */
  override async findOneOrFail(options: FindOneOptions<Entity>): Promise<Entity> {
    const transformedOptions = this.transformFindOptions(options) || options;
    const entity = await super.findOneOrFail(transformedOptions);
    return this.setLanguageOnEntity(entity);
  }

  /**
   * Find one entity by conditions or fail
   */
  override async findOneByOrFail(where: FindOptionsWhere<Entity>): Promise<Entity> {
    const transformedWhere = this.transformWhereClause(where);
    const entity = await super.findOneByOrFail(transformedWhere);
    return this.setLanguageOnEntity(entity);
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

    // Prepare the entity so raw columns are populated from translations
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
  override save<T extends DeepPartial<Entity>>(
    entityOrEntities: T | T[],
    options?: SaveOptions
  ): Promise<(T & Entity) | (T & Entity)[]> {
    if (Array.isArray(entityOrEntities)) {
      const entities = entityOrEntities as T[];
      for (const entity of entities) {
        prepareI18nUpdate(entity as object);
      }
      return super.save(entities, options);
    }
    const entity = entityOrEntities as T;
    prepareI18nUpdate(entity as object);
    return super.save(entity, options);
  }

  /**
   * Set the current language on a single entity and re-transform its i18n properties.
   * This updates both the language symbol and the single-value properties.
   * Also recursively transforms any loaded relations.
   */
  private setLanguageOnEntity(entity: Entity): Entity {
    if (this.currentLanguage) {
      // Re-transform the entity and all its relations with the current language
      transformEntityWithRelations(entity, this.currentLanguage);
    }
    return entity;
  }

  /**
   * Set the current language on multiple entities and their relations
   */
  private setLanguageOnEntities(entities: Entity[]): Entity[] {
    if (this.currentLanguage) {
      for (const entity of entities) {
        // Re-transform each entity and its relations with the current language
        transformEntityWithRelations(entity, this.currentLanguage);
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
   * Transform order clause to use language-specific columns
   */
  private transformOrderClause(order: FindOptionsOrder<Entity>): FindOptionsOrder<Entity> {
    if (!order || !this.currentLanguage) {
      return order;
    }

    const metadata = i18nMetadataStorage.getMetadata(this.target as Function);
    const transformed: any = {};

    for (const [key, value] of Object.entries(order)) {
      const i18nMeta = metadata.find((m) => m.propertyName === key);

      if (i18nMeta) {
        const { options } = i18nMeta;
        let columnName: string;
        if (this.currentLanguage === options.default_language) {
          columnName = key;
        } else {
          columnName = `${key}${LANGUAGE_DELIMITER}${this.currentLanguage}`;
        }
        transformed[columnName] = value;
      } else {
        transformed[key] = value;
      }
    }

    return transformed;
  }

  /**
   * Transform where clause to use language-specific columns
   */
  private transformWhereClause(where: any): any {
    if (!where || !this.currentLanguage) {
      return where;
    }

    // Handle array of where clauses
    if (Array.isArray(where)) {
      return where.map((w) => this.transformWhereClause(w));
    }

    // Get i18n metadata for this entity
    const metadata = i18nMetadataStorage.getMetadata(this.target as Function);

    const transformed: any = {};

    for (const [key, value] of Object.entries(where)) {
      const i18nMeta = metadata.find((m) => m.propertyName === key);

      if (i18nMeta) {
        // This is an i18n column
        const { options } = i18nMeta;

        // Determine which column to use
        let columnName: string;
        if (this.currentLanguage === options.default_language) {
          // Use base column for default language
          columnName = key;
        } else {
          // Use translated column for non-default language
          columnName = `${key}${LANGUAGE_DELIMITER}${this.currentLanguage}`;
        }

        transformed[columnName] = value;
      } else {
        // Not an i18n column, keep as is
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
