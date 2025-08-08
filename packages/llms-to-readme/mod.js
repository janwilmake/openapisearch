#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Parse git config to extract remote URL information
 */
function parseGitRemote() {
  try {
    const gitConfigPath = path.join(".git", "config");
    if (!fs.existsSync(gitConfigPath)) {
      throw new Error("Not a git repository");
    }

    const gitConfig = fs.readFileSync(gitConfigPath, "utf8");
    const remoteMatch = gitConfig.match(
      /\[remote "origin"\]\s*\n\s*url = (.+)/
    );

    if (!remoteMatch) {
      throw new Error("No origin remote found");
    }

    const remoteUrl = remoteMatch[1].trim();

    // Parse GitHub URL (supports both HTTPS and SSH)
    let owner, repo;
    if (remoteUrl.startsWith("https://github.com/")) {
      const match = remoteUrl.match(
        /https:\/\/github\.com\/([^\/]+)\/([^\/\.]+)/
      );
      if (match) {
        owner = match[1];
        repo = match[2];
      }
    } else if (remoteUrl.startsWith("git@github.com:")) {
      const match = remoteUrl.match(/git@github\.com:([^\/]+)\/([^\/\.]+)/);
      if (match) {
        owner = match[1];
        repo = match[2];
      }
    }

    if (!owner || !repo) {
      throw new Error("Could not parse GitHub owner/repo from remote URL");
    }

    return { owner, repo };
  } catch (error) {
    throw new Error(`Failed to parse git remote: ${error.message}`);
  }
}

/**
 * Get the default branch name
 */
function getDefaultBranch() {
  try {
    // Try to get the default branch from git
    const defaultBranch = execSync(
      "git symbolic-ref refs/remotes/origin/HEAD",
      { encoding: "utf8" }
    )
      .trim()
      .replace("refs/remotes/origin/", "");
    return defaultBranch;
  } catch {
    // Fallback to current branch
    try {
      const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
      }).trim();
      return currentBranch;
    } catch {
      // Final fallback
      return "main";
    }
  }
}

/**
 * Process markdown links in the content
 */
function processMarkdownLinks(content, owner, repo, defaultBranch) {
  // Regular expression to match markdown links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)(\s*:\s*[^\n]*)?/g;

  return content.replace(linkRegex, (match, text, url, description) => {
    // Check if it's a relative link (doesn't start with http:// or https://)
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      // Make it relative to root if it doesn't start with /
      const normalizedUrl = url.startsWith("/") ? url.slice(1) : url;

      const fullUrl = `https://uithub.com/${owner}/${repo}/tree/${defaultBranch}/${normalizedUrl}`;
      const badgeUrl = `https://badge.forgithub.com/${owner}/${repo}/tree/${defaultBranch}/${normalizedUrl}`;
      const promptifyUrl = `https://letmeprompt.com/?q=${encodeURIComponent(
        fullUrl + " \n\nYour Prompt...."
      )}`;

      const buttons = `[![](${badgeUrl})](${fullUrl}) [![](https://b.lmpify.com/Ask_AI)](${promptifyUrl})`;

      return `[${text}](${fullUrl})${description || ""}\n${buttons}`;
    }

    // For absolute URLs, still add the buttons
    const promptifyUrl = `https://letmeprompt.com/?q=${encodeURIComponent(
      url + " \n\nYour Prompt...."
    )}`;
    const buttons = `[![](https://badge.forgithub.com/static/badge)](${url}) [![](https://b.lmpify.com/Ask_AI)](${promptifyUrl})`;

    return `${match}\n${buttons}`;
  });
}

/**
 * Convert llms.txt to README.md
 */
function convertLlmsTxtToReadme(
  llmsTxtPath = "llms.txt",
  readmePath = "README.md"
) {
  try {
    // Check if llms.txt exists
    if (!fs.existsSync(llmsTxtPath)) {
      throw new Error(`${llmsTxtPath} not found`);
    }

    // Read llms.txt content
    const content = fs.readFileSync(llmsTxtPath, "utf8");

    // Get git information
    const { owner, repo } = parseGitRemote();
    const defaultBranch = getDefaultBranch();

    console.log(
      `Processing ${llmsTxtPath} for ${owner}/${repo} (${defaultBranch} branch)`
    );

    // Process the content
    const processedContent = processMarkdownLinks(
      content,
      owner,
      repo,
      defaultBranch
    );

    // Write to README.md
    fs.writeFileSync(readmePath, processedContent);

    console.log(`Successfully converted ${llmsTxtPath} to ${readmePath}`);
    return processedContent;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// CLI functionality
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: node llms-to-readme.js [llms.txt] [README.md]

Convert llms.txt to README.md with enhanced GitHub links and buttons.

Arguments:
  llms.txt     Path to llms.txt file (default: llms.txt)
  README.md    Output path for README.md (default: README.md)

Options:
  -h, --help   Show this help message

Examples:
  node llms-to-readme.js
  node llms-to-readme.js docs/llms.txt docs/README.md
`);
    process.exit(0);
  }

  const llmsTxtPath = args[0] || "llms.txt";
  const readmePath = args[1] || "README.md";

  convertLlmsTxtToReadme(llmsTxtPath, readmePath);
}

// Export for use as a module
module.exports = {
  convertLlmsTxtToReadme,
  parseGitRemote,
  getDefaultBranch,
  processMarkdownLinks,
};
