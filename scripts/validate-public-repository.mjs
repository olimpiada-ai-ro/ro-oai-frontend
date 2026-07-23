#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';

const REQUIRED_FILES = [
    '.github/CODEOWNERS',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/workflows/boundary.yml',
    '.github/workflows/ci.yml',
    '.gitignore',
    'LICENSE',
    'README.md',
    'scripts/validate-public-repository.mjs',
];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const EXPECTED_LICENSE_SHA256 = '91a703038dd6f597c6a1a63730912ee67fd90be0c7191969dcd29ea5ae334148';
const ALLOWED_SOURCE_DIRECTORIES = [
    'app/',
    'components/',
    'hooks/',
    'i18n/',
    'lib/',
    'locales/',
    'public/',
    'scripts/',
    'styles/',
    'types/',
];
const ALLOWED_SOURCE_FILES = new Set([
    '.editorconfig',
    '.prettierignore',
    '.prettierrc',
    'components.json',
    'eslint.config.mjs',
    'i18n.ts',
    'instrumentation-client.ts',
    'instrumentation.ts',
    'next.config.mjs',
    'package-lock.json',
    'package.json',
    'postcss.config.mjs',
    'proxy.test.ts',
    'proxy.ts',
    'sentry.edge.config.ts',
    'sentry.server.config.ts',
    'tailwind.config.ts',
    'tsconfig.json',
    'vitest.config.mjs',
]);

const ALLOWED_MARKDOWN = new Set(['.github/PULL_REQUEST_TEMPLATE.md', 'README.md']);
const ALLOWED_GITHUB = new Set([
    '.github/CODEOWNERS',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/workflows/boundary.yml',
    '.github/workflows/ci.yml',
]);
const FORBIDDEN_PREFIXES = [
    '.agents/',
    '.codex/',
    '.cursor/',
    '.devcontainer/',
    '.docker/',
    '.idea/',
    '.junie/',
    '.kiro/',
    '.public-mirror/',
    '.vscode/',
    'charts/',
    'deploy/',
    'docs/',
    'documentation/',
    'helm/',
    'infra/',
    'kubernetes/',
    'monorepo/',
    'public/downloads/',
    'terraform/',
];
const FORBIDDEN_BASENAMES = new Set([
    '.dockerignore',
    '.env',
    '.env.example',
    '.mcp.json',
    '.npmrc',
    '.yarnrc',
    'agents.md',
    'caddyfile',
    'claude.md',
    'docker-compose.yaml',
    'docker-compose.yml',
    'dockerfile',
    'fly.toml',
    'makefile',
    'netlify.toml',
    'nginx.conf',
    'procfile',
    'secrets.yaml',
    'secrets.yml',
    'vagrantfile',
    'vercel.json',
]);
const FORBIDDEN_EXTENSIONS = new Set([
    '.7z',
    '.a',
    '.accdb',
    '.apk',
    '.appimage',
    '.avi',
    '.bash',
    '.bat',
    '.bin',
    '.bz2',
    '.cer',
    '.class',
    '.cmd',
    '.com',
    '.conf',
    '.crt',
    '.csv',
    '.db',
    '.db3',
    '.deb',
    '.dll',
    '.dmg',
    '.doc',
    '.docx',
    '.dylib',
    '.elf',
    '.env',
    '.exe',
    '.fish',
    '.gz',
    '.hcl',
    '.ini',
    '.ipa',
    '.jar',
    '.jks',
    '.key',
    '.keystore',
    '.lib',
    '.mdb',
    '.mobileprovision',
    '.mov',
    '.mp3',
    '.mp4',
    '.msi',
    '.npy',
    '.npz',
    '.o',
    '.p12',
    '.parquet',
    '.pdf',
    '.pem',
    '.pfx',
    '.ppt',
    '.pptx',
    '.properties',
    '.provisionprofile',
    '.ps1',
    '.pyc',
    '.rar',
    '.sh',
    '.so',
    '.sql',
    '.sqlite',
    '.sqlite3',
    '.tar',
    '.tgz',
    '.tf',
    '.tfvars',
    '.toml',
    '.tsv',
    '.wasm',
    '.xls',
    '.xlsx',
    '.xz',
    '.yaml',
    '.yml',
    '.zip',
    '.zsh',
    '.zst',
]);
const BINARY_EXTENSIONS = new Set([
    '.avif',
    '.gif',
    '.ico',
    '.jpeg',
    '.jpg',
    '.otf',
    '.png',
    '.ttf',
    '.webp',
    '.woff',
    '.woff2',
]);
const ALLOWED_BINARY_FILES = Object.freeze({
    'public/favicon.ico': 'ded78b2a33af36e1c548551ee24c9338d12ad25eafe96707b90b3a5dd0b26cb0',
    'public/logo-dark.png': '3d9aaf4015c681e2f1ddaba83b62d4382601ba626dd2e35d6221d20c1ed66562',
    'public/logo.png': '539ddde358af6758989b17a7662dd1aa50e264279a776996672469871f00a4fa',
    'public/placeholder-logo.png':
        'd7c39d978af643ba9525de6fb8171e0f834882db4110c82ecad0df3f4f69551a',
    'public/placeholder-user.jpg':
        '22be067d748175598a5e00123902f5c8332dd7f101de03dfb92ec08d85bb5e53',
    'public/placeholder.jpg': '14be0c7aa11cca1e78f0966176b286a6d36d00ec64be027775dfeb33d8e2dfdf',
});
const CONTENT_PATTERNS = [
    ['private-key material', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
    ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
    ['GitHub token', /\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}\b/],
    ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
    ['Slack token', /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/],
    ['OpenAI-style key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
    ['JWT bearer token', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
    ['hard-coded Sentry DSN', /https:\/\/[A-Za-z0-9]+@[A-Za-z0-9.-]*sentry\.io\/[0-9]+/i],
    ['private production API hostname', /\bapi\.platform\.olimpiada-ai\.ro\b/i],
    ['private identity-provider hostname', /\bauth\.olimpiada-ai\.ro\b/i],
    [
        'object-storage account hostname',
        /\b(?:your-objectstorage\.com|r2\.cloudflarestorage\.com)\b/i,
    ],
    ['cluster-internal hostname', /\bkubernetes\.default(?:\.svc)?\b/i],
];
const SECRET_ASSIGNMENT_PATTERN =
    /\b(?:KEYCLOAK_CLIENT_SECRET|NEXTAUTH_SECRET|SENTRY_AUTH_TOKEN|API_KEY|ACCESS_TOKEN|PRIVATE_KEY)\s*[:=]\s*(?:"([^"]*)"|'([^']*)'|([^\s#,}\]]+))/g;
const URL_USERINFO_PATTERN = /\bhttps?:\/\/([^/\s:@]+):([^@\s/]+)@/gi;
const INTERNAL_CONFIG_REFERENCE_PATTERNS = [
    /(?:^|[/"'`\s])\.(?:agents|codex|cursor|junie|kiro)(?:[/\\]|\b)/im,
    /\b(?:AGENTS|CLAUDE)\.md\b/i,
];
const INTERNAL_REFERENCE_EXEMPT_FILES = new Set([
    '.gitignore',
    'scripts/validate-public-repository.mjs',
]);

function gitFiles() {
    const environment = Object.fromEntries(
        Object.entries(process.env).filter(
            ([name]) =>
                !/(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|AUTHORIZATION|CREDENTIAL)/i.test(name) &&
                !/^GIT_TRACE/i.test(name) &&
                name !== 'GIT_CURL_VERBOSE' &&
                !/^GIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+)$/i.test(name) &&
                !['GIT_ASKPASS', 'SSH_ASKPASS'].includes(name),
        ),
    );
    const result = spawnSync('git', ['ls-files', '--stage', '-z'], {
        encoding: 'utf8',
        env: environment,
    });
    if (result.status !== 0) throw new Error('Unable to enumerate tracked files.');
    return result.stdout
        .split('\0')
        .filter(Boolean)
        .map((record) => {
            const tabIndex = record.indexOf('\t');
            if (tabIndex === -1) throw new Error('Unexpected git index entry.');
            const [mode, , stage] = record.slice(0, tabIndex).split(' ');
            return { mode, stage, path: record.slice(tabIndex + 1) };
        })
        .sort((a, b) => a.path.localeCompare(b.path));
}

function isPlaceholder(value) {
    const normalized = value.trim().replace(/^['"]|['"]$/g, '');
    return (
        !normalized ||
        normalized.includes('${{') ||
        normalized.includes('process.env') ||
        /(?:placeholder|example|replace|change[-_]?me|test|local|dummy|not-a-secret)/i.test(
            normalized,
        )
    );
}

function pathFinding(file) {
    const lower = file.toLowerCase();
    const basename = path.posix.basename(lower);
    const extension = path.posix.extname(lower);

    if (ALLOWED_GITHUB.has(file)) return null;
    if (lower.startsWith('.github/') && !ALLOWED_GITHUB.has(file)) {
        return 'unapproved GitHub configuration';
    }
    if (lower.endsWith('.md') && !ALLOWED_MARKDOWN.has(file)) {
        return 'private/internal Markdown is forbidden';
    }
    if (FORBIDDEN_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
        return 'forbidden private path';
    }
    if (FORBIDDEN_BASENAMES.has(basename) || basename.startsWith('.env.')) {
        return 'forbidden configuration file';
    }
    if (FORBIDDEN_EXTENSIONS.has(extension)) return 'forbidden credential or binary file';
    if (
        /(?:^|[-_.])(?:credentials?|private[-_.]?key|service[-_.]?account|secrets?)(?:[-_.]|$)/i.test(
            basename,
        )
    ) {
        return 'credential-like filename';
    }
    if (
        /(?:^|\/)(?:ansible|charts?|deploy(?:ment)?|devops|helm|infra(?:structure)?|kubernetes|ops|packer|pulumi|terraform)(?:\/|$)/i.test(
            file,
        ) ||
        /(?:^|\/)(?:ansible|deploy(?:ment)?|helm|infra(?:structure)?|kubernetes|packer|pulumi|terraform)(?:[-_.][^/]+)$/i.test(
            file,
        ) ||
        /^(?:docker-)?compose(?:[._-].+)?\.ya?ml$/i.test(basename)
    ) {
        return 'infrastructure or deployment path';
    }
    return null;
}

function isAllowedPath(file) {
    return (
        REQUIRED_FILES.includes(file) ||
        ALLOWED_SOURCE_FILES.has(file) ||
        ALLOWED_SOURCE_DIRECTORIES.some((directory) => file.startsWith(directory))
    );
}

function contentFindings(file, content) {
    const findings = [];
    if (
        file === 'LICENSE' &&
        createHash('sha256').update(content).digest('hex') !== EXPECTED_LICENSE_SHA256
    ) {
        return ['proprietary license terms do not match the trusted digest'];
    }
    const extension = path.posix.extname(file).toLowerCase();
    const expectedBinaryDigest = ALLOWED_BINARY_FILES[file];
    if (expectedBinaryDigest) {
        if (!BINARY_EXTENSIONS.has(extension)) {
            return ['allowlisted binary path does not use an audited web-asset extension'];
        }
        return createHash('sha256').update(content).digest('hex') === expectedBinaryDigest
            ? []
            : ['allowlisted binary digest does not match'];
    }
    if (BINARY_EXTENSIONS.has(extension)) {
        return ['binary asset is not explicitly allowlisted'];
    }
    if (content.includes(0)) return ['NUL or UTF-16-like content is forbidden'];

    let text;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(content);
    } catch {
        return ['content is not strict UTF-8'];
    }
    if (
        text.includes('\u0000') ||
        text.includes('\uFFFD') ||
        !Buffer.from(text, 'utf8').equals(content)
    ) {
        return ['content is not canonical UTF-8'];
    }

    for (const [label, pattern] of CONTENT_PATTERNS) {
        if (pattern.test(text)) findings.push(label);
    }
    if (!INTERNAL_REFERENCE_EXEMPT_FILES.has(file)) {
        for (const pattern of INTERNAL_CONFIG_REFERENCE_PATTERNS) {
            if (pattern.test(text)) findings.push('internal AI/tool configuration reference');
        }
    }
    for (const match of text.matchAll(SECRET_ASSIGNMENT_PATTERN)) {
        const value = match[1] ?? match[2] ?? match[3] ?? '';
        if (!isPlaceholder(value)) findings.push('concrete secret assignment');
    }
    for (const match of text.matchAll(/\b(?:G-[A-Z0-9]{10}|GTM-[A-Z0-9]{7,12})\b/g)) {
        if (!/(?:X{5,}|TEST|EXAMPLE)/.test(match[0])) {
            findings.push('hard-coded analytics identifier');
        }
    }
    for (const match of text.matchAll(URL_USERINFO_PATTERN)) {
        if (!isPlaceholder(match[1]) || !isPlaceholder(match[2])) {
            findings.push('hard-coded URL credentials');
        }
    }
    return [...new Set(findings)];
}

const files = gitFiles();
const findings = [];

for (const requiredFile of REQUIRED_FILES) {
    if (!files.some((entry) => entry.path === requiredFile)) {
        findings.push(`${requiredFile}: required file is missing`);
    }
}
for (const requiredFile of Object.keys(ALLOWED_BINARY_FILES)) {
    if (!files.some((entry) => entry.path === requiredFile)) {
        findings.push(`${requiredFile}: audited binary asset is missing`);
    }
}

for (const entry of files) {
    const file = entry.path;
    if (entry.stage !== '0' || entry.mode !== '100644') {
        findings.push(`${file}: symlink, submodule, conflict, or unexpected mode is forbidden`);
        continue;
    }
    if (!isAllowedPath(file)) {
        findings.push(`${file}: path is outside the exact public allowlist`);
        continue;
    }
    const state = lstatSync(file);
    if (!state.isFile()) {
        findings.push(`${file}: symbolic links and special files are forbidden`);
        continue;
    }
    if (state.size > MAX_FILE_BYTES) {
        findings.push(`${file}: file exceeds the public size limit`);
        continue;
    }
    const forbiddenReason = pathFinding(file);
    if (forbiddenReason) {
        findings.push(`${file}: ${forbiddenReason}`);
        continue;
    }

    const content = readFileSync(file);
    for (const finding of contentFindings(file, content)) {
        findings.push(`${file}: ${finding}`);
    }
}

if (findings.length > 0) {
    console.error(`Public repository validation failed:\n${findings.sort().join('\n')}`);
    process.exit(1);
}

console.log(`Public repository validation passed for ${files.length} tracked files.`);
