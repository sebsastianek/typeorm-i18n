import 'reflect-metadata';
import { I18nColumnMetadata } from './types';

/**
 * Storage for I18n column metadata
 */
class I18nMetadataStorage {
  private metadata = new Map<Function, I18nColumnMetadata[]>();

  /**
   * Add metadata for an I18n column
   */
  addMetadata<T extends string>(meta: I18nColumnMetadata<T>): void {
    const existing = this.metadata.get(meta.target) || [];
    existing.push(meta);
    this.metadata.set(meta.target, existing);
  }

  /**
   * Get all I18n column metadata for a specific entity
   */
  getMetadata(target: Function): I18nColumnMetadata[] {
    return this.metadata.get(target) || [];
  }

  /**
   * Get metadata for a specific property
   */
  getPropertyMetadata(target: Function, propertyName: string): I18nColumnMetadata | undefined {
    const metadata = this.getMetadata(target);
    return metadata.find(m => m.propertyName === propertyName);
  }

  /**
   * Check if a property is an I18n column
   */
  isI18nColumn(target: Function, propertyName: string): boolean {
    return this.getPropertyMetadata(target, propertyName) !== undefined;
  }

  /**
   * Clear all metadata (useful for testing)
   */
  clear(): void {
    this.metadata.clear();
  }
}

/**
 * Global metadata storage instance
 */
export const i18nMetadataStorage = new I18nMetadataStorage();
