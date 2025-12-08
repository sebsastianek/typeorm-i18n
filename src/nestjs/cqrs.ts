/**
 * Language-aware decorators for CQRS and Microservices.
 *
 * Provides transparent language extraction from commands, queries, events,
 * and microservice messages.
 */

import { I18nLanguageService } from './i18n-language.service';
import { getLanguageExtractionConfig } from './types';

/**
 * Interface for commands/queries/events/messages that carry language context.
 *
 * @example
 * ```typescript
 * export class CreateProductCommand implements WithLanguage {
 *   constructor(
 *     public readonly name: string,
 *     public readonly language?: string,
 *   ) {}
 * }
 * ```
 */
export interface WithLanguage {
  language?: string;
}

/**
 * Options for the @I18nLanguageAware decorator
 */
export interface I18nLanguageAwareOptions {
  /** Field name containing the language in payload (default: 'language') */
  field?: string;
  /** Header field name for microservices context (default: 'x-language') */
  headerField?: string;
  /** Default language if not found */
  defaultLanguage?: string;
}

/**
 * Extract language from microservice context (Kafka, RabbitMQ, gRPC).
 */
function extractLanguageFromContext(context: any, headerField: string): string | null {
  if (!context) return null;

  try {
    // Kafka: context.getMessage().headers
    const kafkaMessage = context.getMessage?.();
    if (kafkaMessage?.headers?.[headerField]) {
      const header = kafkaMessage.headers[headerField];
      return Buffer.isBuffer(header) ? header.toString() : String(header);
    }

    // RabbitMQ: context.getMessage().properties.headers
    if (kafkaMessage?.properties?.headers?.[headerField]) {
      return kafkaMessage.properties.headers[headerField];
    }

    // gRPC: metadata.get(key)
    if (context.get) {
      const values = context.get(headerField);
      if (values?.[0]) return values[0];
    }
  } catch {
    // Ignore extraction errors
  }

  return null;
}

/**
 * Set language on all I18nRepository instances found on the handler.
 */
function setLanguageOnRepos(handler: any, language: string): void {
  for (const key of Object.keys(handler)) {
    const prop = handler[key];
    if (prop && typeof prop.setLanguage === 'function' && typeof prop.getLanguage === 'function') {
      prop.setLanguage(language);
    }
  }
}

/**
 * Set language on the language service if available.
 */
function setLanguageOnService(handler: any, language: string): void {
  const languageService: I18nLanguageService | undefined =
    handler.i18nLanguageService ||
    handler.languageService ||
    handler._i18nLanguageService;

  if (languageService) {
    languageService.setLanguage(language);
  }
}

/**
 * Method decorator that automatically extracts language and sets it on all
 * I18nRepository instances on the handler.
 *
 * Works with:
 * - CQRS commands/queries (extracts from first argument)
 * - Microservice messages (extracts from payload or context headers)
 *
 * @param options - Decorator options
 *
 * @example
 * ```typescript
 * // CQRS Command Handler
 * @CommandHandler(CreateProductCommand)
 * export class CreateProductHandler {
 *   constructor(
 *     @InjectI18nRepository(Product) private productRepo: I18nRepository<Product>,
 *   ) {}
 *
 *   @I18nLanguageAware()
 *   async execute(command: CreateProductCommand) {
 *     // Language automatically set from command.language
 *     return this.productRepo.save({ name: command.name });
 *   }
 * }
 *
 * // Microservice Message Handler
 * @Controller()
 * export class ProductController {
 *   constructor(
 *     @InjectI18nRepository(Product) private productRepo: I18nRepository<Product>,
 *   ) {}
 *
 *   @MessagePattern('product.create')
 *   @I18nLanguageAware()
 *   async handleCreate(@Payload() data: any, @Ctx() context: any) {
 *     // Language extracted from data.language or context headers
 *     return this.productRepo.save(data);
 *   }
 * }
 * ```
 */
export function I18nLanguageAware(options: I18nLanguageAwareOptions = {}): MethodDecorator {
  return function (
    _target: any,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Merge global config with decorator options (decorator options take precedence)
      const globalConfig = getLanguageExtractionConfig();
      const field = options.field ?? globalConfig.field ?? 'language';
      const headerField = options.headerField ?? globalConfig.headerField ?? 'x-language';
      const defaultLanguage = options.defaultLanguage;

      // Try to extract language from first argument (payload/command)
      const payload = args[0];
      let language = payload?.[field];

      // If not in payload, try context (second argument for microservices)
      if (!language && args[1]) {
        language = extractLanguageFromContext(args[1], headerField);
      }

      // Fall back to default
      language = language || defaultLanguage;

      if (language) {
        setLanguageOnService(this, language);
        setLanguageOnRepos(this, language);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Class decorator that automatically applies @I18nLanguageAware to the execute method.
 * Useful for CQRS handlers where you want automatic language extraction.
 *
 * @param options - Decorator options
 *
 * @example
 * ```typescript
 * @CommandHandler(CreateProductCommand)
 * @I18nLanguageAwareHandler()
 * export class CreateProductHandler {
 *   constructor(
 *     @InjectI18nRepository(Product) private productRepo: I18nRepository<Product>,
 *   ) {}
 *
 *   async execute(command: CreateProductCommand) {
 *     // Language automatically set from command.language
 *     return this.productRepo.save({ name: command.name });
 *   }
 * }
 * ```
 */
export function I18nLanguageAwareHandler(options: I18nLanguageAwareOptions = {}): ClassDecorator {
  return function (target: any) {
    const originalExecute = target.prototype.execute;

    if (originalExecute) {
      target.prototype.execute = async function (...args: any[]) {
        // Merge global config with decorator options (decorator options take precedence)
        const globalConfig = getLanguageExtractionConfig();
        const field = options.field ?? globalConfig.field ?? 'language';
        const headerField = options.headerField ?? globalConfig.headerField ?? 'x-language';
        const defaultLanguage = options.defaultLanguage;

        const payload = args[0];
        let language = payload?.[field];

        if (!language && args[1]) {
          language = extractLanguageFromContext(args[1], headerField);
        }

        language = language || defaultLanguage;

        if (language) {
          setLanguageOnService(this, language);
          setLanguageOnRepos(this, language);
        }

        return originalExecute.apply(this, args);
      };
    }

    return target;
  };
}
