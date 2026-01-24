# Security Policy

## Reporting a vulnerability
If you believe you've found a security issue, please report it responsibly:
- Prefer a private report (do not open a public issue for exploits).
- Include steps to reproduce, expected vs actual behavior, and impact.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:
- **Email**: Send details to the maintainers privately
- **Private disclosure**: Contact the project maintainers directly

### What to Include

When reporting a vulnerability, please include:
- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- The location of the affected code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability

## Scope
In scope:
- API routes under `/api/*`
- Launchpad endpoints under `/api/launchpad/*`
- Client pages that handle scan/share flows

Out of scope:
- Social engineering, phishing, spam
- DoS that impacts real users/systems without explicit permission

## Disclosure
We aim to acknowledge reports quickly and ship fixes safely.

### Response Timeline
- **Initial response**: Within 48 hours
- **Status update**: Within 7 days
- **Resolution**: Depends on severity and complexity

## Supported Versions

We actively support the latest version of the Bags Shield API. Security updates are applied to the current production version.

We appreciate your efforts to responsibly disclose security vulnerabilities and will make every effort to acknowledge your contributions.
