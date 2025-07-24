# Security Policy

## Reporting Security Vulnerabilities

We take security seriously. If you discover a security vulnerability, please:

1. **DO NOT** open a public issue
2. Use GitHub's private vulnerability reporting:
   - Navigate to the [Security tab](https://github.com/medlock-ai/medlock/security)
   - Click "Report a vulnerability"
   - Provide detailed information about the vulnerability

### What to include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

## Response Time

We aim to:

- Acknowledge reports within 48 hours
- Provide an initial assessment within 5 business days
- Release patches for critical vulnerabilities within 30 days

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Measures

- OAuth 2.0 with PKCE
- Time-limited signed URLs (60 seconds)
- Comprehensive audit logging
- Rate limiting via Durable Objects
- No storage of health data
