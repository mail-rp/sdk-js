import type { ApiKeyInfo, Health, Server } from '../types.ts';
import { Resource } from './resource.ts';

export class SystemResource extends Resource {
    /** State of the API (`GET /health`, no permission needed). */
    health(): Promise<Health> {
        return this.requester.json('GET', '/health');
    }

    /**
     * Checks the key and returns its information (`GET /`).
     *
     * @param withPermissions also list the permissions granted to the key
     */
    checkKey(withPermissions = false): Promise<ApiKeyInfo> {
        // The parameter is read from its mere presence: it is not sent at all when not requested
        return this.requester.json('GET', '/', { query: withPermissions ? { permissions: true } : {} });
    }
}

export class ServerResource extends Resource {
    /** Information and counters of the server the key belongs to (`GET /server`). */
    get(): Promise<Server> {
        return this.requester.json('GET', '/server');
    }
}
