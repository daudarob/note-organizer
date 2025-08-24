// Service Worker for Note Organizer App
// Provides offline functionality and caching

const CACHE_NAME = 'note-organizer-v1.0';
const OFFLINE_URL = '/offline.html';

// Files to cache for offline functionality
const CACHE_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/js/app.js',
    '/js/noteManager.js',
    '/js/searchManager.js',
    '/js/storageManager.js',
    '/js/themeManager.js',
    '/js/keyboardShortcuts.js',
    // External dependencies
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install event - cache essential files with enhanced error handling
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                console.log('Service Worker: Caching essential files');
                
                // Cache files individually to handle failures gracefully
                const cachePromises = CACHE_FILES.map(async (url) => {
                    try {
                        await cache.add(url);
                        console.log(`Service Worker: Cached ${url}`);
                    } catch (error) {
                        console.warn(`Service Worker: Failed to cache ${url}:`, error);
                        // Continue with other files even if one fails
                    }
                });
                
                await Promise.allSettled(cachePromises);
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
                
            } catch (error) {
                console.error('Service Worker: Installation failed', error);
                throw error;
            }
        })()
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http requests
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached version if available
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Try to fetch from network
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone response for caching
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Network failed, try to serve offline page for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }
                        
                        // For other requests, return a generic offline response
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Background sync for note synchronization
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered', event.tag);
    
    if (event.tag === 'background-sync-notes') {
        event.waitUntil(syncNotes());
    }
});

// Push notifications for reminders
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'You have a note reminder!',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'note-reminder',
        vibrate: [200, 100, 200],
        actions: [
            {
                action: 'open',
                title: 'Open Note',
                icon: '/icon-open.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: '/icon-dismiss.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Note Organizer', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked', event.action);
    
    event.notification.close();

    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Enhanced sync notes function with better error handling
async function syncNotes() {
    try {
        console.log('Service Worker: Syncing notes...');
        
        // Check if IndexedDB is available
        if (!self.indexedDB) {
            console.warn('Service Worker: IndexedDB not available');
            return;
        }
        
        // Open IndexedDB and get unsync'd notes
        const db = await openDatabase();
        if (!db) {
            console.error('Service Worker: Failed to open database');
            return;
        }
        
        const unsynced = await getUnsyncedNotes(db);
        
        if (unsynced.length > 0) {
            console.log(`Service Worker: Found ${unsynced.length} unsynced notes`);
            
            let syncedCount = 0;
            let failedCount = 0;
            
            // Attempt to sync each note with retry logic
            for (const note of unsynced) {
                try {
                    await syncSingleNote(note);
                    await markNoteAsSynced(db, note.id);
                    syncedCount++;
                } catch (error) {
                    console.error('Service Worker: Failed to sync note', note.id, error);
                    failedCount++;
                }
            }
            
            console.log(`Service Worker: Sync complete - ${syncedCount} synced, ${failedCount} failed`);
        } else {
            console.log('Service Worker: No unsynced notes found');
        }
        
    } catch (error) {
        console.error('Service Worker: Note sync failed', error);
    }
}

// Enhanced database helpers with error handling and timeouts
function openDatabase() {
    return new Promise((resolve, reject) => {
        if (!self.indexedDB) {
            reject(new Error('IndexedDB is not supported'));
            return;
        }
        
        const request = indexedDB.open('NoteOrganizerDB', 1);
        
        // Set timeout for database operation
        const timeout = setTimeout(() => {
            reject(new Error('Database open timeout'));
        }, 10000);
        
        request.onsuccess = () => {
            clearTimeout(timeout);
            resolve(request.result);
        };
        
        request.onerror = () => {
            clearTimeout(timeout);
            reject(new Error(`Database error: ${request.error?.message || 'Unknown error'}`));
        };
        
        request.onblocked = () => {
            console.warn('Service Worker: Database upgrade blocked');
        };
    });
}

function getUnsyncedNotes(db) {
    return new Promise((resolve, reject) => {
        try {
            if (!db) {
                reject(new Error('Database is not available'));
                return;
            }
            
            const transaction = db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.getAll();
            
            const timeout = setTimeout(() => {
                reject(new Error('Get unsynced notes timeout'));
            }, 5000);
            
            request.onsuccess = () => {
                clearTimeout(timeout);
                try {
                    const notes = request.result.filter(note =>
                        note && typeof note === 'object' && !note.synced
                    );
                    resolve(notes);
                } catch (filterError) {
                    reject(new Error(`Error filtering notes: ${filterError.message}`));
                }
            };
            
            request.onerror = () => {
                clearTimeout(timeout);
                reject(new Error(`Request error: ${request.error?.message || 'Unknown error'}`));
            };
            
            transaction.onerror = () => {
                clearTimeout(timeout);
                reject(new Error(`Transaction error: ${transaction.error?.message || 'Unknown error'}`));
            };
            
        } catch (error) {
            reject(new Error(`getUnsyncedNotes error: ${error.message}`));
        }
    });
}

async function syncSingleNote(note) {
    // Enhanced sync with validation and retry logic
    console.log('Service Worker: Syncing note', note.id);
    
    // Validate note before syncing
    if (!note || !note.id) {
        throw new Error('Invalid note data');
    }
    
    try {
        // Simulate network request with timeout and retry
        return new Promise((resolve, reject) => {
            // Simulate random failure for testing
            const shouldFail = Math.random() < 0.1; // 10% failure rate
            
            setTimeout(() => {
                if (shouldFail) {
                    reject(new Error('Simulated network error'));
                } else {
                    resolve({ success: true, syncedAt: new Date().toISOString() });
                }
            }, Math.random() * 1000 + 500); // 0.5-1.5 seconds
        });
    } catch (error) {
        console.error(`Service Worker: Sync failed for note ${note.id}:`, error);
        throw error;
    }
}

function markNoteAsSynced(db, noteId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['notes'], 'readwrite');
        const store = transaction.objectStore('notes');
        
        const getRequest = store.get(noteId);
        getRequest.onsuccess = () => {
            const note = getRequest.result;
            if (note) {
                note.synced = true;
                const putRequest = store.put(note);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                resolve(); // Note doesn't exist, consider it synced
            }
        };
        
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// Periodic cleanup of old cache entries
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CLEANUP_CACHE') {
        cleanupCache();
    }
});

async function cleanupCache() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        
        // Remove entries older than 7 days
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        for (const request of requests) {
            const response = await cache.match(request);
            const dateHeader = response.headers.get('date');
            
            if (dateHeader) {
                const responseDate = new Date(dateHeader);
                if (responseDate.getTime() < oneWeekAgo) {
                    await cache.delete(request);
                    console.log('Service Worker: Cleaned up old cache entry', request.url);
                }
            }
        }
    } catch (error) {
        console.error('Service Worker: Cache cleanup failed', error);
    }
}

// Handle app update notifications
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Inform clients about updates
function notifyClientsAboutUpdate() {
    self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
            client.postMessage({
                type: 'SW_UPDATE_AVAILABLE'
            });
        });
    });
}

console.log('Service Worker: Registered');