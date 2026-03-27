# Contributing to PRUVIQ

Thank you for your interest in contributing to PRUVIQ! This document provides guidelines and information for contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/pruviq.git`
3. Install dependencies:
   ```bash
   npm install
   cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
   ```
4. Create a branch: `git checkout -b feat/your-feature`

## Development Setup

### Frontend (Astro + Preact + Tailwind v4)
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run test:e2e     # Run E2E tests
```

### Backend (Python FastAPI)
```bash
cd backend
source .venv/bin/activate
uvicorn api.main:app --reload --port 8080
```

## Code Guidelines

- **TypeScript**: Use strict types. No `any` unless absolutely necessary.
- **Python**: Follow PEP 8. Type hints required for function signatures.
- **Tests**: All new features need E2E tests in `tests/e2e/`.
- **Commits**: Use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).

## What to Contribute

### Good First Issues
Look for issues labeled [`good-first-issue`](https://github.com/pruviq/pruviq/labels/good-first-issue).

### Areas We Need Help
- New trading strategy indicators
- Translations (i18n)
- Performance improvements
- Documentation
- Bug reports with reproduction steps

## Pull Request Process

1. Ensure your PR passes all CI checks
2. Update documentation if needed
3. One PR = one logical change
4. PRs are auto-tested with Playwright E2E (Chromium + Firefox)

## Reporting Bugs

- Use the [Bug Report](https://github.com/pruviq/pruviq/issues/new) template
- Include: steps to reproduce, expected behavior, actual behavior, screenshots if applicable

## Code of Conduct

Be respectful. We're building tools for the crypto community together. No tolerance for harassment, spam, or malicious behavior.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
