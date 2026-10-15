import { path } from '../http.ts';
import type {
    Domain,
    DomainCreateInput,
    DomainUpdateInput,
    Newsletter,
    NewsletterWithSenders,
    Page,
    SearchQuery,
    User,
} from '../types.ts';
import { paginate, Resource } from './resource.ts';

/** Domains of the server (limited to the domains of the key when it is not allowed on every domain). */
export class DomainResource extends Resource {
    /** `domain.search`; search on the name or title, sort `name`, `title`, `public`, `activated`. */
    search(query: SearchQuery = {}): Promise<Page<Domain>> {
        return this.requester.json('GET', '/domain/search', { query });
    }

    /** Iterates over every domain matching the search, page after page. */
    iterate(query: SearchQuery = {}): AsyncGenerator<Domain, void, undefined> {
        return paginate((q) => this.search(q), query);
    }

    /** `domain.read` */
    get(domainName: string): Promise<Domain> {
        return this.requester.json('GET', path`/domain/${domainName}`);
    }

    /**
     * Creates a domain (`domain.create`, needs a key allowed on every domain). A private domain needs a manager,
     * created at the same time.
     */
    create(data: DomainCreateInput): Promise<Domain> {
        return this.requester.json('POST', '/domain/add', { body: data });
    }

    /** Partial update (`domain.update`): only the given fields change. */
    update(domainName: string, data: DomainUpdateInput): Promise<Domain> {
        return this.requester.json('PATCH', path`/domain/${domainName}`, { body: data });
    }

    /** Deletes a disabled domain with its users, mails, calendars and newsletters (`domain.delete`). */
    delete(domainName: string): Promise<void> {
        return this.requester.empty('DELETE', path`/domain/${domainName}`);
    }

    /** `domain.update` */
    disable(domainName: string): Promise<Domain> {
        return this.requester.json('POST', path`/domain/${domainName}/disable`);
    }

    /** `domain.update` */
    enable(domainName: string): Promise<Domain> {
        return this.requester.json('POST', path`/domain/${domainName}/enable`);
    }

    /**
     * Users of a domain (`user.search`); search on the email, name or firstname, sort `email`, `name`, `firstname`,
     * `fullName`, `activated`, `createdAt`.
     */
    searchUsers(domainName: string, query: SearchQuery = {}): Promise<Page<User>> {
        return this.requester.json('GET', path`/domain/${domainName}/user/search`, { query });
    }

    iterateUsers(domainName: string, query: SearchQuery = {}): AsyncGenerator<User, void, undefined> {
        return paginate((q) => this.searchUsers(domainName, q), query);
    }

    /** Newsletters of a domain (`domain_newsletter.search`); search on the name or code, sort `name`, `code`. */
    searchNewsletters(domainName: string, query: SearchQuery = {}): Promise<Page<Newsletter>> {
        return this.requester.json('GET', path`/domain/${domainName}/newsletter/search`, { query });
    }

    iterateNewsletters(domainName: string, query: SearchQuery = {}): AsyncGenerator<Newsletter, void, undefined> {
        return paginate((q) => this.searchNewsletters(domainName, q), query);
    }

    /** Creates a newsletter on a private domain (`domain_newsletter.create`). */
    createNewsletter(domainName: string, name: string): Promise<NewsletterWithSenders> {
        return this.requester.json('POST', path`/domain/${domainName}/newsletter/add`, { body: { name } });
    }
}
