import { path, type Requester } from '../http.ts';
import type {
    Calendar,
    CalendarEvent,
    CalendarInput,
    CalendarInvite,
    DateInput,
    EventCreateInput,
    EventDeleteOptions,
    EventSearchQuery,
    EventUpdateInput,
    InviteResult,
    Page,
    SearchQuery,
} from '../types.ts';
import { paginate, Resource } from './resource.ts';

/**
 * Events of a calendar. Dates are read in the time zone of the server, as `YYYY-MM-DD HH:mm` (a `Date` is formatted
 * that way, in local time).
 */
export class CalendarEventResource extends Resource {
    /** Events of the calendar in a period (`calendar_event.search`); search on the uuid, reference or title. */
    search(
        calendarUuid: string,
        start: DateInput,
        end: DateInput,
        query: EventSearchQuery = {}
    ): Promise<Page<CalendarEvent>> {
        return this.requester.json('GET', path`/calendar/${calendarUuid}/event/search`, {
            query: { start, end, ...query },
        });
    }

    iterate(
        calendarUuid: string,
        start: DateInput,
        end: DateInput,
        query: EventSearchQuery = {}
    ): AsyncGenerator<CalendarEvent, void, undefined> {
        return paginate((q) => this.search(calendarUuid, start, end, q), query);
    }

    /** `calendar_event.read` */
    get(calendarUuid: string, eventUuid: string): Promise<CalendarEvent> {
        return this.requester.json('GET', path`/calendar/${calendarUuid}/event/${eventUuid}`);
    }

    /** Creates an event (`calendar_event.create`); participants are invited by mail. */
    create(calendarUuid: string, event: EventCreateInput): Promise<CalendarEvent> {
        return this.requester.json('POST', path`/calendar/${calendarUuid}/event/add`, { body: event });
    }

    /** Replaces an event (`calendar_event.update`). */
    update(calendarUuid: string, eventUuid: string, event: EventUpdateInput): Promise<CalendarEvent> {
        return this.requester.json('PUT', path`/calendar/${calendarUuid}/event/${eventUuid}`, { body: event });
    }

    /** `calendar_event.delete` */
    delete(calendarUuid: string, eventUuid: string, options: EventDeleteOptions = {}): Promise<void> {
        return this.requester.empty('DELETE', path`/calendar/${calendarUuid}/event/${eventUuid}`, {
            applyAll: options.applyAll || undefined,
            applyAllNext: options.applyAllNext || undefined,
        });
    }
}

/** Members of a calendar (users the calendar is shared with). */
export class CalendarInviteResource extends Resource {
    /** `calendar.read`; search on the address, name or firstname, sort `email`. */
    search(calendarUuid: string, query: SearchQuery = {}): Promise<Page<CalendarInvite>> {
        return this.requester.json('GET', path`/calendar/${calendarUuid}/invite/search`, { query });
    }

    iterate(calendarUuid: string, query: SearchQuery = {}): AsyncGenerator<CalendarInvite, void, undefined> {
        return paginate((q) => this.search(calendarUuid, q), query);
    }

    /**
     * Shares the calendar (`calendar.update`). Unknown or disabled users, the owner and users outside the key
     * domains are ignored (see `ignored`).
     *
     * @param calendarUuid
     * @param emails
     * @param manager whether the new members can manage the calendar
     */
    add(calendarUuid: string, emails: string[], manager = false): Promise<InviteResult> {
        return this.requester.json('POST', path`/calendar/${calendarUuid}/invite/add`, {
            body: { users: emails, manager },
        });
    }

    /** Changes the role of a member (`calendar.update`). */
    update(calendarUuid: string, userEmail: string, manager: boolean): Promise<CalendarInvite> {
        return this.requester.json('PUT', path`/calendar/${calendarUuid}/invite/${userEmail}`, { body: { manager } });
    }

    /** `calendar.update` */
    remove(calendarUuid: string, userEmail: string): Promise<void> {
        return this.requester.empty('DELETE', path`/calendar/${calendarUuid}/invite/${userEmail}`);
    }
}

/** Calendars, identified by their uuid (see `users.calendars` to list or create the calendars of a user). */
export class CalendarResource extends Resource {
    readonly events: CalendarEventResource;
    readonly invites: CalendarInviteResource;

    constructor(requester: Requester) {
        super(requester);
        this.events = new CalendarEventResource(requester);
        this.invites = new CalendarInviteResource(requester);
    }

    /** `calendar.read` */
    get(calendarUuid: string): Promise<Calendar> {
        return this.requester.json('GET', path`/calendar/${calendarUuid}`);
    }

    /** `calendar.update` */
    update(calendarUuid: string, data: CalendarInput): Promise<Calendar> {
        return this.requester.json('PUT', path`/calendar/${calendarUuid}`, { body: data });
    }

    /** Deletes a calendar and its events (`calendar.delete`). */
    delete(calendarUuid: string): Promise<void> {
        return this.requester.empty('DELETE', path`/calendar/${calendarUuid}`);
    }

    /** Gives the calendar to another user of the server (`calendar.update`). */
    transfer(calendarUuid: string, newOwnerEmail: string): Promise<Calendar> {
        return this.requester.json('POST', path`/calendar/${calendarUuid}/transfer`, {
            body: { email: newOwnerEmail },
        });
    }
}
