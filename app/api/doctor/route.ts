import { NextResponse } from 'next/server';
import { askBrain } from '@/lib/brain';

type GitHubTreeEntry = {
  path: string;
  sha: string;
  type: string;
  size?: number;
};

type ScannedFile = {
  path: string;
  sha: string;
  content: string;
};

type DoctorFinding = {
  path: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
};

type DoctorPatch = {
  path: string;
  reason: string;
  oldText: string;
  newText: string;
};

type DoctorReport = {
  status: 'PERFECT' | 'FIXES_REQUIRED' | 'REVIEW_REQUIRED';
  summary: string;
  findings?: DoctorFinding[];
  patches?: DoctorPatch[];
};

const MAX_FILES = 100;
const MAX_FILE_BYTES = 160_000;
const MAX_SNAPSHOT_CHARS = 600_000;
const MAX_PATCH_FILES = 5;
const MAX_HUNK_CHARS = 8_000;
const MAX_TOTAL_CHANGED_LINES = 120;
const MAX_DELETED_LINES_PER_PATCH = 80;

const SCANNABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.scss',
  '.md', '.mdx', '.yml', '.yaml', '.toml', '.xml', '.html', '.env.example',
]);

const KNOWN_TEXT_FILES = new Set(['dockerfile', 'makefile', '.gitignore', '.npmrc', '.nvmrc']);
const EXCLUDED_PATH = /(^|\/)(node_modules|\.next|\.git|dist|build|coverage)(\/|$)|(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json|\.env|secrets?\.|credentials?\.|private\.|.*\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|woff2?|ttf|pem|key|crt|p12|pfx|mp[34]))$/i;
const PROTECTED_PATH = /(^|\/)(package\.json|next\.config\.[^/]+|tsconfig\.json|vercel\.json|\.env.*)$/i;

function githubHeaders(token: string, json = false): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function githubJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...githubHeaders(token, Boolean(init?.body)),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || `GitHub request failed (${response.status})`);
  }

  return data as T;
}

function isScannable(entry: GitHubTreeEntry): boolean {
  const path = entry.path.toLowerCase();
  const filename = path.split('/').pop() || path;
  const extension = path.endsWith('.env.example')
    ? '.env.example'
    : `.${path.split('.').pop() || ''}`;

  return entry.type === 'blob'
    && !EXCLUDED_PATH.test(path)
    && (SCANNABLE_EXTENSIONS.has(extension) || KNOWN_TEXT_FILES.has(filename))
    && (entry.size ?? 0) <= MAX_FILE_BYTES;
}

function encodeGitHubPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function createSnapshot(files: ScannedFile[]): {
  snapshot: string;
  visiblePaths: Set<string>;
  truncatedPaths: Set<string>;
} {
  let snapshot = '';
  const visiblePaths = new Set<string>();
  const truncatedPaths = new Set<string>();

  for (const file of files) {
    const section = `\n===== FILE: ${file.path} =====\n${file.content}\n`;
    const remaining = MAX_SNAPSHOT_CHARS - snapshot.length;

    if (remaining <= 0) break;

    if (section.length <= remaining) {
      snapshot += section;
      visiblePaths.add(file.path);
    } else {
      snapshot += `${section.slice(0, Math.max(0, remaining - 80))}\n[FILE CONTENT TRUNCATED FOR CONTEXT]\n`;
      visiblePaths.add(file.path);
      truncatedPaths.add(file.path);
    }
  }

  return { snapshot, visiblePaths, truncatedPaths };
}

function cleanJson(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function lineCount(text: string): number {
  return text.split(/\r?\n/).length;
}

function applySafePatch(
  original: ScannedFile,
  patch: DoctorPatch,
  visiblePaths: Set<string>,
  truncatedPaths: Set<string>,
): { content: string; changedLines: number; deletedLines: number } | null {
  if (patch.path !== original.path || PROTECTED_PATH.test(patch.path)) return null;
  if (!visiblePaths.has(patch.path)) return null;
  if (truncatedPaths.has(patch.path)) return null;
  if (!patch.oldText || !patch.newText) return null;
  if (patch.oldText === patch.newText) return null;
  if (patch.oldText.length > MAX_HUNK_CHARS || patch.newText.length > MAX_HUNK_CHARS) return null;

  const occurrences = original.content.split(patch.oldText).length - 1;
  if (occurrences !== 1) return null;

  const deletedLines = lineCount(patch.oldText);
  const addedLines = lineCount(patch.newText);
  if (deletedLines > MAX_DELETED_LINES_PER_PATCH || deletedLines > addedLines + 40) return null;

  const content = original.content.replace(patch.oldText, patch.newText);
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) return null;

  return {
    content,
    changedLines: deletedLines + addedLines,
    deletedLines,
  };
}

async function runDoctor() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_USERNAME;
  const repo = process.env.GITHUB_REPO;
  const baseBranch = process.env.GITHUB_BASE_BRANCH || 'main';

  if (!token || !owner || !repo) {
    throw new Error('GitHub credentials missing in environment.');
  }

  const repositoryBase = `https://api.github.com/repos/${owner}/${repo}`;
  const tree = await githubJson<{ truncated: boolean; tree: GitHubTreeEntry[] }>(
    `${repositoryBase}/git/trees/${encodeURIComponent(baseBranch)}?recursive=1`,
    token,
  );

  if (tree.truncated) {
    throw new Error('GitHub returned a truncated repository tree; no partial scan was performed.');
  }

  const entries = tree.tree
    .filter(isScannable)
    .sort((left, right) => left.path.localeCompare(right.path));

  if (entries.length > MAX_FILES) {
    throw new Error(`Repository has ${entries.length} scannable files; limit is ${MAX_FILES}.`);
  }

  const scannedFiles = await Promise.all(entries.map(async (entry): Promise<ScannedFile> => {
    const blob = await githubJson<{ content: string }>(
      `${repositoryBase}/git/blobs/${entry.sha}`,
      token,
    );
    const content = Buffer.from(blob.content.replace(/\s/g, ''), 'base64').toString('utf8');

    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
      throw new Error(`File exceeds the safe scan limit: ${entry.path}`);
    }

    return { path: entry.path, sha: entry.sha, content };
  }));

  const { snapshot, visiblePaths, truncatedPaths } = createSnapshot(scannedFiles);
  const systemPrompt = `You are TryNext AI's conservative repository Doctor.
Review the text-based source/configuration snapshot provided by the user.
Find only high-confidence fatal syntax errors, broken imports, invalid route contracts,
or defects that would prevent the project from running. Do not refactor working code.
Return ONLY valid JSON in this exact shape:
{
  "status": "PERFECT" | "FIXES_REQUIRED" | "REVIEW_REQUIRED",
  "summary": "short explanation",
  "findings": [{ "path": "exact/path", "severity": "HIGH", "reason": "specific issue" }],
  "patches": [{ "path": "exact/path", "reason": "specific issue", "oldText": "small exact existing block", "newText": "small corrected block" }]
}

Safety rules:
- Use PERFECT with empty findings and patches when the repository is healthy.
- Use REVIEW_REQUIRED when an issue is plausible but you cannot produce a safe minimal patch.
- Use FIXES_REQUIRED only for high-confidence issues with small targeted patches.
- Never rewrite a complete file, remove unrelated code, add dependencies, or change protected files.
- Keep each oldText/newText block under ${MAX_HUNK_CHARS} characters.
- Return at most ${MAX_PATCH_FILES} patches and keep deletions conservative.
- Do not propose a patch for a file marked [FILE CONTENT TRUNCATED FOR CONTEXT].
- Only use paths present in the snapshot. Never output markdown fences.`;

  const response = await askBrain(
    `Repository: ${owner}/${repo}\nBase branch: ${baseBranch}\nScannable files: ${scannedFiles.length}\n${snapshot}`,
    systemPrompt,
  );

  const report = JSON.parse(cleanJson(response.text)) as DoctorReport;
  const scannedByPath = new Map(scannedFiles.map((file) => [file.path, file]));

  if (report.status === 'PERFECT') {
    return {
      status: 'healthy',
      message: report.summary || 'Whole-repository scan completed. No safe repair was required.',
      filesScanned: scannedFiles.length,
      circuitTripped: response.circuitTripped,
    };
  }

  const proposedPatches = report.patches || [];
  const candidates = proposedPatches.slice(0, MAX_PATCH_FILES);
  const applied = candidates.map((patch) => {
    const original = scannedByPath.get(patch.path);
    if (!original) return null;
    const result = applySafePatch(original, patch, visiblePaths, truncatedPaths);
    return result ? { patch, original, ...result } : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  const totalChangedLines = applied.reduce((sum, item) => sum + item.changedLines, 0);
  const hasUnsafeOrMissingPatch = applied.length !== candidates.length;

  if (
    report.status !== 'FIXES_REQUIRED'
    || proposedPatches.length > MAX_PATCH_FILES
    || !applied.length
    || hasUnsafeOrMissingPatch
    || totalChangedLines > MAX_TOTAL_CHANGED_LINES
  ) {
    return {
      status: 'review',
      message: report.summary || 'Doctor found a concern, but no safe minimal patch was created.',
      findings: report.findings || [],
      filesScanned: scannedFiles.length,
      circuitTripped: response.circuitTripped,
    };
  }

  const baseRef = await githubJson<{ object: { sha: string } }>(
    `${repositoryBase}/git/ref/heads/${encodeURIComponent(baseBranch)}`,
    token,
  );
  const branchName = `doctor-fix-${Date.now()}`;

  await githubJson(`${repositoryBase}/git/refs`, token, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseRef.object.sha }),
  });

  for (const item of applied) {
    await githubJson(`${repositoryBase}/contents/${encodeGitHubPath(item.patch.path)}`, token, {
      method: 'PUT',
      body: JSON.stringify({
        message: `TryNext AI Doctor: Minimal repair for ${item.patch.path}`,
        content: Buffer.from(item.content, 'utf8').toString('base64'),
        sha: item.original.sha,
        branch: branchName,
      }),
    });
  }

  const pullRequest = await githubJson<{ html_url: string }>(`${repositoryBase}/pulls`, token, {
    method: 'POST',
    body: JSON.stringify({
      title: 'TryNext AI Doctor: Conservative repository repair',
      body: `### Repository Doctor report\n${report.summary}\n\n**Files scanned:** ${scannedFiles.length}\n**Files changed:**\n${applied.map((item) => `- \`${item.patch.path}\`: ${item.patch.reason}`).join('\n')}\n\n**Patch budget:** ${totalChangedLines} changed lines, no full-file replacements.\n\nPlease review the targeted patch before merging.\n\n**Engine used:** ${response.modelUsed}`,
      head: branchName,
      base: baseBranch,
    }),
  });

  return {
    status: 'fixed',
    message: report.summary || 'Safe repository repairs were prepared in a pull request.',
    prUrl: pullRequest.html_url,
    filesScanned: scannedFiles.length,
    filesChanged: applied.map((item) => item.patch.path),
    changedLines: totalChangedLines,
    circuitTripped: response.circuitTripped,
  };
}

export async function GET() {
  try {
    return NextResponse.json(await runDoctor());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Repository Doctor failed.';
    console.error('Doctor failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    return NextResponse.json(await runDoctor());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Repository Doctor failed.';
    console.error('Doctor failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
