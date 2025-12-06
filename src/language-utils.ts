/**
 * Normalizes a language code to lowercase.
 * This ensures consistent handling of language codes regardless of input case.
 *
 * @param language - The language code to normalize (e.g., 'EN', 'Es', 'fr')
 * @returns The normalized lowercase language code (e.g., 'en', 'es', 'fr')
 *
 * @example
 * ```typescript
 * normalizeLanguageCode('EN');  // 'en'
 * normalizeLanguageCode('Es');  // 'es'
 * normalizeLanguageCode('fr');  // 'fr'
 * normalizeLanguageCode('ZH-CN'); // 'zh-cn'
 * ```
 */
export function normalizeLanguageCode(language: string): string {
  return language.toLowerCase();
}

/**
 * Normalizes an array of language codes to lowercase.
 *
 * @param languages - Array of language codes to normalize
 * @returns Array of normalized lowercase language codes
 *
 * @example
 * ```typescript
 * normalizeLanguageCodes(['EN', 'ES', 'FR']); // ['en', 'es', 'fr']
 * ```
 */
export function normalizeLanguageCodes<T extends string>(
  languages: readonly T[]
): T[] {
  return languages.map((lang) => normalizeLanguageCode(lang) as T);
}
