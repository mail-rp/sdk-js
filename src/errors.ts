/**
 * Base class of every error thrown by the SDK: catch it to handle any failure.
 */
export class MailRpError extends Error {
    override name = 'MailRpError';
}

/**
 * No HTTP response could be obtained (DNS failure, connection refused, timeout...).
 */
export class ConnectionError extends MailRpError {
    override name = 'ConnectionError';
    readonly timeout: boolean;

    constructor(message: string, options: { timeout?: boolean; cause?: unknown } = {}) {
        super(message, { cause: options.cause });
        this.timeout = options.timeout ?? false;
    }
}

/**
 * The API answered with a success status but a body the SDK cannot read.
 */
export class UnexpectedResponseError extends MailRpError {
    override name = 'UnexpectedResponseError';
}

export interface ApiErrorDetails {
    status: number;
    path: string | null;
    requestId: string | null;
    body: unknown;
    headers: Record<string, string>;
}

/**
 * The API answered with an error status (4xx / 5xx). The message is the one returned by the API, in the language
 * configured on the key.
 */
export class ApiError extends MailRpError {
    override name = 'ApiError';
    /** HTTP status */
    readonly status: number;
    /** Field or parameter the error is about (validation errors, conflicts, missing sub-resources), when given */
    readonly path: string | null;
    /** Identifier of the request, as shown in the history of the key in the panel */
    readonly requestId: string | null;
    /** Decoded JSON body, or the raw body when it is not JSON */
    readonly body: unknown;
    /** Response headers (lower-cased names) */
    readonly headers: Record<string, string>;

    constructor(message: string, details: ApiErrorDetails) {
        super(message);
        this.status = details.status;
        this.path = details.path;
        this.requestId = details.requestId;
        this.body = details.body;
        this.headers = details.headers;
    }
}

/** HTTP 400 / 422: missing, malformed or invalid data; `path` names the field when known. */
export class ValidationError extends ApiError {
    override name = 'ValidationError';
}

/** HTTP 401: API key missing, malformed, unknown or deleted. */
export class AuthenticationError extends ApiError {
    override name = 'AuthenticationError';
}

/**
 * HTTP 403: permission missing on the key, resource outside its domains, IP not allowed, pack without API access,
 * server offline or action not allowed on this resource.
 */
export class PermissionDeniedError extends ApiError {
    override name = 'PermissionDeniedError';
}

/** HTTP 404: the resource does not exist or is not visible with this key. */
export class NotFoundError extends ApiError {
    override name = 'NotFoundError';
}

/** HTTP 409: the request conflicts with the current state (already exists, already disabled...). */
export class ConflictError extends ApiError {
    override name = 'ConflictError';
}

/**
 * HTTP 429: too many requests (60 per minute per key, 300 per minute per server). Thrown once the automatic retries
 * configured on the client are exhausted.
 */
export class RateLimitError extends ApiError {
    override name = 'RateLimitError';

    /** Seconds to wait before retrying, as announced by the API */
    get retryAfter(): number | null {
        const value = this.headers['retry-after'];
        return value !== undefined && /^\d+$/.test(value) ? Number(value) : null;
    }
}

/** HTTP 503: the API is in maintenance. */
export class ServiceUnavailableError extends ApiError {
    override name = 'ServiceUnavailableError';
}

/** HTTP 5xx: unexpected error on the Mail RP side. */
export class ServerError extends ApiError {
    override name = 'ServerError';
}

/**
 * Builds the error matching the status of the response.
 *
 * @internal
 */
export function createApiError(status: number, rawBody: string, headers: Record<string, string>): ApiError {
    let body: unknown = rawBody;
    try {
        body = JSON.parse(rawBody);
    } catch {
        // Corps non JSON (proxy, page HTML) : on garde le texte brut
    }

    const data = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const message =
        typeof data.message === 'string' && data.message !== ''
            ? data.message
            : `The Mail RP API returned HTTP ${status}`;
    const details: ApiErrorDetails = {
        status,
        path: typeof data.path === 'string' ? data.path : null,
        requestId: headers['x-request-id'] ?? null,
        body,
        headers,
    };

    if (status === 400 || status === 422) return new ValidationError(message, details);
    if (status === 401) return new AuthenticationError(message, details);
    if (status === 403) return new PermissionDeniedError(message, details);
    if (status === 404) return new NotFoundError(message, details);
    if (status === 409) return new ConflictError(message, details);
    if (status === 429) return new RateLimitError(message, details);
    if (status === 503) return new ServiceUnavailableError(message, details);
    if (status >= 500) return new ServerError(message, details);

    return new ApiError(message, details);
}
