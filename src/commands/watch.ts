import { runWatcherScan } from '../watcher/daemon.js';

export async function handleWatch(options: { once?: boolean } = {}) {
  try {
    if (options.once) {
      await runWatcherScan({ once: true });
      return;
    }

    console.log('[JobCopilot Watcher] Daemon started in background. Polling every 6h...');
    await runWatcherScan({ once: true });

    // Polling loop interval (every 6 hours)
    setInterval(async () => {
      await runWatcherScan({ once: true });
    }, 6 * 60 * 60 * 1000);
  } catch (err: any) {
    console.error(`[Watcher Error]: ${err.message}`);
  }
}
