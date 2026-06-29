declare module 'redlock' {
  import { Redis } from 'ioredis';

  export interface Options {
    driftFactor?: number;
    retryCount?: number;
    retryDelay?: number;
    retryJitter?: number;
    automaticExtensionThreshold?: number;
  }

  export interface Lock {
    redlock: Redlock;
    resource: string;
    value: string | null;
    expiration: number;
    attempts: number;
    release(): Promise<void>;
    extend(ttl: number): Promise<Lock>;
  }

  export default class Redlock {
    constructor(clients: Redis[], options?: Options);
    acquire(resources: string[], ttl: number): Promise<Lock>;
    release(lock: Lock): Promise<void>;
    quit(): Promise<void>;
  }
}
