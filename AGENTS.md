# Pixel Agent Development Rules

These rules are project-specific and apply to all agent work on Pixel.

## Development Environment

- Do all feature development on the remote server `root@52.77.228.143`.
- Main repository path: `/opt/pixel-src`.
- Feature worktree path pattern: `/opt/pixel-worktrees/<feature-name>`.
- Do not pull the repository to the user's Mac for development, testing, or builds unless the user explicitly asks for local work.
- The local machine may be used only for conversation, coordination, or temporary non-source artifacts when unavoidable.

## Branch And Worktree Flow

- Every new requirement starts from the latest GitHub `origin/main`.
- Fetch first, then create a dedicated feature branch from `origin/main`.
- Use one isolated worktree per requirement.
- Branch naming:
  - `feat/<feature-name>` for features.
  - `fix/<bug-name>` for bug fixes.
  - `chore/<task-name>` for maintenance work.
- Do not develop directly on `main`.
- Do not mix unrelated requirements in one branch.
- If `main` changes while a feature is in progress, merge the latest `origin/main` into the feature branch before final testing and handoff.

Example:

```bash
cd /opt/pixel-src
git fetch origin
mkdir -p /opt/pixel-worktrees
git worktree add /opt/pixel-worktrees/<feature-name> -b feat/<feature-name> origin/main
```

## Default Multi-Agent Roles

Use multi-agent development for non-trivial requirements.

- `开发一号`: backend/API/database/service-layer work only.
- `开发二号`: frontend/UI/API integration/frontend tests only.
- `开发三号`: tests, verification, performance checks, and auxiliary scripts only.
- `代码审查员`: read-only review. This agent must not edit files.
- `答疑管家`: explanations, user-facing notes, and documentation support. This agent must not edit production code unless explicitly assigned.

Agents must remain active after completing an assigned task. They must not close themselves or request shutdown as part of normal completion. Agents may only be closed when the user explicitly asks to close them, or when the controller closes them after the user has authorized that cleanup.

The controller agent is responsible for coordination:

- Clarify and split the requirement.
- Create the branch and worktree.
- Assign agents with clear ownership of files or responsibility areas.
- Make sure agents know they are not alone in the codebase.
- Prevent multiple agents from editing the same files unless explicitly coordinated.
- Integrate results.
- Resolve conflicts.
- Run verification.
- Commit and push the feature branch.
- Prepare the handoff summary for the user.

## Agent Ownership Rules

- Each development agent must stay within its assigned responsibility area.
- Backend agents must not edit frontend files unless the user or controller explicitly changes their assignment.
- Frontend agents must not edit backend files unless the user or controller explicitly changes their assignment.
- Test/verification agents should prefer dedicated test files, scripts, or read-only analysis and must not change production implementation files unless explicitly assigned.
- Review agents are strictly read-only.
- Agents must not revert or overwrite edits made by others.
- Agents must report changed files, tests run, and any unresolved risks.
- The review agent is read-only and must report findings by severity.
- The controller integrates final changes and is the only role that should prepare release/deployment steps unless delegated explicitly.
- If a task requires crossing ownership boundaries, the agent must stop and report the need for coordination instead of editing outside its lane.

## Testing And Verification

- Use test-driven development for code behavior changes whenever practical.
- Write or update tests before production code for new behavior.
- Prefer running most verification in the local development environment or an isolated test environment before handoff.
- In this project, "local development environment" means the feature worktree on the development server or another explicitly approved non-production environment, not the production runtime directory.
- Development-environment tests are allowed by default when they are scoped, reproducible, and do not mutate production data.
- Allowed by default on the development environment:
  - Targeted backend unit tests, for example a specific Go package or `-run` pattern.
  - Targeted frontend tests, for example a specific Vitest spec.
  - Static checks such as `gofmt`, `git diff --check`, type checks, and lint checks.
  - Frontend/backend builds when needed to prove compile correctness, as long as they run from the feature worktree and do not restart production services.
- Require explicit user approval before running:
  - Load tests, pressure tests, benchmark loops, or high-concurrency checks.
  - Full-suite tests known to be long-running or resource-heavy.
  - Tests that write to production databases, call real upstream paid APIs, import large account batches, or touch live account-pool state.
  - Commands that restart `pixel.service`, reload Nginx, deploy builds, or otherwise affect production traffic.
  - Dependency installation or system package installation when it may affect the machine globally.
- Production verification should be limited to post-deploy smoke checks unless the user asks for deeper live testing.
- Do not claim a task is complete until fresh verification has been run and the output has been read.
- Verification should match the scope:
  - Backend changes: targeted Go tests, plus broader package tests when shared behavior changes.
  - Frontend changes: targeted Vitest tests and build/type checks when relevant.
  - API changes: curl or integration checks against the development build when feasible.
  - Performance-related changes: compare old and new response size and timing in a non-production or user-approved environment.

## Delivery Flow

Feature branches are not deployed automatically.

1. Develop in the feature worktree.
2. Run relevant tests and verification.
3. Commit changes on the feature branch.
4. Push the feature branch to GitHub.
5. Tell the user the branch name, summary, changed files, and verification results.
6. Wait for user review or explicit approval.
7. Merge to `main` only after approval.
8. Deploy from `main`.
9. Build the production binary/assets.
10. Restart services.
11. Verify production behavior.
12. Create a version tag when the deployment is accepted.

## Production Deployment Rules

- Deployments happen on the server, not from the user's Mac.
- Do not deploy a feature branch directly unless the user explicitly requests it.
- Prefer deploying from `main` after merge.
- Keep backups of service config files before editing operational configuration.
- After deployment, verify:
  - `pixel.service` is active.
  - `nginx` is active.
  - The public domain responds.
  - Important API endpoints return expected status codes.
  - The version/tag matches the intended release when applicable.

## Current Server Notes

- Production domain: `https://2btocken.xyz`.
- Pixel source: `/opt/pixel-src`.
- Pixel service path: `/opt/pixel`.
- Pixel systemd service: `pixel.service`.
- Nginx handles public HTTP/HTTPS.
- Pixel should listen on `127.0.0.1:8080`; public users should enter through Nginx on ports 80/443.
