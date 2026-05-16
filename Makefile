.PHONY: help up down logs migrate seed reset-db test test-int e2e audit typecheck lint clean

help: ## List all available make targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

up: ## Start all services (db + backend + frontend)
	docker compose up -d

down: ## Stop all services
	docker compose down

logs: ## Tail backend + frontend logs
	docker compose logs -f backend frontend

migrate: ## Run pending migrations against the dev DB
	docker compose exec backend node dist/core/db/migrate.js

seed: ## Run the Node seeder against the dev DB
	docker compose exec backend node dist/core/db/seed.js

reset-db: ## Drop and recreate the dev DB volume (prompts for confirmation)
	@read -p "This will destroy all dev data. Continue? [y/N] " ans && [ "$$ans" = "y" ] || exit 1
	docker compose down -v
	docker compose up -d db

test: ## Run unit + component tests across all workspaces (no DB required)
	npm test

test-int: ## Run integration tests against a temporary test DB
	docker compose -f docker-compose.test.yml up -d db-test
	@echo "Waiting for test DB…"
	@until docker compose -f docker-compose.test.yml exec db-test pg_isready -U mdm_test -d mdmsystems_test 2>/dev/null; do sleep 1; done
	npm run test:integration --workspaces --if-present; EXIT=$$?; \
	docker compose -f docker-compose.test.yml down; \
	exit $$EXIT

e2e: ## Run Playwright golden-path E2E spec (spins up test stack)
	docker compose -f docker-compose.test.yml up -d db-test
	@until docker compose -f docker-compose.test.yml exec db-test pg_isready -U mdm_test -d mdmsystems_test 2>/dev/null; do sleep 1; done
	npm run test -w e2e; EXIT=$$?; \
	docker compose -f docker-compose.test.yml down; \
	exit $$EXIT

audit: ## Check for high-severity npm vulnerabilities across all workspaces
	npm audit --audit-level=high --workspaces

typecheck: ## Run tsc --noEmit across all workspaces
	npm run typecheck --workspaces --if-present

lint: ## Run ESLint across all workspaces
	npm run lint

clean: ## Remove node_modules, dist, and coverage directories
	find . -name "node_modules" -type d -not -path "*/.git/*" -prune -exec rm -rf '{}' +
	find . -name "dist" -type d -not -path "*/.git/*" -prune -exec rm -rf '{}' +
	find . -name "coverage" -type d -not -path "*/.git/*" -prune -exec rm -rf '{}' +
