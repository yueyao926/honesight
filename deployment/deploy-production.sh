#!/usr/bin/env bash
set -Eeuo pipefail

release_sha="${1:?release SHA is required}"
if [[ ! "$release_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid release SHA: $release_sha" >&2
  exit 2
fi

app_dir="$HOME/lenscoach"
release_dir="$app_dir/releases/$release_sha"
compose_file="$release_dir/docker-compose.yml"
env_file="$app_dir/.env"
rollback_tag="rollback"

cd "$release_dir"
sha256sum --check SHA256SUMS
test -s "$env_file"
chmod 600 "$env_file"

compose() {
  IMAGE_TAG="$1" PORT=80 docker compose \
    --project-name lenscoach \
    --env-file "$env_file" \
    --file "$compose_file" \
    "${@:2}"
}

compose "$release_sha" config --quiet

previous_backend="$(docker inspect --format '{{.Image}}' lenscoach-backend-1 2>/dev/null || true)"
previous_frontend="$(docker inspect --format '{{.Image}}' lenscoach-frontend-1 2>/dev/null || true)"
dependency_cache_tag="lenscoach-backend:dependency-cache"

if [[ -n "$previous_backend" ]] && docker run --rm \
  --volume "$release_dir/backend/requirements.txt:/tmp/requirements.txt:ro" \
  --entrypoint python \
  "$previous_backend" \
  -m pip install --dry-run --no-index -r /tmp/requirements.txt >/dev/null; then
  echo "Reusing the verified production Python dependency layer"
  docker tag "$previous_backend" "$dependency_cache_tag"
  docker build \
    --build-arg "BASE_IMAGE=$dependency_cache_tag" \
    --file "$release_dir/backend/Dockerfile.cached" \
    --tag "lenscoach-backend:$release_sha" \
    "$release_dir/backend"
else
  echo "Production dependencies do not satisfy this release; running a full backend build"
  compose "$release_sha" build backend
fi

compose "$release_sha" build frontend

if [[ -n "$previous_backend" ]]; then
  docker tag "$previous_backend" "lenscoach-backend:$rollback_tag"
fi
if [[ -n "$previous_frontend" ]]; then
  docker tag "$previous_frontend" "lenscoach-frontend:$rollback_tag"
fi

rollback() {
  if [[ -z "$previous_backend" || -z "$previous_frontend" ]]; then
    echo "No complete previous release is available for rollback" >&2
    return 1
  fi
  echo "Rolling back to the previous application images" >&2
  compose "$rollback_tag" up -d --no-build --force-recreate
}

if ! compose "$release_sha" up -d --no-build --remove-orphans; then
  rollback || true
  exit 1
fi

healthy=0
for _ in $(seq 1 90); do
  backend_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' lenscoach-backend-1 2>/dev/null || true)"
  if [[ "$backend_health" == "healthy" ]] && curl --fail --silent --show-error http://127.0.0.1/health >/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done

if [[ "$healthy" -ne 1 ]]; then
  echo "Release failed its health check" >&2
  compose "$release_sha" logs --tail 150 backend frontend >&2 || true
  rollback || true
  exit 1
fi

printf '%s\n' "$release_sha" > "$app_dir/.deployed-sha"
compose "$release_sha" ps
docker image prune --force --filter 'until=168h' >/dev/null
