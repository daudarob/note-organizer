// Keyboard Shortcuts Manager - Handles all keyboard shortcuts
class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.isEnabled = true;
        this.modifierKeys = {
            ctrl: false,
            shift: false,
            alt: false,
            meta: false
        };
    }

    // Initialize keyboard shortcuts
    init() {
        this.setupDefaultShortcuts();
        this.bindEventListeners();
        this.loadCustomShortcuts();
    }

    // Setup default keyboard shortcuts
    setupDefaultShortcuts() {
        // Note operations
        this.register('ctrl+n', () => this.executeAction('new-note'), 'Create new note');
        this.register('ctrl+s', () => this.executeAction('save-note'), 'Save current note');
        this.register('ctrl+d', () => this.executeAction('duplicate-note'), 'Duplicate current note');
        this.register('delete', () => this.executeAction('delete-note'), 'Delete selected note');
        
        // Search and navigation
        this.register('ctrl+f', () => this.executeAction('focus-search'), 'Focus search');
        this.register('ctrl+shift+f', () => this.executeAction('advanced-search'), 'Advanced search');
        this.register('escape', () => this.executeAction('close-modal'), 'Close modal/editor');
        
        // View operations
        this.register('ctrl+1', () => this.executeAction('grid-view'), 'Grid view');
        this.register('ctrl+2', () => this.executeAction('list-view'), 'List view');
        this.register('ctrl+b', () => this.executeAction('toggle-sidebar'), 'Toggle sidebar');
        
        // Formatting (when in editor)
        this.register('ctrl+b', () => this.executeAction('bold'), 'Bold text', 'editor');
        this.register('ctrl+i', () => this.executeAction('italic'), 'Italic text', 'editor');
        this.register('ctrl+u', () => this.executeAction('underline'), 'Underline text', 'editor');
        
        // Theme and settings
        this.register('ctrl+shift+t', () => this.executeAction('toggle-theme'), 'Toggle theme');
        this.register('ctrl+comma', () => this.executeAction('open-settings'), 'Open settings');
        
        // Export and import
        this.register('ctrl+e', () => this.executeAction('export-note'), 'Export current note');
        this.register('ctrl+shift+e', () => this.executeAction('export-all'), 'Export all notes');
        
        // Quick actions
        this.register('ctrl+shift+n', () => this.executeAction('new-folder'), 'Create new folder');
        this.register('f2', () => this.executeAction('rename'), 'Rename selected item');
        this.register('ctrl+z', () => this.executeAction('undo'), 'Undo');
        this.register('ctrl+y', () => this.executeAction('redo'), 'Redo');
        
        // Selection and movement
        this.register('ctrl+a', () => this.executeAction('select-all'), 'Select all');
        this.register('ctrl+shift+a', () => this.executeAction('deselect-all'), 'Deselect all');
        this.register('arrowup', () => this.executeAction('navigate-up'), 'Navigate up');
        this.register('arrowdown', () => this.executeAction('navigate-down'), 'Navigate down');
        this.register('enter', () => this.executeAction('open-selected'), 'Open selected note');
        
        // Tags and favorites
        this.register('ctrl+shift+l', () => this.executeAction('toggle-favorite'), 'Toggle favorite');
        this.register('ctrl+t', () => this.executeAction('add-tag'), 'Add tag to note');
    }

    // Register a new keyboard shortcut with validation
    register(combination, callback, description = '', context = 'global') {
        try {
            const validatedParams = this.validateShortcutParams(combination, callback, description, context);
            const key = this.normalizeKey(validatedParams.combination);
            
            if (!this.shortcuts.has(key)) {
                this.shortcuts.set(key, []);
            }
            
            this.shortcuts.get(key).push({
                callback: validatedParams.callback,
                description: validatedParams.description,
                context: validatedParams.context,
                enabled: true
            });
            
            return true;
        } catch (error) {
            console.error('Error registering shortcut:', error);
            return false;
        }
    }

    // Unregister a keyboard shortcut
    unregister(combination, context = 'global') {
        const key = this.normalizeKey(combination);
        
        if (this.shortcuts.has(key)) {
            const shortcuts = this.shortcuts.get(key);
            const filtered = shortcuts.filter(shortcut => shortcut.context !== context);
            
            if (filtered.length === 0) {
                this.shortcuts.delete(key);
            } else {
                this.shortcuts.set(key, filtered);
            }
        }
    }

    // Bind event listeners
    bindEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // Prevent default behavior for certain keys
        document.addEventListener('keydown', (e) => {
            if (this.shouldPreventDefault(e)) {
                e.preventDefault();
            }
        });
    }

    // Handle keydown events
    handleKeyDown(event) {
        if (!this.isEnabled) return;
        
        // Update modifier key states
        this.updateModifierKeys(event);
        
        // Don't process shortcuts when typing in inputs (unless it's escape)
        if (this.isTypingContext(event.target) && event.key !== 'Escape') {
            return;
        }
        
        const combination = this.getKeyCombination(event);
        const shortcuts = this.shortcuts.get(combination);
        
        if (shortcuts && shortcuts.length > 0) {
            const context = this.getCurrentContext();
            
            // Find matching shortcut for current context
            const matchingShortcut = shortcuts.find(shortcut => 
                shortcut.enabled && (shortcut.context === 'global' || shortcut.context === context)
            );
            
            if (matchingShortcut) {
                event.preventDefault();
                event.stopPropagation();
                
                try {
                    matchingShortcut.callback(event);
                } catch (error) {
                    console.error('Error executing keyboard shortcut:', error);
                    // Provide user feedback for failed shortcuts
                    if (window.noteApp && typeof window.noteApp.showToast === 'function') {
                        window.noteApp.showToast('Keyboard shortcut failed', 'error');
                    }
                }
            }
        }
    }

    // Handle keyup events
    handleKeyUp(event) {
        this.updateModifierKeys(event);
    }

    // Update modifier key states
    updateModifierKeys(event) {
        this.modifierKeys.ctrl = event.ctrlKey || event.metaKey; // Use metaKey for Mac
        this.modifierKeys.shift = event.shiftKey;
        this.modifierKeys.alt = event.altKey;
        this.modifierKeys.meta = event.metaKey;
    }

    // Get key combination string
    getKeyCombination(event) {
        const parts = [];
        
        if (event.ctrlKey || event.metaKey) parts.push('ctrl');
        if (event.shiftKey) parts.push('shift');
        if (event.altKey) parts.push('alt');
        
        const key = event.key.toLowerCase();
        parts.push(key);
        
        return parts.join('+');
    }

    // Normalize key combination
    normalizeKey(combination) {
        return combination.toLowerCase().replace(/\s+/g, '');
    }

    // Check if current target is a typing context
    isTypingContext(target) {
        const typingElements = ['input', 'textarea', 'select'];
        const isContentEditable = target.contentEditable === 'true';
        const isTypingElement = typingElements.includes(target.tagName.toLowerCase());
        
        return isContentEditable || isTypingElement;
    }

    // Get current context
    getCurrentContext() {
        if (document.getElementById('note-editor').classList.contains('hidden')) {
            return 'global';
        } else {
            return 'editor';
        }
    }

    // Check if default behavior should be prevented
    shouldPreventDefault(event) {
        const combination = this.getKeyCombination(event);
        const shortcuts = this.shortcuts.get(combination);
        
        if (shortcuts && shortcuts.length > 0) {
            const context = this.getCurrentContext();
            return shortcuts.some(shortcut => 
                shortcut.enabled && (shortcut.context === 'global' || shortcut.context === context)
            );
        }
        
        return false;
    }

    // Execute action by name
    executeAction(actionName, ...args) {
        switch (actionName) {
            case 'new-note':
                if (window.noteApp) {
                    window.noteApp.createNewNote();
                }
                break;
                
            case 'save-note':
                if (window.noteApp && window.noteApp.currentNote) {
                    window.noteApp.saveCurrentNote();
                }
                break;
                
            case 'focus-search':
                const searchInput = document.getElementById('global-search');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
                break;
                
            case 'advanced-search':
                if (window.noteApp) {
                    window.noteApp.openSearchFilters();
                }
                break;
                
            case 'close-modal':
                if (window.noteApp) {
                    const overlay = document.getElementById('modal-overlay');
                    if (!overlay.classList.contains('hidden')) {
                        window.noteApp.closeModal();
                    } else if (!document.getElementById('note-editor').classList.contains('hidden')) {
                        window.noteApp.closeNoteEditor();
                    }
                }
                break;
                
            case 'grid-view':
                if (window.noteApp) {
                    window.noteApp.setView('grid');
                }
                break;
                
            case 'list-view':
                if (window.noteApp) {
                    window.noteApp.setView('list');
                }
                break;
                
            case 'toggle-sidebar':
                if (window.noteApp) {
                    window.noteApp.toggleSidebar();
                }
                break;
                
            case 'toggle-theme':
                if (window.noteApp && window.noteApp.themeManager) {
                    window.noteApp.themeManager.toggle();
                }
                break;
                
            case 'open-settings':
                if (window.noteApp) {
                    window.noteApp.openSettings();
                }
                break;
                
            case 'export-note':
                if (window.noteApp && window.noteApp.currentNote) {
                    window.noteApp.exportCurrentNote();
                }
                break;
                
            case 'new-folder':
                if (window.noteApp) {
                    window.noteApp.createNewFolder();
                }
                break;
                
            case 'toggle-favorite':
                if (window.noteApp && window.noteApp.currentNote) {
                    window.noteApp.toggleNoteFavorite();
                }
                break;
                
            case 'bold':
            case 'italic':
            case 'underline':
                if (this.getCurrentContext() === 'editor') {
                    this.executeModernFormatCommand(actionName);
                }
                break;
                
            default:
                console.warn(`Unknown action: ${actionName}`);
        }
    }

    // Enable/disable keyboard shortcuts
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    // Check if shortcuts are enabled
    isShortcutsEnabled() {
        return this.isEnabled;
    }

    // Get all registered shortcuts
    getAllShortcuts() {
        const result = [];
        
        for (const [combination, shortcuts] of this.shortcuts) {
            shortcuts.forEach(shortcut => {
                result.push({
                    combination,
                    description: shortcut.description,
                    context: shortcut.context,
                    enabled: shortcut.enabled
                });
            });
        }
        
        return result.sort((a, b) => {
            if (a.context !== b.context) {
                return a.context === 'global' ? -1 : 1;
            }
            return a.combination.localeCompare(b.combination);
        });
    }

    // Get shortcuts for specific context
    getShortcutsForContext(context = 'global') {
        return this.getAllShortcuts().filter(shortcut => 
            shortcut.context === context || shortcut.context === 'global'
        );
    }

    // Export shortcuts configuration
    exportShortcuts() {
        const shortcuts = {};
        
        for (const [combination, shortcutList] of this.shortcuts) {
            shortcuts[combination] = shortcutList.map(shortcut => ({
                description: shortcut.description,
                context: shortcut.context,
                enabled: shortcut.enabled
            }));
        }
        
        return {
            shortcuts,
            isEnabled: this.isEnabled,
            exportDate: new Date().toISOString()
        };
    }

    // Import shortcuts configuration
    importShortcuts(config) {
        if (!config || !config.shortcuts) return false;
        
        try {
            // Clear existing shortcuts
            this.shortcuts.clear();
            
            // Import new shortcuts
            for (const [combination, shortcutList] of Object.entries(config.shortcuts)) {
                this.shortcuts.set(combination, shortcutList.map(shortcut => ({
                    ...shortcut,
                    callback: () => this.executeAction(shortcut.action || 'unknown')
                })));
            }
            
            if (typeof config.isEnabled === 'boolean') {
                this.isEnabled = config.isEnabled;
            }
            
            return true;
        } catch (error) {
            console.error('Error importing shortcuts:', error);
            return false;
        }
    }

    // Save custom shortcuts to localStorage
    saveCustomShortcuts() {
        try {
            const config = this.exportShortcuts();
            localStorage.setItem('keyboardShortcuts', JSON.stringify(config));
        } catch (error) {
            console.error('Error saving shortcuts:', error);
        }
    }

    // Load custom shortcuts from localStorage
    loadCustomShortcuts() {
        try {
            const saved = localStorage.getItem('keyboardShortcuts');
            if (saved) {
                const config = JSON.parse(saved);
                // Don't import, just load enabled state for now
                if (typeof config.isEnabled === 'boolean') {
                    this.isEnabled = config.isEnabled;
                }
            }
        } catch (error) {
            console.error('Error loading shortcuts:', error);
        }
    }

    // Show keyboard shortcuts help
    showHelp() {
        const shortcuts = this.getShortcutsForContext();
        const helpContent = shortcuts.map(shortcut => {
            const keys = shortcut.combination.split('+').map(key => {
                // Format key names for display
                const keyMap = {
                    'ctrl': 'Ctrl',
                    'shift': 'Shift',
                    'alt': 'Alt',
                    'meta': 'Cmd',
                    'arrowup': '↑',
                    'arrowdown': '↓',
                    'arrowleft': '←',
                    'arrowright': '→',
                    'escape': 'Esc',
                    'delete': 'Del',
                    'enter': 'Enter',
                    'space': 'Space'
                };
                return keyMap[key] || key.toUpperCase();
            }).join(' + ');
            
            return `<div class="shortcut-item">
                <span class="shortcut-keys">${keys}</span>
                <span class="shortcut-description">${shortcut.description}</span>
            </div>`;
        }).join('');
        
        // Create and show help modal (basic implementation)
        const helpModal = document.createElement('div');
        helpModal.className = 'keyboard-help-modal';
        helpModal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal keyboard-help">
                    <div class="modal-header">
                        <h2>Keyboard Shortcuts</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-content">
                        <div class="shortcuts-list">
                            ${helpContent}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(helpModal);
        
        // Add close functionality
        helpModal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(helpModal);
        });
        
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal.querySelector('.modal-overlay')) {
                document.body.removeChild(helpModal);
            }
        });
    }

    // Modern formatting commands to replace deprecated execCommand
    executeModernFormatCommand(command) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        
        if (!selectedText) return;
        
        try {
            let newElement;
            const fragment = range.extractContents();
            
            switch (command) {
                case 'bold':
                    newElement = document.createElement('strong');
                    break;
                case 'italic':
                    newElement = document.createElement('em');
                    break;
                case 'underline':
                    newElement = document.createElement('u');
                    break;
                default:
                    // If command not recognized, restore original content
                    range.insertNode(fragment);
                    return;
            }
            
            newElement.appendChild(fragment);
            range.insertNode(newElement);
            
            // Restore selection
            const newRange = document.createRange();
            newRange.selectNodeContents(newElement);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
        } catch (error) {
            console.error('Error executing format command:', error);
            // Restore original content on error
            try {
                range.insertNode(fragment);
            } catch (restoreError) {
                console.error('Error restoring content:', restoreError);
            }
        }
    }

    // Enhanced cleanup with proper error handling
    destroy() {
        try {
            // Remove event listeners safely
            const keydownHandler = this.handleKeyDown?.bind(this);
            const keyupHandler = this.handleKeyUp?.bind(this);
            
            if (keydownHandler) {
                document.removeEventListener('keydown', keydownHandler);
            }
            if (keyupHandler) {
                document.removeEventListener('keyup', keyupHandler);
            }
            
            // Clear shortcuts
            this.shortcuts.clear();
            
            // Reset state
            this.isEnabled = false;
            this.modifierKeys = {
                ctrl: false,
                shift: false,
                alt: false,
                meta: false
            };
            
            console.log('KeyboardShortcuts destroyed successfully');
        } catch (error) {
            console.error('Error during KeyboardShortcuts cleanup:', error);
        }
    }

    // Enhanced error handling for action execution
    executeActionSafe(actionName, ...args) {
        try {
            return this.executeAction(actionName, ...args);
        } catch (error) {
            console.error(`Error executing action '${actionName}':`, error);
            return false;
        }
    }

    // Input validation for shortcut registration
    validateShortcutParams(combination, callback, description, context) {
        if (typeof combination !== 'string' || !combination.trim()) {
            throw new Error('Combination must be a non-empty string');
        }
        
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        
        if (description !== undefined && typeof description !== 'string') {
            throw new Error('Description must be a string');
        }
        
        if (context !== undefined && typeof context !== 'string') {
            throw new Error('Context must be a string');
        }
        
        const validContexts = ['global', 'editor'];
        if (context && !validContexts.includes(context)) {
            console.warn(`Invalid context '${context}', using 'global' instead`);
            context = 'global';
        }
        
        return { combination, callback, description: description || '', context: context || 'global' };
    }
}