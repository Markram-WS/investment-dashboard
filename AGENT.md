# Project Context & AI Agent Governance (Native Windows Edition)

## 1. System Environment & Execution Constraints
- **OS:** Windows 11 (Native Execution)
- **Containerization:** Podman Desktop / Podman CLI (Windows Native)
- **Shell Preference:** Bash-like Syntax ONLY (via Git Bash, MinGW, or equivalent).
- **Command Constraints:** 
  - ALWAYS use `/` for paths in code and commands.
  - NEVER recommend PowerShell-specific cmdlets (e.g., `Get-ChildItem`).
  - Use `podman` instead of `docker` commands.
- **Workflow:** Verify Before Done (VBD). AI must check if the service is up via `podman ps` after changes.

## 2. Coding Philosophy: SOLID & Modularization
- **Core Principle:** Strictly follow SOLID principles.
- **Single Responsibility (SRP):** One file, one purpose. If a component or function grows too large, split it.
- **Dependency Inversion:** Use Interfaces/Abstract classes. High-level modules must not depend on low-level modules.
- **No Monolith Blocks:** 
  - ❌ PROHIBITED: Putting Logic, Types, and UI in a single massive file.
  - ✅ REQUIRED: Separate concerns into:
    - `components/` (Presentation only)
    - `hooks/` or `services/` (Business logic & API calls)
    - `types/` or `interfaces/` (Definitions)
    - `utils/` (Pure helper functions)

## 3. Component Architecture Guidelines
- **Granularity:** Break down UI into small, reusable atoms.
- **Composition over Inheritance:** Build complex features by composing smaller, well-defined components.
- **Clean Props:** Keep component interfaces lean. Pass only what is necessary.

## 4. Operational Risk Framework (Mark's Policy)
- **R0 (No Magic):** Do not assume Infrastructure. If Podman machine is not initialized, ask the user first.
- **R1 (Edit & Notify):** For refactoring into SOLID patterns, do it and report the structural changes immediately.
- **R2 (Direct Action):** Minor logic fixes and unit test updates.

## 5. Deployment & Testing
- Use `podman-compose` for local orchestration.
- Ensure every new component has a corresponding unit test file (e.g., `*.test.ts`) to maintain Data Integrity.

# requirement
requirement\Detailed-Functional-Requirements.md

## Main Page
### DESIND : D:\InvestmentDashboard\requirement\UI\DESIGN.md
### SPREAD detail
requirement\UI\UI-LAYOUT-PORTFOLIO-ANALYTICS-SPREAD.md
requirement\UI\portfolio_analytics_grid(layout)
### GRID detail
requirement\UI\UI-LAYOUT-PORTFOLIO-ANALYTICS0-GRID.md
requirement\UI\portfolio_analytics_spread(layout)
## FUND detail
requirement\UI\UI-LAYOUT-MANAGED-FUND.md


## backend detail : D:\InvestmentDashboard\backend\README.md
## fontend detail : D:\InvestmentDashboard\frontend\README.md
## database : D:\InvestmentDashboard\database

requirement
requirement\Detailed-Functional-Requirements.md
