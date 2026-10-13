# Contributing

How to work on the client and publish it. For using the client, see the [README](README.md).

## Development

First install the dependencies

```sh
yarn install
```

Running tests

```sh
yarn test
yarn test:watch
```

Building with babel will output in the `/lib` directory.

```sh
yarn test

# Watches the `src` and `test` directories
yarn test:watch
```

## Publishing

Publishing to npm is done by the [Publish workflow](.github/workflows/publish.yml) when a version tag is pushed. Merging to `main` does not publish anything.

1. On a branch, bump the version and release the `[Unreleased]` section of `CHANGELOG.md`:
   ```sh
   yarn release:prepare 4.0.0
   ```
   This sets `version` in `package.json`, renames `[Unreleased]` to `[v4.0.0]`, and commits. If you're on `main`, it creates a `release/v4.0.0` branch first. Push the branch, open a PR, and merge it to `main`.
1. Tag that commit on `main` and push the tag:
   ```sh
   git checkout main && git pull
   yarn release:tag
   ```
   This checks that `main` is up to date with `origin/main`, that `v4.0.0` doesn't already exist, and that `CHANGELOG.md` has a `[v4.0.0]` section, then tags and pushes.

Both commands accept `--dry-run`. For a pre-release, run `yarn release:prepare 4.0.0-beta.1`: it bumps the version but leaves `CHANGELOG.md` alone, so the notes stay under `[Unreleased]` for the final release.

The workflow then:

1. Checks the tag is on `main` and matches the `package.json` version.
1. Lints, tests and builds the commit that was tagged.
1. Publishes to npm. Versions like `v4.0.0` go to the `latest` dist-tag. Pre-releases like `v4.0.0-beta.1` go to a dist-tag named after their label (`beta`), and are marked as pre-releases on GitHub.
1. Creates a GitHub release, using that version's `CHANGELOG.md` section as the release notes.

### Setup

The workflow uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers), so there is no npm token to store in GitHub secrets. Before the first release, a maintainer of the npm package needs to add a trusted publisher on npmjs.com, under the package's Settings:

* Publisher: GitHub Actions
* Organization or user: `anvilco`
* Repository: `node-anvil`
* Workflow filename: `publish.yml`
* Allow `npm publish`

npm automatically adds [provenance](https://docs.npmjs.com/generating-provenance-statements) to packages published this way. No GitHub secrets are needed: the release is created with the workflow's own `GITHUB_TOKEN`.
