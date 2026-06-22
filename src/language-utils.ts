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
 * Safe BCP-47-ish language code shape. Used as a defense-in-depth guard so that
 * a language code can never carry SQL metacharacters into a generated column
 * identifier (column names are built as `${property}_${language}` and end up in
 * non-parameterized ORDER BY / GROUP BY / SELECT positions).
 *
 * Accepts: 'en', 'es', 'zh', 'pt-br', 'en-us', 'sr-latn-rs' (lowercase, digits, hyphen-separated subtags).
 * Rejects: anything containing spaces, quotes, parentheses, semicolons, commas, etc.
 */
export const LANGUAGE_CODE_PATTERN = /^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/;

/**
 * Returns true if the (already normalized) language code is structurally safe.
 */
export function isValidLanguageCode(language: string): boolean {
  return LANGUAGE_CODE_PATTERN.test(language);
}

/**
 * Throws if the language code is not structurally safe.
 * @internal
 */
export function assertValidLanguageCode(language: string): void {
  if (!isValidLanguageCode(language)) {
    throw new Error(
      `Invalid language code "${language}". Language codes must be lowercase letters/digits ` +
      'separated by hyphens (e.g. "en", "pt-br").'
    );
  }
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
