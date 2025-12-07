/**
 * CQRS integration for typeorm-i18n.
 *
 * Provides utilities for extracting language from Commands, Queries, and Events.
 */

import { I18nLanguageService } from './i18n-language.service';
import { I18nRepository } from '../repository';

// Metadata key for storing language field name
const I18N_LANGUAGE_FIELD_KEY = Symbol('i18n:languageField');

/**
 * Interface for commands/queries/events that carry language context.
 * Extend your commands and queries from this interface to enable i18n support.
 *
 * @example
 * ```typescript
 * export class CreateProductCommand implements WithLanguage {
 *   constructor(
 *     public readonly name: string,
 *     public readonly price: number,
 *     public readonly language?: string,
 *   ) {}
 * }
 * ```
 */
export interface WithLanguage {
  language?: string;
}

/**
 * Extract language from a command, query, or event and apply it to a repository.
 * Use this in your CQRS handlers.
 *
 * @param source - The command, query, or event with language property
 * @param repo - The I18nRepository to configure
 * @param defaultLanguage - Optional fallback language
 * @returns The repository with language set
 *
 * @example
 * ```typescript
 * @CommandHandler(CreateProductCommand)
 * export class CreateProductHandler implements ICommandHandler<CreateProductCommand> {
 *   constructor(
 *     @InjectI18nRepository(Product)
 *     private readonly productRepo: I18nRepository<Product>,
 *   ) {}
 *
 *   async execute(command: CreateProductCommand) {
 *     // Apply language from command to repository
 *     withLanguageFrom(command, this.productRepo);
 *
 *     // Now queries use the command's language
 *     return this.productRepo.save({ name: command.name });
 *   }
 * }
 * ```
 */
export function withLanguageFrom<T extends WithLanguage, E extends object>(
  source: T,
  repo: I18nRepository<E>,
  defaultLanguage?: string,
): I18nRepository<E> {
  const language = source.language || defaultLanguage;
  if (language) {
    repo.setLanguage(language);
  }
  return repo;
}

/**
 * Extract language from a command/query and set it on the language service.
 * Useful when you need to propagate language to multiple repositories.
 *
 * @param source - The command, query, or event with language property
 * @param languageService - The I18nLanguageService instance
 * @param defaultLanguage - Optional fallback language
 *
 * @example
 * ```typescript
 * @CommandHandler(CreateOrderCommand)
 * export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
 *   constructor(
 *     private readonly languageService: I18nLanguageService,
 *     @InjectI18nRepository(Order)
 *     private readonly orderRepo: I18nRepository<Order>,
 *     @InjectI18nRepository(Product)
 *     private readonly productRepo: I18nRepository<Product>,
 *   ) {}
 *
 *   async execute(command: CreateOrderCommand) {
 *     // Set language globally for this request scope
 *     setLanguageFrom(command, this.languageService);
 *
 *     // Both repos now use the command's language
 *     const product = await this.productRepo.findOne({ where: { id: command.productId } });
 *     return this.orderRepo.save({ product, quantity: command.quantity });
 *   }
 * }
 * ```
 */
export function setLanguageFrom<T extends WithLanguage>(
  source: T,
  languageService: I18nLanguageService,
  defaultLanguage?: string,
): void {
  const language = source.language || defaultLanguage;
  if (language) {
    languageService.setLanguage(language);
  }
}

/**
 * Create a language-aware handler wrapper for CQRS.
 * Automatically extracts language from commands/queries before handler execution.
 *
 * @param languageService - The I18nLanguageService instance
 * @param defaultLanguage - Optional fallback language
 * @returns A function that wraps handler execution
 *
 * @example
 * ```typescript
 * @CommandHandler(CreateProductCommand)
 * export class CreateProductHandler implements ICommandHandler<CreateProductCommand> {
 *   private readonly withLanguage: ReturnType<typeof createLanguageHandler>;
 *
 *   constructor(
 *     private readonly languageService: I18nLanguageService,
 *     @InjectI18nRepository(Product)
 *     private readonly productRepo: I18nRepository<Product>,
 *   ) {
 *     this.withLanguage = createLanguageHandler(languageService, 'en');
 *   }
 *
 *   async execute(command: CreateProductCommand) {
 *     return this.withLanguage(command, async () => {
 *       // Language is set for this execution
 *       return this.productRepo.save({ name: command.name });
 *     });
 *   }
 * }
 * ```
 */
export function createLanguageHandler(
  languageService: I18nLanguageService,
  defaultLanguage?: string,
) {
  return async <T extends WithLanguage, R>(
    source: T,
    handler: () => Promise<R>,
  ): Promise<R> => {
    setLanguageFrom(source, languageService, defaultLanguage);
    return handler();
  };
}

/**
 * Base class for language-aware CQRS handlers.
 * Extend this class to automatically handle language extraction.
 *
 * @example
 * ```typescript
 * @CommandHandler(CreateProductCommand)
 * export class CreateProductHandler
 *   extends I18nCommandHandler<CreateProductCommand>
 *   implements ICommandHandler<CreateProductCommand>
 * {
 *   constructor(
 *     languageService: I18nLanguageService,
 *     @InjectI18nRepository(Product)
 *     private readonly productRepo: I18nRepository<Product>,
 *   ) {
 *     super(languageService, 'en'); // default language
 *   }
 *
 *   async handle(command: CreateProductCommand) {
 *     // Language already set from command
 *     return this.productRepo.save({ name: command.name });
 *   }
 *
 *   async execute(command: CreateProductCommand) {
 *     return this.executeWithLanguage(command, () => this.handle(command));
 *   }
 * }
 * ```
 */
export abstract class I18nHandler {
  constructor(
    protected readonly languageService: I18nLanguageService,
    protected readonly defaultLanguage?: string,
  ) {}

  /**
   * Execute a handler with language context from the source.
   */
  protected async executeWithLanguage<T extends WithLanguage, R>(
    source: T,
    handler: () => Promise<R>,
  ): Promise<R> {
    setLanguageFrom(source, this.languageService, this.defaultLanguage);
    return handler();
  }
}

/**
 * Options for the @I18nLanguage decorator
 */
export interface I18nLanguageDecoratorOptions {
  /** Field name containing the language (default: 'language') */
  field?: string;
  /** Default language if not found in command/query */
  defaultLanguage?: string;
}

/**
 * Method decorator that automatically extracts language from the first argument
 * and sets it on the I18nLanguageService before method execution.
 *
 * Requires the class to have an `i18nLanguageService` property (injected via constructor).
 *
 * @param options - Decorator options
 *
 * @example
 * ```typescript
 * // Define command with language
 * class CreateProductCommand implements WithLanguage {
 *   constructor(
 *     public readonly name: string,
 *     public readonly language?: string,
 *   ) {}
 * }
 *
 * @CommandHandler(CreateProductCommand)
 * export class CreateProductHandler implements ICommandHandler<CreateProductCommand> {
 *   constructor(
 *     private readonly i18nLanguageService: I18nLanguageService,
 *     @InjectI18nRepository(Product)
 *     private readonly productRepo: I18nRepository<Product>,
 *   ) {}
 *
 *   @I18nLanguage()
 *   async execute(command: CreateProductCommand) {
 *     // Language is automatically set from command.language
 *     return this.productRepo.save({ name: command.name });
 *   }
 * }
 * ```
 */
export function I18nLanguage(options: I18nLanguageDecoratorOptions = {}): MethodDecorator {
  const { field = 'language', defaultLanguage } = options;

  return function (
    _target: any,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Get the language service from the instance
      const languageService: I18nLanguageService | undefined =
        (this as any).i18nLanguageService ||
        (this as any).languageService ||
        (this as any)._i18nLanguageService;

      if (languageService) {
        // Extract language from first argument (command/query)
        const firstArg = args[0];
        const language = firstArg?.[field] || defaultLanguage;

        if (language) {
          languageService.setLanguage(language);
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Class decorator that automatically applies language extraction to the execute method.
 * Alternative to using @I18nLanguage() on individual methods.
 *
 * @param options - Decorator options
 *
 * @example
 * ```typescript
 * @CommandHandler(CreateProductCommand)
 * @I18nAwareHandler()
 * export class CreateProductHandler implements ICommandHandler<CreateProductCommand> {
 *   constructor(
 *     private readonly i18nLanguageService: I18nLanguageService,
 *     @InjectI18nRepository(Product)
 *     private readonly productRepo: I18nRepository<Product>,
 *   ) {}
 *
 *   async execute(command: CreateProductCommand) {
 *     // Language is automatically set from command.language
 *     return this.productRepo.save({ name: command.name });
 *   }
 * }
 * ```
 */
export function I18nAwareHandler(options: I18nLanguageDecoratorOptions = {}): ClassDecorator {
  return function (target: any) {
    const { field = 'language', defaultLanguage } = options;

    // Wrap the execute method
    const originalExecute = target.prototype.execute;

    if (originalExecute) {
      target.prototype.execute = async function (...args: any[]) {
        const languageService: I18nLanguageService | undefined =
          (this as any).i18nLanguageService ||
          (this as any).languageService ||
          (this as any)._i18nLanguageService;

        if (languageService) {
          const firstArg = args[0];
          const language = firstArg?.[field] || defaultLanguage;

          if (language) {
            languageService.setLanguage(language);
          }
        }

        return originalExecute.apply(this, args);
      };
    }

    return target;
  };
}

/**
 * Property decorator to mark which field contains the language service.
 * Use this if your property name doesn't match the default patterns.
 *
 * @example
 * ```typescript
 * @CommandHandler(CreateProductCommand)
 * export class CreateProductHandler implements ICommandHandler<CreateProductCommand> {
 *   @I18nService()
 *   private readonly myCustomLanguageService: I18nLanguageService;
 *
 *   @I18nLanguage()
 *   async execute(command: CreateProductCommand) {
 *     return this.productRepo.save({ name: command.name });
 *   }
 * }
 * ```
 */
export function I18nService(): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    // Store the property key so decorators know where to find the service
    Reflect.defineMetadata(I18N_LANGUAGE_FIELD_KEY, propertyKey, target.constructor);
  };
}
