class OptionsController {
  constructor() {
    this.settings = {
      authorName: 'Bookmark Git Tracker',
      authorEmail: 'bookmark-tracker@extension.local',
      autoCommit: true,
      commitDelay: 1
    };

    this.initializeElements();
    this.setupEventListeners();
    this.loadSettings();
    this.loadStats();
  }

  initializeElements() {
    // Form elements
    this.authorName = document.getElementById('author-name');
    this.authorEmail = document.getElementById('author-email');
    this.autoCommit = document.getElementById('auto-commit');
    this.commitDelay = document.getElementById('commit-delay');

    // Stats elements
    this.totalCommits = document.getElementById('total-commits');
    this.repoSize = document.getElementById('repo-size');
    this.currentBranch = document.getElementById('current-branch');
    this.lastCommitDate = document.getElementById('last-commit-date');

    // Action buttons
    this.createBackup = document.getElementById('create-backup');
    this.importBackup = document.getElementById('import-backup');
    this.resetRepo = document.getElementById('reset-repo');
    this.saveSettings = document.getElementById('save-settings');
    this.resetSettings = document.getElementById('reset-settings');

    // Status and modal elements
    this.saveStatus = document.getElementById('save-status');
    this.toast = document.getElementById('toast');
    this.importFile = document.getElementById('import-file');
    this.confirmationModal = document.getElementById('confirmation-modal');
    this.modalTitle = document.getElementById('modal-title');
    this.modalMessage = document.getElementById('modal-message');
    this.closeModal = document.getElementById('close-modal');
    this.cancelAction = document.getElementById('cancel-action');
    this.confirmAction = document.getElementById('confirm-action');

    this.pendingAction = null;
  }

  setupEventListeners() {
    // Form changes
    this.authorName.addEventListener('input', () => this.onSettingChange());
    this.authorEmail.addEventListener('input', () => this.onSettingChange());
    this.autoCommit.addEventListener('change', () => this.onSettingChange());
    this.commitDelay.addEventListener('input', () => this.onSettingChange());

    // Action buttons
    this.createBackup.addEventListener('click', () => this.exportRepository());
    this.importBackup.addEventListener('click', () => this.showImportDialog());
    this.resetRepo.addEventListener('click', () => this.showResetConfirmation());
    this.saveSettings.addEventListener('click', () => this.saveSettings());
    this.resetSettings.addEventListener('click', () => this.resetToDefaults());

    // File import
    this.importFile.addEventListener('change', (e) => this.handleFileImport(e));

    // Modal
    this.closeModal.addEventListener('click', () => this.hideModal());
    this.cancelAction.addEventListener('click', () => this.hideModal());
    this.confirmAction.addEventListener('click', () => this.executeAction());

    // Close modal on outside click
    this.confirmationModal.addEventListener('click', (e) => {
      if (e.target === this.confirmationModal) {
        this.hideModal();
      }
    });
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['git_config', 'extension_settings']);
      
      // Load Git config
      const gitConfig = result.git_config || {};
      if (gitConfig.user) {
        this.settings.authorName = gitConfig.user.name || this.settings.authorName;
        this.settings.authorEmail = gitConfig.user.email || this.settings.authorEmail;
      }

      // Load extension settings
      const extSettings = result.extension_settings || {};
      this.settings.autoCommit = extSettings.autoCommit ?? this.settings.autoCommit;
      this.settings.commitDelay = extSettings.commitDelay || this.settings.commitDelay;

      // Update form
      this.updateForm();
      
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showToast('Failed to load settings', 'error');
    }
  }

  async loadStats() {
    try {
      // Get repository stats from background script
      const stats = await this.sendMessage({ action: 'getRepositoryStats' });
      
      if (stats) {
        this.totalCommits.textContent = stats.totalCommits || 0;
        this.currentBranch.textContent = stats.currentBranch || 'main';
        
        if (stats.lastCommit) {
          const date = new Date(stats.lastCommit);
          this.lastCommitDate.textContent = date.toLocaleDateString();
        } else {
          this.lastCommitDate.textContent = 'Never';
        }

        // Calculate approximate repository size
        const sizeKB = Math.round((stats.totalCommits * 50) / 1024) || 1; // Rough estimate
        this.repoSize.textContent = `${sizeKB} KB`;
      }

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  updateForm() {
    this.authorName.value = this.settings.authorName;
    this.authorEmail.value = this.settings.authorEmail;
    this.autoCommit.checked = this.settings.autoCommit;
    this.commitDelay.value = this.settings.commitDelay;
  }

  onSettingChange() {
    // Update settings object
    this.settings.authorName = this.authorName.value;
    this.settings.authorEmail = this.authorEmail.value;
    this.settings.autoCommit = this.autoCommit.checked;
    this.settings.commitDelay = parseInt(this.commitDelay.value) || 1;

    // Auto-save after a short delay
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveSettingsToStorage();
    }, 1000);

    this.updateSaveStatus('Saving...');
  }

  async saveSettingsToStorage() {
    try {
      // Prepare Git config
      const gitConfig = {
        user: {
          name: this.settings.authorName,
          email: this.settings.authorEmail
        }
      };

      // Prepare extension settings
      const extensionSettings = {
        autoCommit: this.settings.autoCommit,
        commitDelay: this.settings.commitDelay
      };

      // Save to storage
      await chrome.storage.local.set({
        git_config: gitConfig,
        extension_settings: extensionSettings
      });

      this.updateSaveStatus('Settings saved automatically');
      
    } catch (error) {
      console.error('Error saving settings:', error);
      this.updateSaveStatus('Failed to save settings');
      this.showToast('Failed to save settings', 'error');
    }
  }

  async saveSettings() {
    await this.saveSettingsToStorage();
    this.showToast('Settings saved successfully', 'success');
  }

  async resetToDefaults() {
    this.settings = {
      authorName: 'Bookmark Git Tracker',
      authorEmail: 'bookmark-tracker@extension.local',
      autoCommit: true,
      commitDelay: 1
    };

    this.updateForm();
    await this.saveSettingsToStorage();
    this.showToast('Settings reset to defaults', 'success');
  }

  async exportRepository() {
    try {
      this.createBackup.disabled = true;
      this.createBackup.textContent = 'Exporting...';

      // Get repository data from background script
      const data = await this.sendMessage({ action: 'exportRepository' });
      
      if (data) {
        // Create download
        const blob = new Blob([JSON.stringify(data, null, 2)], { 
          type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmark-git-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        this.showToast('Repository exported successfully', 'success');
      } else {
        this.showToast('Failed to export repository', 'error');
      }

    } catch (error) {
      console.error('Error exporting repository:', error);
      this.showToast('Failed to export repository', 'error');
    } finally {
      this.createBackup.disabled = false;
      this.createBackup.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2"/>
          <polyline points="7,10 12,15 17,10" stroke="currentColor" stroke-width="2"/>
          <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2"/>
        </svg>
        Export Repository
      `;
    }
  }

  showImportDialog() {
    this.importFile.click();
  }

  async handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate the backup data
      if (!this.validateBackupData(data)) {
        this.showToast('Invalid backup file format', 'error');
        return;
      }

      // Show confirmation
      this.showModal(
        'Import Repository',
        'This will replace your current repository. All existing commits will be lost. Are you sure?',
        () => this.importRepository(data)
      );

    } catch (error) {
      console.error('Error reading backup file:', error);
      this.showToast('Failed to read backup file', 'error');
    }

    // Reset file input
    event.target.value = '';
  }

  validateBackupData(data) {
    return data &&
           typeof data === 'object' &&
           data.repository &&
           data.commits &&
           data.version;
  }

  async importRepository(data) {
    try {
      const result = await this.sendMessage({ 
        action: 'importRepository', 
        data: data 
      });

      if (result.success) {
        this.showToast('Repository imported successfully', 'success');
        this.loadStats(); // Refresh stats
      } else {
        this.showToast(result.error || 'Failed to import repository', 'error');
      }

    } catch (error) {
      console.error('Error importing repository:', error);
      this.showToast('Failed to import repository', 'error');
    }
  }

  showResetConfirmation() {
    this.showModal(
      'Reset Repository',
      'This will permanently delete all commit history and reset the repository. This action cannot be undone. Are you sure?',
      () => this.resetRepository()
    );
  }

  async resetRepository() {
    try {
      const result = await this.sendMessage({ action: 'resetRepository' });

      if (result.success) {
        this.showToast('Repository reset successfully', 'success');
        this.loadStats(); // Refresh stats
      } else {
        this.showToast('Failed to reset repository', 'error');
      }

    } catch (error) {
      console.error('Error resetting repository:', error);
      this.showToast('Failed to reset repository', 'error');
    }
  }

  showModal(title, message, action) {
    this.modalTitle.textContent = title;
    this.modalMessage.textContent = message;
    this.pendingAction = action;
    this.confirmationModal.style.display = 'flex';
  }

  hideModal() {
    this.confirmationModal.style.display = 'none';
    this.pendingAction = null;
  }

  executeAction() {
    if (this.pendingAction) {
      this.pendingAction();
      this.hideModal();
    }
  }

  updateSaveStatus(text) {
    this.saveStatus.textContent = text;
  }

  showToast(message, type = 'info') {
    this.toast.textContent = message;
    this.toast.className = `toast toast-${type} show`;
    
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 3000);
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || {});
      });
    });
  }
}

// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});