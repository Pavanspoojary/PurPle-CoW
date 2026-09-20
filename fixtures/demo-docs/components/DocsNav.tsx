import React from 'react';

// Shared documentation navigation bar mounted across all documentation pages
export function DocsNav() {
  return (
    <nav className="docs-sidebar">
      <div className="nav-group">
        <h3>API Reference</h3>
        <ul>
          <li><a href="/docs/quickstart">Quickstart Guide</a></li>
          {/* Outdated route returning 404, replaced by /api/v3 in modern docs */}
          <li><a href="/api/v2">REST API v2 Reference</a></li>
          <li><a href="https://example-dead-domain-never-exists-987654321.org/spec">Third-Party Protocol Spec</a></li>
        </ul>
      </div>
      <div className="nav-group">
        <h3>Guides</h3>
        <ul>
          <li><a href="/docs/onboarding">Developer Onboarding</a></li>
          <li><a href="/pricing">Pricing & Upgrades</a></li>
        </ul>
      </div>
    </nav>
  );
}
