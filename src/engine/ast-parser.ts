import { readFileSync, existsSync } from 'fs';
import { extname, basename, relative } from 'path';

export interface ExtractedLink {
  url: string;
  anchorText?: string;
  startLine: number;
  endLine: number;
  type: 'INTERNAL_ROUTE' | 'EXTERNAL_URL';
  isComponentLink: boolean;
}

export interface ParsedFile {
  filePath: string;
  isLayout: boolean;
  detectedRoute?: string;
  links: ExtractedLink[];
  totalLines: number;
}

const LAYOUT_INDICATORS = [
  'layout',
  'navbar',
  'nav',
  'header',
  'footer',
  'sidebar',
  'menu',
  'topbar',
  'components/',
  'src/components/',
  '_app',
  '_document',
];

export class AstParser {
  static isLayoutFile(filePath: string): boolean {
    const normalized = filePath.toLowerCase().replace(/\\/g, '/');
    return LAYOUT_INDICATORS.some(ind => normalized.includes(ind));
  }

  static inferRoute(filePath: string): string {
    let normalized = filePath.replace(/\\/g, '/');
    // Strip common directory prefixes
    normalized = normalized
      .replace(/^(src\/)?(app|pages|docs|content)\//, '')
      .replace(/\.(mdx?|tsx|jsx|html)$/, '');
    
    if (normalized.endsWith('/index') || normalized === 'index' || normalized === 'page') {
      normalized = normalized.replace(/\/?(index|page)$/, '');
    }
    return normalized === '' ? '/' : `/${normalized}`;
  }

  static parseFile(filePath: string, rootDir: string = process.cwd()): ParsedFile | null {
    if (!existsSync(filePath)) return null;

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const isLayout = this.isLayoutFile(filePath);
    const detectedRoute = isLayout ? undefined : this.inferRoute(relative(rootDir, filePath));
    const links: ExtractedLink[] = [];

    // Regex matchers for Markdown links, JSX <a href="...">, and <Link href="...">
    // 1. Markdown links: [text](url)
    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+|\/[^\s\)]+)\)/g;
    
    // 2. JSX/HTML links: <a href="..." or <Link href="..." or <Link to="..."
    const jsxHrefRegex = /<(?:a|Link|NavLink|RouteLink)[^>]*\s+(?:href|to)=["']([^"']+)["'][^>]*>(?:([^<]*)<\/(?:a|Link|NavLink|RouteLink)>)?/gi;

    // 3. String literals in JS/TS objects: href: "..." or url: "..."
    const objectUrlRegex = /(?:href|url|link|target):\s*["'](https?:\/\/[^"'\s]+|\/[^"'\s]+)["']/gi;

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;

      // Match Markdown
      let mdMatch;
      while ((mdMatch = mdLinkRegex.exec(lineText)) !== null) {
        const url = mdMatch[2].trim();
        links.push({
          url,
          anchorText: mdMatch[1],
          startLine: lineNum,
          endLine: lineNum,
          type: url.startsWith('http') ? 'EXTERNAL_URL' : 'INTERNAL_ROUTE',
          isComponentLink: isLayout,
        });
      }

      // Match JSX/HTML
      let jsxMatch;
      while ((jsxMatch = jsxHrefRegex.exec(lineText)) !== null) {
        const url = jsxMatch[1].trim();
        links.push({
          url,
          anchorText: jsxMatch[2]?.trim() || undefined,
          startLine: lineNum,
          endLine: lineNum,
          type: url.startsWith('http') ? 'EXTERNAL_URL' : 'INTERNAL_ROUTE',
          isComponentLink: isLayout,
        });
      }

      // Match Object Configs in Navigation files
      if (isLayout) {
        let objMatch;
        while ((objMatch = objectUrlRegex.exec(lineText)) !== null) {
          const url = objMatch[1].trim();
          // Avoid duplicate push if already captured by JSX
          if (!links.some(l => l.startLine === lineNum && l.url === url)) {
            links.push({
              url,
              anchorText: undefined,
              startLine: lineNum,
              endLine: lineNum,
              type: url.startsWith('http') ? 'EXTERNAL_URL' : 'INTERNAL_ROUTE',
              isComponentLink: true,
            });
          }
        }
      }
    });

    return {
      filePath,
      isLayout,
      detectedRoute,
      links,
      totalLines: lines.length,
    };
  }
}
