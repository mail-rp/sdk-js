/*
 * Shapes of the data exchanged with the API. Dates are returned as strings: ISO 8601 with offset for the
 * `createdAt` / `updatedAt` fields, `YYYY-MM-DD HH:mm` in the time zone of the server for the events.
 */

/** Colour of a calendar (events inherit the colour of their calendar). */
export const Color = {
    Primary: 'primary',
    Success: 'success',
    Warning: 'warning',
    Danger: 'danger',
    Info: 'info',
} as const;
export type Color = (typeof Color)[keyof typeof Color];

/** Icon of a calendar event (Bootstrap Icons classes). */
export const EventIcon = {
    Calendar: 'bi-calendar-event',
    People: 'bi-people',
    Call: 'bi-telephone',
    Video: 'bi-camera-video',
    Appointment: 'bi-calendar-check',
    Gift: 'bi-gift',
    Task: 'bi-check2-square',
    Reminder: 'bi-bell',
    Meal: 'bi-cup-hot',
    Travel: 'bi-airplane',
    Sport: 'bi-trophy',
    Training: 'bi-mortarboard',
    Important: 'bi-star',
    Work: 'bi-briefcase',
    Home: 'bi-house-door',
    Health: 'bi-heart-pulse',
} as const;
export type EventIcon = (typeof EventIcon)[keyof typeof EventIcon];

/** Frequency of a repeated event. */
export const RepeatFrequency = {
    Weekly: 'weekly',
    Monthly: 'monthly',
} as const;
export type RepeatFrequency = (typeof RepeatFrequency)[keyof typeof RepeatFrequency];

/** Date sent to the API: a `Date` (formatted in local time) or a `YYYY-MM-DD` / `YYYY-MM-DD HH:mm` string. */
export type DateInput = Date | string;

// ---------------------------------------------------------------------------------------------------------------
// Search

export interface SearchQuery {
    /** Text to look for (the searched fields depend on the resource) */
    search?: string;
    /** 1 to 100 (10 by default on the API side; page size of `iterate()`, 100 by default) */
    limit?: number;
    /** Number of items to skip */
    offset?: number;
    /** Sort field (whitelist per resource) */
    sort?: string;
    order?: 'asc' | 'desc';
}

export interface EventSearchQuery extends SearchQuery {
    sort?: 'start' | 'end' | 'title';
}

export interface UserEventSearchQuery extends EventSearchQuery {
    /** Only the events of this calendar (uuid) */
    calendar?: string;
}

/** One page of a search. */
export interface Page<T> {
    /** Number of items matching the search, every page included */
    total: number;
    /** Items of this page */
    rows: T[];
}

// ---------------------------------------------------------------------------------------------------------------
// Responses

export interface Health {
    status: string;
    version: string;
}

export interface ApiKeyInfo {
    message: string;
    key: {
        name: string;
        description: string | null;
        /** Language of the messages returned by the API for this key */
        locale: string;
        /** Only with `checkKey(true)` (e.g. `domain.read`, `user_mail.create`) */
        permissions?: string[];
    };
}

export interface Server {
    name: string;
    status: 'online' | 'coming_soon';
    discordId: string | null;
    url: string;
    logo: string | null;
    createdAt: string;
    updatedAt: string | null;
    /** Activated domains */
    domains: { total: number };
    users: { total: number };
    mails: { total: number };
}

export interface PublicInformation {
    title?: string | null;
    description?: string | null;
}

export interface User {
    email: string;
    name: string;
    firstname: string;
    activated: boolean;
    createdAt: string;
    updatedAt: string | null;
    /** Avatar URL (not returned for the senders of a newsletter) */
    avatar?: string | null;
    publicInformation: PublicInformation | null;
}

export interface CreatedUser extends User {
    /** Link to choose a password, only after a creation with `invite: true` */
    inviteLink?: string;
}

export interface DomainManager {
    email: string;
    name: string;
    firstname: string;
    activated: boolean;
    avatar: string | null;
}

export interface Domain {
    name: string;
    title: string | null;
    public: boolean;
    activated: boolean;
    addressBook: boolean;
    /** Logo URL */
    logo: string | null;
    usersCount: number;
    newslettersCount: number;
    /** Manager of the domain (private domains only) */
    manager: DomainManager | null;
    createdAt: string;
    updatedAt: string | null;
}

export interface UserSummary {
    email: string;
    name: string;
    firstname: string;
}

/** Calendar as returned by the search of the calendars of a user. */
export interface CalendarSummary {
    uuid: string;
    name: string;
    color: Color;
}

export interface Calendar extends CalendarSummary {
    createdAt: string;
    updatedAt: string | null;
    /** Owner of the calendar */
    user: UserSummary;
}

export interface CalendarEvent {
    uuid: string;
    title: string;
    description: string;
    location: string;
    allDay: boolean;
    /** Inherited from the calendar */
    color: Color;
    /** `YYYY-MM-DD HH:mm`, time zone of the server */
    start: string;
    /** `YYYY-MM-DD HH:mm`, time zone of the server */
    end: string;
    calendar: { uuid: string; name: string } | null;
    /** Shared by every occurrence of a repeated event */
    reference: string | null;
}

/** Member of a calendar. */
export interface CalendarInvite {
    user: UserSummary;
    /** Whether the member can manage the calendar */
    manager: boolean;
    /** Whether the member accepted the invitation */
    accepted: boolean;
}

export interface InviteResult {
    /** Addresses invited */
    invited: string[];
    /** Addresses ignored (unknown, disabled, owner of the calendar, outside the key domains) */
    ignored: string[];
}

export interface Contact {
    name: string;
    email: string;
}

export interface Newsletter {
    /** Mails sent to `<code>@newsletter` reach every subscriber */
    code: string;
    name: string;
    /** Domain name */
    domain: string;
}

/** Newsletter as returned after a creation or an update. */
export interface NewsletterWithSenders extends Newsletter {
    /** Addresses allowed to send to the newsletter */
    emails: string[];
}

/** Sender of a newsletter. */
export type NewsletterSender = Omit<User, 'avatar'>;

export interface NewsletterSubscription {
    email: string;
    createdAt: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Inputs

export interface NewUserInput {
    email: string;
    name: string;
    firstname: string;
    password: string;
    publicInformation?: PublicInformation | null;
}

export interface DomainCreateInput {
    name: string;
    title?: string | null;
    public?: boolean | null;
    addressBook?: boolean | null;
    /** Required for a private domain: the manager is created with the domain */
    manager?: NewUserInput | null;
}

export interface DomainUpdateInput {
    title?: string | null;
    /** Making the domain public removes its manager and its address book */
    public?: boolean | null;
    addressBook?: boolean | null;
    /** Address of an existing user of the domain, or a new user */
    manager?: string | NewUserInput | null;
}

export interface UserCreateInput {
    /** The domain is taken from the address */
    email: string;
    name: string;
    firstname: string;
    /** Not needed with `invite: true` */
    password?: string;
    /** Generate the password and return an `inviteLink` for the user to choose their own */
    invite?: boolean;
    publicInformation?: PublicInformation | null;
}

export interface UserUpdateInput {
    name: string;
    firstname: string;
    publicInformation?: PublicInformation | null;
}

export interface CalendarInput {
    name: string;
    color?: Color | null;
}

export interface ContactInput {
    name: string;
    email: string;
}

export interface EventInput {
    title: string;
    start: DateInput;
    end: DateInput;
    /** Markdown */
    description?: string | null;
    location?: string | null;
    icon?: EventIcon | null;
    allDay?: boolean;
    /** Invited by mail; addresses that are not users of the server (or outside the key domains) are ignored */
    requiredParticipants?: string[];
    optionalParticipants?: string[];
}

export interface RepeatInput {
    start: DateInput;
    end: DateInput;
    frequency?: RepeatFrequency;
    monday?: boolean;
    tuesday?: boolean;
    wednesday?: boolean;
    thursday?: boolean;
    friday?: boolean;
    saturday?: boolean;
    sunday?: boolean;
}

export interface EventCreateInput extends EventInput {
    /** Weekly: at least one day; at most 366 occurrences. The first occurrence is returned. */
    repeat?: RepeatInput | null;
}

export interface EventUpdateInput extends EventInput {
    /** Repeated event: change every occurrence */
    applyAll?: boolean;
    /** Repeated event: change this occurrence and the following ones */
    applyAllNext?: boolean;
}

export interface EventDeleteOptions {
    /** Repeated event: delete every occurrence */
    applyAll?: boolean;
    /** Repeated event: delete this occurrence and the following ones */
    applyAllNext?: boolean;
}

export interface MailAttachment {
    /** `http(s)://` URL of the file */
    url: string;
    name?: string | null;
}

export interface MailEventInput {
    title: string;
    start: DateInput;
    end: DateInput;
    description?: string | null;
    location?: string | null;
    icon?: EventIcon | null;
    allDay?: boolean;
    /** `true`: the `to` recipients become required participants and the `cc` ones optional participants */
    requiredParticipants?: boolean;
    /** Calendar of the event (personal calendar of the sender by default) */
    calendarUuid?: string | null;
}

export interface MailInput {
    /** One address or a list; `code@newsletter` targets the subscribers of a newsletter */
    to: string | string[];
    subject: string;
    /** Address of the user (default) or one of their active aliases */
    from?: string | null;
    cc?: string | string[];
    /** HTML */
    content?: string | null;
    openConfirmation?: boolean;
    priority?: boolean;
    attachments?: Array<string | MailAttachment>;
    event?: MailEventInput | null;
}
