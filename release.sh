#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e 

# Accept bump type from arguments (patch, minor, major). Default is "patch".
BUMP_TYPE=${1:-patch} 

# Validate input
if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "❌ Error: Invalid release type."
  echo "Usage: ./release.sh [patch | minor | major]"
  exit 1
fi

# Ensure the git working directory is clean before releasing
if [[ -n $(git status -s) ]]; then
  echo "❌ Error: Your git working directory is not clean."
  echo "Please commit or stash your changes before creating a release."
  exit 1
fi

echo "🚀 Starting $BUMP_TYPE release..."

# 1. Bump the version in package.json
# Using --no-git-tag-version stops npm from doing the git stuff automatically, 
# giving us full control over the commit and tag process.
NEW_VERSION=$(npm version $BUMP_TYPE --no-git-tag-version)

echo "📦 Version bumped to $NEW_VERSION"

# 2. Stage the package files
git add package.json
if [ -f "package-lock.json" ]; then
  git add package-lock.json
fi
if [ -f "yarn.lock" ]; then
  git add yarn.lock
fi

# 3. Create the release commit
COMMIT_MSG="chore(release): bump version to $NEW_VERSION"
git commit -m "$COMMIT_MSG"

# 4. Create the annotated git tag
# NEW_VERSION already includes the "v" prefix (e.g., v1.0.1)
git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION"

echo "✅ Successfully committed and tagged $NEW_VERSION"

git push origin HEAD --tags

echo "✅ Puched and Triggered Release of $NEW_VERSION"