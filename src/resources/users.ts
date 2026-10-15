import { path, type Requester } from '../http.ts';
import type {
    Calendar,
    CalendarEvent,
    CalendarInput,
    CalendarSummary,
    Contact,
    ContactInput,
    CreatedUser,
    DateInput,
    MailInput,
    Page,
    SearchQuery,
    User,
    UserCreateInput,
    UserEventSearchQuery,
    UserUpdateInput,
} from '../types.ts';
import { emails, paginate, Resource } from './resource.ts';

/** Aliases of a user: other addresses of their domain they receive and send mails with. */
export class AliasResource extends Resource {
    /** `user_alias.search`; search on the address, sort `email`. Rows are the alias addresses. */
    async search(email: string, query: SearchQuery = {}): Promise<Page<string>> {
        return emails(await this.requester.json('GET', path`/user/${email}/alias/search`, { query }));
    }

    iterate(email: string, query: SearchQuery = {}): AsyncGenerator<string, void, undefined> {
        return paginate((q) => this.search(email, q), query);
    }

    /**
     * Adds an alias (`user_alias.create`, private domain, within the alias quota of the pack).
     *
     * @param email
     * @param alias full address, or local part completed with the domain of the user
     * @returns the full alias address
     */
    async add(email: string, alias: string): Promise<string> {
        const created = await this.requester.json<{ email: string }>('POST', path`/user/${email}/alias/add`, {
            body: { email: alias },
        });
        return created.email;
    }

    /** `user_alias.delete` */
    remove(email: string, alias: string): Promise<void> {
        return this.requester.empty('DELETE', path`/user/${email}/alias/${alias}`);
    }
}

/** Calendars of a user (own calendars and calendars shared with them). */
export class UserCalendarResource extends Resource {
    /** `calendar.search`; search on the name, sort `name`, `createdAt`. */
    search(email: string, query: SearchQuery = {}): Promise<Page<CalendarSummary>> {
        return this.requester.json('GET', path`/user/${email}/calendar/search`, { query });
    }

    iterate(email: string, query: SearchQuery = {}): AsyncGenerator<CalendarSummary, void, undefined> {
        return paginate((q) => this.search(email, q), query);
    }

    /** Creates a calendar owned by the user (`calendar.create`). */
    create(email: string, data: CalendarInput): Promise<Calendar> {
        return this.requester.json('POST', path`/user/${email}/calendar/add`, { body: data });
    }
}

/** Contacts of a user. */
export class ContactResource extends Resource {
    /** `user_contact.read`; search on the name or address, sort `name`, `email`. */
    search(email: string, query: SearchQuery = {}): Promise<Page<Contact>> {
        return this.requester.json('GET', path`/user/${email}/contact/search`, { query });
    }

    iterate(email: string, query: SearchQuery = {}): AsyncGenerator<Contact, void, undefined> {
        return paginate((q) => this.search(email, q), query);
    }

    /** Adds a contact (`user_contact.create`); refused if the address is already a contact of the user. */
    create(email: string, contact: ContactInput): Promise<Contact> {
        return this.requester.json('POST', path`/user/${email}/contact/add`, { body: contact });
    }

    /**
     * Renames a contact and/or changes its address (`user_contact.update`).
     *
     * @param contactEmail current address of the contact
     */
    update(email: string, contactEmail: string, contact: ContactInput): Promise<Contact> {
        return this.requester.json('PUT', path`/user/${email}/contact/${contactEmail}`, { body: contact });
    }

    /** `user_contact.delete` */
    delete(email: string, contactEmail: string): Promise<void> {
        return this.requester.empty('DELETE', path`/user/${email}/contact/${contactEmail}`);
    }
}

/** Events of a user (every calendar they can see, and the events they take part in). */
export class UserEventResource extends Resource {
    /**
     * Events in a period (`calendar_event.search`); search on the uuid, reference or title, sort `start`, `end`,
     * `title` (`start` ascending by default).
     */
    search(
        email: string,
        start: DateInput,
        end: DateInput,
        query: UserEventSearchQuery = {}
    ): Promise<Page<CalendarEvent>> {
        return this.requester.json('GET', path`/user/${email}/event/search`, { query: { start, end, ...query } });
    }

    iterate(
        email: string,
        start: DateInput,
        end: DateInput,
        query: UserEventSearchQuery = {}
    ): AsyncGenerator<CalendarEvent, void, undefined> {
        return paginate((q) => this.search(email, start, end, q), query);
    }
}

/** Mails sent on behalf of a user. */
export class MailResource extends Resource {
    /**
     * Sends a mail from a user (`user_mail.create`). The mail is queued: unknown recipients are reported to the
     * sender by a bounce mail, not by this call.
     *
     * @returns confirmation message of the API
     */
    async send(email: string, mail: MailInput): Promise<string> {
        const result = await this.requester.json<{ message: string }>('POST', path`/user/${email}/mail/send`, {
            body: mail,
        });
        return result.message;
    }
}

/** Redirections of a user: addresses that receive a copy of every mail the user receives. */
export class RedirectionResource extends Resource {
    /** `user_redirection.search`; search on the address, sort `email`. Rows are the redirection addresses. */
    async search(email: string, query: SearchQuery = {}): Promise<Page<string>> {
        return emails(await this.requester.json('GET', path`/user/${email}/redirection/search`, { query }));
    }

    iterate(email: string, query: SearchQuery = {}): AsyncGenerator<string, void, undefined> {
        return paginate((q) => this.search(email, q), query);
    }

    /** `user_redirection.create` (private domain, enabled user) */
    async add(email: string, redirectionEmail: string): Promise<string> {
        const created = await this.requester.json<{ email: string }>('POST', path`/user/${email}/redirection/add`, {
            body: { email: redirectionEmail },
        });
        return created.email;
    }

    /** `user_redirection.delete` */
    remove(email: string, redirectionEmail: string): Promise<void> {
        return this.requester.empty('DELETE', path`/user/${email}/redirection/${redirectionEmail}`);
    }

    /** Removes every redirection of the user (`user_redirection.delete`). */
    removeAll(email: string): Promise<void> {
        return this.requester.empty('DELETE', path`/user/${email}/redirection/all`);
    }
}

/** Users of the server, identified by their email address. */
export class UserResource extends Resource {
    readonly aliases: AliasResource;
    readonly calendars: UserCalendarResource;
    readonly contacts: ContactResource;
    readonly events: UserEventResource;
    readonly mails: MailResource;
    readonly redirections: RedirectionResource;

    constructor(requester: Requester) {
        super(requester);
        this.aliases = new AliasResource(requester);
        this.calendars = new UserCalendarResource(requester);
        this.contacts = new ContactResource(requester);
        this.events = new UserEventResource(requester);
        this.mails = new MailResource(requester);
        this.redirections = new RedirectionResource(requester);
    }

    /**
     * Searches the users of the server, limited to the domains of the key (`user.search`); search on the email,
     * name, firstname or Discord account, sort `email`, `name`, `firstname`, `fullName`, `activated`, `createdAt`.
     */
    search(query: SearchQuery = {}): Promise<Page<User>> {
        return this.requester.json('GET', '/user/search', { query });
    }

    iterate(query: SearchQuery = {}): AsyncGenerator<User, void, undefined> {
        return paginate((q) => this.search(q), query);
    }

    /** `user.read` */
    get(email: string): Promise<User> {
        return this.requester.json('GET', path`/user/${email}`);
    }

    /**
     * Creates a user; the domain is taken from the address (`user.create`). With `invite: true` the password is
     * generated and `inviteLink` lets the user choose their own.
     */
    create(data: UserCreateInput): Promise<CreatedUser> {
        return this.requester.json('POST', '/user/add', { body: data });
    }

    /** `user.update` */
    update(email: string, data: UserUpdateInput): Promise<User> {
        return this.requester.json('PUT', path`/user/${email}`, { body: data });
    }

    /** Deletes a disabled user with their mails, calendars and contacts (`user.delete`). */
    delete(email: string): Promise<void> {
        return this.requester.empty('DELETE', path`/user/${email}`);
    }

    /** `user.update` */
    disable(email: string): Promise<User> {
        return this.requester.json('POST', path`/user/${email}/disable`);
    }

    /** `user.update` (refused when the maximum number of users of the pack is reached) */
    enable(email: string): Promise<User> {
        return this.requester.json('POST', path`/user/${email}/enable`);
    }
}
