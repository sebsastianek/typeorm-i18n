/**
 * Pre-built language resolver functions for common use cases.
 * Use these with the `resolveLanguage` option in I18nModule.forRoot().
 */

/**
 * Extract language from JWT payload.
 * Assumes the request has been processed by a JWT guard and has `user` attached.
 *
 * @param field - The field name in the JWT payload (default: 'language')
 *
 * @example
 * ```typescript
 * I18nModule.forRoot({
 *   languages: ['en', 'es', 'fr'],
 *   defaultLanguage: 'en',
 *   resolveLanguage: fromJwtPayload('lang'),
 * })
 * ```
 */
export function fromJwtPayload(field: string = 'language') {
  return (request: any): string | null => {
    return request.user?.[field] || null;
  };
}

/**
 * Extract language from request header.
 *
 * @param header - The header name (default: 'accept-language')
 *
 * @example
 * ```typescript
 * I18nModule.forRoot({
 *   languages: ['en', 'es', 'fr'],
 *   defaultLanguage: 'en',
 *   resolveLanguage: fromHeader('x-language'),
 * })
 * ```
 */
export function fromHeader(header: string = 'accept-language') {
  return (request: any): string | null => {
    const value = request.headers?.[header.toLowerCase()];
    if (!value) return null;

    // Handle Accept-Language format (e.g., "en-US,en;q=0.9,es;q=0.8")
    if (header.toLowerCase() === 'accept-language') {
      const primary = value.split(',')[0];
      return primary?.split('-')[0]?.split(';')[0] || null;
    }

    return value;
  };
}

/**
 * Extract language from query parameter.
 *
 * @param param - The query parameter name (default: 'lang')
 *
 * @example
 * ```typescript
 * I18nModule.forRoot({
 *   languages: ['en', 'es', 'fr'],
 *   defaultLanguage: 'en',
 *   resolveLanguage: fromQuery('language'),
 * })
 * ```
 */
export function fromQuery(param: string = 'lang') {
  return (request: any): string | null => {
    return request.query?.[param] || null;
  };
}

/**
 * Extract language from a cookie.
 *
 * @param cookieName - The cookie name (default: 'language')
 *
 * @example
 * ```typescript
 * I18nModule.forRoot({
 *   languages: ['en', 'es', 'fr'],
 *   defaultLanguage: 'en',
 *   resolveLanguage: fromCookie('user_lang'),
 * })
 * ```
 */
export function fromCookie(cookieName: string = 'language') {
  return (request: any): string | null => {
    return request.cookies?.[cookieName] || null;
  };
}

/**
 * Try multiple resolvers in order, returning the first non-null result.
 *
 * @param resolvers - Array of resolver functions to try in order
 *
 * @example
 * ```typescript
 * I18nModule.forRoot({
 *   languages: ['en', 'es', 'fr'],
 *   defaultLanguage: 'en',
 *   resolveLanguage: chain(
 *     fromJwtPayload('language'),
 *     fromHeader('x-language'),
 *     fromQuery('lang'),
 *   ),
 * })
 * ```
 */
export function chain(
  ...resolvers: Array<(request: any) => string | null | Promise<string | null>>
) {
  return async (request: any): Promise<string | null> => {
    for (const resolver of resolvers) {
      const result = await resolver(request);
      if (result) {
        return result;
      }
    }
    return null;
  };
}

/**
 * Validate that the resolved language is in the allowed list.
 * If not, returns null (which will fall back to defaultLanguage).
 *
 * @param resolver - The resolver to wrap
 * @param allowedLanguages - List of allowed language codes
 *
 * @example
 * ```typescript
 * I18nModule.forRoot({
 *   languages: ['en', 'es', 'fr'],
 *   defaultLanguage: 'en',
 *   resolveLanguage: validated(
 *     fromHeader('accept-language'),
 *     ['en', 'es', 'fr'],
 *   ),
 * })
 * ```
 */
export function validated(
  resolver: (request: any) => string | null | Promise<string | null>,
  allowedLanguages: string[],
) {
  const normalized = allowedLanguages.map((l) => l.toLowerCase());

  return async (request: any): Promise<string | null> => {
    const result = await resolver(request);
    if (!result) return null;

    const lower = result.toLowerCase();
    return normalized.includes(lower) ? lower : null;
  };
}
