/**
 * Preferencias de visualización — tema y tamaño de texto
 * Persistidas en localStorage (oea_preferences)
 */
const Preferences = {
  KEY: 'oea_preferences',
  defaults: { theme: 'light', fontSize: 'md' },

  get() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return { ...this.defaults, ...(raw ? JSON.parse(raw) : {}) };
    } catch {
      return { ...this.defaults };
    }
  },

  save(prefs) {
    localStorage.setItem(this.KEY, JSON.stringify(prefs));
  },

  apply(prefs = this.get()) {
    const html = document.documentElement;
    html.setAttribute('data-theme', prefs.theme || 'light');
    html.setAttribute('data-font-size', prefs.fontSize || 'md');
    this.updateControls(prefs);
  },

  init() {
    this.apply();
    this.bindControls();
  },

  bindControls() {
    const themeHandler = () => {
      const prefs = this.get();
      prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark';
      this.save(prefs);
      this.apply(prefs);
    };

    document.getElementById('themeToggle')?.addEventListener('click', themeHandler);
    document.getElementById('loginThemeToggle')?.addEventListener('click', themeHandler);

    document.querySelectorAll('[data-font-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        const prefs = this.get();
        prefs.fontSize = btn.dataset.fontSize;
        this.save(prefs);
        this.apply(prefs);
      });
    });
  },

  updateControls(prefs) {
    const isDark = prefs.theme === 'dark';
    const sunIcon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>';
    const moonIcon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>';

    ['themeToggle', 'loginThemeToggle'].forEach(id => {
      const themeBtn = document.getElementById(id);
      if (themeBtn) {
        themeBtn.setAttribute('aria-label', isDark ? 'Modo claro' : 'Modo oscuro');
        themeBtn.title = isDark ? 'Modo claro (sol)' : 'Modo oscuro (luna)';
        themeBtn.innerHTML = isDark ? sunIcon : moonIcon;
      }
    });

    document.querySelectorAll('[data-font-size]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.fontSize === prefs.fontSize);
    });
  }
};
