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

export KIND_EXPERIMENTAL_PROVIDER=podman

trap 'echo "ERROR: command failed on line $LINENO: $BASH_COMMAND" >&2' ERR

if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
    echo "==> Deleting kind cluster '$CLUSTER_NAME'"
    kind delete cluster --name "$CLUSTER_NAME"
    echo "Removed kind cluster '$CLUSTER_NAME' (containers, node images, and cluster state)."
    echo "Built images localhost/investment-dashboard/backend:dev and localhost/investment-dashboard/frontend:dev were not removed."
else
    echo "Kind cluster '$CLUSTER_NAME' does not exist; nothing to remove."
fi
