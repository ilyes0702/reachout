function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function birthdayOccurrenceTomorrow(birthday, today) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday || "");
  if (!match) return "";

  const month = Number(match[2]);
  const day = Number(match[3]);
  const referenceDate = new Date(2000, month - 1, day);
  if (referenceDate.getMonth() !== month - 1 || referenceDate.getDate() !== day) return "";

  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const birthdayThisYear = new Date(tomorrow.getFullYear(), month - 1, day);
  if (birthdayThisYear.getFullYear() !== tomorrow.getFullYear() ||
      birthdayThisYear.getMonth() !== tomorrow.getMonth() ||
      birthdayThisYear.getDate() !== tomorrow.getDate()) {
    return "";
  }
  const monthText = String(birthdayThisYear.getMonth() + 1).padStart(2, "0");
  const dayText = String(birthdayThisYear.getDate()).padStart(2, "0");
  return `${birthdayThisYear.getFullYear()}-${monthText}-${dayText}`;
}

function birthdayIsTomorrow(birthday, today) {
  return Boolean(birthdayOccurrenceTomorrow(birthday, today));
}

function birthdayMailto(contact) {
  const subject = `Happy birthday, ${contact.firstName}!`;
  return `mailto:${encodeURIComponent(contact.email.trim())}?subject=${encodeURIComponent(subject)}`;
}

function escapeXML(value) {
  return String(value).replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[character]);
}

function birthdayToastXml(contact) {
  const title = `${contact.name}'s birthday is tomorrow`;
  const hasEmail = isValidEmail(contact.email);
  const body = hasEmail
    ? "Send them birthday wishes with a quick email."
    : "Add an email address to this contact to draft a birthday email.";
  const action = hasEmail
    ? `<actions><action content="Draft Birthday Email" arguments="${escapeXML(birthdayMailto(contact))}" activationType="protocol"/></actions>`
    : "";
  return `<toast><visual><binding template="ToastGeneric"><text>${escapeXML(title)}</text><text>${escapeXML(body)}</text></binding></visual>${action}</toast>`;
}

module.exports = {
  birthdayIsTomorrow,
  birthdayOccurrenceTomorrow,
  birthdayMailto,
  birthdayToastXml,
  isValidEmail,
};
