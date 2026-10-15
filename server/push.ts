import webpush from 'web-push';
import { loadConfig, saveConfig, type PushSub } from './config.js';

export function initPush(): string | null {
  const cfg = loadConfig();
  if (!cfg.vapid) {
    const keys = webpush.generateVAPIDKeys();
    cfg.vapid = { ...keys, subject: 'mailto:pocket-claude@localhost' };
    saveConfig();
  }
  webpush.setVapidDetails(cfg.vapid.subject, cfg.vapid.publicKey, cfg.vapid.privateKey);
  return cfg.vapid.publicKey;
}

export function addSubscription(sub: PushSub): void {
  const cfg = loadConfig();
  cfg.pushSubs = cfg.pushSubs.filter((s) => s.endpoint !== sub.endpoint);
  cfg.pushSubs.push({ endpoint: sub.endpoint, keys: sub.keys });
  saveConfig();
}

export function removeSubscription(endpoint: string): void {
  const cfg = loadConfig();
  cfg.pushSubs = cfg.pushSubs.filter((s) => s.endpoint !== endpoint);
  saveConfig();
}

export async function sendPush(payload: { title: string; body: string; url: string; tag: string }): Promise<number> {
  const cfg = loadConfig();
  let sent = 0;
  await Promise.all(
    cfg.pushSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
        sent++;
      } catch (e: any) {
        // 404/410: the browser dropped this subscription.
        if (e?.statusCode === 404 || e?.statusCode === 410) removeSubscription(sub.endpoint);
        else console.warn('push failed', e?.statusCode ?? e);
      }
    }),
  );
  return sent;
}
