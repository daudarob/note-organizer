// Storage Manager - Handles offline storage with IndexedDB
class StorageManager {
    constructor() {
        this.dbName = 'NoteOrganizerDB';
        this.dbVersion = 1;
        this.db = null;
        this.storeName = 'notes';
        this.foldersStoreName = 'folders';
        this.settingsStoreName = 'settings';
        
        // Prevent race conditions
        this.initPromise = null;
        this.operationQueue = [];
        this.isProcessingQueue = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
    }

    // Initialize IndexedDB with enhanced error handling and race condition prevention
    async init() {
        // Prevent multiple initialization attempts
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._initDatabase();
        return this.initPromise;
    }

    async _initDatabase() {
        // Check if IndexedDB is supported
        if (!window.indexedDB) {
            throw new Error('IndexedDB is not supported in this browser');
        }

        while (this.connectionAttempts < this.maxConnectionAttempts) {
            try {
                this.connectionAttempts++;
                const db = await this._openDatabase();
                this.db = db;
                
                // Setup error handling for the database connection
                this.db.onerror = (event) => {
                    console.error('Database error:', event.target.error);
                };

                this.db.onclose = () => {
                    console.warn('Database connection closed unexpectedly');
                    this.db = null;
                };

                console.log('IndexedDB initialized successfully');
                this.connectionAttempts = 0;
                return this.db;

            } catch (error) {
                console.error(`Database initialization attempt ${this.connectionAttempts} failed:`, error);
                
                if (this.connectionAttempts >= this.maxConnectionAttempts) {
                    throw new Error(`Failed to initialize database after ${this.maxConnectionAttempts} attempts: ${error.message}`);
                }
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * this.connectionAttempts));
            }
        }
    }

    _openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error(`Failed to open database: ${request.error?.message || 'Unknown error'}`));
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                try {
                    const db = event.target.result;
                    
                    // Create notes object store
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        const notesStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
                        notesStore.createIndex('title', 'title', { unique: false });
                        notesStore.createIndex('createdAt', 'createdAt', { unique: false });
                        notesStore.createIndex('modifiedAt', 'modifiedAt', { unique: false });
                        notesStore.createIndex('folderId', 'folderId', { unique: false });
                        notesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
                    }

                    // Create folders object store
                    if (!db.objectStoreNames.contains(this.foldersStoreName)) {
                        const foldersStore = db.createObjectStore(this.foldersStoreName, { keyPath: 'id' });
                        foldersStore.createIndex('name', 'name', { unique: false });
                        foldersStore.createIndex('parentId', 'parentId', { unique: false });
                    }

                    // Create settings object store
                    if (!db.objectStoreNames.contains(this.settingsStoreName)) {
                        db.createObjectStore(this.settingsStoreName, { keyPath: 'key' });
                    }

                    console.log('IndexedDB stores created/updated');
                } catch (upgradeError) {
                    console.error('Error during database upgrade:', upgradeError);
                    reject(upgradeError);
                }
            };

            request.onblocked = () => {
                console.warn('Database upgrade blocked. Please close other tabs with this app.');
            };
        });
    }

    // Save a single note
    async saveNote(note) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.put(note);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Save multiple notes
    async saveNotes(data) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName, this.foldersStoreName], 'readwrite');
            const notesStore = transaction.objectStore(this.storeName);
            const foldersStore = transaction.objectStore(this.foldersStoreName);

            let completed = 0;
            let total = (data.notes?.length || 0) + (data.folders?.length || 0);
            
            if (total === 0) {
                resolve();
                return;
            }

            const checkComplete = () => {
                completed++;
                if (completed === total) {
                    resolve();
                }
            };

            // Save notes
            if (data.notes) {
                data.notes.forEach(note => {
                    const request = notesStore.put(note);
                    request.onsuccess = checkComplete;
                    request.onerror = () => reject(request.error);
                });
            }

            // Save folders
            if (data.folders) {
                data.folders.forEach(folder => {
                    const request = foldersStore.put(folder);
                    request.onsuccess = checkComplete;
                    request.onerror = () => reject(request.error);
                });
            }

            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Load all notes and folders
    async loadNotes() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName, this.foldersStoreName], 'readonly');
            const notesStore = transaction.objectStore(this.storeName);
            const foldersStore = transaction.objectStore(this.foldersStoreName);

            const notes = [];
            const folders = [];

            // Load notes
            const notesRequest = notesStore.getAll();
            notesRequest.onsuccess = () => {
                notes.push(...notesRequest.result);
            };

            // Load folders
            const foldersRequest = foldersStore.getAll();
            foldersRequest.onsuccess = () => {
                folders.push(...foldersRequest.result);
            };

            transaction.oncomplete = () => {
                resolve({ notes, folders });
            };

            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Load a single note
    async loadNote(id) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Delete a note
    async deleteNote(id) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.delete(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Save folder
    async saveFolder(folder) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.foldersStoreName], 'readwrite');
            const store = transaction.objectStore(this.foldersStoreName);
            
            const request = store.put(folder);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Delete folder
    async deleteFolder(id) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.foldersStoreName], 'readwrite');
            const store = transaction.objectStore(this.foldersStoreName);
            
            const request = store.delete(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Save settings
    async saveSetting(key, value) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.settingsStoreName], 'readwrite');
            const store = transaction.objectStore(this.settingsStoreName);
            
            const request = store.put({ key, value });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Load setting
    async loadSetting(key) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.settingsStoreName], 'readonly');
            const store = transaction.objectStore(this.settingsStoreName);
            
            const request = store.get(key);
            
            request.onsuccess = () => {
                resolve(request.result ? request.result.value : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Search notes
    async searchNotes(query, options = {}) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const { tags = [], folderId = null, dateRange = null } = options;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const results = [];

            let cursor;
            
            if (tags.length > 0) {
                // Search by tags
                const index = store.index('tags');
                cursor = index.openCursor();
            } else if (folderId) {
                // Search by folder
                const index = store.index('folderId');
                cursor = index.openCursor(IDBKeyRange.only(folderId));
            } else {
                // Search all notes
                cursor = store.openCursor();
            }

            cursor.onsuccess = (event) => {
                const result = event.target.result;
                if (result) {
                    const note = result.value;
                    let matches = true;

                    // Text search
                    if (query && query.trim()) {
                        const searchText = (
                            (note.title || '') + ' ' + 
                            this.stripHTML(note.content || '') + ' ' +
                            (note.tags || []).join(' ')
                        ).toLowerCase();
                        matches = matches && searchText.includes(query.toLowerCase());
                    }

                    // Date range filter
                    if (dateRange && matches) {
                        const noteDate = new Date(note.modifiedAt);
                        if (dateRange.from && noteDate < new Date(dateRange.from)) {
                            matches = false;
                        }
                        if (dateRange.to && noteDate > new Date(dateRange.to)) {
                            matches = false;
                        }
                    }

                    if (matches) {
                        results.push(note);
                    }

                    result.continue();
                } else {
                    resolve(results);
                }
            };

            cursor.onerror = () => reject(cursor.error);
        });
    }

    // Export all data
    async exportAllData() {
        const data = await this.loadNotes();
        const settings = await this.loadAllSettings();
        
        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            notes: data.notes,
            folders: data.folders,
            settings: settings
        };
    }

    // Import data
    async importData(data) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            // Clear existing data
            await this.clearAllData();
            
            // Import new data
            if (data.notes && data.folders) {
                await this.saveNotes(data);
            }

            if (data.settings) {
                for (const [key, value] of Object.entries(data.settings)) {
                    await this.saveSetting(key, value);
                }
            }

            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    // Clear all data
    async clearAllData() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([
                this.storeName, 
                this.foldersStoreName, 
                this.settingsStoreName
            ], 'readwrite');

            const notesStore = transaction.objectStore(this.storeName);
            const foldersStore = transaction.objectStore(this.foldersStoreName);
            const settingsStore = transaction.objectStore(this.settingsStoreName);

            Promise.all([
                new Promise((res, rej) => {
                    const req = notesStore.clear();
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                }),
                new Promise((res, rej) => {
                    const req = foldersStore.clear();
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                }),
                new Promise((res, rej) => {
                    const req = settingsStore.clear();
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                })
            ]).then(() => resolve()).catch(reject);
        });
    }

    // Load all settings
    async loadAllSettings() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.settingsStoreName], 'readonly');
            const store = transaction.objectStore(this.settingsStoreName);
            const settings = {};

            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    settings[cursor.value.key] = cursor.value.value;
                    cursor.continue();
                } else {
                    resolve(settings);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    // Get database statistics
    async getStatistics() {
        if (!this.db) {
            return null;
        }

        const data = await this.loadNotes();
        const settings = await this.loadAllSettings();

        return {
            notesCount: data.notes.length,
            foldersCount: data.folders.length,
            settingsCount: Object.keys(settings).length,
            databaseSize: await this.estimateSize(),
            lastBackup: settings.lastBackup || null
        };
    }

    // Estimate database size (approximate)
    async estimateSize() {
        if (!navigator.storage || !navigator.storage.estimate) {
            return null;
        }

        try {
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage,
                available: estimate.quota - estimate.usage,
                total: estimate.quota
            };
        } catch (error) {
            console.error('Error estimating storage:', error);
            return null;
        }
    }

    // Backup data to file
    async createBackup() {
        const data = await this.exportAllData();
        const backup = {
            ...data,
            backupDate: new Date().toISOString()
        };

        // Save backup info
        await this.saveSetting('lastBackup', new Date().toISOString());

        return JSON.stringify(backup, null, 2);
    }

    // Utility methods
    stripHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    // Enhanced connection management
    async _ensureConnection() {
        if (!this.db || this.db.readyState === 'closed') {
            await this.init();
        }
    }

    // Queue operations to prevent race conditions
    async _queueOperation(operation) {
        return new Promise((resolve, reject) => {
            this.operationQueue.push({ operation, resolve, reject });
            this._processQueue();
        });
    }

    async _processQueue() {
        if (this.isProcessingQueue || this.operationQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.operationQueue.length > 0) {
            const { operation, resolve, reject } = this.operationQueue.shift();
            
            try {
                const result = await operation();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }

        this.isProcessingQueue = false;
    }

    // Enhanced database connection closure
    close() {
        try {
            // Clear operation queue
            this.operationQueue.forEach(({ reject }) => {
                reject(new Error('Database connection closed'));
            });
            this.operationQueue.length = 0;

            // Close database connection
            if (this.db && this.db.readyState !== 'closed') {
                this.db.close();
            }
            
            this.db = null;
            this.initPromise = null;
            this.connectionAttempts = 0;
            
            console.log('Database connection closed successfully');
        } catch (error) {
            console.error('Error closing database connection:', error);
        }
    }

    // Health check method
    async healthCheck() {
        try {
            await this._ensureConnection();
            
            // Try a simple read operation
            const transaction = this.db.transaction([this.settingsStoreName], 'readonly');
            const store = transaction.objectStore(this.settingsStoreName);
            const request = store.count();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve({ healthy: true, recordCount: request.result });
                request.onerror = () => reject(new Error('Health check failed'));
                
                setTimeout(() => reject(new Error('Health check timeout')), 5000);
            });
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }

    // Enhanced error handling for all operations
    async _executeWithRetry(operation, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.warn(`Operation attempt ${attempt} failed:`, error);
                
                if (attempt < maxRetries) {
                    // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                    
                    // Try to reconnect if connection was lost
                    if (error.message.includes('connection') || error.message.includes('database')) {
                        try {
                            await this._ensureConnection();
                        } catch (reconnectError) {
                            console.error('Failed to reconnect:', reconnectError);
                        }
                    }
                }
            }
        }
        
        throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError.message}`);
    }
}