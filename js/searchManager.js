// Search Manager - Handles advanced search functionality
class SearchManager {
    constructor() {
        this.query = '';
        this.filters = {
            folders: [],
            tags: [],
            dateFrom: null,
            dateTo: null,
            includeContent: true,
            includeTags: true,
            includeTitle: true
        };
        this.searchHistory = [];
        this.maxHistorySize = 10;
    }

    // Set search query
    setQuery(query) {
        this.query = query;
        this.addToHistory(query);
    }

    // Get current query
    getQuery() {
        return this.query;
    }

    // Set search filters
    setFilters(filters) {
        this.filters = { ...this.filters, ...filters };
    }

    // Get current filters
    getFilters() {
        return { ...this.filters };
    }

    // Add query to search history
    addToHistory(query) {
        if (!query || query.trim() === '') return;
        
        const trimmedQuery = query.trim();
        
        // Remove if already exists
        const index = this.searchHistory.indexOf(trimmedQuery);
        if (index > -1) {
            this.searchHistory.splice(index, 1);
        }
        
        // Add to beginning
        this.searchHistory.unshift(trimmedQuery);
        
        // Limit history size
        if (this.searchHistory.length > this.maxHistorySize) {
            this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
        }
        
        this.saveSearchHistory();
    }

    // Get search history
    getSearchHistory() {
        return [...this.searchHistory];
    }

    // Clear search history
    clearSearchHistory() {
        this.searchHistory = [];
        this.saveSearchHistory();
    }

    // Save search history to localStorage
    saveSearchHistory() {
        try {
            localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
        } catch (error) {
            console.error('Error saving search history:', error);
        }
    }

    // Load search history from localStorage
    loadSearchHistory() {
        try {
            const saved = localStorage.getItem('searchHistory');
            if (saved) {
                this.searchHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading search history:', error);
            this.searchHistory = [];
        }
    }

    // Perform advanced search
    search(notes, query = null, filters = null) {
        const searchQuery = query || this.query;
        const searchFilters = filters || this.filters;
        
        let results = [...notes];

        // Text search
        if (searchQuery && searchQuery.trim()) {
            results = this.performTextSearch(results, searchQuery, searchFilters);
        }

        // Apply filters
        results = this.applyFilters(results, searchFilters);

        return results;
    }

    // Perform text search
    performTextSearch(notes, query, filters) {
        const searchTerms = this.parseSearchQuery(query);
        
        return notes.filter(note => {
            return searchTerms.every(term => {
                if (term.startsWith('-')) {
                    // Exclude term
                    const excludeTerm = term.substring(1).toLowerCase();
                    return !this.noteContainsTerm(note, excludeTerm, filters);
                } else if (term.startsWith('"') && term.endsWith('"')) {
                    // Exact phrase
                    const phrase = term.slice(1, -1).toLowerCase();
                    return this.noteContainsPhrase(note, phrase, filters);
                } else {
                    // Include term
                    return this.noteContainsTerm(note, term.toLowerCase(), filters);
                }
            });
        });
    }

    // Parse search query into terms
    parseSearchQuery(query) {
        const terms = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < query.length; i++) {
            const char = query[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
                current += char;
            } else if (char === ' ' && !inQuotes) {
                if (current.trim()) {
                    terms.push(current.trim());
                    current = '';
                }
            } else {
                current += char;
            }
        }
        
        if (current.trim()) {
            terms.push(current.trim());
        }
        
        return terms;
    }

    // Check if note contains a term
    noteContainsTerm(note, term, filters) {
        let searchText = '';
        
        if (filters.includeTitle) {
            searchText += (note.title || '').toLowerCase() + ' ';
        }
        
        if (filters.includeContent) {
            searchText += this.stripHTML(note.content || '').toLowerCase() + ' ';
        }
        
        if (filters.includeTags && note.tags) {
            searchText += note.tags.join(' ').toLowerCase();
        }
        
        return searchText.includes(term);
    }

    // Check if note contains an exact phrase
    noteContainsPhrase(note, phrase, filters) {
        let searchText = '';
        
        if (filters.includeTitle) {
            searchText += (note.title || '').toLowerCase() + ' ';
        }
        
        if (filters.includeContent) {
            searchText += this.stripHTML(note.content || '').toLowerCase() + ' ';
        }
        
        if (filters.includeTags && note.tags) {
            searchText += note.tags.join(' ').toLowerCase();
        }
        
        return searchText.includes(phrase);
    }

    // Apply additional filters
    applyFilters(notes, filters) {
        let filtered = [...notes];

        // Folder filter
        if (filters.folders && filters.folders.length > 0) {
            filtered = filtered.filter(note => 
                filters.folders.includes(note.folderId)
            );
        }

        // Tag filter
        if (filters.tags && filters.tags.length > 0) {
            filtered = filtered.filter(note => 
                note.tags && filters.tags.some(tag => note.tags.includes(tag))
            );
        }

        // Date range filter
        if (filters.dateFrom || filters.dateTo) {
            filtered = filtered.filter(note => {
                const noteDate = new Date(note.modifiedAt);
                
                if (filters.dateFrom && noteDate < new Date(filters.dateFrom)) {
                    return false;
                }
                
                if (filters.dateTo && noteDate > new Date(filters.dateTo)) {
                    return false;
                }
                
                return true;
            });
        }

        return filtered;
    }

    // Search suggestions
    generateSuggestions(notes, query) {
        if (!query || query.length < 2) return [];
        
        const suggestions = new Set();
        const queryLower = query.toLowerCase();
        
        notes.forEach(note => {
            // Title suggestions
            if (note.title) {
                const words = note.title.toLowerCase().split(/\s+/);
                words.forEach(word => {
                    if (word.startsWith(queryLower) && word.length > queryLower.length) {
                        suggestions.add(word);
                    }
                });
            }
            
            // Tag suggestions
            if (note.tags) {
                note.tags.forEach(tag => {
                    if (tag.toLowerCase().startsWith(queryLower)) {
                        suggestions.add(`#${tag}`);
                    }
                });
            }
        });
        
        return Array.from(suggestions).slice(0, 5);
    }

    // Highlight search terms in text
    highlightSearchTerms(text, query) {
        if (!query || !text) return text;
        
        const terms = this.parseSearchQuery(query);
        let highlightedText = text;
        
        terms.forEach(term => {
            if (!term.startsWith('-')) {
                const cleanTerm = term.replace(/['"]/g, '');
                const regex = new RegExp(`(${this.escapeRegExp(cleanTerm)})`, 'gi');
                highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
            }
        });
        
        return highlightedText;
    }

    // Get search result statistics
    getSearchStats(originalNotes, filteredNotes) {
        return {
            total: originalNotes.length,
            found: filteredNotes.length,
            percentage: originalNotes.length > 0 ? 
                Math.round((filteredNotes.length / originalNotes.length) * 100) : 0
        };
    }

    // Save search filters to localStorage
    saveSearchFilters() {
        try {
            localStorage.setItem('searchFilters', JSON.stringify(this.filters));
        } catch (error) {
            console.error('Error saving search filters:', error);
        }
    }

    // Load search filters from localStorage
    loadSearchFilters() {
        try {
            const saved = localStorage.getItem('searchFilters');
            if (saved) {
                const savedFilters = JSON.parse(saved);
                this.filters = { ...this.filters, ...savedFilters };
            }
        } catch (error) {
            console.error('Error loading search filters:', error);
        }
    }

    // Clear all filters
    clearFilters() {
        this.filters = {
            folders: [],
            tags: [],
            dateFrom: null,
            dateTo: null,
            includeContent: true,
            includeTags: true,
            includeTitle: true
        };
        this.saveSearchFilters();
    }

    // Export search results
    exportSearchResults(notes, format = 'json') {
        const results = {
            query: this.query,
            filters: this.filters,
            resultCount: notes.length,
            searchDate: new Date(),
            notes: notes
        };

        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(results, null, 2);
            
            case 'csv':
                let csv = 'Title,Content,Tags,Folder,Created,Modified\n';
                notes.forEach(note => {
                    csv += [
                        this.escapeCsv(note.title || ''),
                        this.escapeCsv(this.stripHTML(note.content || '')),
                        this.escapeCsv((note.tags || []).join(', ')),
                        this.escapeCsv(note.folderId || ''),
                        note.createdAt,
                        note.modifiedAt
                    ].join(',') + '\n';
                });
                return csv;
            
            default:
                return JSON.stringify(results, null, 2);
        }
    }

    // Utility methods
    stripHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    escapeCsv(text) {
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return '"' + text.replace(/"/g, '""') + '"';
        }
        return text;
    }

    // Initialize search manager
    init() {
        this.loadSearchHistory();
        this.loadSearchFilters();
    }
}