#!/usr/bin/env node
// Explicit binary stdout generator; the interactive app generates only in memory.
import { samplePng } from './src/png.mjs';
const [kind = 'freshness', variant = 'before'] = process.argv.slice(2);
if (
  !['nearby', 'freshness', 'etag', 'exercise', 'policy', 'recap'].includes(kind) ||
  !['before', 'after'].includes(variant)
) {
  process.stderr.write(
    'Usage: node lesson-maker/sample-image.mjs nearby|freshness|etag|exercise|policy|recap [before|after]\n',
  );
  process.exitCode = 2;
} else process.stdout.write(samplePng(kind, variant));
