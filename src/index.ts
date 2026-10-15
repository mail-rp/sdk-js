export { MailRpClient, DEFAULT_BASE_URL, type ClientOptions } from './client.ts';
export {
    ApiError,
    AuthenticationError,
    ConflictError,
    ConnectionError,
    MailRpError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
    ServerError,
    ServiceUnavailableError,
    UnexpectedResponseError,
    ValidationError,
    type ApiErrorDetails,
} from './errors.ts';
export { formatDate, type ResponseMeta } from './http.ts';
export { VERSION } from './version.ts';
export * from './types.ts';
export type { CalendarEventResource, CalendarInviteResource, CalendarResource } from './resources/calendars.ts';
export type { DomainResource } from './resources/domains.ts';
export type {
    NewsletterResource,
    NewsletterSenderResource,
    NewsletterSubscriptionResource,
} from './resources/newsletters.ts';
export type { ServerResource, SystemResource } from './resources/system.ts';
export type {
    AliasResource,
    ContactResource,
    MailResource,
    RedirectionResource,
    UserCalendarResource,
    UserEventResource,
    UserResource,
} from './resources/users.ts';
