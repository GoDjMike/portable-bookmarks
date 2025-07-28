# Portable Bookmarks

*Sync your bookmarks across multiple chrome-based browsers, 24/7.*

A pre-alpha chrome extension syncing your bookmarks, links and folders across Chrome, Arc (in progress), Comet, and Dia.
  - try out all the new browsers without losing your bookmarks and folders
  - (self-host) locally run a sync engine that persists across restarts
  - (cloud) set-and-forget a smarter way to bring your bookmarks with you
     - future: remote MCP server support to pass your bookmark(s) as LLM context

[note: pre-alpha is in a **non-working state as of 7/28/2025**. Fixing ASAP.]

## Features

- **Automatic Git Tracking**: Every bookmark change is automatically tracked and committed
- **Real-time Monitoring**: Detects bookmark additions, deletions, moves, and modifications
- **Commit History**: View complete history of bookmark changes with timestamps
- **Manual Snapshots**: Create manual bookmark snapshots with custom commit messages
- **Export/Import**: Backup and restore your bookmark Git repository
- **Cross-Browser Compatibility**: Works on Chrome, Arc, Comet, Dia, and other Chromium browsers
- **Manifest V3**: Built with the latest Chrome extension standards

## Installation

### From Source

1. **Download the Extension**:
   - Clone or download this repository
   - Extract the files to a folder

2. **Enable Developer Mode**:
   - Open Chrome (or your Chromium browser)
   - Go to `chrome://extensions/`
   - Enable "Developer mode" in the top right

3. **Load the Extension**:
   - Click "Load unpacked"
   - Select the `bookmark-git-tracker` folder
   - The extension will be installed and activated

4. **Verify Installation**:
   - Look for the bookmark Git tracker icon in your browser toolbar
   - Click the icon to open the popup interface

## Usage

### Automatic Tracking

Once installed, the extension automatically:
- Creates an initial snapshot of your current bookmarks
- Monitors all bookmark changes in real-time
- Creates Git commits for every change (batched within 1-second intervals)
- Stores complete history in Chrome's local storage

### Manual Operations

#### Creating Manual Snapshots
1. Click the extension icon in your toolbar
2. Click "Create Snapshot"
3. Enter a descriptive commit message
4. Click "Create Snapshot" to save

#### Viewing Commit History
1. Open the extension popup
2. Browse the "History" tab to see all commits
3. Each commit shows:
   - Commit message and timestamp
   - Author information
   - Number of bookmarks and folders
   - Short commit hash

#### Viewing Statistics
1. Switch to the "Stats" tab in the popup
2. View repository statistics including:
   - Total commits
   - Current bookmark/folder count
   - Repository age
   - Last commit time

#### Configuring Settings
1. Click the options button (gear icon) in the popup
2. Or go to `chrome://extensions/` and click "Options" for the extension
3. Configure:
   - Git author name and email
   - Automatic commit settings
   - Commit delay timing

#### Export/Import Repository
1. Go to the Options page
2. Click "Export Repository" to download a backup
3. Use "Import Repository" to restore from a backup file
4. Use "Reset Repository" to start fresh (warning: this deletes all history)

## Supported Events

The extension tracks these bookmark operations:

- **Created**: When new bookmarks or folders are added
- **Removed**: When bookmarks or folders are deleted
- **Moved**: When bookmarks are moved between folders
- **Changed**: When bookmark titles or URLs are modified
- **Reordered**: When bookmarks within a folder are rearranged
- **Import**: When bookmarks are imported from another browser

## Browser Compatibility

This extension works on all Chromium-based browsers:

- ✅ **Google Chrome** - Full support
- ✅ **Arc Browser** - Full support
- ✅ **Comet Browser** - Full support
- ✅ **Dia Browser** - Full support
- ✅ **Microsoft Edge** - Full support
- ✅ **Brave** - Full support
- ✅ **Opera** - Full support
- ✅ **Vivaldi** - Full support

## Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome extension standards
- **Service Worker**: Background script runs as a service worker for efficiency
- **Chrome Storage API**: Stores Git repository data locally
- **Chrome Bookmarks API**: Monitors bookmark changes in real-time

### Data Storage

- All Git data is stored locally using Chrome's storage API
- No external servers or cloud storage required
- Repository data includes commits, author info, and timestamps
- Backup files are standard JSON format

### Git Implementation

The extension implements a simplified Git-like system:
- **Commits**: Each bookmark change creates a commit with metadata
- **Hashing**: Commits are identified by unique hashes
- **History**: Linear commit history with parent references
- **Branches**: Basic branch support (currently single branch)
- **Diffs**: Basic statistics on changes between commits

## Development

### Project Structure

```
bookmark-git-tracker/
├── manifest.json          # Extension manifest
├── background.js          # Service worker (main logic)
├── git-manager.js         # Git operations handler
├── popup.html            # Extension popup interface
├── popup.js              # Popup logic
├── options.html          # Settings page
├── options.js            # Settings logic
├── styles.css            # Popup styles
├── options.css           # Options page styles
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Key Components

1. **BookmarkTracker**: Main class that monitors bookmark events
2. **GitManager**: Handles Git operations and storage
3. **PopupController**: Manages the popup interface
4. **OptionsController**: Handles settings and configuration

### Building from Source

No build process required! This is a pure JavaScript extension that can be loaded directly into Chrome.

## Troubleshooting

### Extension Not Working
- Ensure Developer Mode is enabled
- Check that all files are present in the extension folder
- Look for errors in the Chrome extensions page

### Missing Bookmark Events
- Verify the extension has bookmark permissions
- Check the popup to see if the status shows "Active"
- Look at browser console for error messages

### Storage Issues
- Large bookmark collections may use more storage
- Use Export/Import to backup data regularly
- Reset repository if storage becomes corrupted

## Privacy & Security

- **Local Only**: All data stays on your device
- **No Network Access**: Extension doesn't connect to external servers
- **Open Source**: All code is available for review
- **Minimal Permissions**: Only requests necessary bookmark and storage permissions

## License

MIT | `The MIT License` - 2025 - Mike Brummett. See LICENSE file for details.

## Changelog

### Version 1.0.0
- Initial release
- Automatic bookmark tracking
- Git-style commit history
- Manual snapshot creation
- Export/Import functionality
- Cross-browser compatibility
- Manifest V3 support
