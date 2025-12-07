import { DataSource, DataSourceOptions } from 'typeorm';
import { I18nSubscriber } from '../src';

export type DatabaseType = 'postgres' | 'mysql' | 'sqlite';

/**
 * Get database configuration based on environment or type parameter
 */
export function getDatabaseConfig(dbType?: DatabaseType): DataSourceOptions {
  const type = dbType || (process.env.DB_TYPE as DatabaseType) || 'sqlite';

  const baseConfig = {
    synchronize: true,
    logging: process.env.DEBUG === 'true',
    subscribers: [I18nSubscriber],
  };

  if (type === 'sqlite') {
    return {
      ...baseConfig,
      type: 'better-sqlite3',
      database: process.env.SQLITE_DB || './test.db',
      dropSchema: true, // Clean database on each run
    } as DataSourceOptions;
  } else if (type === 'postgres') {
    return {
      ...baseConfig,
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5433'),
      username: process.env.POSTGRES_USER || 'test_user',
      password: process.env.POSTGRES_PASSWORD || 'test_password',
      database: process.env.POSTGRES_DB || 'typeorm_i18n_test',
    } as DataSourceOptions;
  } else if (type === 'mysql') {
    return {
      ...baseConfig,
      type: 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3307'),
      username: process.env.MYSQL_USER || 'test_user',
      password: process.env.MYSQL_PASSWORD || 'test_password',
      database: process.env.MYSQL_DB || 'typeorm_i18n_test',
    } as DataSourceOptions;
  }

  throw new Error(`Unsupported database type: ${type}`);
}

/**
 * Creates a real database connection for testing
 */
export async function createE2EDataSource(
  entities: Function[],
  dbType?: DatabaseType
): Promise<DataSource> {
  const config = getDatabaseConfig(dbType);
  const dataSource = new DataSource({
    ...config,
    entities,
  });

  try {
    await dataSource.initialize();
    return dataSource;
  } catch (error) {
    throw error;
  }
}

/**
 * Closes the database connection
 */
export async function closeE2EDataSource(dataSource: DataSource): Promise<void> {
  if (dataSource && dataSource.isInitialized) {
    await dataSource.destroy();
  }
}

/**
 * Cleans all tables in the database
 */
export async function cleanDatabase(dataSource: DataSource): Promise<void> {
  const entities = dataSource.entityMetadatas;

  for (const entity of entities) {
    const repository = dataSource.getRepository(entity.name);
    await repository.query(`DELETE FROM ${entity.tableName}`);
  }
}

/**
 * Seeds the database with fixture data
 */
export async function seedDatabase<T extends object>(
  dataSource: DataSource,
  entity: { new (): T },
  fixtures: Partial<T>[]
): Promise<T[]> {
  const repository = dataSource.getRepository(entity);
  // Use Object.assign to ensure virtual properties (like nameTranslations) are copied
  // TypeORM's create() only copies column properties
  const entities = fixtures.map((fixture) => {
    const created = repository.create();
    Object.assign(created, fixture);
    return created;
  });
  const saved = await repository.save(entities as any);
  return saved as T[];
}

/**
 * Waits for database to be ready
 */
export async function waitForDatabase(
  maxRetries: number = 30,
  retryDelay: number = 1000
): Promise<void> {
  const config = getDatabaseConfig();

  // SQLite doesn't need to wait - it's always ready
  if (config.type === 'better-sqlite3') {
    return;
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      const dataSource = new DataSource(config as DataSourceOptions);
      await dataSource.initialize();
      await dataSource.destroy();
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Database not ready after ${maxRetries} attempts`);
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}
