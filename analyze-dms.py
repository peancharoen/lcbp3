#!/usr/bin/env python3
"""
Smart analyzer for LCBP3-DMS - size-aware, structure-focused
Generates stats + selectively includes only important files
"""
import os
from pathlib import Path
from collections import defaultdict

IGNORE_DIRS = {
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'out',
    '__pycache__', '.venv', 'venv', '.turbo', '.vercel', '.cache',
}

IGNORE_EXTS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
    '.zip', '.tar', '.gz', '.lock', '.pyc', '.map', '.o', '.a'
}

# Files to include content (important config/docs)
INCLUDE_CONTENT = {
    '.md',           # README, docs
    '.dockerfile',   # Docker config
    '.env.example',  # Example env
}

# Extensions with content limit (lines)
LIMIT_LINES = {
    '.ts': 50,       # Key TypeScript only
    '.tsx': 30,      # Key React components
    '.json': 40,     # Config files
    '.sql': 50,      # Schema
    '.js': 30,
    '.jsx': 30,
}

def should_process(filename, ext):
    if filename in {'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'}:
        return False
    if ext in IGNORE_EXTS:
        return False
    return True

def is_important_file(rel_path, filename, ext):
    """Heuristic: is this a key file we should include?"""
    important_names = {
        'package.json', 'tsconfig.json', 'nest-cli.json',
        'next.config.js', '.eslintrc', 'dockerfile', 'docker-compose.yml',
        '.env.example', '.gitignore', 'README.md'
    }

    if filename in important_names:
        return True

    # Root-level or config files
    if rel_path.count(os.sep) <= 2 and ext in {'.md', '.json', '.yml', '.yaml'}:
        return True

    return False

def count_lines(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return len(f.readlines())
    except:
        return 0

def read_file_preview(file_path, max_lines=None):
    """Read file content, optionally truncated"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()

        if max_lines and len(lines) > max_lines:
            content = ''.join(lines[:max_lines])
            content += f"\n\n[... truncated {len(lines) - max_lines} more lines ...]\n"
            return content

        return ''.join(lines)
    except Exception as e:
        return f"[Error: {e}]"

def main():
    output = 'dms-analysis.txt'

    # Collect stats
    stats = defaultdict(int)
    by_type = defaultdict(list)
    all_files = []

    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

        for file in files:
            if not should_process(file, os.path.splitext(file)[1].lower()):
                continue

            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, '.')
            ext = os.path.splitext(file)[1].lower()

            lines = count_lines(file_path)

            all_files.append({
                'path': rel_path,
                'file_path': file_path,
                'name': file,
                'ext': ext,
                'lines': lines,
                'important': is_important_file(rel_path, file, ext)
            })

            stats['total_files'] += 1
            stats['total_lines'] += lines
            by_type[ext] += [lines]

    with open(output, 'w', encoding='utf-8') as out:
        # === HEADER ===
        out.write("=" * 80 + "\n")
        out.write("LCBP3-DMS Repository Analysis\n")
        out.write("=" * 80 + "\n\n")

        # === STATS ===
        out.write("📊 REPOSITORY STATISTICS\n")
        out.write("─" * 80 + "\n\n")
        out.write(f"Total Files:      {stats['total_files']}\n")
        out.write(f"Total Lines:      {stats['total_lines']:,}\n\n")

        out.write("By File Type:\n")
        for ext in sorted(by_type.keys()):
            files_count = len(by_type[ext])
            total = sum(by_type[ext])
            avg = total // files_count if files_count else 0
            out.write(f"  {ext:12} {files_count:3d} files  {total:7,} lines  (avg: {avg:5d})\n")
        out.write("\n")

        # === DIRECTORY STRUCTURE ===
        out.write("\n📁 DIRECTORY STRUCTURE (with file counts)\n")
        out.write("─" * 80 + "\n\n")

        dir_counts = defaultdict(lambda: {'files': 0, 'lines': 0})
        for f in all_files:
            top_dir = f['path'].split(os.sep)[0] if os.sep in f['path'] else 'root'
            dir_counts[top_dir]['files'] += 1
            dir_counts[top_dir]['lines'] += f['lines']

        for d in sorted(dir_counts.keys()):
            count = dir_counts[d]['files']
            lines = dir_counts[d]['lines']
            out.write(f"  {d:30} {count:3d} files  {lines:7,} lines\n")
        out.write("\n")

        # === IMPORTANT FILES (with content) ===
        important = [f for f in all_files if f['important']]
        if important:
            out.write("\n📄 IMPORTANT FILES (Content Included)\n")
            out.write("=" * 80 + "\n")

            for f in sorted(important, key=lambda x: (x['ext'], x['path'])):
                max_lines = LIMIT_LINES.get(f['ext'], None)
                ext = f['ext']

                # Always include .md, .env.example, dockerfile
                if ext in {'.md'} or f['name'] in {'dockerfile', '.env.example'}:
                    max_lines = None  # No limit

                out.write(f"\n\n{'─' * 80}\n")
                out.write(f"📌 {f['path']} ({f['lines']} lines)\n")
                out.write(f"{'─' * 80}\n\n")

                content = read_file_preview(f['file_path'], max_lines)
                out.write(content)
                if not content.endswith('\n'):
                    out.write('\n')

        # === FILE LISTING ===
        out.write("\n\n" + "=" * 80 + "\n")
        out.write("📋 COMPLETE FILE LISTING (Summary)\n")
        out.write("=" * 80 + "\n\n")

        current_ext = None
        for f in sorted(all_files, key=lambda x: (x['ext'], x['path'])):
            if f['ext'] != current_ext:
                current_ext = f['ext']
                out.write(f"\n{current_ext or 'NO_EXT'}\n")

            marker = "✓" if f['important'] else " "
            out.write(f"  {marker} {f['path']:60} ({f['lines']:6,} lines)\n")

    print(f"✅ Analysis complete: {output}")
    print(f"   📊 {stats['total_files']} files, {stats['total_lines']:,} lines")
    print(f"   📌 Included content for important files only")

if __name__ == '__main__':
    main()
