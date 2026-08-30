#!/bin/bash
# File: scripts/check-patches.sh
# Change Log:
# - 2026-08-30: Initial creation — guard against orphan patchedDependencies
#
# ตรวจสอบว่าทุก patch ใน pnpm-workspace.yaml > patchedDependencies
# มี package อยู่ใน dependencies ของ workspace package อย้างน้อย 1 ตัว
# ทำงานร่วมกับ allowUnusedPatches: true ที่ปิด safety net ของ pnpm
# ใช้ใน CI ก่อน build เพื่อ catch orphan patch ก่อน deploy fail

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

python3 << 'PYEOF'
import json, os, re, sys

WORKSPACE_FILE = "pnpm-workspace.yaml"

if not os.path.exists(WORKSPACE_FILE):
    print(f"✗ {WORKSPACE_FILE} not found")
    sys.exit(1)

with open(WORKSPACE_FILE, "r") as f:
    content = f.read()

# ดึง patch keys จาก patchedDependencies section
patch_keys = []
in_patches = False
for line in content.splitlines():
    stripped = line.strip()
    if stripped.startswith("patchedDependencies:"):
        in_patches = True
        continue
    # ออกจาก section เมื่อเจอ top-level key ใหม่ (ไม่ใช่ comment/indented)
    if in_patches and stripped and not stripped.startswith("#"):
        if not line.startswith(" ") and not line.startswith("\t"):
            in_patches = False
            continue
    if in_patches and ":" in stripped and not stripped.startswith("#"):
        key = stripped.split(":")[0].strip().strip('"').strip("'")
        # strip version suffix: @nestjs/swagger@1.2.3 → @nestjs/swagger
        if "@" in key and not key.startswith("@"):
            key = key.rsplit("@", 1)[0]
        elif "@" in key and key.startswith("@"):
            parts = key.split("@")
            if len(parts) > 2:
                key = "@".join(parts[:-1])
        if key:
            patch_keys.append(key)

if not patch_keys:
    print("✓ No patchedDependencies found")
    sys.exit(0)

# รวม dependencies จากทุก workspace package.json
all_deps = set()
for root, dirs, files in os.walk("."):
    # skip node_modules, .next, .git
    dirs[:] = [d for d in dirs if d not in ("node_modules", ".next", ".git", ".agents")]
    if "package.json" in files:
        pkg_path = os.path.join(root, "package.json")
        try:
            with open(pkg_path) as f:
                pkg = json.load(f)
            for dep_type in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
                deps = pkg.get(dep_type, {})
                if isinstance(deps, dict):
                    all_deps.update(deps.keys())
        except (json.JSONDecodeError, IOError):
            pass

print("Checking patchedDependencies against workspace packages...")
print()

errors = 0
for patch_pkg in patch_keys:
    if patch_pkg in all_deps:
        print(f"  ✓ {patch_pkg} — found in workspace dependencies")
    else:
        print(f"  ✗ {patch_pkg} — NOT found in any workspace package.json")
        errors += 1

if errors > 0:
    print()
    print(f"❌ {errors} orphan patch(es) detected — package not in any workspace")
    print("   Either add the dependency or remove the patch from pnpm-workspace.yaml")
    sys.exit(1)

print()
print("✓ All patches have corresponding dependencies")
PYEOF
