import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    ApiError,
    AuthenticationError,
    ConflictError,
    ConnectionError,
    MailRpClient,
    MailRpError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
    ServerError,
    ServiceUnavailableError,
    UnexpectedResponseError,
    ValidationError,
    VERSION,
    type ResponseMeta,
} from '../src/index.ts';
import { createClient, FakeFetch, fixtures } from './helpers.ts';

describe('MailRpClient', () => {
    it('sends authenticated JSON requests', async () => {
        const fake = new FakeFetch().queue(200, fixtures.user(), {
            'X-Request-Id': 'req-1',
            'X-RateLimit-Limit': '60',
            'X-RateLimit-Remaining': '59',
        });
        const seen: ResponseMeta[] = [];
        const client = new MailRpClient(' xls-mrp-test ', {
            baseUrl: 'https://api.test/',
            fetch: fake.fetch,
            onResponse: (meta) => seen.push(meta),
        });

        const user = await client.users.update('commander+rp@lspd.gov', { name: 'Foster', firstname: 'Dàn' });

        assert.equal(fake.last.method, 'PUT');
        assert.equal(fake.last.url, 'https://api.test/user/commander%2Brp%40lspd.gov');
        assert.equal(fake.last.headers.Authorization, 'Bearer xls-mrp-test');
        assert.equal(fake.last.headers.Accept, 'application/json');
        assert.equal(fake.last.headers['Content-Type'], 'application/json');
        assert.equal(fake.last.headers['User-Agent'], `mail-rp-node/${VERSION}`);
        assert.equal(fake.last.body, '{"name":"Foster","firstname":"Dàn"}');
        assert.equal(user.firstname, 'Dan');

        const expected = { status: 200, requestId: 'req-1', rateLimitLimit: 60, rateLimitRemaining: 59 };
        assert.deepEqual(client.lastResponse, expected);
        assert.deepEqual(seen, [expected]);
    });

    it('builds query strings and formats dates', async () => {
        const fake = new FakeFetch().queue(200, fixtures.page([]));
        await createClient(fake).users.events.search('commander@lspd.gov', new Date(2026, 9, 14, 8, 30), '2026-10-20', {
            search: 'brief ing',
            order: 'desc',
            sort: undefined,
            limit: 5,
            calendar: 'abc',
        });

        assert.equal(
            fake.last.url,
            'https://api.test/user/commander%40lspd.gov/event/search?start=2026-10-14%2008%3A30&end=2026-10-20&search=brief%20ing&order=desc&limit=5&calendar=abc'
        );
        assert.equal(fake.last.body, null);
        assert.equal(fake.last.headers['Content-Type'], undefined);
    });

    it('formats the dates of the bodies in local time', async () => {
        const fake = new FakeFetch().queue(202, { message: 'OK' });
        await createClient(fake).users.mails.send('commander@lspd.gov', {
            to: 'bob@lspd.gov',
            subject: 'Meeting',
            event: {
                title: 'Meeting',
                start: new Date(2026, 9, 20, 14, 0),
                end: '2026-10-20 15:00',
                requiredParticipants: true,
            },
        });

        assert.deepEqual(fake.lastJsonBody, {
            to: 'bob@lspd.gov',
            subject: 'Meeting',
            event: { title: 'Meeting', start: '2026-10-20 14:00', end: '2026-10-20 15:00', requiredParticipants: true },
        });
    });

    it('only sends the permissions flag when asked', async () => {
        const key = { name: 'Bot', description: null, locale: 'fr' };
        const fake = new FakeFetch()
            .queue(200, { message: 'OK', key })
            .queue(200, { message: 'OK', key: { ...key, permissions: ['user.read'] } });
        const client = createClient(fake);

        assert.equal((await client.system.checkKey()).key.permissions, undefined);
        assert.equal(fake.last.url, 'https://api.test/');
        assert.deepEqual((await client.system.checkKey(true)).key.permissions, ['user.read']);
        assert.equal(fake.last.url, 'https://api.test/?permissions=1');
    });

    it('handles 204 responses', async () => {
        const fake = new FakeFetch().queue(204);
        assert.equal(await createClient(fake).users.delete('commander@lspd.gov'), undefined);
        assert.equal(fake.last.method, 'DELETE');
    });

    const statuses: Array<[number, new (...args: never[]) => ApiError]> = [
        [400, ValidationError],
        [401, AuthenticationError],
        [403, PermissionDeniedError],
        [404, NotFoundError],
        [405, ApiError],
        [409, ConflictError],
        [422, ValidationError],
        [429, RateLimitError],
        [500, ServerError],
        [503, ServiceUnavailableError],
    ];
    for (const [status, errorClass] of statuses) {
        it(`maps HTTP ${status} to ${errorClass.name}`, async () => {
            const fake = new FakeFetch().queue(
                status,
                { message: 'Adresse invalide', path: 'email' },
                { 'X-Request-Id': 'req-9' }
            );
            const error = await createClient(fake, { maxRetries: 0 })
                .users.get('commander@lspd.gov')
                .catch((caught: unknown) => caught);

            assert.ok(error instanceof errorClass);
            assert.ok(error instanceof MailRpError);
            assert.equal(error.constructor, errorClass);
            assert.equal(error.message, 'Adresse invalide');
            assert.equal(error.status, status);
            assert.equal(error.path, 'email');
            assert.equal(error.requestId, 'req-9');
            assert.deepEqual(error.body, { message: 'Adresse invalide', path: 'email' });
        });
    }

    it('keeps a generic message when the error body is not JSON', async () => {
        const fake = new FakeFetch().queue(502, '<html>Bad gateway</html>');
        await assert.rejects(createClient(fake).server.get(), (error: unknown) => {
            assert.ok(error instanceof ServerError);
            assert.equal(error.message, 'The Mail RP API returned HTTP 502');
            assert.equal(error.body, '<html>Bad gateway</html>');
            return true;
        });
    });

    it('retries rate limited requests', async () => {
        const sleeps: number[] = [];
        const fake = new FakeFetch()
            .queue(429, { message: 'Too many requests' }, { 'Retry-After': '3' })
            .queue(429, { message: 'Too many requests' }, { 'Retry-After': '0' })
            .queue(200, fixtures.user());
        const client = createClient(fake, { sleep: async (ms) => void sleeps.push(ms) });

        assert.equal((await client.users.get('commander@lspd.gov')).email, 'commander@lspd.gov');
        assert.deepEqual(sleeps, [3000, 1000]);
        assert.equal(fake.requests.length, 3);
    });

    it('gives up after maxRetries', async () => {
        const sleeps: number[] = [];
        const fake = new FakeFetch()
            .queue(429, { message: 'Too many requests' }, { 'Retry-After': '2' })
            .queue(429, { message: 'Too many requests' }, { 'Retry-After': '7' });
        const client = createClient(fake, { maxRetries: 1, sleep: async (ms) => void sleeps.push(ms) });

        await assert.rejects(client.users.get('commander@lspd.gov'), (error: unknown) => {
            assert.ok(error instanceof RateLimitError);
            assert.equal(error.retryAfter, 7);
            return true;
        });
        assert.deepEqual(sleeps, [2000]);
    });

    it('does not wait longer than maxRetryDelay', async () => {
        const sleeps: number[] = [];
        const fake = new FakeFetch().queue(429, { message: 'Too many requests' }, { 'Retry-After': '45' });
        const client = createClient(fake, { maxRetryDelay: 10, sleep: async (ms) => void sleeps.push(ms) });

        await assert.rejects(client.users.get('commander@lspd.gov'), RateLimitError);
        assert.deepEqual(sleeps, []);
    });

    it('rejects invalid JSON bodies', async () => {
        const fake = new FakeFetch().queue(200, '{not json');
        await assert.rejects(createClient(fake).server.get(), UnexpectedResponseError);
    });

    it('wraps network failures', async () => {
        const client = new MailRpClient('xls-mrp-test', {
            fetch: async () => {
                throw new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED 127.0.0.1:443') });
            },
        });
        await assert.rejects(client.server.get(), (error: unknown) => {
            assert.ok(error instanceof ConnectionError);
            assert.equal(error.timeout, false);
            assert.match(error.message, /ECONNREFUSED/);
            return true;
        });
    });

    it('reports timeouts', async () => {
        const client = new MailRpClient('xls-mrp-test', {
            timeout: 20,
            fetch: (_input, init) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
                }),
        });
        await assert.rejects(client.server.get(), (error: unknown) => {
            assert.ok(error instanceof ConnectionError);
            assert.equal(error.timeout, true);
            return true;
        });
    });

    it('tells whether an API key is set', () => {
        assert.equal(createClient(new FakeFetch()).hasApiKey(), true);
        assert.equal(new MailRpClient(' xls-mrp-test ').hasApiKey(), true);
        assert.equal(new MailRpClient().hasApiKey(), false);
        assert.equal(new MailRpClient(null).hasApiKey(), false);
        assert.equal(new MailRpClient('').hasApiKey(), false);
        assert.equal(new MailRpClient('  ').hasApiKey(), false);
        assert.throws(() => new MailRpClient(42 as unknown as string), MailRpError);
    });

    it('sends no Authorization header without a key', async () => {
        const fake = new FakeFetch().queue(200, { status: 'online', version: '2.0.0' });
        await new MailRpClient(undefined, { baseUrl: 'https://api.test', fetch: fake.fetch }).system.health();
        assert.equal(fake.last.headers.Authorization, undefined);
    });
});
