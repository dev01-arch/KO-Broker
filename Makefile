# KO Broker Platform — Makefile
# Convenience targets for common development tasks

.PHONY: dev build lint typecheck format db-push db-seed db-studio clean install

# ── Development ──
dev:
	pnpm dev

install:
	pnpm install

# ── Build & Quality ──
build:
	pnpm build

lint:
	pnpm lint

typecheck:
	pnpm typecheck

format:
	pnpm format

# ── Database ──
db-generate:
	pnpm db:generate

db-push:
	pnpm db:push

db-seed:
	pnpm db:seed

db-migrate:
	pnpm db:migrate

db-studio:
	pnpm --filter @ko/db studio

# ── Docker ──
docker-up:
	docker compose -f docker/docker-compose.yml up -d

docker-down:
	docker compose -f docker/docker-compose.yml down

# ── Cleanup ──
clean:
	pnpm clean
	rm -rf node_modules
