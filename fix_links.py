import os
import re
from pathlib import Path

# Configuration
BASE_DIR = Path(r"d:\nap-dms.lcbp3\specs")
DIRECTORIES = [
    "00-overview",
    "01-requirements",
    "02-architecture",
    "03-implementation",
    "04-operations",
    "05-decisions",
    "06-tasks"
]

LINK_PATTERN = re.compile(r'(\[([^\]]+)\]\(([^)]+)\))')

def get_file_map():
    """Builds a map of {basename}.md -> {prefixed_name}.md across all dirs."""
    file_map = {}
    for dir_name in DIRECTORIES:
        directory = BASE_DIR / dir_name
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

    # Hardcoded specific overrides for versioning and common typos
    overrides = {
        "fullftack-js-v1.5.0.md": "03-implementation/03-01-fullftack-js-v1.7.0.md",
        "fullstack-js-v1.5.0.md": "03-implementation/03-01-fullftack-js-v1.7.0.md",
        "system-architecture.md": "02-architecture/02-01-system-architecture.md",
        "api-design.md": "02-architecture/02-02-api-design.md",
        "data-model.md": "02-architecture/02-03-data-model.md",
        "backend-guidelines.md": "03-implementation/03-02-backend-guidelines.md",
        "frontend-guidelines.md": "03-implementation/03-03-frontend-guidelines.md",
        "document-numbering.md": "03-implementation/03-04-document-numbering.md",
        "testing-strategy.md": "03-implementation/03-05-testing-strategy.md",
        "deployment-guide.md": "04-operations/04-01-deployment-guide.md",
        "environment-setup.md": "04-operations/04-02-environment-setup.md",
        "monitoring-alerting.md": "04-operations/04-03-monitoring-alerting.md",
        "backup-recovery.md": "04-operations/04-04-backup-recovery.md",
        "maintenance-procedures.md": "04-operations/04-05-maintenance-procedures.md",
        "security-operations.md": "04-operations/04-06-security-operations.md",
        "incident-response.md": "04-operations/04-07-incident-response.md",
        "document-numbering-operations.md": "04-operations/04-08-document-numbering-operations.md",
        # Missing task files - redirect to README or best match
        "task-be-011-notification-audit.md": "06-tasks/README.md",
        "task-be-001-database-migrations.md": "06-tasks/TASK-BE-015-schema-v160-migration.md", # Best match
    }

    for k, v in overrides.items():
        file_map[k] = v

    return file_map

def fix_links():
    file_map = get_file_map()
    changes_made = 0

    for dir_name in DIRECTORIES:
        directory = BASE_DIR / dir_name
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

                # Special case: file:///d:/nap-dms.lcbp3/specs/
                clean_target_path = target_path.replace("file:///d:/nap-dms.lcbp3/specs/", "").replace("file:///D:/nap-dms.lcbp3/specs/", "")

                resolved_locally = (file_path.parent / target_path).resolve()
                if resolved_locally.exists() and resolved_locally.is_file():
                    continue # Not broken

                # It's broken, try to fix it
                target_filename = Path(clean_target_path).name.lower()
                if target_filename in file_map:
                    correct_relative_to_specs = file_map[target_filename]
                    # Calculate relative path from current file's parent to the correct file
                    correct_abs = (BASE_DIR / correct_relative_to_specs).resolve()

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
    fix_links()
