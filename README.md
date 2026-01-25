# mdview

A beautiful, minimal Markdown viewer for the terminal.

## Features

- **Interactive file selector** - Navigate with arrow keys, select with Enter
- **Clean rendering** - Black text on terminal background, blue headings
- **Full keyboard navigation** - Scroll, search, page up/down
- **Mouse text selection** - Select and copy text directly
- **Progress indicator** - Shows percentage read at bottom
- **Compact output** - Minimal spacing, easy to read

## Installation

```bash
git clone https://github.com/padrian2s/mdview.git
cd mdview
./install.sh
```

## Usage

```bash
# Open file selector in current directory
mdview

# Open file selector in specific directory
mdview ~/documents/notes

# Open specific file
mdview README.md

# Pipe content
cat file.md | mdview
```

## Keyboard Shortcuts

### File Selector
| Key | Action |
|-----|--------|
| `↑` / `k` | Move up |
| `↓` / `j` | Move down |
| `Enter` | Open file |
| `q` | Quit |

### Document Viewer
| Key | Action |
|-----|--------|
| `↑` / `k` | Scroll up |
| `↓` / `j` | Scroll down |
| `Space` / `PageDown` | Page down |
| `b` / `PageUp` | Page up |
| `g` | Go to top |
| `G` | Go to bottom |
| `/` | Search forward |
| `?` | Search backward |
| `n` | Next match |
| `N` | Previous match |
| `q` | Back to file selector |

## Markdown Support

- **Headings** - `#`, `##`, `###` displayed in blue with prefix
- **Bold** - `**text**` rendered as bold
- **Italic** - `*text*` rendered as italic
- **Code** - `` `inline` `` and ``` code blocks ``` with grey background
- **Blockquotes** - `> text` with `│` prefix on each line
- **Lists** - Bulleted and numbered lists
- **Tables** - ASCII table rendering
- **Horizontal rules** - Solid grey line
- **Links** - Underlined text

## License

MIT
