#!/usr/bin/env node

/**
 * Helps release the package. See "Publishing" in the README.
 *
 *   yarn release:prepare <version>   Bumps package.json and CHANGELOG.md on a release
 *                                    branch and commits, ready for a PR to main.
 *   yarn release:tag                 Tags the current commit on main and pushes the tag,
 *                                    which runs the Publish workflow.
 *
 * Both accept --dry-run to print what they would do without changing anything.
 */

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

import { root } from './utils.mjs'

const CHANGELOG_PATH = path.join(root, 'CHANGELOG.md')
const PACKAGE_PATH = path.join(root, 'package.json')
const WORKFLOW_URL = 'https://github.com/anvilco/node-anvil/actions/workflows/publish.yml'

// A semver version, like 4.0.0 or 4.0.0-beta.1
const VERSION_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/

const [command, ...args] = process.argv.slice(2).filter((arg) => arg !== '--dry-run')
const dryRun = process.argv.includes('--dry-run')

function git (...gitArgs) {
  return execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()
}

function run (description, fn) {
  if (dryRun) {
    console.log(`[dry run] ${description}`)
  } else {
    console.log(description)
    fn()
  }
}

function fail (message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function readPackageVersion () {
  return JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')).version
}

function tagExists (tag) {
  if (git('tag', '--list', tag)) return 'locally'
  if (git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`)) return 'on origin'
  return false
}

function requireCleanWorkingTree () {
  if (git('status', '--porcelain')) {
    fail('The working tree has uncommitted changes. Commit or stash them first.')
  }
}

function prepare ([version]) {
  if (!version) fail('Usage: yarn release:prepare <version>, e.g. yarn release:prepare 4.0.0')
  version = version.replace(/^v/, '')
  if (!VERSION_RE.test(version)) fail(`${version} is not a semver version, like 4.0.0 or 4.0.0-beta.1`)

  const tag = `v${version}`
  const currentVersion = readPackageVersion()
  if (version === currentVersion) fail(`package.json is already at ${version}`)
  const existing = tagExists(tag)
  if (existing) fail(`${tag} already exists ${existing}`)

  requireCleanWorkingTree()

  // Work on a release branch, so the change goes through a PR
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
  const releaseBranch = `release/${tag}`
  if (branch === 'main') {
    run(`Creating branch ${releaseBranch}`, () => git('checkout', '-b', releaseBranch))
  }

  // package.json: a targeted replace, to keep the file's formatting
  const packageJSON = fs.readFileSync(PACKAGE_PATH, 'utf8')
  const bumped = packageJSON.replace(`"version": "${currentVersion}"`, `"version": "${version}"`)
  if (bumped === packageJSON) fail(`Couldn't find "version": "${currentVersion}" in package.json`)
  run(`Bumping package.json from ${currentVersion} to ${version}`, () => fs.writeFileSync(PACKAGE_PATH, bumped))

  // CHANGELOG.md: the Unreleased section becomes this version's. Pre-releases leave it
  // alone, so the final release gets all of the notes; their GitHub release notes are
  // generated from the commits instead.
  const isPrerelease = version.includes('-')
  if (isPrerelease) {
    console.log(`Leaving CHANGELOG.md as it is, since ${tag} is a pre-release`)
  } else {
    const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8')
    const unreleased = '## [Unreleased]\n'
    if (!changelog.includes(unreleased)) fail('CHANGELOG.md has no "## [Unreleased]" section to release')
    const updated = changelog.replace(unreleased, `${unreleased}\n## [${tag}]\n`)
    run(`Renaming the Unreleased section of CHANGELOG.md to ${tag}`, () => fs.writeFileSync(CHANGELOG_PATH, updated))
  }

  run(`Committing "Release ${tag}"`, () => {
    git('add', PACKAGE_PATH, CHANGELOG_PATH)
    git('commit', '--quiet', '-m', `Release ${tag}`)
  })

  console.log(`
Next:
  1. Push this branch and open a PR to main.${isPrerelease ? '' : ` Check the ${tag} section of CHANGELOG.md reads well.`}
  2. After it merges: git checkout main && git pull && yarn release:tag
`)
}

function tag () {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
  if (branch !== 'main') fail(`Tags must be on main, but this is ${branch}. Run: git checkout main && git pull`)
  requireCleanWorkingTree()

  git('fetch', '--quiet', 'origin', 'main')
  const head = git('rev-parse', 'HEAD')
  if (head !== git('rev-parse', 'origin/main')) {
    fail('main is not the same as origin/main. Run: git pull')
  }

  const version = readPackageVersion()
  const tagName = `v${version}`
  const existing = tagExists(tagName)
  if (existing) fail(`${tagName} already exists ${existing}. Bump the version first: yarn release:prepare <version>`)

  const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8')
  if (!changelog.includes(`## [${tagName}]`)) {
    if (version.includes('-')) {
      console.log(`CHANGELOG.md has no ${tagName} section, so the GitHub release notes will be generated from the commits`)
    } else {
      fail(`CHANGELOG.md has no "## [${tagName}]" section. Run yarn release:prepare ${version} on a branch and merge it first.`)
    }
  }

  run(`Tagging ${head.slice(0, 8)} as ${tagName}`, () => git('tag', tagName))
  run(`Pushing ${tagName} to origin`, () => git('push', 'origin', tagName))

  console.log(`\nThe Publish workflow will publish ${tagName} to npm: ${WORKFLOW_URL}`)
}

switch (command) {
  case 'prepare':
    prepare(args)
    break
  case 'tag':
    tag()
    break
  default:
    fail('Usage: yarn release:prepare <version> | yarn release:tag')
}
