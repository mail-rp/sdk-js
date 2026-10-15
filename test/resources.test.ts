import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Color, EventIcon, RepeatFrequency, type MailRpClient } from '../src/index.ts';
import { createClient, FakeFetch, fixtures } from './helpers.ts';

const CAL = '0199c8a1-6f3e-7a52-9d4b-2f8e1c0a7b31';
const EVT = '0199c8a1-0000-7a52-9d4b-2f8e1c0a7b31';
const member = { user: { email: 'a@lspd.gov', name: 'A', firstname: 'B' }, manager: true, accepted: false };
const subscription = { email: 's@x.y', createdAt: '2026-01-01T12:00:00+00:00' };

type Endpoint = [
    name: string,
    call: (client: MailRpClient) => Promise<unknown>,
    status: number,
    response: unknown,
    method: string,
    path: string,
    body: unknown,
    result?: unknown,
];

// Each endpoint: SDK call, simulated response, expected request (method, path, body) and optionally the result
const endpoints: Endpoint[] = [
    ['health', (c) => c.system.health(), 200, { status: 'online', version: '2.0.0' }, 'GET', '/health', null],
    ['server', (c) => c.server.get(), 200, { name: 'Xelyos' }, 'GET', '/server', null],

    [
        'domain search',
        (c) => c.domains.search({ search: 'lspd', sort: 'name' }),
        200,
        fixtures.page([fixtures.domain]),
        'GET',
        '/domain/search?search=lspd&sort=name',
        null,
    ],
    ['domain get', (c) => c.domains.get('lspd.gov'), 200, fixtures.domain, 'GET', '/domain/lspd.gov', null],
    [
        'domain create',
        (c) =>
            c.domains.create({
                name: 'lspd.gov',
                public: false,
                manager: { email: 'chief@lspd.gov', name: 'Doe', firstname: 'John', password: 'secret123' },
            }),
        201,
        fixtures.domain,
        'POST',
        '/domain/add',
        {
            name: 'lspd.gov',
            public: false,
            manager: { email: 'chief@lspd.gov', name: 'Doe', firstname: 'John', password: 'secret123' },
        },
    ],
    [
        'domain update',
        (c) => c.domains.update('lspd.gov', { title: 'LSPD', manager: 'chief@lspd.gov' }),
        200,
        fixtures.domain,
        'PATCH',
        '/domain/lspd.gov',
        { title: 'LSPD', manager: 'chief@lspd.gov' },
    ],
    [
        'domain delete',
        (c) => c.domains.delete('lspd.gov'),
        204,
        undefined,
        'DELETE',
        '/domain/lspd.gov',
        null,
        undefined,
    ],
    [
        'domain disable',
        (c) => c.domains.disable('lspd.gov'),
        200,
        fixtures.domain,
        'POST',
        '/domain/lspd.gov/disable',
        null,
    ],
    [
        'domain enable',
        (c) => c.domains.enable('lspd.gov'),
        200,
        fixtures.domain,
        'POST',
        '/domain/lspd.gov/enable',
        null,
    ],
    [
        'domain users',
        (c) => c.domains.searchUsers('lspd.gov', { limit: 20 }),
        200,
        fixtures.page([fixtures.user()]),
        'GET',
        '/domain/lspd.gov/user/search?limit=20',
        null,
    ],
    [
        'domain newsletters',
        (c) => c.domains.searchNewsletters('lspd.gov'),
        200,
        fixtures.page([fixtures.newsletter]),
        'GET',
        '/domain/lspd.gov/newsletter/search',
        null,
    ],
    [
        'domain newsletter create',
        (c) => c.domains.createNewsletter('lspd.gov', 'News'),
        201,
        fixtures.newsletter,
        'POST',
        '/domain/lspd.gov/newsletter/add',
        { name: 'News' },
    ],

    [
        'user search',
        (c) => c.users.search({ search: 'dan' }),
        200,
        fixtures.page([fixtures.user()]),
        'GET',
        '/user/search?search=dan',
        null,
    ],
    [
        'user get',
        (c) => c.users.get('commander@lspd.gov'),
        200,
        fixtures.user(),
        'GET',
        '/user/commander%40lspd.gov',
        null,
    ],
    [
        'user create',
        (c) => c.users.create({ email: 'commander@lspd.gov', name: 'Foster', firstname: 'Dan', invite: true }),
        201,
        fixtures.user(),
        'POST',
        '/user/add',
        { email: 'commander@lspd.gov', name: 'Foster', firstname: 'Dan', invite: true },
    ],
    [
        'user update',
        (c) =>
            c.users.update('commander@lspd.gov', { name: 'F', firstname: 'D', publicInformation: { title: 'Chef' } }),
        200,
        fixtures.user(),
        'PUT',
        '/user/commander%40lspd.gov',
        { name: 'F', firstname: 'D', publicInformation: { title: 'Chef' } },
    ],
    [
        'user delete',
        (c) => c.users.delete('commander@lspd.gov'),
        204,
        undefined,
        'DELETE',
        '/user/commander%40lspd.gov',
        null,
        undefined,
    ],
    [
        'user disable',
        (c) => c.users.disable('commander@lspd.gov'),
        200,
        fixtures.user(),
        'POST',
        '/user/commander%40lspd.gov/disable',
        null,
    ],
    [
        'user enable',
        (c) => c.users.enable('commander@lspd.gov'),
        200,
        fixtures.user(),
        'POST',
        '/user/commander%40lspd.gov/enable',
        null,
    ],

    [
        'alias search',
        (c) => c.users.aliases.search('commander@lspd.gov'),
        200,
        fixtures.page([{ email: 'd@lspd.gov' }]),
        'GET',
        '/user/commander%40lspd.gov/alias/search',
        null,
        { total: 1, rows: ['d@lspd.gov'] },
    ],
    [
        'alias add',
        (c) => c.users.aliases.add('commander@lspd.gov', 'd'),
        201,
        { email: 'd@lspd.gov' },
        'POST',
        '/user/commander%40lspd.gov/alias/add',
        { email: 'd' },
        'd@lspd.gov',
    ],
    [
        'alias remove',
        (c) => c.users.aliases.remove('commander@lspd.gov', 'd@lspd.gov'),
        204,
        undefined,
        'DELETE',
        '/user/commander%40lspd.gov/alias/d%40lspd.gov',
        null,
        undefined,
    ],

    [
        'user calendars',
        (c) => c.users.calendars.search('commander@lspd.gov'),
        200,
        fixtures.page([]),
        'GET',
        '/user/commander%40lspd.gov/calendar/search',
        null,
    ],
    [
        'user calendar create',
        (c) => c.users.calendars.create('commander@lspd.gov', { name: 'Perso', color: Color.Info }),
        201,
        fixtures.calendar,
        'POST',
        '/user/commander%40lspd.gov/calendar/add',
        { name: 'Perso', color: 'info' },
    ],

    [
        'contact search',
        (c) => c.users.contacts.search('commander@lspd.gov'),
        200,
        fixtures.page([]),
        'GET',
        '/user/commander%40lspd.gov/contact/search',
        null,
    ],
    [
        'contact create',
        (c) => c.users.contacts.create('commander@lspd.gov', { name: 'Bob', email: 'bob@lspd.gov' }),
        201,
        { name: 'Bob', email: 'bob@lspd.gov' },
        'POST',
        '/user/commander%40lspd.gov/contact/add',
        { name: 'Bob', email: 'bob@lspd.gov' },
    ],
    [
        'contact update',
        (c) => c.users.contacts.update('commander@lspd.gov', 'bob@lspd.gov', { name: 'Bobby', email: 'bob@lspd.gov' }),
        200,
        { name: 'Bobby', email: 'bob@lspd.gov' },
        'PUT',
        '/user/commander%40lspd.gov/contact/bob%40lspd.gov',
        { name: 'Bobby', email: 'bob@lspd.gov' },
    ],
    [
        'contact delete',
        (c) => c.users.contacts.delete('commander@lspd.gov', 'bob@lspd.gov'),
        204,
        undefined,
        'DELETE',
        '/user/commander%40lspd.gov/contact/bob%40lspd.gov',
        null,
        undefined,
    ],

    [
        'user events',
        (c) => c.users.events.search('commander@lspd.gov', '2026-10-01', '2026-10-31'),
        200,
        fixtures.page([fixtures.event]),
        'GET',
        '/user/commander%40lspd.gov/event/search?start=2026-10-01&end=2026-10-31',
        null,
    ],

    [
        'mail send',
        (c) =>
            c.users.mails.send('commander@lspd.gov', {
                to: ['bob@lspd.gov'],
                subject: 'Rapport',
                attachments: ['https://x/a.pdf', { url: 'https://x/b.png', name: 'b' }],
                event: { title: 'Meeting', start: '2026-10-20 14:00', end: '2026-10-20 15:00', icon: EventIcon.People },
            }),
        202,
        { message: "Mail en cours d'envoi" },
        'POST',
        '/user/commander%40lspd.gov/mail/send',
        {
            to: ['bob@lspd.gov'],
            subject: 'Rapport',
            attachments: ['https://x/a.pdf', { url: 'https://x/b.png', name: 'b' }],
            event: { title: 'Meeting', start: '2026-10-20 14:00', end: '2026-10-20 15:00', icon: 'bi-people' },
        },
        "Mail en cours d'envoi",
    ],

    [
        'redirection search',
        (c) => c.users.redirections.search('commander@lspd.gov'),
        200,
        fixtures.page([{ email: 'r@lspd.gov' }]),
        'GET',
        '/user/commander%40lspd.gov/redirection/search',
        null,
        { total: 1, rows: ['r@lspd.gov'] },
    ],
    [
        'redirection add',
        (c) => c.users.redirections.add('commander@lspd.gov', 'r@lspd.gov'),
        201,
        { email: 'r@lspd.gov' },
        'POST',
        '/user/commander%40lspd.gov/redirection/add',
        { email: 'r@lspd.gov' },
        'r@lspd.gov',
    ],
    [
        'redirection remove',
        (c) => c.users.redirections.remove('commander@lspd.gov', 'r@lspd.gov'),
        204,
        undefined,
        'DELETE',
        '/user/commander%40lspd.gov/redirection/r%40lspd.gov',
        null,
        undefined,
    ],
    [
        'redirection remove all',
        (c) => c.users.redirections.removeAll('commander@lspd.gov'),
        204,
        undefined,
        'DELETE',
        '/user/commander%40lspd.gov/redirection/all',
        null,
        undefined,
    ],

    ['calendar get', (c) => c.calendars.get(CAL), 200, fixtures.calendar, 'GET', `/calendar/${CAL}`, null],
    [
        'calendar update',
        (c) => c.calendars.update(CAL, { name: 'X', color: 'danger' }),
        200,
        fixtures.calendar,
        'PUT',
        `/calendar/${CAL}`,
        { name: 'X', color: 'danger' },
    ],
    ['calendar delete', (c) => c.calendars.delete(CAL), 204, undefined, 'DELETE', `/calendar/${CAL}`, null, undefined],
    [
        'calendar transfer',
        (c) => c.calendars.transfer(CAL, 'bob@lspd.gov'),
        200,
        fixtures.calendar,
        'POST',
        `/calendar/${CAL}/transfer`,
        { email: 'bob@lspd.gov' },
    ],

    [
        'event search',
        (c) => c.calendars.events.search(CAL, '2026-10-01 00:00', '2026-10-31 23:59', { sort: 'title' }),
        200,
        fixtures.page([fixtures.event]),
        'GET',
        `/calendar/${CAL}/event/search?start=2026-10-01%2000%3A00&end=2026-10-31%2023%3A59&sort=title`,
        null,
    ],
    [
        'event get',
        (c) => c.calendars.events.get(CAL, EVT),
        200,
        fixtures.event,
        'GET',
        `/calendar/${CAL}/event/${EVT}`,
        null,
    ],
    [
        'event create',
        (c) =>
            c.calendars.events.create(CAL, {
                title: 'Ronde',
                start: '2026-10-01 08:00',
                end: '2026-10-01 09:00',
                repeat: { start: '2026-10-01', end: '2026-12-31', frequency: RepeatFrequency.Weekly, monday: true },
            }),
        201,
        fixtures.event,
        'POST',
        `/calendar/${CAL}/event/add`,
        {
            title: 'Ronde',
            start: '2026-10-01 08:00',
            end: '2026-10-01 09:00',
            repeat: { start: '2026-10-01', end: '2026-12-31', frequency: 'weekly', monday: true },
        },
    ],
    [
        'event update',
        (c) =>
            c.calendars.events.update(CAL, EVT, {
                title: 'Ronde',
                start: '2026-10-01 08:00',
                end: '2026-10-01 09:00',
                applyAll: true,
            }),
        200,
        fixtures.event,
        'PUT',
        `/calendar/${CAL}/event/${EVT}`,
        { title: 'Ronde', start: '2026-10-01 08:00', end: '2026-10-01 09:00', applyAll: true },
    ],
    [
        'event delete',
        (c) => c.calendars.events.delete(CAL, EVT),
        204,
        undefined,
        'DELETE',
        `/calendar/${CAL}/event/${EVT}`,
        null,
        undefined,
    ],
    [
        'event delete series',
        (c) => c.calendars.events.delete(CAL, EVT, { applyAllNext: true }),
        204,
        undefined,
        'DELETE',
        `/calendar/${CAL}/event/${EVT}?applyAllNext=1`,
        null,
        undefined,
    ],

    [
        'invite search',
        (c) => c.calendars.invites.search(CAL),
        200,
        fixtures.page([member]),
        'GET',
        `/calendar/${CAL}/invite/search`,
        null,
    ],
    [
        'invite add',
        (c) => c.calendars.invites.add(CAL, ['a@lspd.gov', 'x@y.z'], true),
        200,
        { invited: ['a@lspd.gov'], ignored: ['x@y.z'] },
        'POST',
        `/calendar/${CAL}/invite/add`,
        { users: ['a@lspd.gov', 'x@y.z'], manager: true },
    ],
    [
        'invite update',
        (c) => c.calendars.invites.update(CAL, 'a@lspd.gov', false),
        200,
        member,
        'PUT',
        `/calendar/${CAL}/invite/a%40lspd.gov`,
        { manager: false },
    ],
    [
        'invite remove',
        (c) => c.calendars.invites.remove(CAL, 'a@lspd.gov'),
        204,
        undefined,
        'DELETE',
        `/calendar/${CAL}/invite/a%40lspd.gov`,
        null,
        undefined,
    ],

    [
        'newsletter search',
        (c) => c.newsletters.search(),
        200,
        fixtures.page([fixtures.newsletter]),
        'GET',
        '/newsletter/search',
        null,
    ],
    [
        'newsletter get',
        (c) => c.newsletters.get('lspd-news'),
        200,
        fixtures.newsletter,
        'GET',
        '/newsletter/lspd-news',
        null,
    ],
    [
        'newsletter create',
        (c) => c.newsletters.create('lspd.gov', 'News'),
        201,
        fixtures.newsletter,
        'POST',
        '/newsletter/add',
        { domain: 'lspd.gov', name: 'News' },
    ],
    [
        'newsletter update',
        (c) => c.newsletters.update('lspd-news', 'Infos'),
        200,
        fixtures.newsletter,
        'PUT',
        '/newsletter/lspd-news',
        { name: 'Infos' },
    ],
    [
        'newsletter delete',
        (c) => c.newsletters.delete('lspd-news'),
        204,
        undefined,
        'DELETE',
        '/newsletter/lspd-news',
        null,
        undefined,
    ],
    [
        'sender search',
        (c) => c.newsletters.senders.search('lspd-news'),
        200,
        fixtures.page([fixtures.user()]),
        'GET',
        '/newsletter/lspd-news/sender/search',
        null,
    ],
    [
        'sender add',
        (c) => c.newsletters.senders.add('lspd-news', 'commander@lspd.gov'),
        201,
        fixtures.user(),
        'POST',
        '/newsletter/lspd-news/sender/add',
        { email: 'commander@lspd.gov' },
    ],
    [
        'sender remove',
        (c) => c.newsletters.senders.remove('lspd-news', 'commander@lspd.gov'),
        204,
        undefined,
        'DELETE',
        '/newsletter/lspd-news/sender/commander%40lspd.gov',
        null,
        undefined,
    ],
    [
        'subscription search',
        (c) => c.newsletters.subscriptions.search('lspd-news'),
        200,
        fixtures.page([subscription]),
        'GET',
        '/newsletter/lspd-news/subscription/search',
        null,
    ],
    [
        'subscription add',
        (c) => c.newsletters.subscriptions.add('lspd-news', 's@x.y'),
        201,
        subscription,
        'POST',
        '/newsletter/lspd-news/subscription/add',
        { email: 's@x.y' },
    ],
    [
        'subscription remove',
        (c) => c.newsletters.subscriptions.remove('lspd-news', 's@x.y'),
        204,
        undefined,
        'DELETE',
        '/newsletter/lspd-news/subscription/s%40x.y',
        null,
        undefined,
    ],
];

describe('resources', () => {
    for (const [name, call, status, response, method, path, body, ...expected] of endpoints) {
        it(name, async () => {
            const fake = new FakeFetch().queue(status, response);
            const result = await call(createClient(fake));

            assert.equal(fake.last.method, method);
            assert.equal(fake.last.url, `https://api.test${path}`);
            assert.deepEqual(fake.lastJsonBody, body);
            // Without an explicit expected result, the JSON of the response is returned as is
            assert.deepEqual(result, expected.length > 0 ? expected[0] : response);
        });
    }

    it('iterates over every page', async () => {
        const fake = new FakeFetch()
            .queue(200, fixtures.page([fixtures.user('a@lspd.gov'), fixtures.user('b@lspd.gov')], 5))
            .queue(200, fixtures.page([fixtures.user('c@lspd.gov'), fixtures.user('d@lspd.gov')], 5))
            .queue(200, fixtures.page([fixtures.user('e@lspd.gov')], 5));

        const emails: string[] = [];
        for await (const user of createClient(fake).users.iterate({ search: 'lspd', limit: 2 })) {
            emails.push(user.email);
        }

        assert.deepEqual(emails, ['a@lspd.gov', 'b@lspd.gov', 'c@lspd.gov', 'd@lspd.gov', 'e@lspd.gov']);
        assert.deepEqual(
            fake.requests.map((request) => request.url),
            [
                'https://api.test/user/search?search=lspd&limit=2&offset=0',
                'https://api.test/user/search?search=lspd&limit=2&offset=2',
                'https://api.test/user/search?search=lspd&limit=2&offset=4',
            ]
        );
    });

    it('stops iterating on an empty page', async () => {
        const fake = new FakeFetch()
            .queue(200, fixtures.page([{ email: 'a@x.y' }], 10))
            .queue(200, fixtures.page([], 10));

        const aliases: string[] = [];
        for await (const alias of createClient(fake).users.aliases.iterate('commander@lspd.gov')) aliases.push(alias);

        assert.deepEqual(aliases, ['a@x.y']);
        assert.equal(
            fake.requests[0]?.url,
            'https://api.test/user/commander%40lspd.gov/alias/search?limit=100&offset=0'
        );
        assert.equal(fake.requests.length, 2);
    });

    it('stops fetching when the loop breaks', async () => {
        const fake = new FakeFetch().queue(200, fixtures.page([fixtures.user('a@x.y'), fixtures.user('b@x.y')], 50));

        for await (const user of createClient(fake).users.iterate()) {
            assert.equal(user.email, 'a@x.y');
            break;
        }
        assert.equal(fake.requests.length, 1);
    });
});
