/**
 * Post-build script to fix ESM import paths in dist/
 * Handles:
 * 1. Adding .js extension to relative imports
 * 2. Converting directory imports to /index.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

// Track directories that have index.js files
const directoriesWithIndex = new Set();

function findDirectoriesWithIndex(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const indexPath = path.join(fullPath, 'index.js');
      if (fs.existsSync(indexPath)) {
        // Store relative path from dist
        const relativePath = path.relative(distDir, fullPath).replace(/\\/g, '/');
        directoriesWithIndex.add(relativePath);
      }
      findDirectoriesWithIndex(fullPath);
    }
  }
}

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const fileDir = path.dirname(filePath);
  let modified = false;

  // Match import/export from statements (handles all variations including "export * from")
  const importRegex = /((?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)?\s*from\s*['"])([^'"]+)(['"])/g;

  content = content.replace(importRegex, (match, prefix, importPath, quote) => {
    // Skip non-relative imports (node_modules)
    if (!importPath.startsWith('.')) {
      return match;
    }

    // Skip if already has .js extension
    if (importPath.endsWith('.js')) {
      return match;
    }

    // Resolve the import path to see if it's a directory
    const resolvedPath = path.resolve(fileDir, importPath);
    const relativeFromDist = path.relative(distDir, resolvedPath).replace(/\\/g, '/');

    // Check if this is a directory import
    if (directoriesWithIndex.has(relativeFromDist)) {
      modified = true;
      return `${prefix}${importPath}/index.js${quote}`;
    }

    // Otherwise just add .js
    modified = true;
    return `${prefix}${importPath}.js${quote}`;
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return modified;
}

function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let filesFixed = 0;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      filesFixed += processDirectory(fullPath);
    } else if (entry.name.endsWith('.js')) {
      if (fixImportsInFile(fullPath)) {
        filesFixed++;
      }
    }
  }

  return filesFixed;
}

// First, find all directories with index.js
console.log('Scanning for directories with index.js...');
findDirectoriesWithIndex(distDir);
console.log(`Found ${directoriesWithIndex.size} directories with index.js`);

// Then fix all imports
console.log('Fixing ESM imports...');
const filesFixed = processDirectory(distDir);
console.log(`Fixed imports in ${filesFixed} files`);
console.log('done.');
