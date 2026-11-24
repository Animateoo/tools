// ── Animateo — Trabajo Page Interactive Scripts ──

(function () {
    'use strict';

    // 1. Portfolio Category Filtering
    const filterBtns = document.querySelectorAll('.tr-filter-btn');
    const projectCards = document.querySelectorAll('.tr-project-card');

    if (filterBtns.length > 0 && projectCards.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const filter = btn.getAttribute('data-filter');

                projectCards.forEach(card => {
                    const category = card.getAttribute('data-category');
                    if (filter === 'all' || category.includes(filter)) {
                        card.style.display = 'flex';
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        }, 20);
                    } else {
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(10px)';
                        setTimeout(() => {
                            card.style.display = 'none';
                        }, 200);
                    }
                });
            });
        });
    }

    // 2. Interactive Price Estimator
    const estTypeBtns = document.querySelectorAll('.tr-est-type-btn');
    const planCards = document.querySelectorAll('.tr-plan-card');
    const durationRange = document.getElementById('durationRange');
    const durationDisplay = document.getElementById('durationDisplay');
    const estPriceDisplay = document.getElementById('estPriceDisplay');
    const estDetailsDisplay = document.getElementById('estDetailsDisplay');
    const estCtaBtn = document.getElementById('estCtaBtn');

    // Base pricing configuration (USD)
    const pricingConfig = {
        vertical: {
            basic: { base: 35, perMin: 8, label: 'Básica (Vertical)', features: 'Corte dinámico, ritmo ágil, subtítulos estilizados y zooms' },
            intermediate: { base: 65, perMin: 14, label: 'Intermedia (Vertical)', features: 'Animación 2D, motion graphics, diseño sonoro y efectos visuales' },
            complex: { base: 110, perMin: 22, label: 'Compleja (Vertical)', features: 'Animación de personajes, branding completo y recursos avanzados' }
        },
        horizontal: {
            basic: { base: 60, perMin: 10, label: 'Básica (Horizontal)', features: 'Edición limpia, narrativa estructurada, ritmo y corrección de color' },
            intermediate: { base: 120, perMin: 18, label: 'Intermedia (Horizontal)', features: 'Motion graphics 2D, infografías animadas y diseño sonoro envolvente' },
            complex: { base: 190, perMin: 28, label: 'Compleja (Horizontal)', features: 'Producción publicitaria completa, motion design avanzado y branding' }
        }
    };

    let currentFormat = 'vertical';
    let currentPlan = 'intermediate';

    function calculateEstimate() {
        if (!durationRange || !estPriceDisplay) return;

        const duration = parseInt(durationRange.value, 10);
        if (durationDisplay) {
            durationDisplay.textContent = currentFormat === 'vertical' ? `${duration} min aprox.` : `${duration} minutos`;
        }

        const tier = pricingConfig[currentFormat][currentPlan];
        const totalPrice = tier.base + (duration * tier.perMin);

        estPriceDisplay.innerHTML = `<span>$</span>${totalPrice} <small style="font-size: 1rem; color: #9ca3af; font-family: var(--tr-font-mono);">USD</small>`;
        
        if (estDetailsDisplay) {
            estDetailsDisplay.innerHTML = `
                <strong>Formato:</strong> ${currentFormat === 'vertical' ? 'Vertical (Reels / TikTok / Shorts)' : 'Horizontal (YouTube / Pautas / Corporativo)'}<br>
                <strong>Plan:</strong> ${tier.label}<br>
                <strong>Incluye:</strong> ${tier.features}<br>
                <strong>Tiempo estimado:</strong> 2 a 4 días hábiles con revisiones incluidas.
            `;
        }

        if (estCtaBtn) {
            const message = encodeURIComponent(`Hola Mateo! Estuve en tu web y coticé un proyecto: Formato ${currentFormat === 'vertical' ? 'Vertical' : 'Horizontal'}, Plan ${tier.label}, Duración aprox ${duration} min (~$${totalPrice} USD). ¿Tienes disponibilidad para conversar?`);
            estCtaBtn.href = `https://wa.me/573196916587?text=${message}`;
        }
    }

    if (estTypeBtns.length > 0) {
        estTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                estTypeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFormat = btn.getAttribute('data-format');
                
                // Adjust slider limits for vertical vs horizontal
                if (currentFormat === 'vertical') {
                    durationRange.min = '1';
                    durationRange.max = '5';
                    if (parseInt(durationRange.value, 10) > 5) durationRange.value = '2';
                } else {
                    durationRange.min = '3';
                    durationRange.max = '20';
                    if (parseInt(durationRange.value, 10) < 3) durationRange.value = '8';
                }
                
                calculateEstimate();
            });
        });
    }

    if (planCards.length > 0) {
        planCards.forEach(card => {
            card.addEventListener('click', () => {
                planCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                currentPlan = card.getAttribute('data-plan');
                calculateEstimate();
            });
        });
    }

    if (durationRange) {
        durationRange.addEventListener('input', calculateEstimate);
    }

    // Run initial calculation
    calculateEstimate();

    // 3. Smooth scrolling for internal anchors
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#' || targetId === '') return;
            const targetEl = document.querySelector(targetId);
            if (targetEl) {
                e.preventDefault();
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

})();
