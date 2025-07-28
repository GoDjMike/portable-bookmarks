class PopupController {
  constructor() {
    this.currentTab = 'history';
    this.commitHistory = [];
    this.filteredHistory = [];
    this.repoStats = null;
    
    this.initializeElements();
    this.setupEventListeners();
    this.loadData();
  }

  initializeElements() {
    // Status elements
    this.statusDot = document.getElementById('status-dot');
    this.statusText = document.getElementById('status-text');
    this.commitCount = document.getElementById('commit-count');

    // Action buttons
    this.createSnapshotBtn = document.getElementById('create-snapshot-btn');
    this.refreshBtn = document.getElementById('refresh-btn');
    this.optionsBtn = document.getElementById('options-btn');

    // Tabs
    this.historyTab = document.getElementById('history-tab');
    this.statsTab = document.getElementById('stats-tab');

    // Panels
    this.historyPanel = document.getElementById('history-panel');
    this.statsPanel = document.getElementById('stats-panel');

    // History elements
    this.searchInput = document.getElementById('search-input');
    this.commitList = document.getElementById('commit-list');

    // Stats elements
    this.totalCommits = document.getElementById('total-commits');
    this.totalBookmarks = document.getElementById('total-bookmarks');
    this.totalFolders = document.getElementById('total-folders');
    this.repoAge = document.getElementById('repo-age');
    this.currentBranch = document.getElementById('current-branch');
    this.lastCommit = document.getElementById('last-commit');
    this.repoCreated = document.getElementById('repo-created');

    // Modal elements
    this.snapshotModal = document.getElementById('snapshot-modal');
    this.commitMessage = document.getElementById('commit-message');
    this.closeModal = document.getElementById('close-modal');
    this.cancelSnapshot = document.getElementById('cancel-snapshot');
    this.confirmSnapshot = document.getElementById('confirm-snapshot');

    // Toast
    this.toast = document.getElementById('toast');
  }

  setupEventListeners() {
    // Action buttons
    this.createSnapshotBtn.addEventListener('click', () => this.showSnapshotModal());
    this.refreshBtn.addEventListener('click', () => this.loadData());
    this.optionsBtn.addEventListener('click', () => this.openOptions());

    // Tabs
    this.historyTab.addEventListener('click', () => this.switchTab('history'));
    this.statsTab.addEventListener('click', () => this.switchTab('stats'));

    // Search
    this.searchInput.addEventListener('input', () => this.filterCommits());

    // Modal
    this.closeModal.addEventListener('click', () => this.hideSnapshotModal());
    this.cancelSnapshot.addEventListener('click', () => this.hideSnapshotModal());
    this.confirmSnapshot.addEventListener('click', () => this.createSnapshot());

    // Close modal on outside click
    this.snapshotModal.addEventListener('click', (e) => {
      if (e.target === this.snapshotModal) {
        this.hideSnapshotModal();
      }
    });

    // Enter key in commit message
    this.commitMessage.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.createSnapshot();
      }
    });
  }

  async loadData() {
    try {
      this.setStatus('loading', 'Loading...');
      
      // Load status and commit history in parallel
      const [status, history, stats] = await Promise.all([
        this.sendMessage({ action: 'getStatus' }),
        this.sendMessage({ action: 'getCommitHistory', limit: 50 }),
        this.getRepoStats()
      ]);

      if (status.initialized) {
        this.setStatus('active', 'Active');
        this.commitHistory = Array.isArray(history) ? history : [];
        this.repoStats = stats;
        
        this.updateCommitCount();
        this.renderCommitHistory();
        this.updateStatsPanel();
      } else {
        this.setStatus('error', 'Not initialized');
      }

    } catch (error) {
      console.error('Error loading data:', error);
      this.setStatus('error', 'Error loading');
      this.showToast('Failed to load data', 'error');
    }
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || {});
      });
    });
  }

  async getRepoStats() {
    // Get current bookmark stats
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const stats = this.calculateBookmarkStats(bookmarkTree);
      return stats;
    } catch (error) {
      console.error('Error getting bookmark stats:', error);
      return { totalBookmarks: 0, totalFolders: 0 };
    }
  }

  calculateBookmarkStats(nodes) {
    let bookmarks = 0;
    let folders = 0;

    const countItems = (items) => {
      if (!items || !Array.isArray(items)) return;
      
      for (const item of items) {
        if (item.url) {
          bookmarks++;
        } else if (item.children) {
          folders++;
          countItems(item.children);
        }
      }
    };

    countItems(nodes);
    return { totalBookmarks: bookmarks, totalFolders: folders };
  }

  setStatus(type, text) {
    this.statusDot.className = `status-dot status-${type}`;
    this.statusText.textContent = text;
  }

  updateCommitCount() {
    const count = this.commitHistory.length;
    this.commitCount.textContent = `${count} commit${count !== 1 ? 's' : ''}`;
  }

  switchTab(tab) {
    this.currentTab = tab;
    
    // Update tab buttons
    this.historyTab.classList.toggle('active', tab === 'history');
    this.statsTab.classList.toggle('active', tab === 'stats');
    
    // Update panels
    this.historyPanel.classList.toggle('active', tab === 'history');
    this.statsPanel.classList.toggle('active', tab === 'stats');
  }

  filterCommits() {
    const query = this.searchInput.value.toLowerCase();
    
    if (!query) {
      this.filteredHistory = this.commitHistory;
    } else {
      this.filteredHistory = this.commitHistory.filter(commit =>
        commit.message.toLowerCase().includes(query) ||
        commit.hash.toLowerCase().includes(query) ||
        commit.author.name.toLowerCase().includes(query)
      );
    }
    
    this.renderCommitHistory();
  }

  renderCommitHistory() {
    const commits = this.filteredHistory.length > 0 ? this.filteredHistory : this.commitHistory;
    
    if (commits.length === 0) {
      this.commitList.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2"/>
          </svg>
          <h3>No commits yet</h3>
          <p>Create your first bookmark snapshot to get started.</p>
        </div>
      `;
      return;
    }

    this.commitList.innerHTML = commits.map((commit, index) => {
      const isLatest = index === 0;
      const date = new Date(commit.date);
      const relativeTime = this.getRelativeTime(date);
      
      return `
        <div class="commit-item ${isLatest ? 'latest' : ''}" data-hash="${commit.hash}">
          <div class="commit-marker">
            <div class="commit-dot"></div>
            ${!isLatest ? '<div class="commit-line"></div>' : ''}
          </div>
          <div class="commit-content">
            <div class="commit-header">
              <h4 class="commit-message">${this.escapeHtml(commit.message)}</h4>
              <span class="commit-hash">${commit.shortHash}</span>
            </div>
            <div class="commit-meta">
              <span class="commit-author">${this.escapeHtml(commit.author.name)}</span>
              <span class="commit-time" title="${date.toLocaleString()}">${relativeTime}</span>
              ${commit.stats ? `
                <span class="commit-stats">
                  ${commit.stats.totalBookmarks} bookmarks, ${commit.stats.totalFolders} folders
                </span>
              ` : ''}
            </div>
            <div class="commit-actions">
              <button class="btn-link" onclick="popupController.viewCommit('${commit.hash}')">
                View
              </button>
              <button class="btn-link" onclick="popupController.restoreCommit('${commit.hash}')">
                Restore
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  updateStatsPanel() {
    if (!this.repoStats) return;

    this.totalCommits.textContent = this.commitHistory.length;
    this.totalBookmarks.textContent = this.repoStats.totalBookmarks;
    this.totalFolders.textContent = this.repoStats.totalFolders;

    // Calculate repository age
    if (this.commitHistory.length > 0) {
      const oldestCommit = this.commitHistory[this.commitHistory.length - 1];
      const age = Date.now() - new Date(oldestCommit.date).getTime();
      this.repoAge.textContent = this.formatDuration(age);

      this.lastCommit.textContent = this.getRelativeTime(new Date(this.commitHistory[0].date));
      this.repoCreated.textContent = new Date(oldestCommit.date).toLocaleDateString();
    } else {
      this.repoAge.textContent = '0d';
      this.lastCommit.textContent = 'Never';
      this.repoCreated.textContent = 'Unknown';
    }

    this.currentBranch.textContent = 'main';
  }

  showSnapshotModal() {
    this.snapshotModal.style.display = 'flex';
    this.commitMessage.value = '';
    this.commitMessage.focus();
  }

  hideSnapshotModal() {
    this.snapshotModal.style.display = 'none';
  }

  async createSnapshot() {
    const message = this.commitMessage.value.trim();
    
    if (!message) {
      this.showToast('Please enter a commit message', 'error');
      return;
    }

    try {
      this.confirmSnapshot.disabled = true;
      this.confirmSnapshot.textContent = 'Creating...';

      const result = await this.sendMessage({
        action: 'createSnapshot',
        message: message
      });

      if (result.success) {
        this.hideSnapshotModal();
        this.showToast('Snapshot created successfully', 'success');
        this.loadData(); // Refresh the data
      } else {
        this.showToast(result.error || 'Failed to create snapshot', 'error');
      }

    } catch (error) {
      console.error('Error creating snapshot:', error);
      this.showToast('Failed to create snapshot', 'error');
    } finally {
      this.confirmSnapshot.disabled = false;
      this.confirmSnapshot.textContent = 'Create Snapshot';
    }
  }

  async viewCommit(hash) {
    try {
      const result = await this.sendMessage({
        action: 'restoreFromCommit',
        commitHash: hash
      });

      if (result.success && result.data) {
        // For now, just show the data in a new tab
        const dataStr = JSON.stringify(result.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Open in new tab
        chrome.tabs.create({ url: url });
        
        this.showToast('Commit data opened in new tab', 'success');
      } else {
        this.showToast('Failed to load commit data', 'error');
      }

    } catch (error) {
      console.error('Error viewing commit:', error);
      this.showToast('Failed to view commit', 'error');
    }
  }

  async restoreCommit(hash) {
    if (!confirm('Are you sure you want to restore this bookmark state? This will replace all current bookmarks.')) {
      return;
    }

    this.showToast('Bookmark restoration is not yet implemented', 'warning');
    // TODO: Implement bookmark restoration
  }

  openOptions() {
    chrome.runtime.openOptionsPage();
  }

  showToast(message, type = 'info') {
    this.toast.textContent = message;
    this.toast.className = `toast toast-${type} show`;
    
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 3000);
  }

  getRelativeTime(date) {
    const now = Date.now();
    const diff = now - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }

  formatDuration(ms) {
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    
    if (days === 0 && hours === 0) return '< 1h';
    if (days === 0) return `${hours}h`;
    return `${days}d`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.popupController = new PopupController();
});