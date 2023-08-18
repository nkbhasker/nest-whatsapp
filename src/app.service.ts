import { Injectable } from '@nestjs/common';
import { Client } from 'whatsapp-web.js';
import { ClientService } from './client-service';
import { MongoStore } from './mongo-store';

@Injectable()
export class AppService {
  private clients = new Map<string, Client>();
  constructor(private mongoStore: MongoStore) {}

  createClient({ mobile }: { mobile: string }) {
    const client = new ClientService(mobile, this.mongoStore);
    this.clients.set(mobile, client.client);

    return { success: true };
  }
}
