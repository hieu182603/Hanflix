import type { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        userId: Types.ObjectId;
        role: 'user' | 'admin';
      };
    }
  }
}

export {};
