#!/bin/bash

set -e

echo "🚀 Starting Test Suite with Real Databases"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Run SQLite tests first (no Docker needed)
echo -e "${YELLOW}🧪 Running tests against SQLite...${NC}"
echo "=============================================="
DB_TYPE=sqlite npm test

SQLITE_EXIT_CODE=$?

if [ $SQLITE_EXIT_CODE -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ SQLite tests passed!${NC}"
else
  echo ""
  echo -e "${RED}❌ SQLite tests failed${NC}"
fi

# Check if Docker is running for PostgreSQL/MySQL tests
if ! docker info > /dev/null 2>&1; then
  echo ""
  echo -e "${YELLOW}⚠️  Docker is not running - skipping PostgreSQL and MySQL tests${NC}"
  echo "To run all tests, start Docker and run this script again"
  exit $SQLITE_EXIT_CODE
fi

echo ""
echo -e "${GREEN}✓${NC} Docker is running"

# Detect Docker Compose command
if docker compose version > /dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
  echo -e "${GREEN}✓${NC} Using Docker Compose V2"
elif command -v docker-compose > /dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
  echo -e "${GREEN}✓${NC} Using Docker Compose V1"
else
  echo -e "${RED}❌ Error: Docker Compose not found${NC}"
  echo "Please install Docker Compose and try again"
  exit 1
fi

# Start databases
echo ""
echo -e "${YELLOW}📦 Starting test databases...${NC}"
$DOCKER_COMPOSE -f docker-compose.test.yml up -d

# Wait for databases to be ready
echo ""
echo -e "${YELLOW}⏳ Waiting for databases to be ready...${NC}"
sleep 5

# Check if PostgreSQL is ready
echo "Checking PostgreSQL..."
for i in {1..30}; do
  if docker exec typeorm-i18n-test-db pg_isready -U test_user -d typeorm_i18n_test > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} PostgreSQL is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ PostgreSQL failed to start${NC}"
    docker logs typeorm-i18n-test-db
    exit 1
  fi
  sleep 1
done

# Check if MySQL is ready
echo "Checking MySQL..."
for i in {1..30}; do
  if docker exec typeorm-i18n-test-mysql mysqladmin ping -h localhost -u test_user -ptest_password > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} MySQL is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ MySQL failed to start${NC}"
    docker logs typeorm-i18n-test-mysql
    exit 1
  fi
  sleep 1
done

# Run tests against PostgreSQL
echo ""
echo -e "${YELLOW}🧪 Running tests against PostgreSQL...${NC}"
echo "=============================================="
DB_TYPE=postgres npm test

PG_EXIT_CODE=$?

if [ $PG_EXIT_CODE -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ PostgreSQL tests passed!${NC}"
else
  echo ""
  echo -e "${RED}❌ PostgreSQL tests failed${NC}"
fi

# Run tests against MySQL
echo ""
echo -e "${YELLOW}🧪 Running tests against MySQL...${NC}"
echo "=============================================="
DB_TYPE=mysql npm test

MYSQL_EXIT_CODE=$?

if [ $MYSQL_EXIT_CODE -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ MySQL tests passed!${NC}"
else
  echo ""
  echo -e "${RED}❌ MySQL tests failed${NC}"
fi

# Cleanup
echo ""
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
$DOCKER_COMPOSE -f docker-compose.test.yml down -v

# Final report
echo ""
echo "=============================================="
echo -e "${YELLOW}📊 Test Results${NC}"
echo "=============================================="

if [ $SQLITE_EXIT_CODE -eq 0 ]; then
  echo -e "SQLite:     ${GREEN}✓ PASSED${NC}"
else
  echo -e "SQLite:     ${RED}❌ FAILED${NC}"
fi

if [ $PG_EXIT_CODE -eq 0 ]; then
  echo -e "PostgreSQL: ${GREEN}✓ PASSED${NC}"
else
  echo -e "PostgreSQL: ${RED}❌ FAILED${NC}"
fi

if [ $MYSQL_EXIT_CODE -eq 0 ]; then
  echo -e "MySQL:      ${GREEN}✓ PASSED${NC}"
else
  echo -e "MySQL:      ${RED}❌ FAILED${NC}"
fi

echo ""

# Exit with error if any tests failed
if [ $SQLITE_EXIT_CODE -ne 0 ] || [ $PG_EXIT_CODE -ne 0 ] || [ $MYSQL_EXIT_CODE -ne 0 ]; then
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
fi
