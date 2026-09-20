#!/usr/bin/env bun
import { resolve } from 'path';
import { ScannerPipeline } from './engine/scanner.ts';

// ANSI terminal colors without external heavy packages
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const red = '\x1b[31m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const magenta = '\x1b[35m';
const cyan = '\x1b[36m';
const gray = '\x1b[90m';

function parseArgs() {
  const args = process.argv.slice(2);
  let targetDir = process.cwd();
  let repoName = 'acme/docs';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      targetDir = resolve(process.cwd(), args[i + 1]);
      i++;
    } else if (args[i] === '--repo' && args[i + 1]) {
      repoName = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  return { targetDir, repoName, dryRun };
}

async function main() {
  const { targetDir, repoName, dryRun } = parseArgs();

  console.log(`\n${bold}${magenta}🛡️  DEAD LINK INSURANCE${reset} — ${cyan}Impact & Blast Radius Engine${reset}`);
  console.log(`${gray}Scanning directory: ${targetDir}${reset}\n`);

  const report = await ScannerPipeline.scan({
    rootDir: targetDir,
    repoName,
    dryRun,
  });

  console.log(`${bold}──────── SCAN METRICS ────────${reset}`);
  console.log(`• Scanned Files:         ${bold}${report.scannedFiles}${reset}`);
  console.log(`• Total Links Discovered: ${bold}${report.totalLinksFound}${reset}`);
  console.log(`• Unique URLs Checked:   ${bold}${report.uniqueUrlsChecked}${reset}`);
  console.log(`• Dead Links Detected:   ${report.brokenLinksDetected > 0 ? red + bold + report.brokenLinksDetected : green + '0'}${reset}`);
  console.log(`• Plan Usage:            ${cyan}${report.usageStatus.currentUsage} / ${report.usageStatus.monthlyLimit} links (${report.usageStatus.percentageUsed}% of $29/mo cap)${reset}\n`);

  if (report.incidents.length === 0) {
    console.log(`${green}${bold}✅ ALL CLEAR:${reset} No broken links found. High navigation integrity maintained.\n`);
    process.exit(0);
  }

  console.log(`${bold}${red}🚨 ACTIONABLE INCIDENTS DETECTED (${report.incidents.length} Root Causes)${reset}\n`);

  report.incidents.forEach((inc, index) => {
    const sevBadge = inc.severity === 'P0_CRITICAL'
      ? `${red}${bold}[P0 CRITICAL]${reset}`
      : inc.severity === 'P1_HIGH'
      ? `${yellow}${bold}[P1 HIGH]${reset}`
      : `${blue}${bold}[P2 LOW]${reset}`;

    console.log(`${sevBadge} ${bold}${inc.url}${reset}`);
    console.log(`   ${gray}├─${reset} ${bold}Source:${reset}      ${inc.sourceFile} (Line ${inc.startLine})`);
    console.log(`   ${gray}├─${reset} ${bold}Blast Radius:${reset} ${red}${bold}${inc.blastRadiusCount} live pages affected${reset}`);
    console.log(`   ${gray}├─${reset} ${bold}Impact:${reset}      ${inc.summaryText}`);
    console.log(`   ${gray}└─${reset} ${bold}Fix Ready:${reset}   ${green}${inc.remediation.pullRequestTitle}${reset}`);

    if (inc.remediation.diff) {
      console.log(`\n${gray}   Suggested Git Patch:${reset}`);
      inc.remediation.diff.split('\n').forEach(line => {
        if (line.startsWith('+')) console.log(`     ${green}${line}${reset}`);
        else if (line.startsWith('-')) console.log(`     ${red}${line}${reset}`);
        else console.log(`     ${gray}${line}${reset}`);
      });
    }
    console.log('');
  });

  console.log(`${bold}──────── REMEDIATION SUMMARY ────────${reset}`);
  console.log(`${cyan}Pull Request generation ready for ${report.incidents.length} issue(s).${reset}`);
  console.log(`Review or merge fixes locally or launch the web dashboard via ${bold}bun start${reset}.\n`);

  if (report.p0Incidents > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`${red}Fatal error during scan:${reset}`, err);
  process.exit(1);
});
