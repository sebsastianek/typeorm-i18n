/**
 * Microservices integration for typeorm-i18n.
 *
 * Provides utilities for extracting language from message payloads and metadata
 * across different transport layers (Redis, RabbitMQ, Kafka, gRPC, etc.).
 */

import { I18nLanguageService } from './i18n-language.service';
import { I18nRepository } from '../repository';

// Re-export WithLanguage for convenience
export { WithLanguage } from './cqrs';

/**
 * Message context that may contain language in metadata.
 * Compatible with NestJS microservice context objects.
 */
export interface MessageContext {
  getMessage?: () => any;
  getPattern?: () => string | object;
  getArgs?: () => any[];
  getArgByIndex?: (index: number) => any;
  // Kafka-specific
  getPartition?: () => number;
  getTopic?: () => string;
  // RabbitMQ-specific
  getChannelRef?: () => any;
  // Generic metadata
  [key: string]: any;
}

/**
 * Options for extracting language from microservice messages.
 */
export interface MessageLanguageOptions {
  /** Field name in the message payload (default: 'language') */
  payloadField?: string;
  /** Field name in message headers/metadata (default: 'x-language') */
  headerField?: string;
  /** Default language if not found */
  defaultLanguage?: string;
}

/**
 * Extract language from a microservice message payload.
 *
 * @param payload - The message payload
 * @param options - Extraction options
 * @returns The extracted language or null
 *
 * @example
 * ```typescript
 * @MessagePattern('product.create')
 * async handleCreateProduct(@Payload() data: CreateProductMessage) {
 *   const language = extractLanguageFromPayload(data);
 *   this.productRepo.setLanguage(language || 'en');
 *   return this.productRepo.save(data);
 * }
 * ```
 */
export function extractLanguageFromPayload(
  payload: any,
  options: MessageLanguageOptions = {},
): string | null {
  const { payloadField = 'language' } = options;

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return payload[payloadField] || null;
}

/**
 * Extract language from Kafka message headers.
 *
 * @param context - The Kafka context
 * @param headerField - Header field name (default: 'x-language')
 * @returns The extracted language or null
 *
 * @example
 * ```typescript
 * @MessagePattern('product.create')
 * async handleCreateProduct(
 *   @Payload() data: CreateProductMessage,
 *   @Ctx() context: KafkaContext,
 * ) {
 *   const language = extractLanguageFromKafka(context);
 *   this.productRepo.setLanguage(language || 'en');
 *   return this.productRepo.save(data);
 * }
 * ```
 */
export function extractLanguageFromKafka(
  context: any,
  headerField: string = 'x-language',
): string | null {
  try {
    const message = context.getMessage?.();
    if (!message?.headers) return null;

    const header = message.headers[headerField];
    if (!header) return null;

    // Kafka headers can be Buffer or string
    return Buffer.isBuffer(header) ? header.toString() : String(header);
  } catch {
    return null;
  }
}

/**
 * Extract language from RabbitMQ message properties.
 *
 * @param context - The RabbitMQ context
 * @param headerField - Header field name (default: 'x-language')
 * @returns The extracted language or null
 *
 * @example
 * ```typescript
 * @MessagePattern('product.create')
 * async handleCreateProduct(
 *   @Payload() data: CreateProductMessage,
 *   @Ctx() context: RmqContext,
 * ) {
 *   const language = extractLanguageFromRabbitMQ(context);
 *   this.productRepo.setLanguage(language || 'en');
 *   return this.productRepo.save(data);
 * }
 * ```
 */
export function extractLanguageFromRabbitMQ(
  context: any,
  headerField: string = 'x-language',
): string | null {
  try {
    const message = context.getMessage?.();
    if (!message?.properties?.headers) return null;

    return message.properties.headers[headerField] || null;
  } catch {
    return null;
  }
}

/**
 * Extract language from Redis message (from payload since Redis doesn't have headers).
 *
 * @param payload - The message payload
 * @param payloadField - Field name in payload (default: 'language')
 * @returns The extracted language or null
 */
export function extractLanguageFromRedis(
  payload: any,
  payloadField: string = 'language',
): string | null {
  return extractLanguageFromPayload(payload, { payloadField });
}

/**
 * Extract language from gRPC metadata.
 *
 * @param context - The gRPC context
 * @param metadataKey - Metadata key (default: 'x-language')
 * @returns The extracted language or null
 *
 * @example
 * ```typescript
 * @GrpcMethod('ProductService', 'CreateProduct')
 * async createProduct(
 *   data: CreateProductRequest,
 *   metadata: Metadata,
 * ) {
 *   const language = extractLanguageFromGrpc(metadata);
 *   this.productRepo.setLanguage(language || 'en');
 *   return this.productRepo.save(data);
 * }
 * ```
 */
export function extractLanguageFromGrpc(
  metadata: any,
  metadataKey: string = 'x-language',
): string | null {
  try {
    if (!metadata?.get) return null;

    const values = metadata.get(metadataKey);
    return values?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Universal language extractor for microservices.
 * Attempts to extract language from various sources.
 *
 * @param payload - The message payload
 * @param context - The message context (optional)
 * @param options - Extraction options
 * @returns The extracted language or default
 *
 * @example
 * ```typescript
 * @MessagePattern('product.create')
 * async handleCreateProduct(
 *   @Payload() data: CreateProductMessage,
 *   @Ctx() context: any,
 * ) {
 *   const language = extractLanguage(data, context, { defaultLanguage: 'en' });
 *   this.productRepo.setLanguage(language);
 *   return this.productRepo.save(data);
 * }
 * ```
 */
export function extractLanguage(
  payload: any,
  context?: any,
  options: MessageLanguageOptions = {},
): string {
  const { defaultLanguage = 'en' } = options;

  // Try payload first
  const fromPayload = extractLanguageFromPayload(payload, options);
  if (fromPayload) return fromPayload;

  // No context, return default
  if (!context) return defaultLanguage;

  // Try Kafka
  const fromKafka = extractLanguageFromKafka(context, options.headerField);
  if (fromKafka) return fromKafka;

  // Try RabbitMQ
  const fromRabbitMQ = extractLanguageFromRabbitMQ(context, options.headerField);
  if (fromRabbitMQ) return fromRabbitMQ;

  // Try gRPC (if context is Metadata)
  const fromGrpc = extractLanguageFromGrpc(context, options.headerField);
  if (fromGrpc) return fromGrpc;

  return defaultLanguage;
}

/**
 * Apply language from a message to a repository.
 *
 * @param payload - The message payload
 * @param repo - The I18nRepository to configure
 * @param context - Optional message context for header-based extraction
 * @param options - Extraction options
 * @returns The repository with language set
 *
 * @example
 * ```typescript
 * @MessagePattern('product.create')
 * async handleCreateProduct(
 *   @Payload() data: CreateProductMessage,
 *   @Ctx() context: any,
 * ) {
 *   withMessageLanguage(data, this.productRepo, context);
 *   return this.productRepo.save(data);
 * }
 * ```
 */
export function withMessageLanguage<E extends object>(
  payload: any,
  repo: I18nRepository<E>,
  context?: any,
  options: MessageLanguageOptions = {},
): I18nRepository<E> {
  const language = extractLanguage(payload, context, options);
  repo.setLanguage(language);
  return repo;
}

/**
 * Apply language from a message to the language service.
 * Useful when using multiple repositories.
 *
 * @param payload - The message payload
 * @param languageService - The I18nLanguageService instance
 * @param context - Optional message context for header-based extraction
 * @param options - Extraction options
 *
 * @example
 * ```typescript
 * @MessagePattern('order.create')
 * async handleCreateOrder(
 *   @Payload() data: CreateOrderMessage,
 *   @Ctx() context: any,
 * ) {
 *   applyMessageLanguage(data, this.languageService, context);
 *   // Both repos now use the message's language
 *   const product = await this.productRepo.findOne({ where: { id: data.productId } });
 *   return this.orderRepo.save({ product, quantity: data.quantity });
 * }
 * ```
 */
export function applyMessageLanguage(
  payload: any,
  languageService: I18nLanguageService,
  context?: any,
  options: MessageLanguageOptions = {},
): void {
  const language = extractLanguage(payload, context, options);
  languageService.setLanguage(language);
}
