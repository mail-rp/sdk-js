import { MailRpClient, type ClientOptions } from '../src/index.ts';

export interface RecordedRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string | null;
}

interface QueuedResponse {
    status: number;
    body?: unknown;
    headers?: Record<string, string>;
}

/** Replays queued responses and records the requests. */
export class FakeFetch {
    readonly requests: RecordedRequest[] = [];
    private readonly responses: QueuedResponse[] = [];

    queue(status: number, body?: unknown, headers: Record<string, string> = {}): this {
        this.responses.push({ status, body, headers });
        return this;
    }

    readonly fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
        this.requests.push({
            method: init.method ?? 'GET',
            url: String(input),
            headers: { ...(init.headers as Record<string, string>) },
            body: typeof init.body === 'string' ? init.body : null,
        });
        const next = this.responses.shift();
        if (!next) throw new Error(`No response queued for ${init.method} ${String(input)}`);

        const isText = typeof next.body === 'string';
        const body = next.body === undefined ? null : isText ? (next.body as string) : JSON.stringify(next.body);
        const headers = {
            ...(body !== null && !isText ? { 'Content-Type': 'application/json' } : {}),
            ...next.headers,
        };
        return new Response(next.status === 204 ? null : body, { status: next.status, headers });
    };

    get last(): RecordedRequest {
        const request = this.requests.at(-1);
        if (!request) throw new Error('No request sent');
        return request;
    }

    get lastJsonBody(): unknown {
        return this.last.body === null ? null : JSON.parse(this.last.body);
    }
}

export function createClient(fake: FakeFetch, options: ClientOptions = {}): MailRpClient {
    return new MailRpClient('xls-mrp-test', { baseUrl: 'https://api.test', fetch: fake.fetch, ...options });
}

export const fixtures = {
    user: (email = 'commander@lspd.gov') => ({
        email,
        name: 'Foster',
        firstname: 'Dan',
        activated: true,
        createdAt: '2026-01-01T12:00:00+00:00',
        updatedAt: null,
        avatar: null,
        publicInformation: { title: 'Aros', description: 'Mail RP Manager' },
    }),
    domain: {
        name: 'lspd.gov',
        public: false,
        createdAt: '2026-01-01T12:00:00+00:00',
        updatedAt: null,
        activated: true,
        title: 'LSPD',
        logo: null,
        usersCount: 153,
        newslettersCount: 7,
        manager: null,
        addressBook: true,
    },
    calendar: {
        uuid: '0199c8a1-6f3e-7a52-9d4b-2f8e1c0a7b31',
        name: 'Patrouilles',
        color: 'primary',
        createdAt: '2026-01-01T12:00:00+00:00',
        updatedAt: null,
        user: { email: 'commander@lspd.gov', name: 'Foster', firstname: 'Dan' },
    },
    event: {
        uuid: '0199c8a1-0000-7a52-9d4b-2f8e1c0a7b31',
        title: 'Briefing',
        description: '',
        location: '',
        allDay: false,
        calendar: { uuid: '0199c8a1-6f3e-7a52-9d4b-2f8e1c0a7b31', name: 'Patrouilles' },
        reference: null,
        color: 'primary',
        start: '2026-10-14 09:00',
        end: '2026-10-14 10:00',
    },
    newsletter: { code: 'lspd-news', name: 'LSPD News', domain: 'lspd.gov' },
    page: <T>(rows: T[], total = rows.length) => ({ total, rows }),
};
