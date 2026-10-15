import { ConnectionError, createApiError, RateLimitError, UnexpectedResponseError } from './errors.ts';
import { VERSION } from './version.ts';

/** Metadata of a response (success or error). */
export interface ResponseMeta {
    status: number;
    /** Identifier of the request, as shown in the history of the key in the panel */
    requestId: string | null;
    /** Requests allowed per minute by the most restrictive limiter (key or server) */
    rateLimitLimit: number | null;
    /** Requests left in the current window of the most restrictive limiter */
    rateLimitRemaining: number | null;
}

export interface RequesterConfig {
    apiKey: string;
    baseUrl: string;
    timeout: number;
    maxRetries: number;
    maxRetryDelay: number;
    fetch: typeof fetch;
    sleep: (milliseconds: number) => Promise<void>;
    onResponse?: ((meta: ResponseMeta) => void) | undefined;
}

/**
 * Builds, sends and decodes the API requests: authentication, JSON, retries on 429, error mapping.
 *
 * @internal
 */
export class Requester {
    lastResponse: ResponseMeta | null = null;
    private readonly config: RequesterConfig;

    constructor(config: RequesterConfig) {
        this.config = config;
    }

    /** Request answered with a JSON body. */
    async json<T>(method: string, path: string, options: { query?: object; body?: unknown } = {}): Promise<T> {
        const text = await this.send(method, path, options.query, options.body);
        if (text.trim() === '') {
            throw new UnexpectedResponseError(`The Mail RP API returned an empty body for ${method} ${path}`);
        }

        try {
            return JSON.parse(text) as T;
        } catch (error) {
            throw new UnexpectedResponseError('The Mail RP API returned an invalid JSON body', { cause: error });
        }
    }

    /** Request answered by `204 No Content`. */
    async empty(method: string, path: string, query?: object): Promise<void> {
        await this.send(method, path, query);
    }

    private async send(method: string, path: string, query?: object, body?: unknown): Promise<string> {
        const url = this.config.baseUrl.replace(/\/+$/, '') + path + buildQuery(query);
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.config.apiKey}`,
            Accept: 'application/json',
            'User-Agent': `mail-rp-node/${VERSION}`,
        };
        let payload: string | undefined;
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            payload = JSON.stringify(normalize(body));
        }

        for (let attempt = 0; ; attempt++) {
            let response: Response;
            let text: string;
            try {
                response = await this.config.fetch(url, {
                    method,
                    headers,
                    body: payload ?? null,
                    redirect: 'manual',
                    signal: AbortSignal.timeout(this.config.timeout),
                });
                text = await response.text();
            } catch (error) {
                const timeout =
                    error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
                const reason = timeout ? `timeout after ${this.config.timeout} ms` : describe(error);
                throw new ConnectionError(`${method} ${url} failed: ${reason}`, { timeout, cause: error });
            }

            const responseHeaders = Object.fromEntries(
                [...response.headers.entries()].map(([name, value]) => [name.toLowerCase(), value])
            );
            this.lastResponse = {
                status: response.status,
                requestId: responseHeaders['x-request-id'] ?? null,
                rateLimitLimit: toInt(responseHeaders['x-ratelimit-limit']),
                rateLimitRemaining: toInt(responseHeaders['x-ratelimit-remaining']),
            };
            this.config.onResponse?.(this.lastResponse);

            if (response.status < 400) {
                return text;
            }

            const error = createApiError(response.status, text, responseHeaders);
            // 429: the request was not processed, so it can safely be replayed after the announced delay
            if (error instanceof RateLimitError && attempt < this.config.maxRetries) {
                const delay = Math.max(1, error.retryAfter ?? 1);
                if (delay <= this.config.maxRetryDelay) {
                    await this.config.sleep(delay * 1000);
                    continue;
                }
            }

            throw error;
        }
    }
}

/** Encodes path segments (email, domain name, uuid...): path`/user/${email}`. */
export function path(strings: TemplateStringsArray, ...segments: string[]): string {
    return strings.reduce((result, part, index) => {
        const segment = segments[index - 1];
        return result + (segment === undefined ? '' : encodeURIComponent(segment)) + part;
    });
}

/** Formats a date the way the API reads it (`YYYY-MM-DD HH:mm`), in local time. */
export function formatDate(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

/** Builds the query string; `undefined` / `null` values are skipped, booleans are sent as `1` / `0`. */
export function buildQuery(query?: object): string {
    if (!query) return '';

    const parts: string[] = [];
    for (const [name, value] of Object.entries(query) as Array<[string, unknown]>) {
        let text: string;
        if (value instanceof Date) text = formatDate(value);
        else if (typeof value === 'boolean') text = value ? '1' : '0';
        else if (typeof value === 'string' || typeof value === 'number') text = String(value);
        else continue;
        parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(text)}`);
    }

    return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** Replaces the dates by their API format, recursively (JSON.stringify would send them in UTC ISO format). */
function normalize(value: unknown): unknown {
    if (value instanceof Date) return formatDate(value);
    if (Array.isArray(value)) return value.map(normalize);
    if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
    }
    return value;
}

function toInt(value: string | undefined): number | null {
    return value !== undefined && /^\d+$/.test(value) ? Number(value) : null;
}

function describe(error: unknown): string {
    if (!(error instanceof Error)) return String(error);
    // fetch (undici) range la vraie raison (ECONNREFUSED, ENOTFOUND...) dans cause
    const cause = error.cause instanceof Error ? `: ${error.cause.message}` : '';
    return error.message + cause;
}
