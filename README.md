# RO-OAI frontend

This repository is the public source mirror of the RO-OAI frontend. Production deployment
configuration, credentials, internal documentation, AI-tool configuration, and release binaries are
intentionally excluded.

Changes are accepted through public pull requests. Direct pushes to `main` are not part of the
contribution flow.

## Local checks

```bash
npm ci
npm run format:check
npm run lint
npm test
npm run build
```

The application expects its service URLs and optional integrations to be supplied through
environment variables. Optional analytics and error reporting remain disabled when unconfigured.

## License

This is source-available proprietary software, not open-source software. You may inspect it and
prepare contributions, but reuse, deployment, redistribution, and AI/ML training are prohibited
without prior written permission. See [`LICENSE`](LICENSE) for the complete terms.
