# Deploy Scripts

These are server-side operational scripts used on the production host at `/opt/scripts/`.

## Files

- `photo-deploy.sh` — Production deploy with PM2 reload (zero-downtime), multi-layer health check, rollback on failure
- `photo-rollback.sh` — Rollback to previous release using current/previous symlink chain

## Usage

These scripts run on the production server, not in CI. They manage the fangc.cc photo site via PM2 + symlink architecture.

Do not confuse with `docker-compose.*.yml` files in the repository root — those are for container-based deployment and not currently used in production.
