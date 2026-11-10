#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Rootless podman requires a delegated systemd scope; re-exec inside one.
if [ -z "${KIND_IN_DELEGATED_SCOPE:-}" ] && [ "$(id -u)" -ne 0 ]; then
    export KIND_IN_DELEGATED_SCOPE=1
    if command -v systemd-run >/dev/null 2>&1; then
        exec systemd-run --user --scope --quiet --collect --property=Delegate=yes -- "$0" "$@"
    fi
    echo "ERROR: rootless kind needs a delegated systemd scope and systemd-run is missing." >&2
    echo "       Either install systemd, or create /etc/systemd/system/user@.service.d/delegate.conf with [Service] Delegate=yes" >&2
    exit 1
fi

CLUSTER_NAME="investment-dashboard"
KIND_CONFIG="deploy/overlays/kind/kind-cluster.yaml"
SECRETS_FILE="deploy/base/secrets.env"
SECRETS_EXAMPLE="deploy/base/secrets.env.example"

trap 'echo "ERROR: command failed on line $LINENO: $BASH_COMMAND" >&2' ERR

cleanup_image_tars() {
    rm -f "${TMPDIR:-/tmp}"/kind-image-*.tar
}
trap 'status=$?; cleanup_image_tars; exit $status' EXIT

echo "==> Checking required tools"
missing=()
for tool in podman kind kubectl; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        missing+=("$tool")
    fi
done
if [ "${#missing[@]}" -gt 0 ]; then
    echo "ERROR: missing required tool(s): ${missing[*]}" >&2
    echo "Install with: pacman -S kind kubectl kustomize" >&2
    echo "or download user-local binaries from:" >&2
    echo "  https://kind.sigs.k8s.io/docs/user/quick-start/#installation" >&2
    echo "  https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/" >&2
    exit 1
fi

export KIND_EXPERIMENTAL_PROVIDER=podman
echo "==> Using podman as the kind provider (KIND_EXPERIMENTAL_PROVIDER=podman)"

# buildah mounts an overlay over the build context; exFAT cannot host one.
# Stage the context on a native filesystem when that is the case.
stage_context() {
    local src="$1" name="$2" fs dst
    fs="$(stat -f -c %T "$src" 2>/dev/null || echo unknown)"
    if [ "$fs" != "exfat" ]; then
        printf '%s\n' "$src"
        return 0
    fi
    dst="${TMPDIR:-/tmp}/kind-build-$name"
    rm -rf "$dst"
    mkdir -p "$dst"
    tar -C "$src" --exclude=node_modules --exclude=dist --exclude=.git -cf - . | tar -C "$dst" -xf -
    printf '%s\n' "$dst"
}

load_image() {
    local ref="$1"
    local tar="${TMPDIR:-/tmp}/kind-image-$(printf '%s' "$ref" | tr '/:' '__').tar"
    echo "==> Loading $ref into kind cluster '$CLUSTER_NAME'"
    podman save -q -o "$tar" "$ref"
    kind load image-archive --name "$CLUSTER_NAME" "$tar"
    rm -f "$tar"
}

echo "==> Checking $SECRETS_FILE"
if [ ! -f "$SECRETS_FILE" ]; then
    cp "$SECRETS_EXAMPLE" "$SECRETS_FILE"
    echo "ERROR: $SECRETS_FILE was missing." >&2
    echo "A template was copied from $SECRETS_EXAMPLE." >&2
    echo "Fill in real values in $SECRETS_FILE and run this script again." >&2
    exit 1
fi

echo "==> Ensuring kind cluster '$CLUSTER_NAME' exists"
if ! kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
    echo "Cluster not found; creating it from $KIND_CONFIG"
    kind create cluster --name "$CLUSTER_NAME" --config "$KIND_CONFIG"
else
    echo "Cluster '$CLUSTER_NAME' already exists"
fi

echo "==> Building backend image localhost/investment-dashboard/backend:dev"
BACKEND_CTX="$(stage_context backend backend)"
podman build -t localhost/investment-dashboard/backend:dev "$BACKEND_CTX"

echo "==> Building frontend image localhost/investment-dashboard/frontend:dev"
FRONTEND_CTX="$(stage_context frontend frontend)"
podman build -t localhost/investment-dashboard/frontend:dev "$FRONTEND_CTX"

echo "==> Loading images into kind cluster '$CLUSTER_NAME'"
load_image localhost/investment-dashboard/backend:dev
load_image localhost/investment-dashboard/frontend:dev

echo "==> Verifying images are present in cluster node"
NODE_NAME="$(kind get nodes --name "$CLUSTER_NAME" | head -n 1)"
for image in localhost/investment-dashboard/backend:dev localhost/investment-dashboard/frontend:dev; do
    if ! podman exec "$NODE_NAME" crictl images --quiet "$image" | grep -q .; then
        echo "ERROR: image $image is missing from cluster node $NODE_NAME after image import." >&2
        exit 1
    fi
done

echo "==> Applying kustomize overlay deploy/overlays/kind"
kubectl apply -k deploy/overlays/kind

echo "==> Waiting for postgres-main"
kubectl -n investment-dashboard wait --for=condition=Ready pod/postgres-main-0 --timeout=180s

echo "==> Waiting for backend rollout"
kubectl -n investment-dashboard rollout status deployment/backend --timeout=300s

echo "==> Waiting for frontend rollout"
kubectl -n investment-dashboard rollout status deployment/frontend --timeout=300s

echo ""
echo "==> Done"
echo "UI:            http://localhost:8080"
echo "Backend API:   kubectl -n investment-dashboard port-forward svc/backend 8000:8000"
