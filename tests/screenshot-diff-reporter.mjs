import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const toPosix = value => value.split(path.sep).join(path.posix.sep);

const fromTestsDir = expectedPath => {
  const normalized = toPosix(expectedPath);
  const marker = '/tests/';
  const at = normalized.lastIndexOf(marker);
  return at === -1 ? null : normalized.slice(at + marker.length);
};

const withSuffix = (file, suffix) => {
  const parsed = path.posix.parse(file);
  return path.posix.join(parsed.dir, `${parsed.name}.${suffix}${parsed.ext}`);
};

const displayRoot = outputDir => path.posix.basename(toPosix(outputDir));

const relativeTarget = (displayPath, root) => displayPath.slice(root.length + 1);

const getAttachmentKind = attachment => {
  for (const kind of ['actual', 'expected', 'diff']) {
    if (attachment?.name === kind) return kind;
    if (attachment?.name?.endsWith(`-${kind}.png`)) return kind;
    if (attachment?.path?.endsWith(`-${kind}.png`)) return kind;
  }
  return null;
};

export const buildScreenshotDiffPaths = (expectedPath, rootDir = 'screenshot-diffs') => {
  const base = fromTestsDir(expectedPath);
  if (!base) return null;

  return {
    actual: path.posix.join(rootDir, withSuffix(base, 'actual')),
    expected: path.posix.join(rootDir, withSuffix(base, 'expected')),
    diff: path.posix.join(rootDir, withSuffix(base, 'diff')),
  };
};

export const copyScreenshotDiffAttachments = (attachments, outputDir = 'screenshot-diffs') => {
  const byName = Object.fromEntries((attachments || [])
    .map(x => [getAttachmentKind(x), x?.path])
    .filter(([kind, source]) => kind && source));

  if (!byName.actual || !byName.expected) return null;

  const root = displayRoot(outputDir);
  const paths = buildScreenshotDiffPaths(byName.expected, root);
  if (!paths) return null;

  for (const [name, source] of Object.entries(byName)) {
    if (!paths[name] || !existsSync(source)) continue;
    const target = path.join(outputDir, relativeTarget(paths[name], root));
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
  }

  return paths;
};

export const formatScreenshotDiffBlock = ({ actual, expected, diff }) =>
  [
    'Screenshot diffs:',
    `  Actual:   ${actual}`,
    `  Expected: ${expected}`,
    `  Diff:     ${diff}`,
  ].join('\n');

export default class ScreenshotDiffReporter {
  constructor(options = {}) {
    this.outputDir = options.outputDir || process.env.PW_SCREENSHOT_DIFFS_DIR;
  }

  onBegin() {
    if (this.outputDir) mkdirSync(this.outputDir, { recursive: true });
  }

  onTestEnd(_test, result) {
    if (!this.outputDir) return;
    const paths = copyScreenshotDiffAttachments(result?.attachments, this.outputDir);
    if (paths) process.stdout.write(`\n${formatScreenshotDiffBlock(paths)}\n`);
  }
}
