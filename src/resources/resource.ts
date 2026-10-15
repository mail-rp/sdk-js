import type { Requester } from '../http.ts';
import type { Page, SearchQuery } from '../types.ts';

/** Largest page the API accepts. */
export const MAX_LIMIT = 100;

export abstract class Resource {
    protected readonly requester: Requester;

    constructor(requester: Requester) {
        this.requester = requester;
    }
}

/**
 * Fetches the pages one after the other and yields every row, until the total is reached.
 *
 * @internal
 */
export async function* paginate<T, Q extends SearchQuery>(
    fetchPage: (query: Q) => Promise<Page<T>>,
    query: Q
): AsyncGenerator<T, void, undefined> {
    const limit = query.limit ?? MAX_LIMIT;
    let offset = query.offset ?? 0;

    while (true) {
        const page = await fetchPage({ ...query, limit, offset });
        yield* page.rows;
        offset += page.rows.length;
        if (page.rows.length === 0 || offset >= page.total) return;
    }
}

/** Turns `{total, rows: [{email}]}` into `{total, rows: [email]}`. */
export function emails(page: Page<{ email: string }>): Page<string> {
    return { total: page.total, rows: page.rows.map((row) => row.email) };
}
