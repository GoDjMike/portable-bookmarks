/**
 * Git Manager for Chrome Extension
 * Implements basic Git functionality using Chrome storage API
 */
export default class GitManager {
  constructor() {
    this.initialized = false;
    this.repositoryKey = 'bookmark_git_repo';
    this.commitsKey = 'bookmark_commits';
    this.branchKey = 'current_branch';
    this.configKey = 'git_config';
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize repository structure
      await this.ensureRepository();
      this.initialized = true;
      console.log('Git manager initialized');
    } catch (error) {
      console.error('Failed to initialize Git manager:', error);
      throw error;
    }
  }

  async ensureRepository() {
    const result = await chrome.storage.local.get([this.repositoryKey]);
    
    if (!result[this.repositoryKey]) {
      // Create new repository
      const repo = {
        initialized: true,
        created: Date.now(),
        head: null,
        branches: {
          main: null
        }
      };
      
      await chrome.storage.local.set({
        [this.repositoryKey]: repo,
        [this.commitsKey]: {},
        [this.branchKey]: 'main',
        [this.configKey]: {
          user: {
            name: 'Bookmark Git Tracker',
            email: 'bookmark-tracker@extension.local'
          }
        }
      });
      
      console.log('Created new bookmark Git repository');
    }
  }

  async hasCommits() {
    const result = await chrome.storage.local.get([this.commitsKey]);
    const commits = result[this.commitsKey] || {};
    return Object.keys(commits).length > 0;
  }

  async createCommit(bookmarkData, message, author = 'user') {
    try {
      // Generate commit hash (simplified)
      const commitHash = this.generateHash(Date.now() + message + JSON.stringify(bookmarkData));
      
      // Get current repository state
      const [repoResult, commitsResult, branchResult, configResult] = await Promise.all([
        chrome.storage.local.get([this.repositoryKey]),
        chrome.storage.local.get([this.commitsKey]),
        chrome.storage.local.get([this.branchKey]),
        chrome.storage.local.get([this.configKey])
      ]);

      const repo = repoResult[this.repositoryKey];
      const commits = commitsResult[this.commitsKey] || {};
      const currentBranch = branchResult[this.branchKey] || 'main';
      const config = configResult[this.configKey] || {};

      // Create commit object
      const commit = {
        hash: commitHash,
        message: message,
        author: {
          name: config.user?.name || 'Bookmark Git Tracker',
          email: config.user?.email || 'bookmark-tracker@extension.local',
          timestamp: Date.now()
        },
        committer: {
          name: config.user?.name || 'Bookmark Git Tracker',
          email: config.user?.email || 'bookmark-tracker@extension.local',
          timestamp: Date.now()
        },
        parent: repo.head,
        tree: commitHash + '_tree',
        data: bookmarkData,
        stats: this.calculateStats(bookmarkData)
      };

      // Store commit
      commits[commitHash] = commit;

      // Update repository head and branch
      repo.head = commitHash;
      repo.branches[currentBranch] = commitHash;

      // Save everything
      await chrome.storage.local.set({
        [this.repositoryKey]: repo,
        [this.commitsKey]: commits
      });

      console.log(`Created commit ${commitHash}: ${message}`);
      return commitHash;

    } catch (error) {
      console.error('Error creating commit:', error);
      throw error;
    }
  }

  async getCommitHistory(limit = 50) {
    try {
      const [repoResult, commitsResult] = await Promise.all([
        chrome.storage.local.get([this.repositoryKey]),
        chrome.storage.local.get([this.commitsKey])
      ]);

      const repo = repoResult[this.repositoryKey];
      const commits = commitsResult[this.commitsKey] || {};

      if (!repo || !repo.head) {
        return [];
      }

      // Walk commit history from HEAD
      const history = [];
      let currentHash = repo.head;
      let count = 0;

      while (currentHash && count < limit) {
        const commit = commits[currentHash];
        if (!commit) break;

        history.push({
          hash: commit.hash,
          shortHash: commit.hash.substring(0, 8),
          message: commit.message,
          author: commit.author,
          committer: commit.committer,
          stats: commit.stats,
          date: new Date(commit.committer.timestamp).toISOString()
        });

        currentHash = commit.parent;
        count++;
      }

      return history;

    } catch (error) {
      console.error('Error getting commit history:', error);
      return [];
    }
  }

  async getCommitData(commitHash) {
    try {
      const result = await chrome.storage.local.get([this.commitsKey]);
      const commits = result[this.commitsKey] || {};
      const commit = commits[commitHash];
      
      return commit ? commit.data : null;
    } catch (error) {
      console.error('Error getting commit data:', error);
      return null;
    }
  }

  async getCommitDiff(commitHash1, commitHash2) {
    try {
      const [data1, data2] = await Promise.all([
        this.getCommitData(commitHash1),
        this.getCommitData(commitHash2)
      ]);

      if (!data1 || !data2) {
        return null;
      }

      // Simple diff calculation
      return this.calculateDiff(data1, data2);

    } catch (error) {
      console.error('Error calculating commit diff:', error);
      return null;
    }
  }

  async getBranches() {
    try {
      const result = await chrome.storage.local.get([this.repositoryKey]);
      const repo = result[this.repositoryKey];
      return repo ? repo.branches : { main: null };
    } catch (error) {
      console.error('Error getting branches:', error);
      return { main: null };
    }
  }

  async getCurrentBranch() {
    try {
      const result = await chrome.storage.local.get([this.branchKey]);
      return result[this.branchKey] || 'main';
    } catch (error) {
      console.error('Error getting current branch:', error);
      return 'main';
    }
  }

  async getRepositoryStats() {
    try {
      const [repoResult, commitsResult] = await Promise.all([
        chrome.storage.local.get([this.repositoryKey]),
        chrome.storage.local.get([this.commitsKey])
      ]);

      const repo = repoResult[this.repositoryKey];
      const commits = commitsResult[this.commitsKey] || {};

      return {
        initialized: !!repo,
        totalCommits: Object.keys(commits).length,
        branches: repo ? Object.keys(repo.branches).length : 0,
        currentBranch: await this.getCurrentBranch(),
        headCommit: repo?.head,
        created: repo?.created,
        lastCommit: repo?.head ? commits[repo.head]?.committer?.timestamp : null
      };

    } catch (error) {
      console.error('Error getting repository stats:', error);
      return {
        initialized: false,
        totalCommits: 0,
        branches: 0,
        currentBranch: 'main',
        headCommit: null,
        created: null,
        lastCommit: null
      };
    }
  }

  // Utility methods
  generateHash(input) {
    // Simple hash function for demo purposes
    // In a real implementation, you'd use a proper crypto hash
    let hash = 0;
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16).padStart(8, '0') + Date.now().toString(16);
  }

  calculateStats(bookmarkData) {
    let totalBookmarks = 0;
    let totalFolders = 0;

    const countItems = (nodes) => {
      if (!nodes || !Array.isArray(nodes)) return;
      
      for (const node of nodes) {
        if (node.url) {
          totalBookmarks++;
        } else {
          totalFolders++;
        }
        
        if (node.children) {
          countItems(node.children);
        }
      }
    };

    if (Array.isArray(bookmarkData)) {
      countItems(bookmarkData);
    }

    return {
      totalBookmarks,
      totalFolders,
      totalItems: totalBookmarks + totalFolders
    };
  }

  calculateDiff(data1, data2) {
    // Basic diff calculation
    const stats1 = this.calculateStats(data1);
    const stats2 = this.calculateStats(data2);

    return {
      bookmarks: {
        added: Math.max(0, stats2.totalBookmarks - stats1.totalBookmarks),
        removed: Math.max(0, stats1.totalBookmarks - stats2.totalBookmarks),
        changed: 0 // Would need deeper analysis
      },
      folders: {
        added: Math.max(0, stats2.totalFolders - stats1.totalFolders),
        removed: Math.max(0, stats1.totalFolders - stats2.totalFolders),
        changed: 0 // Would need deeper analysis
      }
    };
  }

  // Reset repository (for development/testing)
  async resetRepository() {
    try {
      await chrome.storage.local.remove([
        this.repositoryKey,
        this.commitsKey,
        this.branchKey
      ]);
      
      this.initialized = false;
      await this.initialize();
      
      console.log('Repository reset successfully');
      return true;
    } catch (error) {
      console.error('Error resetting repository:', error);
      return false;
    }
  }

  // Export repository data
  async exportRepository() {
    try {
      const result = await chrome.storage.local.get([
        this.repositoryKey,
        this.commitsKey,
        this.branchKey,
        this.configKey
      ]);

      return {
        repository: result[this.repositoryKey],
        commits: result[this.commitsKey],
        currentBranch: result[this.branchKey],
        config: result[this.configKey],
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Error exporting repository:', error);
      return null;
    }
  }
}