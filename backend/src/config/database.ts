import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase(options: { strictServerApi?: boolean } = {}): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    maxPoolSize: 10,
    minPoolSize: env.NODE_ENV === 'test' ? 0 : 1,
    serverSelectionTimeoutMS: 7000,
    serverApi: {
      version: mongoose.mongo.ServerApiVersion.v1,
      strict: options.strictServerApi ?? true,
      deprecationErrors: true,
    },
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function databaseState(): string {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] ?? 'unknown';
}
