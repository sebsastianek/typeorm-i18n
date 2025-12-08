import { ModuleMetadata, Type } from '@nestjs/common';

/**
 * Configuration for language extraction in CQRS/Microservices
 */
export interface I18nLanguageExtractionConfig {
  /**
   * Field name in payload/command containing language (default: 'language')
   */
  field?: string;

  /**
   * Header field name for microservices context (default: 'x-language')
   */
  headerField?: string;
}

/**
 * Configuration options for I18nModule
 */
export interface I18nModuleOptions {
  /**
   * Supported language codes
   */
  languages: string[];

  /**
   * Default language code
   */
  defaultLanguage: string;

  /**
   * Function to extract language from request.
   * Receives the request object and should return a language code or null.
   * If null is returned, defaultLanguage will be used.
   */
  resolveLanguage?: (request: any) => string | null | Promise<string | null>;

  /**
   * Configuration for @I18nLanguageAware decorator.
   * Sets default field names for language extraction in CQRS/Microservices.
   */
  languageExtraction?: I18nLanguageExtractionConfig;
}

// Global config store for decorator access
let globalLanguageExtractionConfig: I18nLanguageExtractionConfig = {};

/**
 * Set global language extraction config (called by I18nModule)
 * @internal
 */
export function setLanguageExtractionConfig(config: I18nLanguageExtractionConfig): void {
  globalLanguageExtractionConfig = config;
}

/**
 * Get global language extraction config (used by decorators)
 * @internal
 */
export function getLanguageExtractionConfig(): I18nLanguageExtractionConfig {
  return globalLanguageExtractionConfig;
}

/**
 * Factory for async configuration
 */
export interface I18nModuleOptionsFactory {
  createI18nOptions(): Promise<I18nModuleOptions> | I18nModuleOptions;
}

/**
 * Async configuration options for I18nModule
 */
export interface I18nModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<I18nModuleOptionsFactory>;
  useClass?: Type<I18nModuleOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<I18nModuleOptions> | I18nModuleOptions;
  inject?: any[];
}

/**
 * Token for injecting I18n module options
 */
export const I18N_MODULE_OPTIONS = Symbol('I18N_MODULE_OPTIONS');

/**
 * Token for injecting the current request language
 */
export const I18N_LANGUAGE = Symbol('I18N_LANGUAGE');

/**
 * Token prefix for I18n repositories
 */
export const I18N_REPOSITORY_TOKEN = 'I18nRepository_';

/**
 * Get the injection token for an I18n repository
 */
export function getI18nRepositoryToken(entity: Function): string {
  return `${I18N_REPOSITORY_TOKEN}${entity.name}`;
}
