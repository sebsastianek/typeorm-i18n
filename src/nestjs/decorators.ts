import { Inject } from '@nestjs/common';
import { getI18nRepositoryToken } from './types';

/**
 * Decorator for injecting an I18n repository.
 * Use this instead of @InjectRepository() for entities with I18nColumn.
 *
 * The injected repository is request-scoped and automatically has the
 * language set based on the current request (from JWT, header, etc.).
 *
 * @param entity - The entity class
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class ProductService {
 *   constructor(
 *     @InjectI18nRepository(Product)
 *     private readonly productRepo: I18nRepository<Product>,
 *   ) {}
 *
 *   async findAll() {
 *     // Language is automatically set from request context
 *     return this.productRepo.find();
 *   }
 *
 *   async search(name: string) {
 *     // Queries use the correct language column automatically
 *     return this.productRepo.find({
 *       where: i18nWhere<Product>({ name }),
 *     });
 *   }
 * }
 * ```
 */
export function InjectI18nRepository(
  entity: Function,
): ReturnType<typeof Inject> {
  return Inject(getI18nRepositoryToken(entity));
}
