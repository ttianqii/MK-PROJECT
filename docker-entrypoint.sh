#!/bin/sh
set -e

# Bring the schema up to date (migrate.mjs retries while MariaDB starts up),
# load the demo data (idempotent), then hand off to the Next.js server.
node migrate.mjs
node seed.mjs
exec node server.js
