// Theme Manager - Handles light/dark theme switching
class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.themes = ['light', 'dark', 'auto'];
        this.storageKey = 'selectedTheme';
    }

    // Initialize theme manager
    init() {
        this.loadTheme();
        this.setupThemeToggle();
        this.setupSystemThemeListener();
        this.applyTheme();
    }

    // Load theme from storage
    loadTheme() {
        try {
            const savedTheme = localStorage.getItem(this.storageKey);
            if (savedTheme && this.themes.includes(savedTheme)) {
                this.currentTheme = savedTheme;
            } else {
                // Default to system preference
                this.currentTheme = this.getSystemPreference();
            }
        } catch (error) {
            console.error('Error loading theme:', error);
            this.currentTheme = 'light';
        }
    }

    // Save theme to storage
    saveTheme() {
        try {
            localStorage.setItem(this.storageKey, this.currentTheme);
        } catch (error) {
            console.error('Error saving theme:', error);
        }
    }

    // Get system theme preference
    getSystemPreference() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    // Apply theme to document
    applyTheme(theme = null) {
        const targetTheme = theme || this.resolveTheme();
        
        // Remove existing theme classes
        document.body.classList.remove('light-theme', 'dark-theme');
        
        // Apply new theme class
        document.body.classList.add(`${targetTheme}-theme`);
        
        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(targetTheme);
        
        // Update theme toggle button icon
        this.updateToggleIcon(targetTheme);
        
        // Store resolved theme for other components
        this.resolvedTheme = targetTheme;
        
        // Emit theme change event
        this.emitThemeChange(targetTheme);
    }

    // Resolve auto theme to actual theme
    resolveTheme() {
        if (this.currentTheme === 'auto') {
            return this.getSystemPreference();
        }
        return this.currentTheme;
    }

    // Toggle between themes
    toggle() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.themes.length;
        this.setTheme(this.themes[nextIndex]);
    }

    // Set specific theme
    setTheme(theme) {
        if (!this.themes.includes(theme)) {
            console.warn(`Invalid theme: ${theme}`);
            return;
        }

        this.currentTheme = theme;
        this.saveTheme();
        this.applyTheme();
    }

    // Get current theme
    getCurrentTheme() {
        return this.currentTheme;
    }

    // Get resolved theme (actual theme after resolving 'auto')
    getResolvedTheme() {
        return this.resolvedTheme || this.resolveTheme();
    }

    // Setup theme toggle button
    setupThemeToggle() {
        const toggleButton = document.getElementById('theme-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => this.toggle());
        }

        // Setup settings theme selector
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = this.currentTheme;
            themeSelect.addEventListener('change', (e) => {
                this.setTheme(e.target.value);
            });
        }
    }

    // Update toggle button icon
    updateToggleIcon(theme) {
        const toggleButton = document.getElementById('theme-toggle');
        if (!toggleButton) return;

        const icon = toggleButton.querySelector('i');
        if (!icon) return;

        // Remove existing classes
        icon.classList.remove('fa-moon', 'fa-sun', 'fa-adjust');

        // Add appropriate icon
        switch (theme) {
            case 'dark':
                icon.classList.add('fa-sun');
                toggleButton.setAttribute('aria-label', 'Switch to light theme');
                break;
            case 'light':
                icon.classList.add('fa-moon');
                toggleButton.setAttribute('aria-label', 'Switch to dark theme');
                break;
            default:
                icon.classList.add('fa-adjust');
                toggleButton.setAttribute('aria-label', 'Switch theme');
        }
    }

    // Update meta theme-color
    updateMetaThemeColor(theme) {
        let themeColor = '#ffffff'; // Default light theme color
        
        if (theme === 'dark') {
            themeColor = '#0f172a'; // Dark theme color
        }

        // Update existing meta tag or create new one
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.content = themeColor;
    }

    // Setup system theme change listener
    setupSystemThemeListener() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            mediaQuery.addEventListener('change', () => {
                if (this.currentTheme === 'auto') {
                    this.applyTheme();
                }
            });
        }
    }

    // Emit theme change event
    emitThemeChange(theme) {
        const event = new CustomEvent('themeChanged', {
            detail: { theme, previousTheme: this.resolvedTheme }
        });
        document.dispatchEvent(event);
    }

    // Get CSS custom property values for current theme
    getThemeColors() {
        const computedStyle = getComputedStyle(document.body);
        return {
            primary: computedStyle.getPropertyValue('--bg-primary').trim(),
            secondary: computedStyle.getPropertyValue('--bg-secondary').trim(),
            tertiary: computedStyle.getPropertyValue('--bg-tertiary').trim(),
            accent: computedStyle.getPropertyValue('--bg-accent').trim(),
            textPrimary: computedStyle.getPropertyValue('--text-primary').trim(),
            textSecondary: computedStyle.getPropertyValue('--text-secondary').trim(),
            textMuted: computedStyle.getPropertyValue('--text-muted').trim(),
            borderPrimary: computedStyle.getPropertyValue('--border-primary').trim(),
            borderSecondary: computedStyle.getPropertyValue('--border-secondary').trim(),
            accentPrimary: computedStyle.getPropertyValue('--accent-primary').trim(),
            accentHover: computedStyle.getPropertyValue('--accent-hover').trim(),
            accentLight: computedStyle.getPropertyValue('--accent-light').trim()
        };
    }

    // Check if current theme is dark
    isDarkTheme() {
        return this.getResolvedTheme() === 'dark';
    }

    // Check if current theme is light
    isLightTheme() {
        return this.getResolvedTheme() === 'light';
    }

    // Check if auto theme is enabled
    isAutoTheme() {
        return this.currentTheme === 'auto';
    }

    // Create theme-aware colors for dynamic elements
    getAdaptiveColor(lightColor, darkColor) {
        return this.isDarkTheme() ? darkColor : lightColor;
    }

    // Apply theme to specific element
    applyThemeToElement(element, themeClass = null) {
        if (!element) return;

        const theme = themeClass || `${this.getResolvedTheme()}-theme`;
        
        // Remove existing theme classes
        element.classList.remove('light-theme', 'dark-theme');
        
        // Apply new theme class
        element.classList.add(theme);
    }

    // Get theme transition duration
    getTransitionDuration() {
        return getComputedStyle(document.body)
            .getPropertyValue('--transition')
            .trim() || '0.3s ease';
    }

    // Reset to system theme
    resetToSystem() {
        this.setTheme('auto');
    }

    // Export theme settings
    exportThemeSettings() {
        return {
            currentTheme: this.currentTheme,
            resolvedTheme: this.getResolvedTheme(),
            systemPreference: this.getSystemPreference(),
            themeColors: this.getThemeColors(),
            exportDate: new Date().toISOString()
        };
    }

    // Import theme settings
    importThemeSettings(settings) {
        if (settings && settings.currentTheme && this.themes.includes(settings.currentTheme)) {
            this.setTheme(settings.currentTheme);
            return true;
        }
        return false;
    }

    // Add custom theme colors (for future extensibility)
    addCustomColors(colorMap) {
        const root = document.documentElement;
        
        Object.entries(colorMap).forEach(([property, value]) => {
            root.style.setProperty(`--custom-${property}`, value);
        });
    }

    // Remove custom theme colors
    removeCustomColors(properties) {
        const root = document.documentElement;
        
        properties.forEach(property => {
            root.style.removeProperty(`--custom-${property}`);
        });
    }

    // Animate theme transition
    animateThemeTransition(duration = 300) {
        document.body.style.transition = `background-color ${duration}ms ease, color ${duration}ms ease`;
        
        setTimeout(() => {
            document.body.style.transition = '';
        }, duration);
    }

    // Get theme-appropriate icon
    getThemeIcon(theme = null) {
        const targetTheme = theme || this.getResolvedTheme();
        
        switch (targetTheme) {
            case 'dark':
                return 'fa-moon';
            case 'light':
                return 'fa-sun';
            default:
                return 'fa-adjust';
        }
    }

    // Initialize theme preferences based on time (optional feature)
    initTimeBasedTheme() {
        if (this.currentTheme !== 'auto') return;

        const hour = new Date().getHours();
        const isNightTime = hour < 7 || hour > 19;
        
        if (isNightTime && !this.isDarkTheme()) {
            this.applyTheme('dark');
        } else if (!isNightTime && this.isDarkTheme()) {
            this.applyTheme('light');
        }
    }
}