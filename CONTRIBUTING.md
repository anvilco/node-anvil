# Contributing

How to work on the client and publish it. For using the client, see the [README](README.md).

## Development

The Node and Yarn versions to use are pinned in `package.json`, under `volta` and `packageManager`. With [Volta](https://volta.sh) installed, both are picked up automatically. Without it, use Node 24 and run `corepack enable` once, which makes `yarn` the pinned version.

Install the dependencies:

```sh
yarn install
```

Lint, and run the unit tests. `yarn test` also builds the client into `dist/` and its types into `types/`: `types/src/` from the source, and `types/esm/` as a copy for the ESM entry point (see `dev/build-esm-types.mjs`).

```sh
yarn lint
yarn test

# Watches the `src` and `test` directories
yarn test:watch
```

Build the client into `dist/` without testing:

```sh
yarn build
```

## Testing against a real environment

[`test-client.js`](test-client.js) builds the client, then runs every method against an Anvil environment and prints a `PASS`, `FAIL` or `SKIP` for each. It uses staging by default, and needs an API key for that environment:

```sh
ANVIL_API_KEY=<your staging API key> yarn test-client
```

* `ANVIL_BASE_URL` - _optional_ Test another environment instead, e.g. `http://localhost:3000`.
* `ANVIL_PDF_TEMPLATE_ID` - _optional_ The PDF template to test `fillPDF` with. Defaults to the first template in your organization that has example data.
* `ANVIL_FORGE_EID` - _optional_ The webform (Forge) in a Workflow to test `forgeSubmit` with. Defaults to the first one in your organization.

Everything it creates is test data. It creates a test Etch packet each run, and removes the Workflow submission it creates.

## Versioning

Versions follow [semver](https://semver.org). The client's TypeScript types are part of its public API, and most of them come from [`@anvilco/types`](https://www.npmjs.com/package/@anvilco/types), which is generated from the API's specs and takes its bumps from them ([its policy](https://github.com/anvilco/anvil-js/tree/main/packages/types#versioning)): a major when the API removes or changes a type, field or argument, a minor for additions, a patch for descriptions. The [Sync API Types workflow](.github/workflows/sync-api-types.yml) moves the dependency to each new version as anvil-js publishes it (its release workflow sends an `anvilco-types-published` dispatch here), and weekly as a backstop, and opens a PR; `yarn check:graphql` validates the client's operations against the schema that ships in the package, so an API change that breaks one fails that PR. The PR says whether the sync crosses a major, minor or patch release of `@anvilco/types`; on a major it marks its changelog note `BREAKING`, adds the `breaking` label, and asks the GitHub users in the optional `SYNC_BREAKING_REVIEWERS` repository variable (comma separated) for review. The workflow needs a `CI_GITHUB_TOKEN` repository secret: a token that can push branches and open PRs, so the PR gets its CI checks (the workflow's own `GITHUB_TOKEN` can't trigger workflows). python-anvil, dotnet-anvil and anvil-js use the same secret name. Dependabot leaves `@anvilco/types` alone.

That bump sets a floor for the next release: a `@anvilco/types` major is a `BREAKING:` entry in `CHANGELOG.md` and a major of this client; a minor makes the next release at least a minor. The client's own changes can raise the bump, never lower it.

## Publishing

Releases are run from [anvilco/package-ops](https://github.com/anvilco/package-ops), the private repository that releases every Anvil package: Actions → **Release** → **Run workflow**, pick `anvilco/node-anvil` and the increment. Merging to `main` does not publish anything, and nothing in this repository publishes.

The run checks out `main`, runs `yarn lint:quiet` and `yarn test`, checks the release floor (the last tag matches `package.json`, `CHANGELOG.md` has notes under `[Unreleased]`, and the increment isn't below what the synced `@anvilco/types` demands; see Versioning), then bumps `package.json`, turns `[Unreleased]` into `[vX.Y.Z]`, commits `Release vX.Y.Z` to `main`, tags `vX.Y.Z`, creates the GitHub release with that changelog section as its notes, packs, and stages the package on npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers). A dry run (the default) shows all of that and changes nothing; run one first.

A staged version isn't installable until a maintainer approves it with 2FA, either on npmjs.com under the package's **Staged Packages** tab, or with `npm stage list @anvilco/anvil` for the stage id and `npm stage approve <stage-id>`. The run's job summary says the same. Versions like `v4.0.0` go to the `latest` dist-tag, pre-releases like `v4.0.0-beta.1` to a dist-tag named after their label (`beta`). npm adds [provenance](https://docs.npmjs.com/generating-provenance-statements) to packages published this way.

Who may run a real release, the npm trusted publisher (staging allowed, publishing not, so a compromised workflow can stage a version but can't make it public), and the GitHub App that pushes the release commit are set up in package-ops; its README has the details and how to add a repository.
