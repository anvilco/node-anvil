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

## Publishing Guidelines

- All PRs must pass lint and test checks before merging.
- Publishing to npm is triggered automatically when changes are merged to `main`.
- Ensure version bumps follow semver conventions before merging release PRs.
