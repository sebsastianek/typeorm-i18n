# Tests with Real Databases

This directory contains tests that run against **real database instances**: SQLite, PostgreSQL, and MySQL.

## Prerequisites

- Node.js and npm installed
- Docker (optional - only needed for PostgreSQL and MySQL)

## Quick Start

### Option 1: SQLite (No Docker Required) ⚡

The fastest way to run tests:

```bash
npm test
```

SQLite tests run against a real database file (not in-memory), no setup needed!

### Option 2: All Databases (Requires Docker) 🐳

#### 1. Start PostgreSQL and MySQL

```bash
npm run docker:test:up
```

This will start:
- PostgreSQL on port `5433`
- MySQL on port `3307`

#### 2. Wait for databases to be ready

The databases need a few seconds to initialize. You can check their status:

```bash
npm run docker:test:logs
```

Or wait for the health check to pass (about 10-15 seconds).

#### 3. Run tests

```bash
# Run all tests (SQLite, PostgreSQL, MySQL)
npm run test:all

# Or run against specific databases
npm run test:sqlite   # SQLite only (fast, no Docker)
npm run test:pg       # PostgreSQL only
npm run test:mysql    # MySQL only
```

#### 4. Stop databases when done

```bash
npm run docker:test:down
```

## Test Structure

```
tests/
├── entities/              # Test entities
├── fixtures/              # Test data fixtures
├── db-helper.ts           # Database connection helpers
├── setup.ts               # Global test setup
└── full-stack.test.ts     # Main test suite
```

## What's Tested

### 1. Database Schema Generation
- Correct table structure with I18n columns
- Nullable columns for non-default languages
- Column naming conventions (name, name_es, name_fr)

### 2. Complete CRUD Lifecycle
- Create with I18n values
- Read with automatic transformation
- Update translations
- Delete operations
- Full lifecycle test: Create → Read → Update → Delete

### 3. Complex Queries
- WHERE clauses with I18n columns
- Aggregate functions (COUNT, AVG, MAX, MIN)
- Pagination
- Full-text search on translated columns
- QueryBuilder support

### 4. Transactions
- Successful transaction commits
- Transaction rollbacks on errors
- Data consistency within transactions

### 5. Multi-Entity Operations
- Multiple entities with different language sets
- Cross-entity operations

### 6. Binary Data (Buffer) Support (SQLite only)
- Store Buffer values
- Retrieve Buffer values
- Update Buffer values
- Note: Binary tests run only on SQLite due to cross-database type compatibility

### 7. Data Integrity
- Consistency after multiple operations
- No data loss during updates
- Proper handling of null/empty values

### 8. Performance
- Bulk inserts (100+ records)
- Bulk reads (50+ records)
- Query performance with I18n columns

## Configuration

### Environment Variables

You can customize the database connection using environment variables:

```bash
# PostgreSQL
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5433
export POSTGRES_USER=test_user
export POSTGRES_PASSWORD=test_password
export POSTGRES_DB=typeorm_i18n_test

# MySQL
export MYSQL_HOST=localhost
export MYSQL_PORT=3307
export MYSQL_USER=test_user
export MYSQL_PASSWORD=test_password
export MYSQL_DB=typeorm_i18n_test

# Database type (postgres or mysql)
export DB_TYPE=postgres

# Enable query logging
export DEBUG=true
```

### Custom Database

If you want to use your own database instead of Docker:

1. Create a database named `typeorm_i18n_test`
2. Set the appropriate environment variables
3. Run the tests: `npm run test:e2e`

## Troubleshooting

### Database connection fails

```bash
# Check if containers are running
docker ps

# Check container logs
npm run docker:test:logs

# Restart containers
npm run docker:test:down
npm run docker:test:up
```

### Tests timeout

Tests have a 30-second timeout. If tests fail with timeout errors:

1. Check database is running: `docker ps`
2. Check database health: `npm run docker:test:logs`
3. Increase timeout in `jest.config.js` if needed

### Permission errors

```bash
# Clean up volumes and restart
npm run docker:test:down
docker volume prune
npm run docker:test:up
```

## CI/CD Integration

For CI/CD pipelines, you can use this workflow:

```bash
# Start databases
npm run docker:test:up

# Wait for databases to be ready
sleep 15

# Run tests
npm test

# Cleanup
npm run docker:test:down
```

Or use the provided wait mechanism in the tests:

```typescript
import { waitForDatabase } from './db-helper';

beforeAll(async () => {
  await waitForDatabase(); // Automatically waits for DB
  // ... rest of setup
});
```

## Performance Benchmarks

Expected performance (on a modern laptop):

- Bulk insert 100 products: < 500ms
- Bulk read 50 products: < 100ms
- Single CRUD cycle: < 50ms
- Transaction commit: < 100ms

## Comparing Databases

Run tests against all databases to ensure compatibility:

```bash
# SQLite (fastest)
npm run test:sqlite

# PostgreSQL
npm run test:pg

# MySQL
npm run test:mysql

# All three
npm run test:all
```

All should pass their tests, demonstrating full cross-database compatibility.
