#!/usr/bin/env bash
# Content generation functions for update-agent-context
# Extracted from update-agent-context.sh for modularity

# Get project directory structure based on project type
get_project_structure() {
    local project_type="$1"

    if [[ "$project_type" == *"web"* ]]; then
        echo "backend/\\nfrontend/\\ntests/"
    else
        echo "src/\\ntests/"
    fi
}

# Get build/test commands for a given language
get_commands_for_language() {
    local lang="$1"

    case "$lang" in
        *"Python"*)
            echo "cd src && pytest && ruff check ."
            ;;
        *"Rust"*)
            echo "cargo test && cargo clippy"
            ;;
        *"JavaScript"*|*"TypeScript"*)
            echo "npm test \\&\\& npm run lint"
            ;;
        *)
            echo "# Add commands for $lang"
            ;;
    esac
}

# Get language-specific conventions string
get_language_conventions() {
    local lang="$1"
    echo "$lang: Follow standard conventions"
}
