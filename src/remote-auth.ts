import { Client, ClientOptions, Events } from 'whatsapp-web.js';

import * as archiver from 'archiver';
import { copy, createWriteStream, mkdirSync, promises } from 'fs-extra';

import * as AdmZip from 'adm-zip';
import { join, resolve } from 'path';
import { MongoStore } from './mongo-store';

/**
 * Remote-based authentication
 * @param {object} options - options
 * @param {object} options.store - Remote database store instance
 * @param {string} options.clientId - Client id to distinguish instances if you are using multiple, otherwise keep null if you are using only one instance
 * @param {string} options.dataPath - Change the default path for saving session files, default is: "./.wwebjs_auth/"
 * @param {number} options.backupSyncIntervalMs - Sets the time interval for periodic session backups. Accepts values starting from 60000ms {1 minute}
 */
export class RemoteAuth {
  store: MongoStore;
  clientId: string;
  backupSyncIntervalMs: number;
  dataPath: string;
  tempDir: string;
  backupSync: NodeJS.Timer;
  userDataDir: string;
  sessionName: string;
  client: Client & { options: ClientOptions };
  requiredDirs: string[];

  constructor({
    clientId,
    store,
    backupSyncIntervalMs,
  }: {
    clientId: string;
    store: MongoStore;
    backupSyncIntervalMs: number;
  }) {
    const idRegex = /^[-_\w]+$/i;
    if (clientId && !idRegex.test(clientId)) {
      throw new Error(
        'Invalid clientId. Only alphanumeric characters, underscores and hyphens are allowed.',
      );
    }
    if (!backupSyncIntervalMs || backupSyncIntervalMs < 60000) {
      throw new Error(
        'Invalid backupSyncIntervalMs. Accepts values starting from 60000ms {1 minute}.',
      );
    }
    if (!store) throw new Error('Remote database store is required.');

    this.store = store;
    this.clientId = clientId;
    this.backupSyncIntervalMs = backupSyncIntervalMs;
    this.dataPath = resolve('./.wwebjs_auth/');
    this.tempDir = `${this.dataPath}/wwebjs_temp_session-${clientId}`;
    this.requiredDirs = ['Default', 'IndexedDB', 'Local Storage'];
  }

  setup(client: Client & { options: ClientOptions }) {
    this.client = client;
  }

  async afterBrowserInitialized() {}
  async getAuthEventPayload() {}
  async onAuthenticationNeeded() {
    return {
      failed: false,
      restart: false,
      failureEventPayload: undefined,
    };
  }

  async beforeBrowserInitialized() {
    const puppeteerOpts = this.client.options.puppeteer;
    const sessionDirName = this.clientId
      ? `RemoteAuth-${this.clientId}`
      : 'RemoteAuth';
    const dirPath = join(this.dataPath, sessionDirName);

    if (puppeteerOpts.userDataDir && puppeteerOpts.userDataDir !== dirPath) {
      throw new Error(
        'RemoteAuth is not compatible with a user-supplied userDataDir.',
      );
    }

    this.userDataDir = dirPath;
    this.sessionName = sessionDirName;

    await this.extractRemoteSession();

    this.client.options.puppeteer = {
      ...puppeteerOpts,
      userDataDir: dirPath,
    };
  }

  async logout() {
    await this.disconnect();
  }

  async destroy() {
    clearInterval(this.backupSync);
  }

  async disconnect() {
    await this.deleteRemoteSession();

    const pathExists = await this.isValidPath(this.userDataDir);
    if (pathExists) {
      await promises
        .rm(this.userDataDir, {
          recursive: true,
          force: true,
        })
        .catch(() => {});
    }
    clearInterval(this.backupSync);
  }

  async afterAuthReady() {
    const sessionExists = await this.store.sessionExists({
      session: this.sessionName,
    });
    if (!sessionExists) {
      await this.delay(
        60000,
      ); /* Initial delay sync required for session to be stable enough to recover */
      await this.storeRemoteSession({ emit: true });
    }

    this.backupSync = setInterval(async () => {
      await this.storeRemoteSession({ emit: true });
    }, this.backupSyncIntervalMs);
  }

  async storeRemoteSession(options) {
    /* Compress & Store Session */
    const pathExists = await this.isValidPath(this.userDataDir);
    if (pathExists) {
      await this.compressSession();
      await this.store.save({ session: this.sessionName });
      await promises.unlink(`${this.sessionName}.zip`);
      await promises
        .rm(`${this.tempDir}`, {
          recursive: true,
          force: true,
        })
        .catch(() => {});
      if (options && options.emit)
        this.client.emit(Events.REMOTE_SESSION_SAVED);
    }
  }

  async extractRemoteSession() {
    const pathExists = await this.isValidPath(this.userDataDir);
    const compressedSessionPath = `${this.sessionName}.zip`;
    const sessionExists = await this.store.sessionExists({
      session: this.sessionName,
    });
    if (pathExists) {
      await promises.rm(this.userDataDir, {
        recursive: true,
        force: true,
      });
    }
    if (sessionExists) {
      await this.store.extract({
        session: this.sessionName,
        path: compressedSessionPath,
      });
      await this.unCompressSession(compressedSessionPath);
    } else {
      mkdirSync(this.userDataDir, { recursive: true });
    }
  }

  async deleteRemoteSession() {
    const sessionExists = await this.store.sessionExists({
      session: this.sessionName,
    });
    if (sessionExists) await this.store.delete({ session: this.sessionName });
  }

  async compressSession() {
    const archive = archiver('zip');
    const stream = createWriteStream(`${this.sessionName}.zip`);

    await copy(this.userDataDir, this.tempDir).catch(() => {});
    await this.deleteMetadata();
    return new Promise<void>((resolve, reject) => {
      archive
        .directory(this.tempDir, false)
        .on('error', (err) => reject(err))
        .pipe(stream);

      stream.on('close', () => resolve());
      archive.finalize();
    });
  }

  async unCompressSession(compressedSessionPath: string) {
    await new Promise<void>((resolve, reject) => {
      const zip = new AdmZip(compressedSessionPath);
      zip.extractAllToAsync(this.userDataDir, true, false, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    await promises.unlink(compressedSessionPath);
  }

  async deleteMetadata() {
    const sessionDirs = [this.tempDir, join(this.tempDir, 'Default')];
    for (const dir of sessionDirs) {
      const sessionFiles = await promises.readdir(dir);
      for (const element of sessionFiles) {
        if (!this.requiredDirs.includes(element)) {
          const dirElement = join(dir, element);
          const stats = await promises.lstat(dirElement);
          if (stats.isDirectory()) {
            await promises
              .rm(dirElement, {
                recursive: true,
                force: true,
              })
              .catch(() => {});
          } else {
            await promises.unlink(dirElement).catch(() => {});
          }
        }
      }
    }
  }

  async isValidPath(path: string) {
    try {
      await promises.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
