/**
 * PWA Initialization Module
 * Handles service worker registration, install prompts, and PWA features
 */

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.swRegistration = null;
        this.init();
    }

    init() {
        // Check if app is already installed
        this.checkIfInstalled();
        
        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => this.handleBeforeInstallPrompt(e));
        
        // Listen for successful installation
        window.addEventListener('appinstalled', () => this.handleAppInstalled());

        // Register service worker
        this.registerServiceWorker();

        // Handle online/offline
        this.setupConnectivityHandling();

        // Request notification permission if needed
        this.requestNotificationPermission();
    }

    /**
     * Register service worker
     */
    registerServiceWorker() {
        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

        // In dev, disable SW to avoid stale cache and make F5 reflect changes immediately.
        if (isLocalhost && 'serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations()
                .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
                .then(() => console.log('[PWA] Service Worker desativado no localhost (modo desenvolvimento)'))
                .catch((error) => console.warn('[PWA] Falha ao desativar SW no localhost:', error));
            return;
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    this.swRegistration = registration;
                    console.log('[PWA] Service Worker registrado:', registration);
                    
                    // Check for updates periodically (intervalo mais longo para evitar ruído visual).
                    setInterval(() => {
                        registration.update();
                    }, 1000 * 60 * 10); // Every 10 minutes
                })
                .catch((error) => {
                    console.error('[PWA] Erro ao registrar Service Worker:', error);
                });
        }
    }

    /**
     * Handle before install prompt
     */
    handleBeforeInstallPrompt(e) {
        e.preventDefault();
        this.deferredPrompt = e;
        
        // Show install button/prompt to user
        this.showInstallPrompt();
    }

    /**
     * Handle successful app installation
     */
    handleAppInstalled() {
        this.isInstalled = true;
        console.log('[PWA] App instalado com sucesso');
        
        // Clear deferred prompt
        this.deferredPrompt = null;
        
        // Hide install button if visible
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }

        // Show success message
        this.showNotification('App instalado!', {
            body: 'LDFP Igreja está pronto para usar offline',
            icon: '/icons/icon-192x192.png'
        });
    }

    /**
     * Show install prompt to user
     */
    showInstallPrompt() {
        // You can either show a banner or button
        // Example: Show banner on pages that don't have one
        if (document.getElementById('pwa-install-banner')) {
            document.getElementById('pwa-install-banner').style.display = 'flex';
        }
    }

    /**
     * Trigger install prompt
     */
    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('[PWA] Prompt não disponível');
            return;
        }

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        console.log('[PWA] Resultado:', outcome);
        this.deferredPrompt = null;
    }

    /**
     * Check if app is installed
     */
    checkIfInstalled() {
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            console.log('[PWA] App está em modo standalone');
            document.documentElement.setAttribute('data-pwa-installed', 'true');
        }
    }

    /**
     * Setup online/offline handling
     */
    setupConnectivityHandling() {
        window.addEventListener('offline', () => {
            console.log('[PWA] App ficou offline');
            this.showNotification('Modo Offline', {
                body: 'Você está sem conexão. Os dados serão sincronizados quando voltar online.',
                icon: '/icons/icon-192x192.png'
            });
        });

        window.addEventListener('online', () => {
            console.log('[PWA] App voltou online');
            this.syncPendingData();
        });
    }

    /**
     * Request notification permission
     */
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
                .then((permission) => {
                    if (permission === 'granted') {
                        console.log('[PWA] Permissão de notificação concedida');
                    }
                });
        }
    }

    /**
     * Show notification
     */
    showNotification(title, options = {}) {
        if ('Notification' in window && Notification.permission === 'granted') {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title,
                    options
                });
            } else {
                new Notification(title, options);
            }
        }
    }

    /**
     * Sync pending data when back online
     */
    async syncPendingData() {
        try {
            if ('serviceWorker' in navigator && this.swRegistration) {
                await navigator.serviceWorker.ready;
                
                if ('SyncManager' in window) {
                    // Trigger background sync
                    try {
                        await this.swRegistration.sync.register('sync-oracoes');
                        await this.swRegistration.sync.register('sync-visitantes');
                    } catch (error) {
                        console.warn('[PWA] Background sync não disponível:', error);
                    }
                }
            }
        } catch (error) {
            console.error('[PWA] Erro ao sincronizar:', error);
        }
    }

    /**
     * Get app status
     */
    getStatus() {
        return {
            installed: this.isInstalled,
            online: navigator.onLine,
            serviceWorkerActive: 'serviceWorker' in navigator,
            notificationsEnabled: 'Notification' in window && Notification.permission === 'granted'
        };
    }
}

// Initialize PWA when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pwa = new PWAManager();
    });
} else {
    window.pwa = new PWAManager();
}

// Make globally available
window.PWAManager = PWAManager;
