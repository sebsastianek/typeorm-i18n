import { Injectable, Scope } from '@nestjs/common';

/**
 * Request-scoped service for managing the current language.
 * This service holds the language for the current request context.
 */
@Injectable({ scope: Scope.REQUEST })
export class I18nLanguageService {
  private language: string | null = null;

  /**
   * Set the current language for this request
   */
  setLanguage(language: string): void {
    this.language = language.toLowerCase();
  }

  /**
   * Get the current language for this request
   */
  getLanguage(): string | null {
    return this.language;
  }

  /**
   * Check if a language has been set
   */
  hasLanguage(): boolean {
    return this.language !== null;
  }
}
