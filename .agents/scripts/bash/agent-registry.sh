#!/usr/bin/env bash
# Agent registry — maps agent types to file paths and display names
# Extracted from update-agent-context.sh for modularity
#
# Usage:
#   source agent-registry.sh
#   init_agent_registry "$REPO_ROOT"
#   get_agent_file "claude"    # → /path/to/CLAUDE.md
#   get_agent_name "claude"    # → "Claude Code"

# Initialize agent file paths (call after REPO_ROOT is set)
init_agent_registry() {
    local repo_root="$1"

    # Agent type → file path mapping
    declare -gA AGENT_FILES=(
        [claude]="$repo_root/CLAUDE.md"
        [gemini]="$repo_root/GEMINI.md"
        [copilot]="$repo_root/.github/agents/copilot-instructions.md"
        [cursor-agent]="$repo_root/.cursor/rules/specify-rules.mdc"
        [qwen]="$repo_root/QWEN.md"
        [opencode]="$repo_root/AGENTS.md"
        [codex]="$repo_root/AGENTS.md"
        [windsurf]="$repo_root/.windsurf/rules/specify-rules.md"
        [kilocode]="$repo_root/.kilocode/rules/specify-rules.md"
        [auggie]="$repo_root/.augment/rules/specify-rules.md"
        [roo]="$repo_root/.roo/rules/specify-rules.md"
        [codebuddy]="$repo_root/CODEBUDDY.md"
        [qoder]="$repo_root/QODER.md"
        [amp]="$repo_root/AGENTS.md"
        [shai]="$repo_root/SHAI.md"
        [q]="$repo_root/AGENTS.md"
        [bob]="$repo_root/AGENTS.md"
    )

    # Agent type → display name mapping
    declare -gA AGENT_NAMES=(
        [claude]="Claude Code"
        [gemini]="Gemini CLI"
        [copilot]="GitHub Copilot"
        [cursor-agent]="Cursor IDE"
        [qwen]="Qwen Code"
        [opencode]="opencode"
        [codex]="Codex CLI"
        [windsurf]="Windsurf"
        [kilocode]="Kilo Code"
        [auggie]="Auggie CLI"
        [roo]="Roo Code"
        [codebuddy]="CodeBuddy CLI"
        [qoder]="Qoder CLI"
        [amp]="Amp"
        [shai]="SHAI"
        [q]="Amazon Q Developer CLI"
        [bob]="IBM Bob"
    )

    # Template file path
    TEMPLATE_FILE="$repo_root/.specify/templates/agent-file-template.md"
}

# Get file path for an agent type
get_agent_file() {
    local agent_type="$1"
    echo "${AGENT_FILES[$agent_type]:-}"
}

# Get display name for an agent type
get_agent_name() {
    local agent_type="$1"
    echo "${AGENT_NAMES[$agent_type]:-}"
}

# Get all registered agent types
get_all_agent_types() {
    echo "${!AGENT_FILES[@]}"
}

# Check if an agent type is valid
is_valid_agent() {
    local agent_type="$1"
    [[ -n "${AGENT_FILES[$agent_type]:-}" ]]
}

# Get supported agent types as a pipe-separated string (for error messages)
get_supported_agents_string() {
    local result=""
    for key in "${!AGENT_FILES[@]}"; do
        if [[ -n "$result" ]]; then
            result="$result|$key"
        else
            result="$key"
        fi
    done
    echo "$result"
}
