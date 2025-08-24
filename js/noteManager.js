// Note Manager - Handles all note operations
class NoteManager {
    constructor() {
        this.notes = new Map();
        this.folders = new Map();
        this.searchQuery = '';
        this.quickFilter = 'all';
        this.folderFilter = null;
        this.tagFilter = null;
        this.sortBy = 'modified';
        this.storageManager = null;
        
        // Prevent race conditions and add validation
        this.saveInProgress = false;
        this.loadInProgress = false;
        this.operationQueue = [];
        this.maxNoteSize = 1024 * 1024; // 1MB max per note
        this.maxTitleLength = 500;
        this.maxTagLength = 50;
        this.maxTagsPerNote = 20;
    }

    // Initialize with storage manager
    init(storageManager) {
        this.storageManager = storageManager;
    }

    // Load notes from storage with race condition prevention
    async loadNotes() {
        // Prevent concurrent loading operations
        if (this.loadInProgress) {
            return;
        }
        
        this.loadInProgress = true;
        
        try {
            if (this.storageManager) {
                const data = await this.storageManager.loadNotes();
                
                // Validate and sanitize loaded data
                if (data.notes && Array.isArray(data.notes)) {
                    data.notes.forEach(note => {
                        const validatedNote = this.validateNote(note, false);
                        if (validatedNote) {
                            this.notes.set(validatedNote.id, validatedNote);
                        }
                    });
                }
                
                if (data.folders && Array.isArray(data.folders)) {
                    data.folders.forEach(folder => {
                        const validatedFolder = this.validateFolder(folder, false);
                        if (validatedFolder) {
                            this.folders.set(validatedFolder.id, validatedFolder);
                        }
                    });
                }
                
                console.log(`Loaded ${this.notes.size} notes and ${this.folders.size} folders`);
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            throw new Error(`Failed to load notes: ${error.message}`);
        } finally {
            this.loadInProgress = false;
        }
    }

    // Save notes to storage with race condition prevention
    async saveNotes() {
        // Prevent concurrent saving operations
        if (this.saveInProgress) {
            return;
        }
        
        this.saveInProgress = true;
        
        try {
            if (this.storageManager) {
                const data = {
                    notes: Array.from(this.notes.values()).map(note => this.validateNote(note, false)),
                    folders: Array.from(this.folders.values()).map(folder => this.validateFolder(folder, false))
                };
                
                // Filter out invalid entries
                data.notes = data.notes.filter(Boolean);
                data.folders = data.folders.filter(Boolean);
                
                await this.storageManager.saveNotes(data);
                console.log(`Saved ${data.notes.length} notes and ${data.folders.length} folders`);
            }
        } catch (error) {
            console.error('Error saving notes:', error);
            throw new Error(`Failed to save notes: ${error.message}`);
        } finally {
            this.saveInProgress = false;
        }
    }

    // Create a new note with validation
    createNote(options = {}) {
        try {
            // Validate input options
            if (options && typeof options !== 'object') {
                throw new Error('Options must be an object');
            }

            const note = {
                id: this.generateId(),
                title: this.sanitizeTitle(options.title || ''),
                content: this.sanitizeContent(options.content || ''),
                color: this.validateColor(options.color || '#ffffff'),
                tags: this.validateTags(options.tags || []),
                folderId: this.validateFolderId(options.folderId || null),
                isFavorite: Boolean(options.isFavorite),
                isShared: Boolean(options.isShared),
                createdAt: new Date(),
                modifiedAt: new Date(),
                isDirty: false,
                metadata: {
                    wordCount: 0,
                    attachments: [],
                    links: [],
                    version: 1
                }
            };

            // Final validation
            const validatedNote = this.validateNote(note, true);
            if (!validatedNote) {
                throw new Error('Failed to create valid note');
            }

            this.notes.set(validatedNote.id, validatedNote);
            
            // Save asynchronously without blocking
            this.saveNotes().catch(error => {
                console.error('Failed to save after creating note:', error);
            });
            
            return validatedNote;
        } catch (error) {
            console.error('Error creating note:', error);
            throw new Error(`Failed to create note: ${error.message}`);
        }
    }

    // Get a note by ID
    getNote(id) {
        return this.notes.get(id);
    }

    // Update a note with proper synchronization
    async updateNote(note) {
        if (!note || !note.id || !this.notes.has(note.id)) {
            return false;
        }

        try {
            // Validate the note before updating
            const validatedNote = this.validateNote(note, true);
            
            validatedNote.modifiedAt = new Date();
            this.notes.set(validatedNote.id, validatedNote);
            
            // Ensure persistence
            await this.saveNotes();
            return true;
        } catch (error) {
            console.error('Failed to update note:', error);
            throw error;
        }
    }

    // Delete a note with proper synchronization
    async deleteNote(id) {
        if (!id || typeof id !== 'string') {
            throw new Error('Invalid note ID for deletion');
        }

        if (this.notes.has(id)) {
            try {
                // Remove from memory first
                this.notes.delete(id);
                
                // Immediately persist to storage to prevent reappearing
                await this.safeExecute(async () => {
                    if (this.storageManager) {
                        // Delete from IndexedDB directly
                        await this.storageManager.deleteNote(id);
                        // Also save the updated notes collection
                        await this.saveNotes();
                    }
                }, 'note deletion');
                
                console.log(`Note ${id} successfully deleted and synchronized`);
                return true;
            } catch (error) {
                // Restore note to memory if deletion failed
                console.error('Failed to delete note, restoration may be needed:', error);
                throw error;
            }
        }
        
        console.warn(`Note ${id} not found for deletion`);
        return false;
    }

    // Toggle favorite status
    toggleFavorite(id) {
        const note = this.notes.get(id);
        if (note) {
            note.isFavorite = !note.isFavorite;
            note.modifiedAt = new Date();
            this.saveNotes();
            return note.isFavorite;
        }
        return false;
    }

    // Get all notes
    getAllNotes() {
        return Array.from(this.notes.values());
    }

    // Get filtered and sorted notes
    getFilteredNotes() {
        let filteredNotes = Array.from(this.notes.values());

        // Apply quick filter
        switch (this.quickFilter) {
            case 'recent':
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                filteredNotes = filteredNotes.filter(note => 
                    new Date(note.modifiedAt) >= oneWeekAgo
                );
                break;
            case 'favorites':
                filteredNotes = filteredNotes.filter(note => note.isFavorite);
                break;
            case 'shared':
                filteredNotes = filteredNotes.filter(note => note.isShared);
                break;
            // 'all' case - no filtering needed
        }

        // Apply folder filter
        if (this.folderFilter) {
            filteredNotes = filteredNotes.filter(note => 
                note.folderId === this.folderFilter
            );
        }

        // Apply tag filter
        if (this.tagFilter) {
            filteredNotes = filteredNotes.filter(note => 
                note.tags && note.tags.includes(this.tagFilter)
            );
        }

        // Apply search filter
        if (this.searchQuery && this.searchQuery.trim()) {
            const query = this.searchQuery.toLowerCase().trim();
            filteredNotes = filteredNotes.filter(note => {
                const title = (note.title || '').toLowerCase();
                const content = this.stripHTML(note.content || '').toLowerCase();
                const tags = (note.tags || []).join(' ').toLowerCase();
                
                return title.includes(query) || 
                       content.includes(query) || 
                       tags.includes(query);
            });
        }

        // Sort notes
        filteredNotes.sort((a, b) => {
            switch (this.sortBy) {
                case 'created':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'title':
                    return (a.title || '').localeCompare(b.title || '');
                case 'folder':
                    const folderA = this.getFolderName(a.folderId) || '';
                    const folderB = this.getFolderName(b.folderId) || '';
                    return folderA.localeCompare(folderB);
                case 'modified':
                default:
                    return new Date(b.modifiedAt) - new Date(a.modifiedAt);
            }
        });

        return filteredNotes;
    }

    // Set search query with immediate filtering
    setSearchFilter(query) {
        this.searchQuery = query ? query.trim() : '';
        console.log(`Search filter set to: "${this.searchQuery}"`);
    }

    // Clear all filters
    clearAllFilters() {
        this.searchQuery = '';
        this.quickFilter = 'all';
        this.folderFilter = null;
        this.tagFilter = null;
        console.log('All filters cleared');
    }

    // Set quick filter
    setQuickFilter(filter) {
        this.quickFilter = filter;
    }

    // Set folder filter
    setFolderFilter(folderId) {
        this.folderFilter = folderId;
    }

    // Set tag filter
    setTagFilter(tag) {
        this.tagFilter = tag;
    }

    // Set sort option
    setSortBy(sortBy) {
        this.sortBy = sortBy;
    }

    // Folder management
    createFolder(name, parentId = null) {
        const folder = {
            id: this.generateId(),
            name: name,
            parentId: parentId,
            color: '#ffffff',
            createdAt: new Date(),
            modifiedAt: new Date()
        };

        this.folders.set(folder.id, folder);
        this.saveNotes();
        
        return folder;
    }

    getFolder(id) {
        return this.folders.get(id);
    }

    getFolders() {
        const folders = Array.from(this.folders.values());
        
        // Add note counts
        return folders.map(folder => {
            const noteCount = Array.from(this.notes.values())
                .filter(note => note.folderId === folder.id).length;
            
            return {
                ...folder,
                noteCount
            };
        });
    }

    getFolderName(folderId) {
        const folder = this.folders.get(folderId);
        return folder ? folder.name : null;
    }

    updateFolder(folder) {
        if (this.folders.has(folder.id)) {
            folder.modifiedAt = new Date();
            this.folders.set(folder.id, folder);
            this.saveNotes();
            return true;
        }
        return false;
    }

    deleteFolder(id) {
        if (this.folders.has(id)) {
            // Move notes in this folder to no folder
            Array.from(this.notes.values())
                .filter(note => note.folderId === id)
                .forEach(note => {
                    note.folderId = null;
                    this.updateNote(note);
                });
            
            this.folders.delete(id);
            this.saveNotes();
            return true;
        }
        return false;
    }

    // Tag management
    getAllTags() {
        const tagCount = new Map();
        
        Array.from(this.notes.values()).forEach(note => {
            if (note.tags && note.tags.length > 0) {
                note.tags.forEach(tag => {
                    const count = tagCount.get(tag) || 0;
                    tagCount.set(tag, count + 1);
                });
            }
        });

        return Array.from(tagCount.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }

    addTagToNote(noteId, tag) {
        const note = this.getNote(noteId);
        if (note) {
            if (!note.tags) note.tags = [];
            if (!note.tags.includes(tag)) {
                note.tags.push(tag);
                this.updateNote(note);
                return true;
            }
        }
        return false;
    }

    removeTagFromNote(noteId, tag) {
        const note = this.getNote(noteId);
        if (note && note.tags) {
            const index = note.tags.indexOf(tag);
            if (index > -1) {
                note.tags.splice(index, 1);
                this.updateNote(note);
                return true;
            }
        }
        return false;
    }

    // Search and filtering utilities
    searchNotes(query, options = {}) {
        const {
            folders = [],
            tags = [],
            dateFrom = null,
            dateTo = null,
            includeContent = true,
            includeTags = true,
            includeTitle = true
        } = options;

        let results = Array.from(this.notes.values());

        if (query && query.trim()) {
            const searchQuery = query.toLowerCase().trim();
            results = results.filter(note => {
                let searchText = '';
                
                if (includeTitle) {
                    searchText += (note.title || '').toLowerCase() + ' ';
                }
                
                if (includeContent) {
                    searchText += this.stripHTML(note.content || '').toLowerCase() + ' ';
                }
                
                if (includeTags && note.tags) {
                    searchText += note.tags.join(' ').toLowerCase();
                }
                
                return searchText.includes(searchQuery);
            });
        }

        // Filter by folders
        if (folders.length > 0) {
            results = results.filter(note => 
                folders.includes(note.folderId)
            );
        }

        // Filter by tags
        if (tags.length > 0) {
            results = results.filter(note => 
                note.tags && tags.some(tag => note.tags.includes(tag))
            );
        }

        // Filter by date range
        if (dateFrom || dateTo) {
            results = results.filter(note => {
                const noteDate = new Date(note.modifiedAt);
                if (dateFrom && noteDate < new Date(dateFrom)) return false;
                if (dateTo && noteDate > new Date(dateTo)) return false;
                return true;
            });
        }

        return results.sort((a, b) => 
            new Date(b.modifiedAt) - new Date(a.modifiedAt)
        );
    }

    // Utility methods
    generateId() {
        // More secure ID generation with collision prevention
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substring(2, 15);
        const counterPart = (this.notes.size + this.folders.size).toString(36);
        return `note_${timestamp}_${randomPart}_${counterPart}`;
    }

    // Comprehensive note validation
    validateNote(note, throwOnError = false) {
        try {
            if (!note || typeof note !== 'object') {
                throw new Error('Note must be an object');
            }

            if (!note.id || typeof note.id !== 'string') {
                if (throwOnError) throw new Error('Note ID is required and must be a string');
                return null;
            }

            // Validate and sanitize all fields
            const validatedNote = {
                id: note.id,
                title: this.sanitizeTitle(note.title || ''),
                content: this.sanitizeContent(note.content || ''),
                color: this.validateColor(note.color || '#ffffff'),
                tags: this.validateTags(note.tags || []),
                folderId: this.validateFolderId(note.folderId),
                isFavorite: Boolean(note.isFavorite),
                isShared: Boolean(note.isShared),
                createdAt: note.createdAt ? new Date(note.createdAt) : new Date(),
                modifiedAt: note.modifiedAt ? new Date(note.modifiedAt) : new Date(),
                isDirty: Boolean(note.isDirty),
                metadata: {
                    wordCount: Math.max(0, parseInt(note.metadata?.wordCount || 0)),
                    attachments: Array.isArray(note.metadata?.attachments) ? note.metadata.attachments : [],
                    links: Array.isArray(note.metadata?.links) ? note.metadata.links : [],
                    version: Math.max(1, parseInt(note.metadata?.version || 1))
                }
            };

            return validatedNote;
        } catch (error) {
            if (throwOnError) throw error;
            console.warn('Note validation failed:', error);
            return null;
        }
    }

    // Validate folder data
    validateFolder(folder, throwOnError = false) {
        try {
            if (!folder || typeof folder !== 'object') {
                throw new Error('Folder must be an object');
            }

            if (!folder.id || typeof folder.id !== 'string') {
                if (throwOnError) throw new Error('Folder ID is required');
                return null;
            }

            if (!folder.name || typeof folder.name !== 'string' || folder.name.trim().length === 0) {
                if (throwOnError) throw new Error('Folder name is required');
                return null;
            }

            return {
                id: folder.id,
                name: folder.name.trim().substring(0, this.maxTitleLength),
                parentId: folder.parentId || null,
                color: this.validateColor(folder.color || '#ffffff'),
                createdAt: folder.createdAt ? new Date(folder.createdAt) : new Date(),
                modifiedAt: folder.modifiedAt ? new Date(folder.modifiedAt) : new Date()
            };
        } catch (error) {
            if (throwOnError) throw error;
            console.warn('Folder validation failed:', error);
            return null;
        }
    }

    // Sanitize title input
    sanitizeTitle(title) {
        if (typeof title !== 'string') return '';
        return title.trim().substring(0, this.maxTitleLength);
    }

    // Sanitize content with size limits
    sanitizeContent(content) {
        if (typeof content !== 'string') return '';
        if (content.length > this.maxNoteSize) {
            console.warn(`Content truncated from ${content.length} to ${this.maxNoteSize} characters`);
            return content.substring(0, this.maxNoteSize);
        }
        return content;
    }

    // Validate color format
    validateColor(color) {
        if (typeof color !== 'string') return '#ffffff';
        
        // Simple hex color validation
        const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
        if (hexColorRegex.test(color)) {
            return color;
        }
        
        // Default to white if invalid
        return '#ffffff';
    }

    // Validate tags array
    validateTags(tags) {
        if (!Array.isArray(tags)) return [];
        
        return tags
            .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
            .map(tag => tag.trim().substring(0, this.maxTagLength))
            .slice(0, this.maxTagsPerNote) // Limit number of tags
            .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates
    }

    // Validate folder ID
    validateFolderId(folderId) {
        if (!folderId) return null;
        if (typeof folderId !== 'string') return null;
        
        // Check if folder exists
        if (this.folders.has(folderId)) {
            return folderId;
        }
        
        console.warn(`Invalid folder ID: ${folderId}`);
        return null;
    }

    // Enhanced error handling for operations
    async safeExecute(operation, context = 'operation') {
        try {
            return await operation();
        } catch (error) {
            console.error(`Error in ${context}:`, error);
            throw new Error(`${context} failed: ${error.message}`);
        }
    }

    stripHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    // Export functionality
    exportNote(noteId, format = 'json') {
        const note = this.getNote(noteId);
        if (!note) return null;

        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(note, null, 2);
            
            case 'markdown':
                let markdown = `# ${note.title || 'Untitled Note'}\n\n`;
                
                if (note.tags && note.tags.length > 0) {
                    markdown += `Tags: ${note.tags.map(tag => `#${tag}`).join(' ')}\n\n`;
                }
                
                markdown += this.stripHTML(note.content || '');
                
                if (note.createdAt) {
                    markdown += `\n\n---\nCreated: ${new Date(note.createdAt).toLocaleDateString()}`;
                }
                
                if (note.modifiedAt) {
                    markdown += `\nModified: ${new Date(note.modifiedAt).toLocaleDateString()}`;
                }
                
                return markdown;
            
            case 'html':
                return `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${note.title || 'Untitled Note'}</title>
                        <style>
                            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                            h1 { color: #333; }
                            .meta { color: #666; font-size: 0.9em; margin-bottom: 20px; }
                            .tags { margin: 10px 0; }
                            .tag { background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; }
                        </style>
                    </head>
                    <body>
                        <h1>${note.title || 'Untitled Note'}</h1>
                        <div class="meta">
                            Created: ${new Date(note.createdAt).toLocaleDateString()}
                            | Modified: ${new Date(note.modifiedAt).toLocaleDateString()}
                        </div>
                        ${note.tags && note.tags.length > 0 ? `
                            <div class="tags">
                                ${note.tags.map(tag => `<span class="tag">#${tag}</span>`).join(' ')}
                            </div>
                        ` : ''}
                        <div class="content">
                            ${note.content || ''}
                        </div>
                    </body>
                    </html>
                `;
            
            case 'txt':
                let text = `${note.title || 'Untitled Note'}\n`;
                text += '='.repeat((note.title || 'Untitled Note').length) + '\n\n';
                
                if (note.tags && note.tags.length > 0) {
                    text += `Tags: ${note.tags.join(', ')}\n\n`;
                }
                
                text += this.stripHTML(note.content || '') + '\n\n';
                text += `Created: ${new Date(note.createdAt).toLocaleDateString()}\n`;
                text += `Modified: ${new Date(note.modifiedAt).toLocaleDateString()}`;
                
                return text;
            
            default:
                return JSON.stringify(note, null, 2);
        }
    }

    exportAllNotes(format = 'json') {
        const notes = this.getAllNotes();
        
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify({
                    notes: notes,
                    folders: Array.from(this.folders.values()),
                    exportDate: new Date(),
                    version: '1.0'
                }, null, 2);
            
            case 'markdown':
                let markdown = '# My Notes Export\n\n';
                markdown += `Exported on: ${new Date().toLocaleDateString()}\n\n`;
                
                notes.forEach(note => {
                    markdown += `## ${note.title || 'Untitled Note'}\n\n`;
                    
                    if (note.tags && note.tags.length > 0) {
                        markdown += `Tags: ${note.tags.map(tag => `#${tag}`).join(' ')}\n\n`;
                    }
                    
                    markdown += this.stripHTML(note.content || '') + '\n\n';
                    markdown += '---\n\n';
                });
                
                return markdown;
            
            default:
                return this.exportAllNotes('json');
        }
    }

    // Import functionality
    importNote(data, format = 'json') {
        try {
            let noteData;
            
            switch (format.toLowerCase()) {
                case 'json':
                    noteData = typeof data === 'string' ? JSON.parse(data) : data;
                    break;
                
                case 'markdown':
                    // Basic markdown parsing
                    const lines = data.split('\n');
                    const title = lines[0].replace(/^#\s*/, '').trim();
                    const content = lines.slice(2).join('\n').trim();
                    
                    noteData = {
                        title: title,
                        content: content.replace(/\n/g, '<br>'),
                        tags: []
                    };
                    
                    // Extract tags if present
                    const tagMatch = content.match(/Tags:\s*((?:#\w+\s*)+)/);
                    if (tagMatch) {
                        noteData.tags = tagMatch[1].match(/#(\w+)/g).map(tag => tag.substring(1));
                    }
                    break;
                
                default:
                    throw new Error('Unsupported import format');
            }
            
            // Create new note with imported data
            const note = this.createNote({
                title: noteData.title || 'Imported Note',
                content: noteData.content || '',
                tags: noteData.tags || [],
                color: noteData.color || '#ffffff'
            });
            
            return note;
            
        } catch (error) {
            console.error('Error importing note:', error);
            return null;
        }
    }

    // Statistics
    getStatistics() {
        const notes = this.getAllNotes();
        const totalWords = notes.reduce((sum, note) => {
            const wordCount = this.stripHTML(note.content || '').trim().split(/\s+/).length;
            return sum + (wordCount > 0 ? wordCount : 0);
        }, 0);

        return {
            totalNotes: notes.length,
            totalWords: totalWords,
            totalFolders: this.folders.size,
            totalTags: this.getAllTags().length,
            favoriteNotes: notes.filter(note => note.isFavorite).length,
            sharedNotes: notes.filter(note => note.isShared).length,
            oldestNote: notes.length > 0 ? new Date(Math.min(...notes.map(n => new Date(n.createdAt)))) : null,
            newestNote: notes.length > 0 ? new Date(Math.max(...notes.map(n => new Date(n.createdAt)))) : null
        };
    }
}