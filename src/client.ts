import { MailRpError } from './errors.ts';
import { Requester, type ResponseMeta } from './http.ts';
import { CalendarResource } from './resources/calendars.ts';
import { DomainResource } from './resources/domains.ts';
import { NewsletterResource } from './resources/newsletters.ts';
import { ServerResource, SystemResource } from './resources/system.ts';
import { UserResource } from './resources/users.ts';

export const DEFAULT_BASE_URL = 'https://api.mail-rp.com';

export interface ClientOptions {
    /** URL of the API */
    baseUrl?: string;
    /** Milliseconds before a request is abandoned (30 000 by default) */
    timeout?: number;
    /** Automatic retries of a request refused with 429 (2 by default, 0 to disable) */
    maxRetries?: number;
    /** Longest `Retry-After` (seconds) worth waiting for; above it the `RateLimitError` is thrown at once (60) */
    maxRetryDelay?: number;
    /** `fetch` implementation (global `fetch` by default) */
    fetch?: typeof fetch;
    /** Called after every response (request id, rate limit state) */
    onResponse?: (meta: ResponseMeta) => void;
    /** Waits between two retries (replaced in tests) */
    sleep?: (milliseconds: number) => Promise<void>;
}

/**
 * Entry point of the SDK.
 *
 * ```ts
 * const mailRp = new MailRpClient('xls-mrp-...');
 * const user = await mailRp.users.get('aros@lspd.gov');
 * ```
 */
export class MailRpClient {
    readonly system: SystemResource;
    readonly server: ServerResource;
    readonly domains: DomainResource;
    readonly users: UserResource;
    readonly calendars: CalendarResource;
    readonly newsletters: NewsletterResource;

    private readonly requester: Requester;

    /**
     * @param apiKey key created in the panel (`xls-mrp-...`); without it, only the public routes
     *               (`system.health()`) can be called
     * @param options
     */
    constructor(apiKey?: string | null, options: ClientOptions = {}) {
        if (apiKey !== undefined && apiKey !== null && typeof apiKey !== 'string') {
            throw new MailRpError('The Mail RP API key must be a string');
        }
        const fetchImplementation = options.fetch ?? globalThis.fetch;
        if (typeof fetchImplementation !== 'function') {
            throw new MailRpError('fetch is not available: use Node.js 18 or later, or pass the fetch option');
        }
        const timeout = options.timeout ?? 30_000;
        const maxRetries = options.maxRetries ?? 2;
        const maxRetryDelay = options.maxRetryDelay ?? 60;
        if (!(timeout > 0) || !(maxRetries >= 0) || !(maxRetryDelay >= 0)) {
            throw new MailRpError('timeout must be positive, maxRetries and maxRetryDelay cannot be negative');
        }

        this.requester = new Requester({
            apiKey: apiKey?.trim() || undefined,
            baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
            timeout,
            maxRetries,
            maxRetryDelay,
            fetch: fetchImplementation,
            sleep: options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
            onResponse: options.onResponse,
        });

        this.system = new SystemResource(this.requester);
        this.server = new ServerResource(this.requester);
        this.domains = new DomainResource(this.requester);
        this.users = new UserResource(this.requester);
        this.calendars = new CalendarResource(this.requester);
        this.newsletters = new NewsletterResource(this.requester);
    }

    /**
     * Whether an API key is set on this client (a blank key counts as missing). Without a key, the requests are sent
     * without authentication and the API answers `401` (`AuthenticationError`) except on the public routes.
     */
    hasApiKey(): boolean {
        return this.requester.hasApiKey();
    }

    /**
     * Request id and rate limit state of the last response received by this client. With concurrent requests,
     * prefer the `onResponse` option.
     */
    get lastResponse(): ResponseMeta | null {
        return this.requester.lastResponse;
    }
}
