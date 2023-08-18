import { generate, setErrorLevel } from 'qrcode-terminal';
import { Client } from 'whatsapp-web.js';
import { MongoStore } from './mongo-store';
import { RemoteAuth } from './remote-auth';

setErrorLevel('L');

export class ClientService {
  public client: Client;
  constructor(clientId: string, store: MongoStore) {
    this.client = new Client({
      authStrategy: new RemoteAuth({
        store,
        clientId,
        backupSyncIntervalMs: 300000,
      }),
    });

    this.client.on('disconnected', (reason) => console.error(reason));
    this.client.on('auth_failure', (message) => console.error(message));

    this.client.on('qr', async (qr: string) => {
      generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      console.info('client is ready!');
    });

    this.client.on('remote_session_saved', () => {
      console.info('session saved');
    });

    this.client.initialize();
  }
}
