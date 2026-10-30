#!/usr/bin/env bash
# Rebuilds the "publish" folder from src/ArtisanSite on macOS or Linux (same result as Publish-Site.ps1).
# Needs the .NET 10 SDK.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

dotnet publish "$root/src/ArtisanSite/ArtisanSite.csproj" -c Release -r win-x64 --self-contained false -o "$staging"

mkdir -p "$root/publish"
# Mirror the build, keeping files the server creates (certificate checks, logs, app_offline.htm).
find "$root/publish" -mindepth 1 -maxdepth 1 ! -name '.well-known' ! -name 'logs' ! -name 'app_offline.htm' -exec rm -rf {} +
cp -R "$staging"/. "$root/publish/"
echo "publish folder updated. Commit src and publish together."
