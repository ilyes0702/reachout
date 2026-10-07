const test = require("node:test");
const assert = require("node:assert/strict");
const {
  birthdayIsTomorrow,
  birthdayOccurrenceTomorrow,
  birthdayMailto,
  birthdayToastXml,
} = require("../src/birthday-reminders");

test("matches a birthday on the next calendar day", () => {
  assert.equal(birthdayIsTomorrow("1990-10-08", new Date(2026, 9, 7, 9)), true);
  assert.equal(birthdayIsTomorrow("1990-10-09", new Date(2026, 9, 7, 9)), false);
});

test("handles month, year, and leap-day boundaries", () => {
  assert.equal(birthdayIsTomorrow("1990-01-01", new Date(2025, 11, 31, 9)), true);
  assert.equal(birthdayIsTomorrow("2000-02-29", new Date(2025, 1, 28, 9)), true);
  assert.equal(birthdayIsTomorrow("2000-02-29", new Date(2024, 1, 28, 9)), true);
  assert.equal(birthdayOccurrenceTomorrow("2000-02-29", new Date(2025, 1, 28, 9)), "2025-03-01");
});

test("ignores invalid birthday dates", () => {
  assert.equal(birthdayIsTomorrow("1990-02-30", new Date(2026, 2, 1, 9)), false);
  assert.equal(birthdayIsTomorrow("not-a-date", new Date(2026, 9, 7, 9)), false);
});

test("creates the email draft link with an encoded subject", () => {
  assert.equal(
    birthdayMailto({ email: "alex@example.com", firstName: "Alex" }),
    "mailto:alex%40example.com?subject=Happy%20birthday%2C%20Alex!",
  );
});

test("creates an escaped toast action only when an email is available", () => {
  const contact = { name: 'Alex & "Sam"', firstName: "Alex", email: "alex@example.com" };
  const xml = birthdayToastXml(contact);
  assert.match(xml, /Alex &amp; &quot;Sam&quot;&apos;s birthday is tomorrow/);
  assert.match(xml, /content="Draft Birthday Email"/);
  assert.match(xml, /activationType="protocol"/);
  assert.doesNotMatch(birthdayToastXml({ ...contact, email: "" }), /<actions>/);
});
