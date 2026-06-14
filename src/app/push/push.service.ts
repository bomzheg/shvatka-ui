import {Injectable, NgZone, signal} from '@angular/core';
import {Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {HttpAdapter} from '../http/http.adapter';
import {SnackbarService} from '../snackbar/snackbar.service';
import {environment} from '../../environments/environment';

export interface PushConfig {
  enabled: boolean;
  public_key: string | null;
}

export interface BackendPushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * UI-facing state of push notifications:
 *  - unsupported: browser lacks the required APIs
 *  - disabled:    backend reports push is turned off (or has no public key)
 *  - default:     supported, permission not yet requested
 *  - denied:      user blocked notifications in the browser
 *  - granted:     permission granted and a subscription is registered
 */
export type PushState = 'unsupported' | 'disabled' | 'default' | 'denied' | 'granted';

const SW_URL = '/push-sw.js';

@Injectable({providedIn: 'root'})
export class PushService {
  readonly state = signal<PushState>('default');
  readonly busy = signal(false);

  private config: PushConfig | undefined;
  private registration: ServiceWorkerRegistration | undefined;
  private messageHandlerBound = false;

  constructor(
    private http: HttpAdapter,
    private httpClient: HttpClient,
    private router: Router,
    private snackbar: SnackbarService,
    private zone: NgZone,
  ) {
  }

  isSupported(): boolean {
    return typeof navigator !== 'undefined'
      && 'serviceWorker' in navigator
      && typeof window !== 'undefined'
      && 'PushManager' in window
      && 'Notification' in window;
  }

  /**
   * Called once on app bootstrap. Registers the service worker, listens for
   * foreground messages and, when permission was already granted, refreshes the
   * saved subscription so the backend always knows the current endpoint.
   */
  async init(): Promise<void> {
    if (!this.isSupported()) {
      this.state.set('unsupported');
      return;
    }

    this.bindMessageHandler();

    try {
      this.registration = await this.registerServiceWorker();
    } catch (e) {
      console.error('push: service worker registration failed', e);
      return;
    }

    if (Notification.permission === 'granted') {
      await this.refresh();
    } else {
      await this.syncState();
    }
  }

  /** User action: enable notifications from a visible button. */
  async enable(): Promise<void> {
    if (!this.isSupported()) {
      this.state.set('unsupported');
      this.snackbar.error('Этот браузер не поддерживает уведомления');
      return;
    }
    if (this.busy()) {
      return;
    }

    this.busy.set(true);
    try {
      const config = await this.loadConfig();
      if (!config.enabled || !config.public_key) {
        this.state.set('disabled');
        this.snackbar.info('Push-уведомления сейчас отключены на сервере');
        return;
      }

      this.registration = await this.registerServiceWorker();

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.state.set(permission === 'denied' ? 'denied' : 'default');
        this.snackbar.error(
          permission === 'denied'
            ? 'Уведомления заблокированы в настройках браузера'
            : 'Разрешение на уведомления не получено',
        );
        return;
      }

      const subscription = await this.subscribe(config.public_key);
      await this.sendSubscription(subscription);
      this.state.set('granted');
      this.snackbar.success('Уведомления включены');
    } catch (e) {
      console.error('push: enable failed', e);
      this.snackbar.error('Не удалось включить уведомления');
    } finally {
      this.busy.set(false);
    }
  }

  /** User action: disable notifications from a visible button. */
  async disable(): Promise<void> {
    if (!this.isSupported() || this.busy()) {
      return;
    }

    this.busy.set(true);
    try {
      await this.removeSubscription();
      await this.syncState();
      this.snackbar.info('Уведомления отключены');
    } catch (e) {
      console.error('push: disable failed', e);
      this.snackbar.error('Не удалось отключить уведомления');
    } finally {
      this.busy.set(false);
    }
  }

  /** Called on logout: drop the subscription so the backend stops sending. */
  async onLogout(): Promise<void> {
    if (!this.isSupported()) {
      return;
    }
    try {
      await this.removeSubscription();
    } catch (e) {
      console.error('push: logout cleanup failed', e);
    }
  }

  /**
   * Re-registers the current browser subscription with the backend. Safe to call
   * repeatedly: pushManager.subscribe returns the existing subscription for the
   * same endpoint, so refresh/re-login never creates duplicates.
   */
  async refresh(): Promise<void> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return;
    }

    try {
      const config = await this.loadConfig();
      if (!config.enabled) {
        this.state.set('disabled');
        return;
      }

      const registration = await this.ensureRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await this.sendSubscription(subscription);
        this.state.set('granted');
      } else {
        this.state.set('default');
      }
    } catch (e) {
      console.error('push: refresh failed', e);
    }
  }

  private async subscribe(publicKey: string): Promise<PushSubscription> {
    const registration = await this.ensureRegistration();
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      return existing;
    }
    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  private async removeSubscription(): Promise<void> {
    const registration = await this.ensureRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return;
    }

    try {
      await firstValueFrom(
        this.httpClient.delete(`${environment.apiUrl}/push/subscriptions`, {
          withCredentials: true,
          body: subscription.toJSON(),
        }),
      );
    } catch (e) {
      // Even if the backend call fails we still unsubscribe locally.
      console.error('push: DELETE /push/subscriptions failed', e);
    }
    await subscription.unsubscribe();
  }

  private async sendSubscription(subscription: PushSubscription): Promise<void> {
    await firstValueFrom(this.http.put('/push/subscriptions', subscription.toJSON()));
  }

  private async loadConfig(): Promise<PushConfig> {
    this.config = await firstValueFrom(this.http.get<PushConfig>('/push/config'));
    return this.config;
  }

  private async ensureRegistration(): Promise<ServiceWorkerRegistration> {
    if (!this.registration) {
      this.registration = await this.registerServiceWorker();
    }
    return this.registration;
  }

  private registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    return navigator.serviceWorker.register(SW_URL);
  }

  /**
   * Derives the UI state from the real world: 'granted' only when an active
   * subscription exists, so disabling/unsubscribing correctly falls back to the
   * "enable" state even though the browser permission stays granted.
   */
  private async syncState(): Promise<void> {
    if (!this.isSupported()) {
      this.state.set('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      this.state.set('denied');
      return;
    }
    try {
      const registration = await this.ensureRegistration();
      const subscription = await registration.pushManager.getSubscription();
      this.state.set(subscription ? 'granted' : 'default');
    } catch (e) {
      console.error('push: state sync failed', e);
      this.state.set('default');
    }
  }

  private bindMessageHandler(): void {
    if (this.messageHandlerBound) {
      return;
    }
    this.messageHandlerBound = true;

    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      const data = event.data || {};
      this.zone.run(() => {
        if (data.type === 'push' && data.payload) {
          this.showForegroundToast(data.payload as BackendPushPayload);
        } else if (data.type === 'notificationclick' && data.url) {
          this.router.navigateByUrl(data.url);
        }
      });
    });
  }

  private showForegroundToast(payload: BackendPushPayload): void {
    const message = payload.body ? `${payload.title}: ${payload.body}` : payload.title;
    const url = payload.url || (payload.data?.['url'] as string | undefined);
    const ref = this.snackbar.info(message, url ? 'Открыть' : 'OK', 6000);
    if (url) {
      ref.onAction().subscribe(() => this.router.navigateByUrl(url));
    }
  }
}

/** Converts a base64url VAPID public key into the Uint8Array the Push API needs. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
