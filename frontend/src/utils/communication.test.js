import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPhoneForWhatsApp } from './communication.js';
import { escapeHtml } from './html.js';

test('WhatsApp handles local numbers beginning with country-code digits and international prefixes', () => {
    for (const phone of ['9123456789', '09123456789', '+91 91234 56789', '0091 9123456789', '919123456789']) {
        assert.equal(cleanPhoneForWhatsApp(phone), '919123456789');
    }
    assert.equal(cleanPhoneForWhatsApp('+44 20 7946 0958'), '442079460958');
    for (const phone of ['abc12345678', '++919123456789', '123', '', null]) assert.equal(cleanPhoneForWhatsApp(phone), '');
});

test('downloaded document fields preserve text without creating HTML', () => {
    assert.equal(escapeHtml('</title><script>alert("x")</script>'), '&lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    assert.equal(escapeHtml("A & B's address"), 'A &amp; B&#39;s address');
    assert.equal(escapeHtml(2), '2');
    assert.equal(escapeHtml(null), '');
});
