// Main Application Controller
class NoteOrganizerApp {
    constructor() {
        this.noteManager = new NoteManager();
        this.searchManager = new SearchManager();
        this.storageManager = new StorageManager();
        this.themeManager = new ThemeManager();
        this.keyboardShortcuts = new KeyboardShortcuts();
        
        this.currentView = 'grid';
        this.currentSort = 'modified';
        this.selectedNotes = new Set();
        this.currentNote = null;
        
        // Resource management
        this.autoSaveInterval = null;
        this.debounceTimers = new Map();
        this.eventListeners = [];
        this.domCache = new Map();
        this.isDestroyed = false;
        
        // Bind methods to prevent memory leaks
        this.handleSearch = this.debounce(this.handleSearch.bind(this), 300);
        this.handleContentChange = this.debounce(this.handleContentChange.bind(this), 1000);
        
        this.init();
    }

    async init() {
        try {
            // Initialize storage
            await this.storageManager.init();
            
            // Initialize note manager with storage
            this.noteManager.init(this.storageManager);
            
            // Load notes from storage
            await this.noteManager.loadNotes();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize theme
            this.themeManager.init();
            
            // Initialize keyboard shortcuts
            this.keyboardShortcuts.init();
            
            // Render initial UI
            this.renderUI();
            
            console.log('Note Organizer App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showToast('Failed to initialize application', 'error');
        }
    }

    setupEventListeners() {
        // Helper function to safely add event listeners with null checks
        const safeAddEventListener = (elementId, event, handler, options = {}) => {
            const element = this.getElement(elementId);
            if (element) {
                element.addEventListener(event, handler, options);
                // Store for cleanup
                this.eventListeners.push({ element, event, handler, options });
                return true;
            }
            console.warn(`Element with id '${elementId}' not found`);
            return false;
        };

        const safeAddEventListenerToNodeList = (selector, event, handler, options = {}) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.addEventListener(event, handler, options);
                this.eventListeners.push({ element, event, handler, options });
            });
            return elements.length;
        };

        // Header events with null checks
        safeAddEventListener('menu-toggle', 'click', this.toggleSidebar.bind(this));
        safeAddEventListener('theme-toggle', 'click', this.themeManager.toggle.bind(this.themeManager));
        safeAddEventListener('new-note', 'click', this.createNewNote.bind(this));
        safeAddEventListener('create-first-note', 'click', this.createNewNote.bind(this));
        safeAddEventListener('settings', 'click', this.openSettings.bind(this));

        // Search events with debouncing
        safeAddEventListener('global-search', 'input', this.handleSearch);
        safeAddEventListener('search-filters', 'click', this.openSearchFilters.bind(this));

        // View and sort events
        safeAddEventListener('grid-view', 'click', () => this.setView('grid'));
        safeAddEventListener('list-view', 'click', () => this.setView('list'));
        safeAddEventListener('sort-by', 'change', this.handleSortChange.bind(this));

        // Quick access events
        safeAddEventListenerToNodeList('.quick-access-btn', 'click', this.handleQuickAccess.bind(this));

        // Folder and tag management
        safeAddEventListener('new-folder', 'click', this.createNewFolder.bind(this));
        safeAddEventListener('manage-tags', 'click', this.openTagManager.bind(this));

        // Note editor events
        safeAddEventListener('close-editor', 'click', this.closeNoteEditor.bind(this));
        safeAddEventListener('save-note', 'click', this.saveCurrentNote.bind(this));
        safeAddEventListener('export-note', 'click', this.exportCurrentNote.bind(this));
        safeAddEventListener('favorite-note', 'click', this.toggleNoteFavorite.bind(this));
        safeAddEventListener('share-note', 'click', this.shareCurrentNote.bind(this));

        // Editor toolbar events
        safeAddEventListenerToNodeList('.format-btn[data-command]', 'click', this.handleFormatCommand.bind(this));
        safeAddEventListenerToNodeList('.color-btn', 'click', this.handleColorChange.bind(this));

        // Content events with debouncing
        safeAddEventListener('note-content', 'input', this.handleContentChange);
        safeAddEventListener('note-title', 'input', this.handleTitleChange.bind(this));
        safeAddEventListener('tags-input', 'keypress', this.handleTagInput.bind(this));

        // Rich text editor toolbar events
        safeAddEventListener('insert-image', 'click', this.handleImageInsertion.bind(this));
        safeAddEventListener('insert-voice', 'click', this.handleVoiceRecording.bind(this));
        safeAddEventListener('insert-link', 'click', this.handleLinkInsertion.bind(this));

        // Modal events
        safeAddEventListener('modal-overlay', 'click', this.closeModal.bind(this));
        safeAddEventListenerToNodeList('.modal-close', 'click', this.closeModal.bind(this));

        // Prevent modal close when clicking inside modal
        safeAddEventListenerToNodeList('.modal', 'click', (e) => e.stopPropagation());

        // Selection change listener for format button states
        document.addEventListener('selectionchange', this.updateFormatButtonStates.bind(this));

        // Auto-save with proper cleanup
        this.autoSaveInterval = setInterval(() => {
            if (!this.isDestroyed && this.currentNote && this.currentNote.isDirty) {
                this.saveCurrentNote(true);
            }
        }, 5000);

        // Window events for cleanup
        window.addEventListener('beforeunload', this.destroy.bind(this));
        this.eventListeners.push({ element: window, event: 'beforeunload', handler: this.destroy.bind(this) });
    }

    renderUI() {
        this.renderNotes();
        this.renderFolders();
        this.renderTags();
        this.updateEmptyState();
    }

    renderNotes() {
        const container = document.getElementById('notes-container');
        const notes = this.noteManager.getFilteredNotes();
        
        container.innerHTML = '';

        if (notes.length === 0) {
            this.showEmptyState();
            return;
        }

        notes.forEach(note => {
            const noteElement = this.createNoteElement(note);
            container.appendChild(noteElement);
        });

        this.hideEmptyState();
    }

    createNoteElement(note) {
        const noteCard = document.createElement('div');
        noteCard.className = 'note-card';
        noteCard.dataset.noteId = note.id;
        
        if (note.color) {
            const colorIndicator = document.createElement('div');
            colorIndicator.className = 'note-color-indicator';
            colorIndicator.style.backgroundColor = note.color;
            noteCard.appendChild(colorIndicator);
        }

        const header = document.createElement('div');
        header.className = 'note-header';
        
        const title = document.createElement('h3');
        title.className = 'note-title';
        title.textContent = note.title || 'Untitled Note';
        
        const actions = document.createElement('div');
        actions.className = 'note-actions';
        
        const favoriteBtn = document.createElement('button');
        favoriteBtn.className = 'note-action-btn';
        favoriteBtn.innerHTML = `<i class="${note.isFavorite ? 'fas' : 'far'} fa-star"></i>`;
        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleNoteFavorite(note.id);
        });
        
        const shareBtn = document.createElement('button');
        shareBtn.className = 'note-action-btn';
        shareBtn.innerHTML = '<i class="fas fa-share"></i>';
        shareBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.shareNote(note.id);
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'note-action-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteNote(note.id);
        });

        actions.appendChild(favoriteBtn);
        actions.appendChild(shareBtn);
        actions.appendChild(deleteBtn);
        
        header.appendChild(title);
        header.appendChild(actions);

        const content = document.createElement('div');
        content.className = 'note-content';
        content.textContent = this.truncateText(this.stripHTML(note.content), 200);

        const footer = document.createElement('div');
        footer.className = 'note-footer';
        
        const meta = document.createElement('div');
        meta.className = 'note-meta';
        meta.textContent = this.formatDate(note.modifiedAt);
        
        const tags = document.createElement('div');
        tags.className = 'note-tags';
        
        if (note.tags && note.tags.length > 0) {
            note.tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'tag';
                tagSpan.textContent = tag;
                tags.appendChild(tagSpan);
            });
        }
        
        footer.appendChild(meta);
        footer.appendChild(tags);

        noteCard.appendChild(header);
        noteCard.appendChild(content);
        noteCard.appendChild(footer);

        // Add click event to open note
        noteCard.addEventListener('click', () => this.openNote(note.id));

        // Add drag and drop support
        noteCard.draggable = true;
        noteCard.addEventListener('dragstart', this.handleNoteDragStart.bind(this));

        return noteCard;
    }

    createNewNote() {
        const note = this.noteManager.createNote();
        this.openNote(note.id);
        this.renderNotes();
        
        // Focus on title input
        setTimeout(() => {
            document.getElementById('note-title').focus();
        }, 100);
    }

    openNote(noteId) {
        const note = this.noteManager.getNote(noteId);
        if (!note) return;

        this.currentNote = note;
        
        try {
            // Populate editor with XSS protection
            const titleInput = this.getElement('note-title');
            const contentArea = this.getElement('note-content');
            const tagsInput = this.getElement('tags-input');
            
            if (titleInput) titleInput.value = note.title || '';
            if (contentArea) {
                // Use textContent instead of innerHTML to prevent XSS
                contentArea.textContent = this.stripHTML(note.content || '');
            }
            if (tagsInput) tagsInput.value = '';
            
            // Update favorite button
            const favoriteBtn = this.getElement('favorite-note');
            if (favoriteBtn) {
                favoriteBtn.innerHTML = `<i class="${note.isFavorite ? 'fas' : 'far'} fa-star"></i>`;
            }
            
            // Update tags display
            this.renderNoteTags(note.tags || []);
            
            // Update folder selection
            const folderSelect = this.getElement('folder-select');
            if (folderSelect) {
                folderSelect.value = note.folderId || '';
            }
            
            // Update word count
            this.updateWordCount();
            
            // Show editor
            this.showNoteEditor();
        } catch (error) {
            console.error('Error opening note:', error);
            this.showToast('Error opening note', 'error');
        }
    }

    showNoteEditor() {
        const editor = document.getElementById('note-editor');
        editor.classList.remove('hidden');
        
        // Adjust content area width
        const contentArea = document.querySelector('.content-area');
        contentArea.style.marginRight = '50%';
    }

    closeNoteEditor() {
        const editor = document.getElementById('note-editor');
        editor.classList.add('hidden');
        
        // Reset content area width
        const contentArea = document.querySelector('.content-area');
        contentArea.style.marginRight = '0';
        
        // Save current note before closing
        if (this.currentNote && this.currentNote.isDirty) {
            this.saveCurrentNote(true);
        }
        
        this.currentNote = null;
    }

    async saveCurrentNote(autoSave = false) {
        if (!this.currentNote) return;

        try {
            const titleInput = this.getElement('note-title');
            const contentArea = this.getElement('note-content');
            const folderSelect = this.getElement('folder-select');

            if (!titleInput || !contentArea) {
                throw new Error('Required form elements not found');
            }

            const title = titleInput.value.trim();
            const content = contentArea.innerHTML;
            const folderId = folderSelect ? folderSelect.value : null;

            // Update note object
            this.currentNote.title = title || 'Untitled Note';
            this.currentNote.content = content;
            this.currentNote.folderId = folderId || null;
            this.currentNote.modifiedAt = new Date();
            this.currentNote.isDirty = false;

            // Save to storage with proper async handling
            await this.noteManager.updateNote(this.currentNote);
            
            // Update UI
            this.renderNotes();
            this.renderFolders(); // Update folder counts
            this.renderTags(); // Update tag counts
            
            // Show save status
            const saveStatus = this.getElement('last-saved');
            if (saveStatus) {
                saveStatus.textContent = autoSave ? 'Auto-saved' : 'Saved';
            }
            
            if (!autoSave) {
                this.showToast('Note saved successfully', 'success');
            }

            console.log(`Note ${this.currentNote.id} saved successfully`);
        } catch (error) {
            console.error('Failed to save note:', error);
            this.showToast('Failed to save note', 'error');
            
            // Mark as dirty again since save failed
            if (this.currentNote) {
                this.currentNote.isDirty = true;
            }
        }
    }

    async deleteNote(noteId) {
        if (confirm('Are you sure you want to delete this note?')) {
            try {
                // Use the async delete method for proper synchronization
                await this.noteManager.deleteNote(noteId);
                
                // Update UI immediately
                this.renderNotes();
                this.updateEmptyState();
                
                // Close editor if this note is open
                if (this.currentNote && this.currentNote.id === noteId) {
                    this.closeNoteEditor();
                    this.currentNote = null;
                }
                
                // Refresh folders and tags count
                this.renderFolders();
                this.renderTags();
                
                this.showToast('Note deleted successfully', 'success');
                console.log(`Note ${noteId} deleted and UI updated`);
            } catch (error) {
                console.error('Failed to delete note:', error);
                this.showToast('Failed to delete note', 'error');
                // Force refresh in case of error
                this.renderNotes();
            }
        }
    }

    toggleNoteFavorite(noteId = null) {
        const id = noteId || (this.currentNote ? this.currentNote.id : null);
        if (!id) return;

        this.noteManager.toggleFavorite(id);
        
        // Update UI
        this.renderNotes();
        
        if (this.currentNote && this.currentNote.id === id) {
            const favoriteBtn = document.getElementById('favorite-note');
            const note = this.noteManager.getNote(id);
            favoriteBtn.innerHTML = `<i class="${note.isFavorite ? 'fas' : 'far'} fa-star"></i>`;
        }
    }

    handleContentChange() {
        if (this.currentNote) {
            this.currentNote.isDirty = true;
            this.updateWordCount();
            
            const saveStatus = this.getElement('last-saved');
            if (saveStatus) {
                saveStatus.textContent = 'Unsaved changes';
            }
            
            // Update note content in real-time
            const contentArea = this.getElement('note-content');
            if (contentArea) {
                this.currentNote.content = contentArea.innerHTML;
            }
        }
    }

    handleTitleChange() {
        if (this.currentNote) {
            this.currentNote.isDirty = true;
        }
    }

    updateWordCount() {
        const content = document.getElementById('note-content').textContent || '';
        const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
        document.getElementById('word-count').textContent = `${wordCount} words`;
    }

    setView(viewType) {
        this.currentView = viewType;
        
        // Update button states
        document.getElementById('grid-view').classList.toggle('active', viewType === 'grid');
        document.getElementById('list-view').classList.toggle('active', viewType === 'list');
        
        // Update container class
        const container = document.getElementById('notes-container');
        container.className = `notes-container ${viewType}-view`;
    }

    handleSortChange(event) {
        this.currentSort = event.target.value;
        this.noteManager.setSortBy(this.currentSort);
        this.renderNotes();
    }

    handleSearch(event) {
        const query = event.target ? event.target.value : event;
        console.log('Search triggered with query:', query);
        
        // Update both managers
        if (this.searchManager) {
            this.searchManager.setQuery(query);
        }
        this.noteManager.setSearchFilter(query);
        
        // Force re-render notes with new filter
        this.renderNotes();
        
        // Show search results count
        const filteredNotes = this.noteManager.getFilteredNotes();
        if (query && query.trim()) {
            this.showToast(`Found ${filteredNotes.length} notes matching "${query.trim()}"`, 'info');
        }
    }

    handleQuickAccess(event) {
        const filterBtn = event.target.closest('.quick-access-btn');
        if (!filterBtn) return;
        
        const filter = filterBtn.dataset.filter;
        console.log('Quick filter applied:', filter);
        
        // Update active state
        document.querySelectorAll('.quick-access-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        filterBtn.classList.add('active');
        
        // Clear search when switching filters
        const searchInput = this.getElement('global-search');
        if (searchInput) {
            searchInput.value = '';
            this.noteManager.setSearchFilter('');
        }
        
        // Apply filter and refresh
        this.noteManager.setQuickFilter(filter);
        this.renderNotes();
        this.updateEmptyState();
        
        // Show filter applied message
        const filterName = filterBtn.textContent.trim();
        this.showToast(`Showing ${filterName} notes`, 'info');
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('open');
    }

    showEmptyState() {
        document.getElementById('empty-state').classList.remove('hidden');
        document.getElementById('notes-container').classList.add('hidden');
    }

    hideEmptyState() {
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('notes-container').classList.remove('hidden');
    }

    updateEmptyState() {
        const hasNotes = this.noteManager.getAllNotes().length > 0;
        if (hasNotes) {
            this.hideEmptyState();
        } else {
            this.showEmptyState();
        }
    }

    renderFolders() {
        const container = document.getElementById('folders-container');
        const folders = this.noteManager.getFolders();
        
        container.innerHTML = '';
        
        folders.forEach(folder => {
            const folderElement = this.createFolderElement(folder);
            container.appendChild(folderElement);
        });
    }

    createFolderElement(folder) {
        const div = document.createElement('div');
        div.className = 'folder-item';
        div.innerHTML = `
            <button class="folder-btn" data-folder-id="${folder.id}">
                <i class="fas fa-folder"></i>
                <span>${folder.name}</span>
                <span class="folder-count">${folder.noteCount || 0}</span>
            </button>
        `;
        
        div.querySelector('.folder-btn').addEventListener('click', () => {
            this.filterByFolder(folder.id);
        });
        
        return div;
    }

    renderTags() {
        const container = document.getElementById('tags-container');
        const tags = this.noteManager.getAllTags();
        
        container.innerHTML = '';
        
        tags.forEach(tag => {
            const tagElement = this.createTagElement(tag);
            container.appendChild(tagElement);
        });
    }

    createTagElement(tag) {
        const span = document.createElement('span');
        span.className = 'tag-filter';
        span.textContent = tag.name;
        span.dataset.count = tag.count;
        
        span.addEventListener('click', () => {
            this.filterByTag(tag.name);
        });
        
        return span;
    }

    renderNoteTags(tags) {
        const container = document.getElementById('note-tags');
        container.innerHTML = '';
        
        tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = tag;
            
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '×';
            removeBtn.addEventListener('click', () => this.removeNoteTag(tag));
            
            span.appendChild(removeBtn);
            container.appendChild(span);
        });
    }

    // Utility methods
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text || '';
        return text.substring(0, maxLength) + '...';
    }

    // Secure HTML stripping utility
    stripHTML(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    // Sanitize HTML content to prevent XSS
    sanitizeHTML(html) {
        if (!html) return '';
        
        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Remove script tags and dangerous attributes
        const scripts = temp.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(element => {
            // Remove dangerous attributes
            const dangerousAttrs = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'];
            dangerousAttrs.forEach(attr => {
                if (element.hasAttribute(attr)) {
                    element.removeAttribute(attr);
                }
            });
            
            // Remove javascript: links
            if (element.href && element.href.toLowerCase().includes('javascript:')) {
                element.removeAttribute('href');
            }
        });
        
        return temp.innerHTML;
    }

    // DOM element caching utility
    getElement(id) {
        if (this.domCache.has(id)) {
            const element = this.domCache.get(id);
            // Verify element is still in DOM
            if (document.contains(element)) {
                return element;
            }
            this.domCache.delete(id);
        }
        
        const element = document.getElementById(id);
        if (element) {
            this.domCache.set(id, element);
        }
        return element;
    }

    // Debounce utility for performance
    debounce(func, wait, immediate = false) {
        return (...args) => {
            const callNow = immediate && !this.debounceTimers.has(func);
            
            if (this.debounceTimers.has(func)) {
                clearTimeout(this.debounceTimers.get(func));
            }
            
            this.debounceTimers.set(func, setTimeout(() => {
                this.debounceTimers.delete(func);
                if (!immediate) func.apply(this, args);
            }, wait));
            
            if (callNow) func.apply(this, args);
        };
    }

    // Resource cleanup method
    destroy() {
        if (this.isDestroyed) return;
        
        this.isDestroyed = true;
        
        // Clear auto-save interval
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        
        // Clear debounce timers
        for (const [func, timerId] of this.debounceTimers) {
            clearTimeout(timerId);
        }
        this.debounceTimers.clear();
        
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler, options }) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                console.warn('Error removing event listener:', error);
            }
        });
        this.eventListeners.length = 0;
        
        // Cleanup managers
        if (this.keyboardShortcuts && typeof this.keyboardShortcuts.destroy === 'function') {
            this.keyboardShortcuts.destroy();
        }
        
        if (this.storageManager && typeof this.storageManager.close === 'function') {
            this.storageManager.close();
        }
        
        // Clear caches
        this.domCache.clear();
        this.selectedNotes.clear();
        
        console.log('NoteOrganizerApp destroyed and resources cleaned up');
    }

    formatDate(date) {
        const now = new Date();
        const noteDate = new Date(date);
        const diffMs = now - noteDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return noteDate.toLocaleDateString();
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300);
        }, 3000);
    }

    // Modal methods
    openModal(modalId) {
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById(modalId).classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
        document.body.style.overflow = '';
    }

    openSearchFilters() {
        this.openModal('search-modal');
    }

    openSettings() {
        this.openModal('settings-modal');
    }

    // Placeholder methods for advanced features
    createNewFolder() {
        const name = prompt('Enter folder name:');
        if (name && name.trim()) {
            this.noteManager.createFolder(name.trim());
            this.renderFolders();
        }
    }

    openTagManager() {
        // TODO: Implement tag management modal
        console.log('Tag manager not yet implemented');
    }

    exportCurrentNote() {
        // TODO: Implement export functionality
        console.log('Export functionality not yet implemented');
    }

    shareCurrentNote() {
        // TODO: Implement sharing functionality
        console.log('Share functionality not yet implemented');
    }

    handleFormatCommand(event) {
        const button = event.target.closest('.format-btn');
        if (!button) return;
        
        const command = button.dataset.command;
        const contentArea = this.getElement('note-content');
        
        if (!contentArea) {
            console.error('Content area not found');
            return;
        }
        
        try {
            // Ensure content area is focused
            contentArea.focus();
            
            // Execute formatting command using modern approach
            switch (command) {
                case 'bold':
                    this.applyFormatting('strong');
                    break;
                case 'italic':
                    this.applyFormatting('em');
                    break;
                case 'underline':
                    this.applyFormatting('u');
                    break;
                case 'strikethrough':
                    this.applyFormatting('s');
                    break;
                case 'code':
                    this.applyFormatting('code');
                    break;
                default:
                    console.warn(`Unknown format command: ${command}`);
            }
            
            // Update button state
            this.updateFormatButtonStates();
            
            // Mark note as dirty
            if (this.currentNote) {
                this.currentNote.isDirty = true;
                this.handleContentChange();
            }
            
        } catch (error) {
            console.error('Error applying format command:', error);
            this.showToast('Format command failed', 'error');
        }
    }

    // Modern text formatting implementation
    applyFormatting(tagName) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        
        if (!selectedText) {
            // No text selected, just insert formatting tags
            const element = document.createElement(tagName);
            element.textContent = 'formatted text';
            range.insertNode(element);
            
            // Select the inserted text
            const newRange = document.createRange();
            newRange.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            // Wrap selected text
            const element = document.createElement(tagName);
            try {
                const contents = range.extractContents();
                element.appendChild(contents);
                range.insertNode(element);
                
                // Restore selection
                const newRange = document.createRange();
                newRange.selectNodeContents(element);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } catch (error) {
                console.error('Error wrapping selection:', error);
            }
        }
    }

    // Update format button states based on current selection
    updateFormatButtonStates() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        let parent = range.commonAncestorContainer;
        
        if (parent.nodeType === Node.TEXT_NODE) {
            parent = parent.parentElement;
        }
        
        // Reset all button states
        document.querySelectorAll('.format-btn[data-command]').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Check what formatting is currently applied
        let current = parent;
        while (current && current !== document.getElementById('note-content')) {
            const tagName = current.tagName?.toLowerCase();
            
            switch (tagName) {
                case 'strong':
                case 'b':
                    document.querySelector('.format-btn[data-command="bold"]')?.classList.add('active');
                    break;
                case 'em':
                case 'i':
                    document.querySelector('.format-btn[data-command="italic"]')?.classList.add('active');
                    break;
                case 'u':
                    document.querySelector('.format-btn[data-command="underline"]')?.classList.add('active');
                    break;
                case 's':
                    document.querySelector('.format-btn[data-command="strikethrough"]')?.classList.add('active');
                    break;
                case 'code':
                    document.querySelector('.format-btn[data-command="code"]')?.classList.add('active');
                    break;
            }
            current = current.parentElement;
        }
    }

    // Handle image insertion
    handleImageInsertion() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = false;
        
        input.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            // Validate file size (max 5MB)
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                this.showToast('Image too large. Maximum size is 5MB.', 'error');
                return;
            }
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.showToast('Please select a valid image file.', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                this.insertImageToContent(e.target.result, file.name);
            };
            reader.onerror = () => {
                this.showToast('Error reading image file.', 'error');
            };
            
            reader.readAsDataURL(file);
        });
        
        input.click();
    }

    // Insert image into content area
    insertImageToContent(dataUrl, fileName) {
        const contentArea = this.getElement('note-content');
        if (!contentArea) return;
        
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = fileName;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.margin = '10px 0';
        img.draggable = false;
        
        // Insert at current cursor position or at the end
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.insertNode(img);
            
            // Move cursor after image
            range.setStartAfter(img);
            range.setEndAfter(img);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            contentArea.appendChild(img);
        }
        
        // Mark note as dirty
        if (this.currentNote) {
            this.currentNote.isDirty = true;
            this.handleContentChange();
        }
        
        this.showToast('Image inserted successfully', 'success');
    }

    // Handle voice recording (placeholder for future implementation)
    handleVoiceRecording() {
        this.showToast('Voice recording feature coming soon', 'info');
    }

    // Handle link insertion
    handleLinkInsertion() {
        const url = prompt('Enter URL:');
        if (!url) return;
        
        const text = prompt('Enter link text (optional):') || url;
        
        const link = document.createElement('a');
        link.href = url;
        link.textContent = text;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.insertNode(link);
            
            // Move cursor after link
            range.setStartAfter(link);
            range.setEndAfter(link);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            const contentArea = this.getElement('note-content');
            if (contentArea) {
                contentArea.appendChild(link);
            }
        }
        
        if (this.currentNote) {
            this.currentNote.isDirty = true;
            this.handleContentChange();
        }
        
        this.showToast('Link inserted', 'success');
    }

    handleColorChange(event) {
        const color = event.target.dataset.color;
        if (this.currentNote) {
            this.currentNote.color = color;
            this.currentNote.isDirty = true;
        }
    }

    handleTagInput(event) {
        if (event.key === 'Enter') {
            const input = event.target;
            const tag = input.value.trim();
            
            if (tag && this.currentNote) {
                if (!this.currentNote.tags) this.currentNote.tags = [];
                
                if (!this.currentNote.tags.includes(tag)) {
                    this.currentNote.tags.push(tag);
                    this.renderNoteTags(this.currentNote.tags);
                    this.currentNote.isDirty = true;
                }
                
                input.value = '';
            }
        }
    }

    removeNoteTag(tag) {
        if (this.currentNote && this.currentNote.tags) {
            const index = this.currentNote.tags.indexOf(tag);
            if (index > -1) {
                this.currentNote.tags.splice(index, 1);
                this.renderNoteTags(this.currentNote.tags);
                this.currentNote.isDirty = true;
            }
        }
    }

    handleNoteDragStart(event) {
        event.dataTransfer.setData('text/plain', event.target.dataset.noteId);
        event.target.classList.add('dragging');
    }

    filterByFolder(folderId) {
        console.log('Folder filter applied:', folderId);
        
        // Clear other filters
        this.noteManager.setTagFilter(null);
        this.noteManager.setSearchFilter('');
        
        // Reset quick access buttons
        document.querySelectorAll('.quick-access-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('.quick-access-btn[data-filter="all"]')?.classList.add('active');
        
        // Apply folder filter
        this.noteManager.setFolderFilter(folderId);
        this.renderNotes();
        this.updateEmptyState();
        
        // Show feedback
        const folderName = this.noteManager.getFolderName(folderId) || 'Unknown';
        this.showToast(`Showing notes in "${folderName}" folder`, 'info');
    }

    filterByTag(tagName) {
        console.log('Tag filter applied:', tagName);
        
        // Clear other filters
        this.noteManager.setFolderFilter(null);
        this.noteManager.setSearchFilter('');
        
        // Reset quick access buttons
        document.querySelectorAll('.quick-access-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('.quick-access-btn[data-filter="all"]')?.classList.add('active');
        
        // Apply tag filter
        this.noteManager.setTagFilter(tagName);
        this.renderNotes();
        this.updateEmptyState();
        
        // Show feedback
        this.showToast(`Showing notes tagged with "${tagName}"`, 'info');
    }

    // Clear all filters
    clearAllFilters() {
        console.log('Clearing all filters');
        
        // Clear search input
        const searchInput = this.getElement('global-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Reset all filters
        this.noteManager.clearAllFilters();
        
        // Reset UI state
        document.querySelectorAll('.quick-access-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('.quick-access-btn[data-filter="all"]')?.classList.add('active');
        
        // Refresh display
        this.renderNotes();
        this.updateEmptyState();
        
        this.showToast('All filters cleared', 'info');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.noteApp = new NoteOrganizerApp();
});