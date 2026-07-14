(function () {
    'use strict';

    var button = document.getElementById('themeToggle');
    if (!button) return;

    function currentTheme() {
        return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    }

    function updateButton() {
        var isLight = currentTheme() === 'light';
        button.querySelector('span').textContent = isLight ? '☾' : '☀';
        button.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
    }

    button.addEventListener('click', function () {
        var nextTheme = currentTheme() === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = nextTheme;

        try {
            localStorage.setItem('animateo-theme', nextTheme);
        } catch (e) {}

        updateButton();
    });

    updateButton();
})();
