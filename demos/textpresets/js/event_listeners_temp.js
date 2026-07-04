// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
    // Apply buttons
    if (elements.applyEntranceBtn) {
        elements.applyEntranceBtn.addEventListener('click', () => handleApply('entrance'));
    }

    if (elements.applyExitBtn) {
        elements.applyExitBtn.addEventListener('click', () => handleApply('exit'));
    }

    if (elements.applyBothBtn) {
        elements.applyBothBtn.addEventListener('click', () => handleApply('both'));
    }

    // Reset button
    if (elements.resetBtn) {
        elements.resetBtn.addEventListener('click', resetAnimations);
    }

    // Refresh button
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', () => {
            loadAEPresets();
            updateStatus('✓ Presets actualizados');
        });
    }

    // Import preset button
    const importPresetBtn = document.getElementById('importPresetBtn');
    if (importPresetBtn) {
        importPresetBtn.addEventListener('click', () => {
            elements.presetImportInput.click();
        });
    }

    // Preset import input
    if (elements.presetImportInput) {
        elements.presetImportInput.addEventListener('change', handlePresetImport);
    }

    // Favorites toggle button
    if (elements.favoritesToggleBtn) {
        elements.favoritesToggleBtn.addEventListener('click', toggleFavoritesFilter);
    }

    // Category headers (collapsible)
    document.querySelectorAll('.category-header').forEach(header => {
        header.addEventListener('click', function () {
            const category = this.dataset.category;
            const content = document.getElementById(category);
            const icon = this.querySelector('.category-icon');

            if (content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                icon.textContent = '▼';
            } else {
                content.classList.add('collapsed');
                icon.textContent = '▶';
            }
        });
    });
}
