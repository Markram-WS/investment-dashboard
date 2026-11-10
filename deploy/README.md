# Deployment

## Layout

- `base/` — environment-agnostic Kubernetes resources: namespace, PostgreSQL main/ai StatefulSets, backend and frontend Deployments and Services. It contains no environment-specific values; secrets are supplied at apply time through the `app-secrets` Secret generated from `base/secrets.env`.
- `overlays/kind/` — dev-only adapter for a local kind cluster running on podman. It pins the `:dev` image tags, sets `imagePullPolicy: IfNotPresent`, exposes the frontend as NodePort `30080` (mapped to host port `8080`), and shrinks Postgres resource requests. It also holds `kind-cluster.yaml`, the kind cluster definition.

Production runs on the existing homelab Kubernetes cluster, which applies this base directly (with its own secret source). This repository ships only the base plus the local dev overlay — there is no production overlay here.

## Usage

```bash
./scripts/kind-up.sh    # create the cluster, build and load images, apply, wait
./scripts/kind-down.sh  # delete the kind cluster
```

`kind-up.sh` uses podman (`KIND_EXPERIMENTAL_PROVIDER=podman`), builds `investment-dashboard/backend:dev` and `investment-dashboard/frontend:dev`, loads them into the kind cluster, and applies `deploy/overlays/kind`. When it finishes, the UI is at <http://localhost:8080>.

On rootless podman, kind requires a delegated systemd scope. Both scripts handle this by re-executing themselves under `systemd-run --user --scope --property=Delegate=yes`; if `systemd-run` is unavailable, the alternative is a `/etc/systemd/system/user@.service.d/delegate.conf` drop-in with `[Service]` `Delegate=yes`. On a checkout located on exFAT (or any filesystem that cannot host the buildah context overlay), `kind-up.sh` stages the build context under `${TMPDIR:-/tmp}` before building. Images are imported with `podman save` + `kind load image-archive` rather than `kind load docker-image`, because podman 6 dropped `RepoTags` from `podman images --format json` and kind 0.33 relies on it.

## Secrets

`deploy/base/secrets.env` is required but gitignored. Create it from the committed template:

```bash
cp deploy/base/secrets.env.example deploy/base/secrets.env
```

Then replace every placeholder with real values. Required keys:

| Key | Purpose |
|-----|---------|
| `POSTGRES_USER` | Main database user |
| `POSTGRES_PASSWORD` | Main database password |
| `POSTGRES_DB` | Main database name |
| `AI_POSTGRES_USER` | AI database user |
| `AI_POSTGRES_PASSWORD` | AI database password |
| `AI_POSTGRES_DB` | AI database name |
| `DATABASE_URL` | Async main DB URL used by the backend (`postgresql+asyncpg://...@postgres-main:5432/...`) |
| `AI_DATABASE_URL` | Async AI DB URL used by the backend (`postgresql+asyncpg://...@postgres-ai:5432/...`) |
| `FERNET_KEY` | Fernet key for encrypting custom-portfolio DB passwords |

Generate a `FERNET_KEY` with:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

`kind-up.sh` copies the example file and exits if `secrets.env` is missing, so it never invents values.
