import os
import re
import sys
from pathlib import Path

# Configuration - default base directory, can be overridden via CLI argument
DEFAULT_BASE_DIR = Path(__file__).resolve().parent.parent.parent / "specs"

DIRECTORIES = [
    "00-Overview",
    "01-Requirements",
    "02-Architecture",
    "03-Data-and-Storage",
    "04-Infrastructure-OPS",
    "05-Engineering-Guidelines",
    "06-Decision-Records"
]

# Regex for Markdown links: [label](path)
# Handles relative paths, absolute file paths, and anchors
LINK_PATTERN = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')

def verify_links(base_dir: Path):
    results = {
        "total_links": 0,
        "broken_links": []
    }

    for dir_name in DIRECTORIES:
        directory = base_dir / dir_name
        if not directory.exists():
            print(f"Directory not found: {directory}")
            continue

        for file_path in directory.glob("*.md"):
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                links = LINK_PATTERN.findall(content)

                for label, target in links:
                    # Ignore external links (http/https)
                    if target.startswith("http"):
                        continue

                    # Ignore anchors within the same file
                    if target.startswith("#"):
                        continue

                    results["total_links"] += 1

                    # Process target path
                    # 1. Handle file:/// Absolute paths if any
                    if target.startswith("file:///"):
                        clean_target = Path(target.replace("file:///", "").replace("/", os.sep))
                    else:
                        # 2. Handle relative paths
                        # Remove anchor if present
                        clean_target_str = target.split("#")[0]
                        if not clean_target_str:
                            continue

                        # Resolve path relative to current file
                        clean_target = (file_path.parent / clean_target_str).resolve()

                    # Verify existence
                    if not clean_target.exists():
                        results["broken_links"].append({
                            "source": str(file_path),
                            "label": label,
                            "target": target,
                            "resolved": str(clean_target)
                        })

    return results

if __name__ == "__main__":
    if len(sys.argv) > 1:
        base_dir = Path(sys.argv[1])
    else:
        base_dir = DEFAULT_BASE_DIR

    if not base_dir.exists():
        print(f"Error: Directory not found: {base_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Starting link verification in {base_dir}...")
    audit_results = verify_links(base_dir)

    print(f"\nAudit Summary:")
    print(f"Total Internal Links Scanned: {audit_results['total_links']}")
    print(f"Total Broken Links Found: {len(audit_results['broken_links'])}")

    if audit_results['broken_links']:
        print("\nBroken Links Detail:")
        for idx, link in enumerate(audit_results['broken_links'], 1):
            print(f"{idx}. Source: {link['source']}")
            print(f"   Link: [{link['label']}]({link['target']})")
            print(f"   Resolved Path: {link['resolved']}")
            print("-" * 20)
    else:
        print("\nNo broken links found! 🎉")
