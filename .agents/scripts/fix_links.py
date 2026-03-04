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

LINK_PATTERN = re.compile(r'(\[([^\]]+)\]\(([^)]+)\))')

def get_file_map(base_dir: Path):
    """Builds a map of {basename}.md -> {prefixed_name}.md across all dirs."""
    file_map = {}
    for dir_name in DIRECTORIES:
        directory = base_dir / dir_name
        if not directory.exists():
            continue
        for file_path in directory.glob("*.md"):
            actual_name = file_path.name
            low_name = actual_name.lower()

            # 1. Map actual name
            file_map[low_name] = f"{dir_name}/{actual_name}"

            # 2. Try to strip prefixes to find base names
            strip_patterns = [
                r'^\d+-\d+\.?\d*-?(.*)', # 01-03.1- or 01-01-
                r'^\d+-(.*)',           # 04-
                r'^ADR-\d+-(.*)',       # ADR-001-
            ]

            for pattern in strip_patterns:
                match = re.match(pattern, actual_name)
                if match:
                    base_name = match.group(1).lower()
                    if base_name:
                        file_map[base_name] = f"{dir_name}/{actual_name}"

                    # Also map partials like "03.1-project-management.md"
                    # if the original was "01-03.1-project-management.md"
                    if pattern == r'^\d+-\d+\.?\d*-?(.*)':
                        secondary_match = re.match(r'^\d+-(.*)', actual_name)
                        if secondary_match:
                            secondary_base = secondary_match.group(1).lower()
                            if secondary_base:
                                file_map[secondary_base] = f"{dir_name}/{actual_name}"

    return file_map

def fix_links(base_dir: Path):
    file_map = get_file_map(base_dir)
    changes_made = 0

    for dir_name in DIRECTORIES:
        directory = base_dir / dir_name
        if not directory.exists():
            continue

        for file_path in directory.glob("*.md"):
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            new_content = content
            original_links = LINK_PATTERN.findall(content)

            for full_match, label, target in original_links:
                if target.startswith("http") or target.startswith("#"):
                    continue

                # Check if broken
                target_path = target.split("#")[0]
                if not target_path:
                    continue

                # Special case: file:/// absolute paths
                clean_target_path = re.sub(
                    r'^file:///[a-zA-Z]:[/\\].*?specs[/\\]',
                    '',
                    target_path
                )

                resolved_locally = (file_path.parent / target_path).resolve()
                if resolved_locally.exists() and resolved_locally.is_file():
                    continue # Not broken

                # It's broken, try to fix it
                target_filename = Path(clean_target_path).name.lower()
                if target_filename in file_map:
                    correct_relative_to_specs = file_map[target_filename]
                    # Calculate relative path from current file's parent to the correct file
                    correct_abs = (base_dir / correct_relative_to_specs).resolve()

                    try:
                        new_relative_path = os.path.relpath(correct_abs, file_path.parent).replace(os.sep, "/")
                        # Re-add anchor if it was there
                        anchor = target.split("#")[1] if "#" in target else ""
                        new_target = new_relative_path + (f"#{anchor}" if anchor else "")

                        # Replace in content
                        old_link = f"({target})"
                        new_link = f"({new_target})"
                        new_content = new_content.replace(old_link, new_link)
                        print(f"Fixed in {file_path.name}: {target} -> {new_target}")
                    except ValueError:
                        print(f"Error calculating relpath for {correct_abs} from {file_path.parent}")

            if new_content != content:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                changes_made += 1

    print(f"\nTotal files updated: {changes_made}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        base_dir = Path(sys.argv[1])
    else:
        base_dir = DEFAULT_BASE_DIR

    if not base_dir.exists():
        print(f"Error: Directory not found: {base_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Scanning specs directory: {base_dir}")
    fix_links(base_dir)
