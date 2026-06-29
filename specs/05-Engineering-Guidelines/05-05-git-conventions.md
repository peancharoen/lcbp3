# Git Conventions

**Version:** 1.8.4  
**Last Updated:** 2026-03-24  
**Location:** `specs/05-Engineering-Guidelines/05-05-git-conventions.md`

---

## Commit Message Format

```
<type>(<scope>): <description>
[optional body]
[optional footer: Refs #issue]
```

### Types

| Type       | When to Use                                 |
| ---------- | ------------------------------------------- |
| `feat`     | Add new feature                             |
| `fix`      | Fix bug                                     |
| `refactor` | Restructure code without behavior change    |
| `docs`     | Edit documentation                          |
| `test`     | Add/modify tests                            |
| `chore`    | Infra, config, dependency updates           |
| `style`    | Formatting, linting (no logic change)       |
| `spec`     | Edit specs/ documents                       |
| `adr`      | Add/modify Architecture Decision Record     |

### Examples

```
feat(correspondence): add create correspondence endpoint
fix(uuid): remove parseInt on projectId in rfas/page.tsx
spec(requirements): update edge cases for drawing workflow
adr(019): add UUID serialization behavior notes
```

---

## Branch Naming

```
feature/<description>              # New feature
fix/<issue-number>-<description>   # Bug fix
spec/<category>/<description>      # Spec changes
adr/<number>-<description>         # New/modify ADR
refactor/<description>             # Refactor
```

### Examples

```
feature/correspondence-cc-support
fix/23-uuid-parseInt-rfas-page
spec/requirements/update-correspondence-workflow
adr/019-uuid-serialization-behavior
```

---

## Reference

- [FullStack Guidelines](05-01-fullstack-js-guidelines.md)
- [Backend Guidelines](05-02-backend-guidelines.md)
- [Frontend Guidelines](05-03-frontend-guidelines.md)
