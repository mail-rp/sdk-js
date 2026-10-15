import { path, type Requester } from '../http.ts';
import type {
    Newsletter,
    NewsletterSender,
    NewsletterSubscription,
    NewsletterWithSenders,
    Page,
    SearchQuery,
} from '../types.ts';
import { paginate, Resource } from './resource.ts';

/** Users allowed to send mails to the subscribers of a newsletter. */
export class NewsletterSenderResource extends Resource {
    /** `domain_newsletter.read`; search on the address, name or firstname, sort `email`. */
    search(newsletterCode: string, query: SearchQuery = {}): Promise<Page<NewsletterSender>> {
        return this.requester.json('GET', path`/newsletter/${newsletterCode}/sender/search`, { query });
    }

    iterate(newsletterCode: string, query: SearchQuery = {}): AsyncGenerator<NewsletterSender, void, undefined> {
        return paginate((q) => this.search(newsletterCode, q), query);
    }

    /** `domain_newsletter.update` */
    add(newsletterCode: string, email: string): Promise<NewsletterSender> {
        return this.requester.json('POST', path`/newsletter/${newsletterCode}/sender/add`, { body: { email } });
    }

    /** `domain_newsletter.update` */
    remove(newsletterCode: string, email: string): Promise<void> {
        return this.requester.empty('DELETE', path`/newsletter/${newsletterCode}/sender/${email}`);
    }
}

/** Subscribers of a newsletter. */
export class NewsletterSubscriptionResource extends Resource {
    /** `domain_newsletter_subscription.read`; search on the address, sort `email`. */
    search(newsletterCode: string, query: SearchQuery = {}): Promise<Page<NewsletterSubscription>> {
        return this.requester.json('GET', path`/newsletter/${newsletterCode}/subscription/search`, { query });
    }

    iterate(newsletterCode: string, query: SearchQuery = {}): AsyncGenerator<NewsletterSubscription, void, undefined> {
        return paginate((q) => this.search(newsletterCode, q), query);
    }

    /** `domain_newsletter_subscription.create` */
    add(newsletterCode: string, email: string): Promise<NewsletterSubscription> {
        return this.requester.json('POST', path`/newsletter/${newsletterCode}/subscription/add`, { body: { email } });
    }

    /** `domain_newsletter_subscription.delete` */
    remove(newsletterCode: string, email: string): Promise<void> {
        return this.requester.empty('DELETE', path`/newsletter/${newsletterCode}/subscription/${email}`);
    }
}

/** Newsletters of the server, identified by their code (limited to the domains of the key). */
export class NewsletterResource extends Resource {
    readonly senders: NewsletterSenderResource;
    readonly subscriptions: NewsletterSubscriptionResource;

    constructor(requester: Requester) {
        super(requester);
        this.senders = new NewsletterSenderResource(requester);
        this.subscriptions = new NewsletterSubscriptionResource(requester);
    }

    /** `domain_newsletter.search`; search on the name, code or domain, sort `name`, `code`. */
    search(query: SearchQuery = {}): Promise<Page<Newsletter>> {
        return this.requester.json('GET', '/newsletter/search', { query });
    }

    iterate(query: SearchQuery = {}): AsyncGenerator<Newsletter, void, undefined> {
        return paginate((q) => this.search(q), query);
    }

    /** `domain_newsletter.read` */
    get(newsletterCode: string): Promise<Newsletter> {
        return this.requester.json('GET', path`/newsletter/${newsletterCode}`);
    }

    /** Creates a newsletter on a private domain (`domain_newsletter.create`). */
    create(domainName: string, name: string): Promise<NewsletterWithSenders> {
        return this.requester.json('POST', '/newsletter/add', { body: { domain: domainName, name } });
    }

    /** Renames a newsletter (`domain_newsletter.update`). */
    update(newsletterCode: string, name: string): Promise<NewsletterWithSenders> {
        return this.requester.json('PUT', path`/newsletter/${newsletterCode}`, { body: { name } });
    }

    /** `domain_newsletter.delete` */
    delete(newsletterCode: string): Promise<void> {
        return this.requester.empty('DELETE', path`/newsletter/${newsletterCode}`);
    }
}
