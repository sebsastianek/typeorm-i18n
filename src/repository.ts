import { Repository, DataSource, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { i18nMetadataStorage } from './metadata';
import { LANGUAGE_DELIMITER } from './constants';
import { I18nQueryBuilder, createI18nQueryBuilder } from './query-builder';
import { normalizeLanguageCode } from './language-utils';

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
   * Find entities with automatic language column mapping
   */
  override async find(options?: FindManyOptions<Entity>): Promise<Entity[]> {
    const transformedOptions = this.transformFindOptions(options);
    return super.find(transformedOptions);
  }

  /**
   * Find one entity with automatic language column mapping
   */
  override async findOne(options: FindOneOptions<Entity>): Promise<Entity | null> {
    const transformedOptions = this.transformFindOptions(options) || options;
    return super.findOne(transformedOptions);
  }

  /**
   * Find one entity by ID or conditions
   */
  override async findOneBy(where: FindOptionsWhere<Entity>): Promise<Entity | null> {
    const transformedWhere = this.transformWhereClause(where);
    return super.findOneBy(transformedWhere);
  }

  /**
   * Find entities by conditions
   */
  override async findBy(where: FindOptionsWhere<Entity>): Promise<Entity[]> {
    const transformedWhere = this.transformWhereClause(where);
    return super.findBy(transformedWhere);
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
   * The returned QueryBuilder has additional i18n-aware methods like
   * whereLanguage(), andWhereLanguage(), orWhereLanguage(), and orderByLanguage().
   *
   * @param alias - Optional alias for the entity
   * @returns An I18nQueryBuilder with language-aware helper methods
   *
   * @example
   * ```typescript
   * const repo = getI18nRepository(Product, dataSource);
   * repo.setLanguage('es');
   *
   * // Using ergonomic language-aware methods
   * const products = await repo
   *   .createQueryBuilder('product')
   *   .whereLanguage('name', '=', 'Portátil')
   *   .andWhereLanguage('description', 'LIKE', '%laptop%')
   *   .orderByLanguage('name', 'ASC')
   *   .getMany();
   *
   * // Or use the traditional approach with getLanguageColumn()
   * const products2 = await repo
   *   .createQueryBuilder('product')
   *   .where(`product.${repo.getLanguageColumn('name')} = :name`, { name: 'Portátil' })
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
