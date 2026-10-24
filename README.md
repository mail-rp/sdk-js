# Mail RP — Node.js SDK

Node.js (server-side) client for the [Mail RP API](https://api.mail-rp.com/docs/): domains, users, calendars,
newsletters, mail sending.

- Node.js ≥ 18, no dependency (uses `fetch`)
- Written in TypeScript: types included, ESM and CommonJS
- Typed errors, automatic pagination (`for await`)
- Automatic retry on `429 Too Many Requests`

> The API key gives access to the data of your server: use this SDK on the server side only (Discord bot, FiveM
> server script, backend…), never in a browser.

## Installation

```bash
npm install @xelyos/mail-rp
```

## Quick start

```ts
import { MailRpClient } from '@xelyos/mail-rp';
// CommonJS: const { MailRpClient } = require('@xelyos/mail-rp');

const mailRp = new MailRpClient(process.env.MAIL_RP_API_KEY!); // key created in the panel (Server > API)

const user = await mailRp.users.get('commander@lspd.gov');
console.log(`${user.firstname} ${user.name}`);

await mailRp.users.mails.send('commander@lspd.gov', {
    to: ['chief@lspd.gov'],
    subject: 'Patrol report',
    content: '<p>Nothing to report tonight.</p>',
});
```

## Configuration

```ts
const mailRp = new MailRpClient('xls-mrp-...', {
    baseUrl: 'https://api.mail-rp.com', // default
    timeout: 30_000, // milliseconds
    maxRetries: 2, // retries on 429 (0 to disable)
    maxRetryDelay: 60, // longest accepted Retry-After (s); above it, the error is thrown at once
    fetch: customFetch, // fetch implementation (global one by default)
    onResponse: (meta) => console.debug(meta.requestId, meta.rateLimitRemaining),
});
```

A key only has access to the permissions ticked in the panel and, when it is restricted, to its domains.
`await mailRp.system.checkKey(true)` returns the name, the language and the permissions of the key.

## Resources

| Access | Methods |
| --- | --- |
| `mailRp.system` | `health()`, `checkKey(withPermissions?)` |
| `mailRp.server` | `get()` |
| `mailRp.domains` | `search()`, `iterate()`, `get()`, `create()`, `update()`, `delete()`, `disable()`, `enable()`, `searchUsers()`, `iterateUsers()`, `searchNewsletters()`, `iterateNewsletters()`, `createNewsletter()` |
| `mailRp.users` | `search()`, `iterate()`, `get()`, `create()`, `update()`, `delete()`, `disable()`, `enable()` |
| `mailRp.users.aliases` | `search()`, `iterate()`, `add()`, `remove()` |
| `mailRp.users.calendars` | `search()`, `iterate()`, `create()` |
| `mailRp.users.contacts` | `search()`, `iterate()`, `create()`, `update()`, `delete()` |
| `mailRp.users.events` | `search()`, `iterate()` |
| `mailRp.users.mails` | `send()` |
| `mailRp.users.redirections` | `search()`, `iterate()`, `add()`, `remove()`, `removeAll()` |
| `mailRp.calendars` | `get()`, `update()`, `delete()`, `transfer()` |
| `mailRp.calendars.events` | `search()`, `iterate()`, `get()`, `create()`, `update()`, `delete()` |
| `mailRp.calendars.invites` | `search()`, `iterate()`, `add()`, `update()`, `remove()` |
| `mailRp.newsletters` | `search()`, `iterate()`, `get()`, `create()`, `update()`, `delete()` |
| `mailRp.newsletters.senders` | `search()`, `iterate()`, `add()`, `remove()` |
| `mailRp.newsletters.subscriptions` | `search()`, `iterate()`, `add()`, `remove()` |

Resources are identified as in the API: email address for a user, name for a domain, uuid for a calendar or an event,
code for a newsletter. The documentation of each method (hover in your editor) states the required permission.
Responses are the JSON of the API, typed; aliases and redirections are returned as addresses (`Page<string>`).

### Search and pagination

```ts
const page = await mailRp.domains.search({ search: 'lspd', sort: 'name', limit: 20 });
console.log(page.total, page.rows);

// iterate() chains the pages (100 rows per call by default); a `break` stops the calls
for await (const user of mailRp.users.iterate({ search: 'lspd.gov' })) {
    console.log(user.email);
}
```

Parameters: `search`, `limit` (1 to 100, API default 10), `offset`, `sort`, `order` (`asc` / `desc`).

### Calendars and events

Period dates are read in the time zone of the server, in the `YYYY-MM-DD HH:mm` format (or `YYYY-MM-DD`). A `Date` is
accepted everywhere and formatted that way **in the local time** of the Node.js process: if your server does not run in
the same time zone as your Mail RP server, pass strings instead.

```ts
import { Color, EventIcon, RepeatFrequency } from '@xelyos/mail-rp';

const calendar = await mailRp.users.calendars.create('commander@lspd.gov', { name: 'Patrols', color: Color.Danger });

const event = await mailRp.calendars.events.create(calendar.uuid, {
    title: 'Briefing',
    start: '2026-10-20 09:00',
    end: '2026-10-20 10:00',
    icon: EventIcon.People,
    requiredParticipants: ['chief@lspd.gov'],
    repeat: { start: '2026-10-20', end: '2026-12-31', frequency: RepeatFrequency.Weekly, monday: true },
});

const week = await mailRp.users.events.search('commander@lspd.gov', '2026-10-19', '2026-10-25', { calendar: calendar.uuid });

// Repeated event: delete the whole series
await mailRp.calendars.events.delete(calendar.uuid, event.uuid, { applyAll: true });
```

### Sending a mail

```ts
await mailRp.users.mails.send('commander@lspd.gov', {
    from: 'patrol@lspd.gov', // address of the user (default) or one of their active aliases
    to: ['chief@lspd.gov', 'infos@newsletter'], // `code@newsletter` targets the subscribers of a newsletter
    cc: 'archives@lspd.gov',
    subject: 'Meeting',
    content: '<p>Agenda attached.</p>',
    attachments: ['https://example.com/agenda.pdf', { url: 'https://example.com/map.png', name: 'Map' }],
    priority: true,
    openConfirmation: true,
    event: {
        title: 'Meeting',
        start: '2026-10-20 14:00',
        end: '2026-10-20 15:00',
        requiredParticipants: true, // `to` = required participants, `cc` = optional participants
    },
});
```

Sending is asynchronous (`202`): an unknown recipient is reported to the sender by a bounce mail, not by an error.

## Errors

All errors extend `MailRpError`.

| Error | Case |
| --- | --- |
| `ValidationError` | 400 / 422 — missing or invalid data (`path` gives the field) |
| `AuthenticationError` | 401 — missing, unknown or deleted key |
| `PermissionDeniedError` | 403 — missing permission, domain outside the key, refused IP, pack without API, server offline |
| `NotFoundError` | 404 — unknown resource |
| `ConflictError` | 409 — already existing, already disabled… |
| `RateLimitError` | 429 — once the retries are exhausted (`retryAfter`) |
| `ServiceUnavailableError` | 503 — API under maintenance |
| `ServerError` | other 5xx |
| `ApiError` | parent of the previous ones (`status`, `path`, `requestId`, `body`, `headers`) |
| `ConnectionError` | no HTTP response (DNS, connection, timeout: `timeout`) |
| `UnexpectedResponseError` | unreadable response |

The message is the one of the API, in the language set on the key. `requestId` matches the identifier shown in the
history of the key (panel).

```ts
import { NotFoundError, ValidationError } from '@xelyos/mail-rp';

try {
    await mailRp.users.create({ email: 'commander@lspd.gov', name: 'Foster', firstname: 'Dan', invite: true });
} catch (error) {
    if (error instanceof ValidationError) console.error(`${error.path}: ${error.message}`);
    else if (error instanceof NotFoundError) console.error('Unknown domain');
    else throw error;
}
```

## Rate limit

60 requests per minute per key and 300 per server. On a `429`, the client waits for the announced `Retry-After`, then
replays the request (`maxRetries` times). The current state is given by the `onResponse` option or by
`mailRp.lastResponse` (last response received; with concurrent calls, prefer `onResponse`).

## Development

```bash
npm install
npm test           # node:test, directly on the TypeScript sources (Node ≥ 22.18)
npm run typecheck
npm run build      # dist/esm + dist/cjs + declarations
```

## Repository

This GitHub repository is a read-only mirror: the code is maintained in the Mail RP repository (`sdk/js`) and
published here with each release. Please open issues here; pull requests cannot be merged directly into this mirror.

## License

[MIT](LICENSE) © Xelyos
