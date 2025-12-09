import { SelectQueryBuilder, ObjectLiteral, Brackets, WhereExpressionBuilder } from 'typeorm';
import { i18nMetadataStorage } from './metadata';
import { LANGUAGE_DELIMITER } from './constants';
import { transformEntityWithRelations } from './utils';

/**
 * Extended QueryBuilder with automatic i18n column translation.
 * Standard methods like where(), orderBy() automatically use language-specific columns.
 *
 * @template Entity - The entity type
 *
 * @example
 * ```typescript
 * const repo = getI18nRepository(Product, dataSource);
 * repo.setLanguage('es');
 *
 * // Standard methods automatically use Spanish columns
 * const products = await repo
 *   .createQueryBuilder('product')
 *   .where({ name: 'Portátil' })           // Uses name_es
 *   .orderBy('product.name', 'ASC')        // Orders by name_es
 *   .getMany();
 * ```
 */
export class I18nQueryBuilder<Entity extends ObjectLiteral> extends SelectQueryBuilder<Entity> {
  private __i18nLanguage: string | null = null;
  private __i18nTarget: Function | null = null;

  /**
   * Set the i18n context for this query builder
   * @internal
   */
  setI18nContext(language: string | null, target: Function, _alias?: string): this {
    this.__i18nLanguage = language;
    this.__i18nTarget = target;
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
   * Transform a where object to use language-specific columns
   */
  private transformWhereObject(where: ObjectLiteral): ObjectLiteral {
    if (!this.__i18nLanguage || !this.__i18nTarget) {
      return where;
    }

    const transformed: ObjectLiteral = {};
    for (const [key, value] of Object.entries(where)) {
      const columnName = this.getLanguageColumn(key);
      transformed[columnName] = value;
    }
    return transformed;
  }

  /**
   * Transform a column reference string (e.g., "alias.name") to use language-specific column
   */
  private transformColumnString(column: string): string {
    if (!this.__i18nLanguage || !this.__i18nTarget) {
      return column;
    }

    // Handle "alias.property" format
    const dotIndex = column.lastIndexOf('.');
    if (dotIndex !== -1) {
      const alias = column.substring(0, dotIndex);
      const property = column.substring(dotIndex + 1);
      const transformedProperty = this.getLanguageColumn(property);
      return `${alias}.${transformedProperty}`;
    }

    // Handle plain property name
    return this.getLanguageColumn(column);
  }

  /**
   * Transform an order object to use language-specific columns
   */
  private transformOrderObject(
    order: { [key: string]: 'ASC' | 'DESC' | { order: 'ASC' | 'DESC'; nulls?: 'NULLS FIRST' | 'NULLS LAST' } }
  ): { [key: string]: 'ASC' | 'DESC' | { order: 'ASC' | 'DESC'; nulls?: 'NULLS FIRST' | 'NULLS LAST' } } {
    const transformed: typeof order = {};
    for (const [key, value] of Object.entries(order)) {
      const transformedKey = this.transformColumnString(key);
      transformed[transformedKey] = value;
    }
    return transformed;
  }

  /**
   * Override where() to automatically use language-specific columns.
   * Supports object notation: .where({ name: 'value' })
   */
  override where(
    where:
      | string
      | ((qb: WhereExpressionBuilder) => string)
      | Brackets
      | ObjectLiteral
      | ObjectLiteral[],
    parameters?: ObjectLiteral
  ): this {
    if (typeof where === 'object' && where !== null && !(where instanceof Brackets) && !Array.isArray(where)) {
      where = this.transformWhereObject(where);
    } else if (Array.isArray(where)) {
      where = where.map((w) => this.transformWhereObject(w));
    }
    return super.where(where, parameters);
  }

  /**
   * Override andWhere() to automatically use language-specific columns.
   */
  override andWhere(
    where:
      | string
      | ((qb: WhereExpressionBuilder) => string)
      | Brackets
      | ObjectLiteral
      | ObjectLiteral[],
    parameters?: ObjectLiteral
  ): this {
    if (typeof where === 'object' && where !== null && !(where instanceof Brackets) && !Array.isArray(where)) {
      where = this.transformWhereObject(where);
    } else if (Array.isArray(where)) {
      where = where.map((w) => this.transformWhereObject(w));
    }
    return super.andWhere(where, parameters);
  }

  /**
   * Override orWhere() to automatically use language-specific columns.
   */
  override orWhere(
    where:
      | string
      | ((qb: WhereExpressionBuilder) => string)
      | Brackets
      | ObjectLiteral
      | ObjectLiteral[],
    parameters?: ObjectLiteral
  ): this {
    if (typeof where === 'object' && where !== null && !(where instanceof Brackets) && !Array.isArray(where)) {
      where = this.transformWhereObject(where);
    } else if (Array.isArray(where)) {
      where = where.map((w) => this.transformWhereObject(w));
    }
    return super.orWhere(where, parameters);
  }

  /**
   * Override orderBy() to automatically use language-specific columns.
   * Supports both string and object notation.
   */
  override orderBy(
    sort?: string | ObjectLiteral,
    order?: 'ASC' | 'DESC',
    nulls?: 'NULLS FIRST' | 'NULLS LAST'
  ): this {
    if (typeof sort === 'string') {
      sort = this.transformColumnString(sort);
    } else if (typeof sort === 'object' && sort !== null) {
      sort = this.transformOrderObject(sort as any);
    }
    return super.orderBy(sort as any, order, nulls);
  }

  /**
   * Override addOrderBy() to automatically use language-specific columns.
   */
  override addOrderBy(
    sort: string,
    order?: 'ASC' | 'DESC',
    nulls?: 'NULLS FIRST' | 'NULLS LAST'
  ): this {
    sort = this.transformColumnString(sort);
    return super.addOrderBy(sort, order, nulls);
  }

  /**
   * Override select() to automatically use language-specific columns.
   * Supports string format like "alias.property" or array of strings.
   */
  override select(): this;
  override select(selection: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>, selectionAliasName?: string): this;
  override select(selection: string, selectionAliasName?: string): this;
  override select(selection: string[]): this;
  override select(
    selection?: string | string[] | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
    selectionAliasName?: string
  ): this {
    if (typeof selection === 'function') {
      return super.select(selection, selectionAliasName);
    }
    if (typeof selection === 'string') {
      selection = this.transformColumnString(selection);
    } else if (Array.isArray(selection)) {
      selection = selection.map((s) => this.transformColumnString(s));
    }
    return super.select(selection as any, selectionAliasName);
  }

  /**
   * Override addSelect() to automatically use language-specific columns.
   */
  override addSelect(selection: string, selectionAliasName?: string): this;
  override addSelect(selection: string[]): this;
  override addSelect(selection: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>): this;
  override addSelect(
    selection: string | string[] | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
    selectionAliasName?: string
  ): this {
    if (typeof selection === 'function') {
      return super.addSelect(selection);
    }
    if (typeof selection === 'string') {
      selection = this.transformColumnString(selection);
    } else if (Array.isArray(selection)) {
      selection = selection.map((s) => this.transformColumnString(s));
    }
    return super.addSelect(selection as any, selectionAliasName);
  }

  /**
   * Override groupBy() to automatically use language-specific columns.
   */
  override groupBy(groupBy?: string): this {
    if (groupBy) {
      return super.groupBy(this.transformColumnString(groupBy));
    }
    return super.groupBy();
  }

  /**
   * Override addGroupBy() to automatically use language-specific columns.
   */
  override addGroupBy(groupBy: string): this {
    groupBy = this.transformColumnString(groupBy);
    return super.addGroupBy(groupBy);
  }

  /**
   * Get many entities with language-aware transformation.
   * Overrides the base getMany to apply language context to loaded entities
   * and their relations.
   */
  override async getMany(): Promise<Entity[]> {
    const entities = await super.getMany();
    if (this.__i18nLanguage) {
      for (const entity of entities) {
        transformEntityWithRelations(entity, this.__i18nLanguage);
      }
    }
    return entities;
  }

  /**
   * Get one entity with language-aware transformation.
   * Overrides the base getOne to apply language context to loaded entity
   * and its relations.
   */
  override async getOne(): Promise<Entity | null> {
    const entity = await super.getOne();
    if (entity && this.__i18nLanguage) {
      transformEntityWithRelations(entity, this.__i18nLanguage);
    }
    return entity;
  }

  /**
   * Get one entity or fail with language-aware transformation.
   * Note: TypeORM's getOneOrFail() internally calls getOne(), which we've already overridden
   * to apply language transformation. So we don't need to transform again here.
   */
  override async getOneOrFail(): Promise<Entity> {
    // TypeORM's getOneOrFail() calls this.getOne() internally,
    // which is our overridden getOne() that already handles transformation.
    // We just need to delegate to super without additional transformation.
    return super.getOneOrFail();
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
