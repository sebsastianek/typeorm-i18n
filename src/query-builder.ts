import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { i18nMetadataStorage } from './metadata';
import { LANGUAGE_DELIMITER } from './constants';
import { transformAfterLoad } from './utils';

/**
 * Extended QueryBuilder with i18n-aware helper methods.
 * Provides ergonomic methods for querying translated columns without manual column mapping.
 *
 * @template Entity - The entity type
 *
 * @example
 * ```typescript
 * const repo = getI18nRepository(Product, dataSource);
 * repo.setLanguage('es');
 *
 * // Instead of:
 * const products = await repo
 *   .createQueryBuilder('product')
 *   .where(`product.${repo.getLanguageColumn('name')} = :name`, { name: 'Portátil' })
 *   .getMany();
 *
 * // You can now write:
 * const products = await repo
 *   .createQueryBuilder('product')
 *   .whereLanguage('name', '=', 'Portátil')
 *   .getMany();
 * ```
 */
export class I18nQueryBuilder<Entity extends ObjectLiteral> extends SelectQueryBuilder<Entity> {
  private __i18nLanguage: string | null = null;
  private __i18nTarget: Function | null = null;
  private __i18nAlias: string | undefined;

  /**
   * Set the i18n context for this query builder
   * @internal
   */
  setI18nContext(language: string | null, target: Function, alias?: string): this {
    this.__i18nLanguage = language;
    this.__i18nTarget = target;
    this.__i18nAlias = alias;
    return this;
  }

  /**
   * Get the column name for a property in the current language context
   */
  private getLanguageColumn(propertyName: string): string {
    if (!this.__i18nLanguage || !this.__i18nTarget) {
      return propertyName;
    }

    const metadata = i18nMetadataStorage.getMetadata(this.__i18nTarget);
    const i18nMeta = metadata.find((m) => m.propertyName === propertyName);

    if (!i18nMeta) {
      return propertyName;
    }

    const { options } = i18nMeta;

    if (this.__i18nLanguage === options.default_language) {
      return propertyName;
    }

    return `${propertyName}${LANGUAGE_DELIMITER}${this.__i18nLanguage}`;
  }

  /**
   * Build the full column reference with alias
   */
  private buildColumnRef(propertyName: string): string {
    const columnName = this.getLanguageColumn(propertyName);
    return this.__i18nAlias ? `${this.__i18nAlias}.${columnName}` : columnName;
  }

  /**
   * Generate a unique parameter name to avoid conflicts
   */
  private generateParamName(propertyName: string): string {
    return `${propertyName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a WHERE condition using the current language's column.
   * Automatically maps the property name to the correct language-specific column.
   *
   * @param propertyName - The i18n property name (e.g., 'name', 'description')
   * @param operator - SQL operator (e.g., '=', 'LIKE', '!=', '>', '<')
   * @param value - The value to compare against
   * @returns The query builder for chaining
   *
   * @example
   * ```typescript
   * repo.setLanguage('es');
   * const products = await repo
   *   .createQueryBuilder('product')
   *   .whereLanguage('name', '=', 'Portátil')
   *   .getMany();
   * // Generates: WHERE product.name_es = 'Portátil'
   * ```
   */
  whereLanguage(propertyName: string, operator: string, value: any): this {
    const columnRef = this.buildColumnRef(propertyName);
    const paramName = this.generateParamName(propertyName);
    return this.where(`${columnRef} ${operator} :${paramName}`, { [paramName]: value });
  }

  /**
   * Add an AND WHERE condition using the current language's column.
   *
   * @param propertyName - The i18n property name
   * @param operator - SQL operator
   * @param value - The value to compare against
   * @returns The query builder for chaining
   *
   * @example
   * ```typescript
   * repo.setLanguage('es');
   * const products = await repo
   *   .createQueryBuilder('product')
   *   .where('product.isActive = :active', { active: true })
   *   .andWhereLanguage('name', 'LIKE', '%Portátil%')
   *   .getMany();
   * ```
   */
  andWhereLanguage(propertyName: string, operator: string, value: any): this {
    const columnRef = this.buildColumnRef(propertyName);
    const paramName = this.generateParamName(propertyName);
    return this.andWhere(`${columnRef} ${operator} :${paramName}`, { [paramName]: value });
  }

  /**
   * Add an OR WHERE condition using the current language's column.
   *
   * @param propertyName - The i18n property name
   * @param operator - SQL operator
   * @param value - The value to compare against
   * @returns The query builder for chaining
   *
   * @example
   * ```typescript
   * repo.setLanguage('es');
   * const products = await repo
   *   .createQueryBuilder('product')
   *   .whereLanguage('name', '=', 'Portátil')
   *   .orWhereLanguage('name', '=', 'Ratón')
   *   .getMany();
   * ```
   */
  orWhereLanguage(propertyName: string, operator: string, value: any): this {
    const columnRef = this.buildColumnRef(propertyName);
    const paramName = this.generateParamName(propertyName);
    return this.orWhere(`${columnRef} ${operator} :${paramName}`, { [paramName]: value });
  }

  /**
   * Add an ORDER BY clause using the current language's column.
   *
   * @param propertyName - The i18n property name
   * @param order - Sort order ('ASC' or 'DESC')
   * @param nulls - Optional null ordering ('NULLS FIRST' or 'NULLS LAST')
   * @returns The query builder for chaining
   *
   * @example
   * ```typescript
   * repo.setLanguage('es');
   * const products = await repo
   *   .createQueryBuilder('product')
   *   .orderByLanguage('name', 'ASC')
   *   .getMany();
   * // Orders by name_es ASC
   * ```
   */
  orderByLanguage(
    propertyName: string,
    order: 'ASC' | 'DESC' = 'ASC',
    nulls?: 'NULLS FIRST' | 'NULLS LAST'
  ): this {
    const columnRef = this.buildColumnRef(propertyName);
    return this.orderBy(columnRef, order, nulls);
  }

  /**
   * Add an additional ORDER BY clause using the current language's column.
   *
   * @param propertyName - The i18n property name
   * @param order - Sort order ('ASC' or 'DESC')
   * @param nulls - Optional null ordering
   * @returns The query builder for chaining
   */
  addOrderByLanguage(
    propertyName: string,
    order: 'ASC' | 'DESC' = 'ASC',
    nulls?: 'NULLS FIRST' | 'NULLS LAST'
  ): this {
    const columnRef = this.buildColumnRef(propertyName);
    return this.addOrderBy(columnRef, order, nulls);
  }

  /**
   * Select specific i18n columns in the current language.
   *
   * @param propertyNames - Array of i18n property names to select
   * @returns The query builder for chaining
   *
   * @example
   * ```typescript
   * repo.setLanguage('es');
   * const products = await repo
   *   .createQueryBuilder('product')
   *   .selectLanguage(['name', 'description'])
   *   .getMany();
   * // Selects name_es, description_es
   * ```
   */
  selectLanguage(propertyNames: string[]): this {
    const columns = propertyNames.map((prop) => this.buildColumnRef(prop));
    return this.select(columns);
  }

  /**
   * Add i18n columns to the selection in the current language.
   *
   * @param propertyNames - Array of i18n property names to add to selection
   * @returns The query builder for chaining
   */
  addSelectLanguage(propertyNames: string[]): this {
    for (const prop of propertyNames) {
      this.addSelect(this.buildColumnRef(prop));
    }
    return this;
  }

  /**
   * Get many entities with language-aware transformation.
   * Overrides the base getMany to apply language context to loaded entities.
   */
  override async getMany(): Promise<Entity[]> {
    const entities = await super.getMany();
    if (this.__i18nLanguage) {
      for (const entity of entities) {
        transformAfterLoad(entity, this.__i18nLanguage);
      }
    }
    return entities;
  }

  /**
   * Get one entity with language-aware transformation.
   * Overrides the base getOne to apply language context to loaded entity.
   */
  override async getOne(): Promise<Entity | null> {
    const entity = await super.getOne();
    if (entity && this.__i18nLanguage) {
      transformAfterLoad(entity, this.__i18nLanguage);
    }
    return entity;
  }

  /**
   * Get one entity or fail with language-aware transformation.
   * Overrides the base getOneOrFail to apply language context to loaded entity.
   */
  override async getOneOrFail(): Promise<Entity> {
    const entity = await super.getOneOrFail();
    if (this.__i18nLanguage) {
      transformAfterLoad(entity, this.__i18nLanguage);
    }
    return entity;
  }
}

/**
 * Create an I18nQueryBuilder from a SelectQueryBuilder
 * @internal
 */
export function createI18nQueryBuilder<Entity extends ObjectLiteral>(
  qb: SelectQueryBuilder<Entity>,
  language: string | null,
  target: Function,
  alias?: string
): I18nQueryBuilder<Entity> {
  // Copy all properties from the original QueryBuilder to the I18nQueryBuilder
  const i18nQb = Object.assign(
    Object.create(I18nQueryBuilder.prototype),
    qb
  ) as I18nQueryBuilder<Entity>;

  // Set up the prototype chain properly
  Object.setPrototypeOf(i18nQb, I18nQueryBuilder.prototype);

  // Set the i18n context
  i18nQb.setI18nContext(language, target, alias);

  return i18nQb;
}
