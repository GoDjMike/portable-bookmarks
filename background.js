import GitManager from './git-manager.js';

class BookmarkTracker {
  constructor() {
    this.gitManager = new GitManager();
    this.isInitialized = false;
    this.pendingChanges = [];
    this.changeBuffer = null;
    this.bufferDelay = 1000; // 1 second delay to batch rapid changes
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      await this.gitManager.initialize();
      await this.createInitialSnapshot();
      this.setupBookmarkListeners();
      this.isInitialized = true;
      console.log('Bookmark Git Tracker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Bookmark Git Tracker:', error);
    }
  }

  async createInitialSnapshot() {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const hasCommits = await this.gitManager.hasCommits();
      
      if (!hasCommits) {
        await this.gitManager.createCommit(
          bookmarkTree,
          'Initial bookmark snapshot',
          'system'
        );
        console.log('Created initial bookmark snapshot');
      }
    } catch (error) {
      console.error('Failed to create initial snapshot:', error);
    }
  }

  setupBookmarkListeners() {
    // Listen to bookmark creation
    chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
      await this.handleBookmarkChange('created', { id, bookmark });
    });

    // Listen to bookmark removal
    chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
      await this.handleBookmarkChange('removed', { id, removeInfo });
    });

    // Listen to bookmark moves
    chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
      await this.handleBookmarkChange('moved', { id, moveInfo });
    });

    // Listen to bookmark updates (title/URL changes)
    chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
      await this.handleBookmarkChange('changed', { id, changeInfo });
    });

    // Listen to bookmark reordering
    chrome.bookmarks.onChildrenReordered.addListener(async (id, reorderInfo) => {
      await this.handleBookmarkChange('reordered', { id, reorderInfo });
    });

    // Listen to import events
    chrome.bookmarks.onImportBegan.addListener(async () => {
      await this.handleBookmarkChange('import_began', {});
    });

    chrome.bookmarks.onImportEnded.addListener(async () => {
      await this.handleBookmarkChange('import_ended', {});
    });
  }

  async handleBookmarkChange(eventType, details) {
    try {
      // Add change to pending list
      this.pendingChanges.push({
        timestamp: Date.now(),
        eventType,
        details
      });

      // Clear existing buffer and set new one
      if (this.changeBuffer) {
        clearTimeout(this.changeBuffer);
      }

      this.changeBuffer = setTimeout(async () => {
        await this.processBufferedChanges();
      }, this.bufferDelay);

    } catch (error) {
      console.error('Error handling bookmark change:', error);
    }
  }

  async processBufferedChanges() {
    if (this.pendingChanges.length === 0) return;

    try {
      // Get current bookmark tree
      const bookmarkTree = await chrome.bookmarks.getTree();
      
      // Create commit message based on changes
      const commitMessage = this.generateCommitMessage(this.pendingChanges);
      
      // Create Git commit
      await this.gitManager.createCommit(
        bookmarkTree,
        commitMessage,
        'user'
      );

      // Store change details in storage for history view
      await this.storeChangeHistory(this.pendingChanges);

      console.log(`Created commit for ${this.pendingChanges.length} bookmark changes`);
      
      // Clear pending changes
      this.pendingChanges = [];
      this.changeBuffer = null;

    } catch (error) {
      console.error('Error processing buffered changes:', error);
    }
  }

  generateCommitMessage(changes) {
    if (changes.length === 1) {
      const change = changes[0];
      switch (change.eventType) {
        case 'created':
          return `Added bookmark: ${change.details.bookmark.title || change.details.bookmark.url || 'New folder'}`;
        case 'removed':
          return `Removed bookmark (ID: ${change.details.id})`;
        case 'moved':
          return `Moved bookmark (ID: ${change.details.id})`;
        case 'changed':
          return `Modified bookmark (ID: ${change.details.id})`;
        case 'reordered':
          return `Reordered bookmarks in folder (ID: ${change.details.id})`;
        case 'import_began':
          return 'Started bookmark import';
        case 'import_ended':
          return 'Completed bookmark import';
        default:
          return `Bookmark ${change.eventType}`;
      }
    } else {
      const eventCounts = {};
      changes.forEach(change => {
        eventCounts[change.eventType] = (eventCounts[change.eventType] || 0) + 1;
      });
      
      const summary = Object.entries(eventCounts)
        .map(([event, count]) => `${count} ${event}`)
        .join(', ');
      
      return `Bulk bookmark changes: ${summary}`;
    }
  }

  async storeChangeHistory(changes) {
    try {
      const result = await chrome.storage.local.get(['changeHistory']);
      const history = result.changeHistory || [];
      
      const historyEntry = {
        timestamp: Date.now(),
        changes: changes,
        commitMessage: this.generateCommitMessage(changes)
      };
      
      history.unshift(historyEntry);
      
      // Keep only last 100 history entries
      if (history.length > 100) {
        history.splice(100);
      }
      
      await chrome.storage.local.set({ changeHistory: history });
    } catch (error) {
      console.error('Error storing change history:', error);
    }
  }

  // Method to manually create a snapshot (called from popup)
  async createManualSnapshot(message = 'Manual bookmark snapshot') {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      await this.gitManager.createCommit(bookmarkTree, message, 'manual');
      return { success: true, message: 'Snapshot created successfully' };
    } catch (error) {
      console.error('Error creating manual snapshot:', error);
      return { success: false, error: error.message };
    }
  }

  // Method to get commit history (called from popup)
  async getCommitHistory(limit = 50) {
    try {
      return await this.gitManager.getCommitHistory(limit);
    } catch (error) {
      console.error('Error getting commit history:', error);
      return [];
    }
  }

  // Method to restore bookmarks from a specific commit
  async restoreFromCommit(commitHash) {
    try {
      const bookmarkData = await this.gitManager.getCommitData(commitHash);
      if (!bookmarkData) {
        throw new Error('Commit data not found');
      }

      // This is complex - we need to carefully replace the bookmark tree
      // For now, we'll return the data and let the user manually import
      return { success: true, data: bookmarkData };
    } catch (error) {
      console.error('Error restoring from commit:', error);
      return { success: false, error: error.message };
    }
  }

  // Method to get repository statistics
  async getRepositoryStats() {
    try {
      return await this.gitManager.getRepositoryStats();
    } catch (error) {
      console.error('Error getting repository stats:', error);
      return null;
    }
  }

  // Method to export repository
  async exportRepository() {
    try {
      return await this.gitManager.exportRepository();
    } catch (error) {
      console.error('Error exporting repository:', error);
      return null;
    }
  }

  // Method to import repository
  async importRepository(data) {
    try {
      // Reset current repository
      await this.gitManager.resetRepository();
      
      // Import the new data
      await chrome.storage.local.set({
        [this.gitManager.repositoryKey]: data.repository,
        [this.gitManager.commitsKey]: data.commits,
        [this.gitManager.branchKey]: data.currentBranch || 'main',
        [this.gitManager.configKey]: data.config || {}
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error importing repository:', error);
      return { success: false, error: error.message };
    }
  }

  // Method to reset repository
  async resetRepository() {
    try {
      const success = await this.gitManager.resetRepository();
      return { success };
    } catch (error) {
      console.error('Error resetting repository:', error);
      return { success: false, error: error.message };
    }
  }
}

// Initialize the tracker
const tracker = new BookmarkTracker();

// Handle extension startup
chrome.runtime.onStartup.addListener(async () => {
  await tracker.initialize();
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(async () => {
  await tracker.initialize();
});

// Handle messages from popup/options
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  try {
    let response;
    
    switch (request.action) {
      case 'createSnapshot':
        response = await tracker.createManualSnapshot(request.message);
        break;
      case 'getCommitHistory':
        response = await tracker.getCommitHistory(request.limit);
        break;
      case 'restoreFromCommit':
        response = await tracker.restoreFromCommit(request.commitHash);
        break;
      case 'getStatus':
        response = {
          initialized: tracker.isInitialized,
          pendingChanges: tracker.pendingChanges.length
        };
        break;
      case 'getRepositoryStats':
        response = await tracker.getRepositoryStats();
        break;
      case 'exportRepository':
        response = await tracker.exportRepository();
        break;
      case 'importRepository':
        response = await tracker.importRepository(request.data);
        break;
      case 'resetRepository':
        response = await tracker.resetRepository();
        break;
      default:
        response = { error: 'Unknown action' };
    }
    
    sendResponse(response);
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
  
  return true; // Keep the message channel open for async response
});

// Initialize on load
tracker.initialize();