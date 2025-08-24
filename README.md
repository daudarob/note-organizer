# Digital Note Organizer

A comprehensive digital note organizer application with advanced features including offline access, search functionality, folders, tags, and more. Built as a Progressive Web App (PWA) with modern web technologies.

## Features

### ✅ Core Functionality
- **Note Creation & Editing**: Rich text editor with formatting options
- **Auto-Save**: Automatic saving of notes with change detection
- **Offline Storage**: IndexedDB for persistent offline storage
- **PWA Support**: Installable app with service worker for offline functionality
- **Dark/Light Themes**: Beautiful theme switching with system preference detection
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

### ✅ Organization & Search
- **Folder System**: Organize notes into customizable folders
- **Tagging System**: Add multiple tags to notes for easy categorization
- **Advanced Search**: Search through titles, content, and tags
- **Quick Access**: Filter by recent, favorites, and shared notes
- **Sort Options**: Sort by date modified, created, title, or folder

### ✅ User Experience
- **Keyboard Shortcuts**: Comprehensive keyboard shortcuts for power users
- **Accessibility**: WCAG compliant with ARIA labels and keyboard navigation
- **Word Count**: Real-time word counting
- **Note Preview**: Quick preview of notes in card format
- **Color Coding**: Assign colors to notes for visual organization

### ✅ Advanced Features
- **Service Worker**: Full offline functionality with background sync
- **Export Options**: Export notes in multiple formats (JSON, Markdown, HTML, TXT)
- **Import/Export**: Backup and restore all notes and settings
- **Version History**: Track note changes over time
- **Encryption Ready**: Infrastructure for end-to-end encryption
- **Reminder System**: Set reminders for notes (foundation implemented)

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Storage**: IndexedDB for offline data persistence
- **PWA**: Service Worker, Web App Manifest
- **UI/UX**: Modern CSS Grid, Flexbox, CSS Custom Properties
- **Icons**: Font Awesome 6
- **Fonts**: Inter font family

## Installation

### Local Development
1. Clone this repository
2. Open `index.html` in a modern web browser
3. For full PWA features, serve from a local web server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

### PWA Installation
- **Desktop**: Click the install button in your browser's address bar
- **Mobile**: Add to home screen from browser menu
- **Chrome**: Install from the three-dot menu

## Usage

### Getting Started
1. **Create Your First Note**: Click "New Note" or use the empty state button
2. **Add Content**: Type in the title and content areas
3. **Organize**: Add tags and assign to folders
4. **Save**: Notes auto-save, or use Ctrl+S
5. **Search**: Use the global search or advanced filters

### Keyboard Shortcuts
- **Ctrl + N**: Create new note
- **Ctrl + S**: Save current note
- **Ctrl + F**: Focus search
- **Ctrl + Shift + F**: Advanced search
- **Ctrl + B**: Toggle sidebar
- **Ctrl + Shift + T**: Toggle theme
- **Escape**: Close modals/editor

### Organization Tips
1. **Use Folders**: Create folders for different projects or categories
2. **Tag Consistently**: Use consistent tagging for better organization
3. **Color Coding**: Assign colors to notes based on priority or type
4. **Regular Cleanup**: Use the search and filter features to maintain organization

## File Structure

```
note-organizer/
├── index.html                 # Main application HTML
├── styles.css                # Complete styling with themes
├── manifest.json             # PWA manifest
├── sw.js                     # Service worker
├── js/
│   ├── app.js                # Main application controller
│   ├── noteManager.js        # Note CRUD operations
│   ├── searchManager.js      # Search functionality
│   ├── storageManager.js     # IndexedDB operations
│   ├── themeManager.js       # Theme switching
│   └── keyboardShortcuts.js  # Keyboard shortcuts handler
└── README.md                 # This file
```

## Data Storage

### Local Storage Structure
- **IndexedDB Database**: `NoteOrganizerDB`
- **Object Stores**:
  - `notes`: Individual note data
  - `folders`: Folder organization
  - `settings`: User preferences

### Data Format
```javascript
// Note Object
{
  id: "note_timestamp_random",
  title: "Note Title",
  content: "<p>Rich HTML content</p>",
  tags: ["tag1", "tag2"],
  folderId: "folder_id",
  color: "#ffffff",
  isFavorite: false,
  isShared: false,
  createdAt: Date,
  modifiedAt: Date,
  metadata: {
    wordCount: 100,
    attachments: [],
    links: [],
    version: 1
  }
}
```

## Browser Compatibility

### Supported Browsers
- **Chrome/Chromium**: 80+
- **Firefox**: 75+
- **Safari**: 13+
- **Edge**: 80+

### Required APIs
- IndexedDB (for storage)
- Service Worker (for offline functionality)
- CSS Custom Properties (for theming)
- Fetch API (for network requests)

## Performance

### Optimizations Implemented
- **Lazy Loading**: Components loaded as needed
- **Efficient Storage**: IndexedDB for fast local storage
- **Memory Management**: Proper cleanup of event listeners
- **Caching**: Service worker caches for offline performance
- **Debounced Search**: Optimized search input handling

## Security & Privacy

### Data Protection
- **Local Storage**: All data stored locally on user's device
- **No Tracking**: No analytics or tracking scripts
- **Encryption Ready**: Infrastructure for client-side encryption
- **HTTPS Required**: Service worker requires secure context

## Accessibility

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Proper ARIA labels and roles
- **Color Contrast**: Meets AA contrast requirements
- **Focus Management**: Logical focus flow
- **Semantic HTML**: Proper heading structure and landmarks

## Contributing

### Development Setup
1. Fork the repository
2. Make your changes
3. Test across different browsers
4. Ensure accessibility compliance
5. Submit a pull request

### Code Style
- Use modern JavaScript (ES6+)
- Follow semantic HTML practices
- Maintain CSS custom properties for theming
- Write accessible code with proper ARIA attributes

## Roadmap

### Planned Features
- [ ] Real-time collaboration
- [ ] Cloud synchronization
- [ ] Advanced text formatting
- [ ] Image and file attachments
- [ ] Voice note recording
- [ ] Drawing/sketching tools
- [ ] Note linking and backlinking
- [ ] Templates system
- [ ] Advanced encryption
- [ ] Plugin system

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Changelog

### v1.0.0 (Current)
- Initial release
- Core note functionality
- Offline storage with IndexedDB
- PWA support with service worker
- Dark/light theme switching
- Basic search and organization
- Keyboard shortcuts
- Export functionality foundation
- Accessibility compliance

## Support

For issues, questions, or contributions:
1. Check existing issues
2. Create detailed bug reports
3. Include browser version and steps to reproduce
4. Test on multiple devices when possible

---

**Digital Note Organizer** - Your thoughts, organized and accessible anywhere, anytime.