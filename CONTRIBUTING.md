# Contributing to Anvil Node.js Client

## Development Setup

Install dependencies:

```sh
yarn install
```

## Running Tests

```sh
yarn test

# Watch mode
yarn test:watch
```

## Building

Building with babel will output in the `/lib` directory:

```sh
yarn build
```

## Integration Testing

The integration test script (`scripts/integration-test.js`) runs a suite of tests against a live Anvil environment. By default it targets the staging environment.

### Running Integration Tests

```sh
ANVIL_API_KEY=your_key node scripts/integration-test.js
```

You can target a different environment by setting `ANVIL_BASE_URL`:

```sh
ANVIL_API_KEY=your_key ANVIL_BASE_URL=https://staging.useanvil.com node scripts/integration-test.js
```

The default base URL is `https://staging.useanvil.com`.

### baseURL Configuration for Staging

When working with the staging environment, configure the client with:

```js
const client = new Anvil({
  apiKey: 'your-api-key',
  baseURL: 'https://staging.useanvil.com',
})
```

## CI/CD

**PR Workflow:** Runs lint and tests on every pull request.

**Publish Workflow:** Publishes to npm on merge to main.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | npm authentication token for publishing |
| `ANTHROPIC_API_KEY` | Anthropic API key for changelog generation |
| `PUBLISH_PAT` | Personal access token with `contents: write` — needed to push the changelog commit and create GitHub Releases when branch protection is enabled. Falls back to `GITHUB_TOKEN` if not set (will fail if branch protection requires PR reviews). |

## Changelog Generation

The publish workflow automatically generates a changelog entry before publishing.
You can also run it manually:

```sh
node scripts/generate-changelog.js <version>
```

The script:
- If `CHANGELOG.md` has an `[Unreleased]` section with content, it stamps it
  with the given version and today's date.
- If there's no `[Unreleased]` content, it reads the git log since the last
  tag and uses Claude to generate an entry.
- A fresh empty `[Unreleased]` section is added above the new entry.

## Publishing

Publishing is tag-based. Merging to `main` does not publish — only pushing a
version tag triggers a release.

1. Bump the version in `package.json` in a PR and merge to `main`.
2. Create and push a tag **from the main branch** matching the version:
   ```sh
   git checkout main && git pull
   git tag v3.4.0
   git push origin v3.4.0
   ```
3. The publish workflow will:
   - Verify the tag is on the `main` branch (rejects tags on other branches)
   - Verify the tag matches `package.json` (fails if they differ)
   - Run lint and tests
   - Generate a changelog entry and auto-commit it to `main`
   - Validate the package with `npm pack --dry-run`
   - Publish to npm with `--provenance` for supply chain attestation
   - Create a GitHub Release with the changelog as release notes

### Pre-release versions

Tags like `v1.2.3-alpha.1` or `v1.2.3-beta.0` are detected as pre-releases.
They publish to npm under the `next` tag (instead of `latest`) and the GitHub
Release is marked as a pre-release.

### Tag format

Only tags matching `v<major>.<minor>.<patch>` trigger the workflow (e.g.,
`v3.4.0`, `v3.4.0-alpha.1`). Tags like `latest` or `release` are ignored.
