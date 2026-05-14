const toggles = document.querySelectorAll('.menu-toggle');

toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
        const group = toggle.closest('.menu-group');
        if (!group) return;

        const isOpening = !group.classList.contains('open');

        // Comportamento accordion: ao abrir um grupo, fecha os demais.
        toggles.forEach((otherToggle) => {
            const otherGroup = otherToggle.closest('.menu-group');
            if (otherGroup && otherGroup !== group) {
                otherGroup.classList.remove('open');
            }
        });

        group.classList.toggle('open', isOpening);
    });
});

// Abre os primeiros grupos por padrão
['Secretaria', 'Tesouraria'].forEach((label) => {
    toggles.forEach((toggle) => {
        if (toggle.textContent.includes(label)) {
            const group = toggle.closest('.menu-group');
            if (group) group.classList.add('open');
        }
    });
});
