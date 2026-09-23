import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { createRequestActivity, trackRequests } from './requestActivity.js';

function setup() {
    const waiting = [];
    const activity = createRequestActivity();
    const client = axios.create({ adapter: config => new Promise((resolve, reject) => waiting.push({
        config,
        resolve: () => resolve({ data: {}, status: 200, headers: {}, config }),
        reject: code => reject(new axios.AxiosError('Request failed', code, config)),
    })) });
    trackRequests(client, activity);
    return { client, activity, waiting };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('global action feedback clears when only screen-owned reads remain', async () => {
    const { client, activity, waiting } = setup();
    const read = client.get('/records');
    const save = client.post('/records', {});
    await tick();
    assert.deepEqual(activity.getSnapshot(), { count: 2, message: 'Saving changes...' });
    waiting[1].resolve();
    await save;
    assert.deepEqual(activity.getSnapshot(), { count: 1, message: '' });
    waiting[0].resolve();
    await read;
    assert.equal(activity.getSnapshot().count, 0);
});

test('failures, timeouts and cancellation always release the activity indicator', async () => {
    for (const code of ['ERR_NETWORK', 'ECONNABORTED', 'ERR_BAD_RESPONSE']) {
        const { client, activity, waiting } = setup();
        const request = client.get('/records');
        const rejected = assert.rejects(request);
        await tick();
        waiting[0].reject(code);
        await rejected;
        assert.equal(activity.getSnapshot().count, 0);
    }
    const { client, activity, waiting } = setup();
    const controller = new AbortController();
    const request = client.get('/records', { signal: controller.signal });
    const rejected = assert.rejects(request, { code: 'ERR_CANCELED' });
    await tick();
    controller.abort();
    waiting[0].resolve();
    await rejected;
    assert.equal(activity.getSnapshot().count, 0);
});

test('upload/download labels and repeated cleanup preserve pending request count', () => {
    const activity = createRequestActivity();
    const download = activity.begin({ responseType: 'blob' });
    assert.equal(activity.getSnapshot().message, 'Downloading file...');
    const upload = activity.begin({ method: 'post', data: new FormData() });
    assert.equal(activity.getSnapshot().message, 'Uploading file...');
    upload();
    upload();
    assert.equal(activity.getSnapshot().count, 1);
    download();
    assert.deepEqual(activity.getSnapshot(), { count: 0, message: '' });
});
