#!/usr/bin/env bash
# Keeps the encrypted subscriber list (subscribers.enc.json) on the repo's `alerts-state` branch.
#   state-branch.sh load <dir>   clone the branch into <dir>, or start a new one there if it doesn't exist
#   state-branch.sh save <dir>   commit and push <dir>/subscribers.enc.json if it changed
# REMOTE_URL is the git remote to use (the workflow passes the repo URL with its GITHUB_TOKEN).
set -euo pipefail

cmd="${1:?load|save}"
dir="${2:?directory}"
branch="${STATE_BRANCH:-alerts-state}"
remote="${REMOTE_URL:?REMOTE_URL is required}"
file="subscribers.enc.json"

git_id=(-c user.name="mora-alerts" -c user.email="mora-alerts@users.noreply.github.com")

case "$cmd" in
  load)
    rm -rf "$dir"
    if git ls-remote --exit-code --heads "$remote" "$branch" >/dev/null 2>&1; then
      git clone --quiet --depth 1 --single-branch --branch "$branch" "$remote" "$dir"
      echo "loaded $branch ($(git -C "$dir" log -1 --format=%h))"
    else
      mkdir -p "$dir"
      git -C "$dir" init --quiet --initial-branch "$branch"
      git -C "$dir" remote add origin "$remote"
      cat > "$dir/README.md" <<'EOF'
# alerts-state

Written by the Guardian alerts workflow. `subscribers.enc.json` is the list of who watches which vault,
encrypted with AES-256-GCM using a key derived from the bot token. It can't be read without that secret.
Don't edit this branch by hand.
EOF
      echo "no $branch branch yet; starting a new one"
    fi
    ;;
  save)
    if [ ! -f "$dir/$file" ]; then
      echo "nothing to save"
      exit 0
    fi
    git -C "$dir" add -A
    if git -C "$dir" diff --cached --quiet; then
      echo "subscribers unchanged"
      exit 0
    fi
    git -C "$dir" "${git_id[@]}" commit --quiet -m "Update encrypted alert subscriptions"
    for attempt in 1 2 3; do
      if git -C "$dir" push --quiet origin "HEAD:refs/heads/$branch"; then
        echo "saved $branch ($(git -C "$dir" log -1 --format=%h))"
        exit 0
      fi
      sleep $((attempt * 3))
    done
    echo "::error::Could not push the $branch branch; the Actions cache still holds this run's subscribers."
    exit 1
    ;;
  *)
    echo "usage: $0 load|save <dir>" >&2
    exit 2
    ;;
esac
