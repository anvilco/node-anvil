#!/usr/bin/env node

/**
 * Generate a changelog entry for a new version.
 *
 * Usage:
 *   node scripts/generate-changelog.js <version>
 *
 * Examples:
 *   node scripts/generate-changelog.js 3.4.0
 *   node scripts/generate-changelog.js 5.2.0
 *
 * Behavior:
 *   - If CHANGELOG.md has an [Unreleased] section with content, it renames
 *     that section to the given version with today's date and adds a fresh
 *     empty [Unreleased] above it.
 *   - If CHANGELOG.md has no [Unreleased] section (or it's empty), it reads
 *     the git log since the last tag and uses Claude to generate a changelog
 *     entry, then inserts it under a new versioned header.
 *
 * Requires:
 *   - git (for log/tag detection)
 *   - claude CLI (only when generating from git diff — must be on PATH)
 *
 * Environment:
 *   - ANTHROPIC_API_KEY: Required when generating from git diff
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const CHANGELOG_PATH = path.resolve(process.cwd(), 'CHANGELOG.md')

function main () {
  const version = process.argv[2]
  if (!version) {
    console.error('Usage: node scripts/generate-changelog.js <version>')
    process.exit(1)
  }

  const today = new Date().toISOString().split('T')[0]

  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.log('No CHANGELOG.md found, creating one.')
    fs.writeFileSync(CHANGELOG_PATH, [
      '# Changelog',
      '',
      'All notable changes to this project will be documented in this file.',
      '',
      'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)',
      'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).',
      '',
      '',
    ].join('\n'))
  }

  const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8')

  // Check if there's an [Unreleased] section with content
  const unreleasedMatch = changelog.match(
    /## \[Unreleased\]\s*\n([\s\S]*?)(?=\n## \[|$)/i,
  )

  const hasUnreleasedContent =
    unreleasedMatch &&
    unreleasedMatch[1] &&
    unreleasedMatch[1].trim().length > 0

  if (hasUnreleasedContent) {
    console.log(`Found [Unreleased] section with content. Stamping as [${version}].`)
    const updated = changelog.replace(
      /## \[Unreleased\]/i,
      `## [Unreleased]\n\n## [${version}] (${today})`,
    )
    fs.writeFileSync(CHANGELOG_PATH, updated)
    console.log(`CHANGELOG.md updated: [Unreleased] content is now under [${version}] (${today}).`)
    return
  }

  // No [Unreleased] content — generate from git diff
  console.log('No [Unreleased] content found. Generating from git history...')

  const lastTag = getLastTag()
  console.log(`Last tag: ${lastTag || '(none — using full history)'}`)

  const gitLog = getGitLog(lastTag)
  const diffStat = getDiffStat(lastTag)

  if (!gitLog.trim()) {
    console.log('No commits found since last tag. Nothing to generate.')
    return
  }

  const entry = generateWithClaude(version, today, gitLog, diffStat)

  // Insert the new entry into the changelog
  const versionHeader = `## [${version}] (${today})`
  const newSection = `## [Unreleased]\n\n${versionHeader}\n\n${entry}`

  let updated
  if (changelog.match(/## \[Unreleased\]/i)) {
    // Replace empty [Unreleased] with new content
    updated = changelog.replace(
      /## \[Unreleased\]\s*\n/i,
      newSection + '\n\n',
    )
  } else {
    // Insert after the header block
    const insertPoint = changelog.indexOf('\n## [')
    if (insertPoint !== -1) {
      updated =
        changelog.slice(0, insertPoint) +
        '\n' +
        newSection +
        '\n' +
        changelog.slice(insertPoint)
    } else {
      // No existing versions, append
      updated = changelog.trimEnd() + '\n\n' + newSection + '\n'
    }
  }

  fs.writeFileSync(CHANGELOG_PATH, updated)
  console.log(`CHANGELOG.md updated with [${version}] (${today}).`)
}

function getLastTag () {
  try {
    return execSync('git describe --tags --abbrev=0 2>/dev/null', {
      encoding: 'utf8',
    }).trim()
  } catch {
    return null
  }
}

function getGitLog (sinceTag) {
  const range = sinceTag ? `${sinceTag}..HEAD` : 'HEAD'
  try {
    return execSync(
      `git log ${range} --pretty=format:"%h %s" --no-merges 2>/dev/null`,
      { encoding: 'utf8' },
    ).trim()
  } catch {
    return ''
  }
}

function getDiffStat (sinceTag) {
  const range = sinceTag ? `${sinceTag}..HEAD` : 'HEAD'
  try {
    return execSync(`git diff --stat ${range} 2>/dev/null`, {
      encoding: 'utf8',
    }).trim()
  } catch {
    return ''
  }
}

function generateWithClaude (version, today, gitLog, diffStat) {
  const prompt = `You are generating a changelog entry for version ${version} (${today}).

Here are the git commits since the last release:

${gitLog}

Here is the diff stat:

${diffStat}

Generate a changelog entry following Keep a Changelog format (https://keepachangelog.com).
Use these section headers as appropriate: Added, Changed, Deprecated, Removed, Fixed, Security.
Only include sections that have entries. Be concise but specific.
Do NOT include the version header — just the content (### sections and bullet points).
Do NOT wrap in markdown code fences.
Write from the perspective of a library consumer — focus on what changed in the public API,
new features, bug fixes, and breaking changes. Skip internal refactors unless they affect users.`

  try {
    const result = execSync(
      `claude --print --model sonnet "${prompt.replace(/"/g, '\\"')}"`,
      {
        encoding: 'utf8',
        timeout: 60000,
        env: { ...process.env },
      },
    ).trim()
    return result
  } catch (e) {
    console.error('Failed to generate changelog with Claude:', e.message)
    console.error('Falling back to raw git log.')
    return (
      '### Changed\n' +
      gitLog
        .split('\n')
        .map((line) => `- ${line}`)
        .join('\n')
    )
  }
}

main()
