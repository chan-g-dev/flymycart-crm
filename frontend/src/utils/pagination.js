// Full-directory consumers must not silently truncate at the API's default page.
export async function fetchAllPages(fetchPage) {
    const rows = [];
    const limit = 500;
    let offset = 0;
    while (true) {
        const response = await fetchPage({ limit, offset });
        const items = response.data;
        if (!Array.isArray(items)) throw new Error('Invalid directory response');
        rows.push(...items);
        offset += items.length;
        const header = response.headers?.['x-total-count'];
        const total = header == null ? NaN : Number(header);
        if (!items.length || (Number.isFinite(total) ? offset >= total : items.length < limit)) break;
    }
    return rows;
}
