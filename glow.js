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

function showWithLess(content, filename, onClose) {
    const os = require('os');
    const path = require('path');

    const header = '  ' + chalk.inverse.black(` ${filename} `) + '\n\n';
    const rendered = header + render(content);

    // Write to temp file so less can have full terminal control
    const tmpFile = path.join(os.tmpdir(), `mdview-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, rendered);

    const less = spawn('less', [
        '-R',           // Raw control chars (colors)
        '-i',           // Case insensitive search
        '-Ps%pt%%',     // Short prompt: percentage with %
        '-Pm%pt%%',     // Medium prompt: percentage with %
        '-PM%pt%%',     // Long prompt: percentage with %
        tmpFile
    ], {
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
    const files = fs.readdirSync(dir);
    return files.filter(f => f.endsWith('.md') || f.endsWith('.markdown'))
                .sort();
}

function showFileSelector(files) {
    let selected = 0;
    let inputHandler;

    const renderList = () => {
        // Clear screen and move cursor to top
        process.stdout.write('\x1B[2J\x1B[H');
        console.log(chalk.hex('#0000FF').bold('\n  Markdown files\n'));
        files.forEach((file, i) => {
            const basename = require('path').basename(file);
            if (i === selected) {
                console.log(chalk.bgHex('#0000FF').hex('#FFFFFF')(`  > ${basename}  `));
            } else {
                console.log(chalk.hex('#000000')(`    ${basename}`));
            }
        });
        console.log(chalk.hex('#AAAAAA')('\n  ↑/↓ navigate  Enter select  q quit'));
    };

    const startSelector = () => {
        renderList();
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', inputHandler);
    };

    inputHandler = (key) => {
        // Ctrl+C or q
        if (key === '\u0003' || key === 'q') {
            process.stdout.write('\x1B[2J\x1B[H');
            process.exit(0);
        }
        // Enter
        if (key === '\r' || key === '\n') {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeAllListeners('data');
            process.stdout.write('\x1B[2J\x1B[H');
            const content = fs.readFileSync(files[selected], 'utf8');
            const basename = require('path').basename(files[selected]);
            showWithLess(content, basename, startSelector);
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
        const mdFiles = findMarkdownFiles(target).map(f => path.join(target, f));
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
