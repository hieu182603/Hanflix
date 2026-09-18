import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase(options: { strictServerApi?: boolean } = {}): Promise<void> {
  mongoose.set('strictQuery', true);

  // SECURITY (H-5): Always enable TLS for MongoDB connections.
  // MongoDB Atlas SRV records REQUIRE TLS — connecting without it fails with
  // "ReplicaSetNoPrimary" / "commonWireVersion: 0" because the driver cannot
  // negotiate the handshake. For self-hosted local MongoDB without TLS, set
  // MONGODB_TLS=false explicitly.
  // Default: enabled in production, explicitly opt-out in development.
  const tlsEnabled = env.MONGODB_TLS ?? env.NODE_ENV !== 'test';
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    maxPoolSize: 10,
    minPoolSize: env.NODE_ENV === 'test' ? 0 : 1,
    serverSelectionTimeoutMS: 7000,
    tls: tlsEnabled,
    // Reject servers with invalid certificates by default; only relax for local dev.
    tlsAllowInvalidCertificates: env.MONGODB_TLS_ALLOW_INVALID ?? false,
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
