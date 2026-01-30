#!/usr/bin/env node

const fs = require('fs');
const { spawn } = require('child_process');
const { Marked } = require('marked');
const { markedTerminal } = require('marked-terminal');
const chalk = require('chalk');

// Force chalk colors
chalk.level = 3;

// Configure marked - compact, minimal spacing
const marked = new Marked(
    markedTerminal({
        width: 100,
        reflowText: true,
        showSectionPrefix: false,
        tab: 2,
        emoji: true,
        unescape: true,
        // Compact styling
        paragraph: chalk.hex('#000000'),
        firstHeading: (text, level) => chalk.hex('#0000FF').bold('#'.repeat(level || 1) + ' ' + text),
        heading: (text, level) => chalk.hex('#0000FF').bold('#'.repeat(level || 2) + ' ' + text),
        strong: (text) => chalk.hex('#000000').bold(text),
        em: chalk.hex('#000000').italic,
        codespan: chalk.bgHex('#E0E0E0').hex('#000000'),
        blockquote: (text) => text.split('\n').map(line => chalk.hex('#000000').dim('│ ' + line)).join('\n'),
        code: chalk.bgHex('#E0E0E0').hex('#000000'),
        link: chalk.hex('#000000').underline,
        href: chalk.hex('#000000').dim,
        hr: () => chalk.hex('#AAAAAA')('─'.repeat(60)),
        listitem: chalk.hex('#000000'),
        // Table
        tableOptions: {
            chars: {
                'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
                'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
                'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
                'right': '│', 'right-mid': '┤', 'middle': '│'
            },
            style: { head: [], border: [] }
        },
    })
);

function render(content) {
    let result = marked.parse(content);
    // Remove excessive blank lines (make compact)
    result = result.replace(/\n{3,}/g, '\n\n');
    // Convert any remaining **text** to bold
    result = result.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text));
    // Convert any remaining *text* to italic
    result = result.replace(/\*([^*]+)\*/g, (_, text) => chalk.italic(text));
    // Convert any remaining `code` to grey background
    result = result.replace(/`([^`]+)`/g, (_, text) => chalk.bgHex('#E0E0E0').hex('#000000')(text));
    // Add left padding to each line
    result = result.split('\n').map(line => '  ' + line).join('\n');
    return result;
}

function showWithLess(content, filename, onClose, startLine) {
    const os = require('os');
    const path = require('path');

    const header = '  ' + chalk.inverse.black(` ${filename} `) + '\n\n';
    const rendered = header + render(content);

    // Write to temp file so less can have full terminal control
    const tmpFile = path.join(os.tmpdir(), `mdview-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, rendered);

    // %Pb = percentage through file by line, bottom of screen (shows 100% at end)
    // \% = literal % sign in less prompt
    const lessArgs = [
        '-R',
        '-i',
        '-M',
        '-Ps%Pb\\\\%',
        '-Pm%Pb\\\\%',
        '-PM%Pb\\\\%  ↑/↓:scroll  PgUp/PgDn:page  q:quit',
    ];
    if (startLine && startLine > 1) {
        lessArgs.push(`+${startLine}`);
    }
    lessArgs.push(tmpFile);

    const less = spawn('less', lessArgs, {
        stdio: 'inherit'
    });

    less.on('close', () => {
        fs.unlinkSync(tmpFile);
        if (onClose) {
            onClose();
        } else {
            process.exit(0);
        }
    });
}

function showHelp() {
    console.log(`
${chalk.bold('mdview')} - Markdown viewer for terminal

${chalk.bold('Usage:')}
  mdview <file.md>
  cat file.md | mdview

${chalk.bold('Keys (in less):')}
  j/↓/Enter  Scroll down
  k/↑        Scroll up
  Space/PgDn Page down
  b/PgUp     Page up
  g          Go to top
  G          Go to bottom
  /pattern   Search forward
  ?pattern   Search backward
  n          Next match
  N          Previous match
  q          Quit

${chalk.bold('Mouse:')}
  Select     Copy text directly
`);
}

function findMarkdownFiles(dir) {
    const path = require('path');
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            results.push(...findMarkdownFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
            results.push(fullPath);
        }
    }
    return results.sort();
}

function searchInFiles(files, query) {
    const path = require('path');
    const results = [];
    const lowerQuery = query.toLowerCase();
    for (const file of files) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(lowerQuery)) {
                    results.push({
                        file: file,
                        basename: path.basename(file),
                        relPath: path.relative('.', file),
                        line: i + 1,
                        preview: lines[i].trim().substring(0, 80)
                    });
                    break; // only first match per file
                }
            }
        } catch (e) { /* skip unreadable files */ }
    }
    return results;
}

function showFileSelector(files) {
    const path = require('path');
    let selected = 0;
    let inputHandler;
    let searchMode = false;
    let searchQuery = '';
    let searchResults = [];

    const renderList = () => {
        process.stdout.write('\x1B[2J\x1B[H');

        if (searchMode) {
            console.log(chalk.hex('#0000FF').bold('\n  Search in files\n'));
            console.log(chalk.hex('#AAAAAA')(`  / `) + chalk.white(searchQuery) + chalk.hex('#FFFFFF').bold('█') + '\n');

            if (searchQuery.length > 0 && searchResults.length > 0) {
                searchResults.forEach((result, i) => {
                    const lineInfo = chalk.hex('#888888')(`L${result.line}`);
                    const preview = chalk.hex('#666666')(result.preview);
                    if (i === selected) {
                        console.log(chalk.bgHex('#0000FF').hex('#FFFFFF')(`  > ${result.relPath} `) + ' ' + lineInfo);
                        console.log(chalk.hex('#999999')(`      ${preview}`));
                    } else {
                        console.log(chalk.hex('#000000')(`    ${result.relPath} `) + lineInfo);
                        console.log(chalk.hex('#666666')(`      ${preview}`));
                    }
                });
            } else if (searchQuery.length > 0) {
                console.log(chalk.hex('#888888')('  No matches found'));
            }
            console.log(chalk.hex('#AAAAAA')('\n  Enter:open  Esc:back  type to search'));
            return;
        }

        console.log(chalk.hex('#0000FF').bold('\n  Markdown files\n'));
        files.forEach((file, i) => {
            const relPath = path.relative('.', file);
            if (i === selected) {
                console.log(chalk.bgHex('#0000FF').hex('#FFFFFF')(`  > ${relPath}  `));
            } else {
                console.log(chalk.hex('#000000')(`    ${relPath}`));
            }
        });
        console.log(chalk.hex('#AAAAAA')('\n  ↑/↓ navigate  Enter select  / search  q quit'));
    };

    const startSelector = () => {
        searchMode = false;
        searchQuery = '';
        searchResults = [];
        selected = 0;
        renderList();
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', inputHandler);
    };

    inputHandler = (key) => {
        // Ctrl+C
        if (key === '\u0003') {
            process.stdout.write('\x1B[2J\x1B[H');
            process.exit(0);
        }

        if (searchMode) {
            // Escape - exit search
            if (key === '\x1B' && key.length === 1) {
                searchMode = false;
                searchQuery = '';
                searchResults = [];
                selected = 0;
                renderList();
                return;
            }
            // Backspace
            if (key === '\x7F' || key === '\b') {
                searchQuery = searchQuery.slice(0, -1);
                if (searchQuery.length > 0) {
                    searchResults = searchInFiles(files, searchQuery);
                } else {
                    searchResults = [];
                }
                selected = 0;
                renderList();
                return;
            }
            // Enter - open selected result
            if (key === '\r' || key === '\n') {
                if (searchResults.length > 0) {
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    process.stdin.removeAllListeners('data');
                    process.stdout.write('\x1B[2J\x1B[H');
                    const result = searchResults[selected];
                    const content = fs.readFileSync(result.file, 'utf8');
                    showWithLess(content, result.relPath, startSelector, result.line);
                }
                return;
            }
            // Up arrow
            if (key === '\x1B[A') {
                if (searchResults.length > 0) {
                    selected = selected > 0 ? selected - 1 : searchResults.length - 1;
                }
                renderList();
                return;
            }
            // Down arrow
            if (key === '\x1B[B') {
                if (searchResults.length > 0) {
                    selected = selected < searchResults.length - 1 ? selected + 1 : 0;
                }
                renderList();
                return;
            }
            // Printable character - add to search
            if (key.length === 1 && key >= ' ') {
                searchQuery += key;
                searchResults = searchInFiles(files, searchQuery);
                selected = 0;
                renderList();
                return;
            }
            return;
        }

        // Normal mode
        // q to quit
        if (key === 'q') {
            process.stdout.write('\x1B[2J\x1B[H');
            process.exit(0);
        }
        // / to enter search mode
        if (key === '/') {
            searchMode = true;
            searchQuery = '';
            searchResults = [];
            selected = 0;
            renderList();
            return;
        }
        // Enter
        if (key === '\r' || key === '\n') {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeAllListeners('data');
            process.stdout.write('\x1B[2J\x1B[H');
            const content = fs.readFileSync(files[selected], 'utf8');
            const relPath = path.relative('.', files[selected]);
            showWithLess(content, relPath, startSelector);
            return;
        }
        // Up arrow
        if (key === '\x1B[A' || key === 'k') {
            selected = selected > 0 ? selected - 1 : files.length - 1;
            renderList();
        }
        // Down arrow
        if (key === '\x1B[B' || key === 'j') {
            selected = selected < files.length - 1 ? selected + 1 : 0;
            renderList();
        }
    };

    startSelector();
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('-h') || args.includes('--help')) {
        showHelp();
        return;
    }

    // Stdin
    if (!process.stdin.isTTY && args.length === 0) {
        let content = '';
        process.stdin.setEncoding('utf8');
        for await (const chunk of process.stdin) {
            content += chunk;
        }
        if (content.trim()) {
            showWithLess(content, 'stdin');
        }
        return;
    }

    const target = args[0] || '.';
    const path = require('path');

    if (!fs.existsSync(target)) {
        console.error(chalk.red(`  Error: Not found: ${target}`));
        process.exit(1);
    }

    const stat = fs.statSync(target);

    // Directory - show file selector
    if (stat.isDirectory()) {
        const mdFiles = findMarkdownFiles(target);
        if (mdFiles.length === 0) {
            console.error(chalk.red(`  No markdown files found in ${target}`));
            process.exit(1);
        }
        showFileSelector(mdFiles);
        return;
    }

    // File - open directly
    const content = fs.readFileSync(target, 'utf8');
    showWithLess(content, path.basename(target));
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
