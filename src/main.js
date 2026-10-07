const { app, BrowserWindow, dialog, ipcMain, Notification, shell } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { promisify } = require("node:util");
const {
  birthdayOccurrenceTomorrow,
  birthdayMailto,
  birthdayToastXml,
  isValidEmail,
} = require("./birthday-reminders");

const CONTACT_FIELDS = ["firstName", "lastName", "email", "phone", "company", "birthday", "address", "notes"];
const VISIBLE_FIELD_OPTIONS = ["email", "phone", "company", "birthday", "address", "notes"];
const execFileAsync = promisify(execFile);
const CSV_HEADERS = {
  name: ["name", "fullname", "contactname"],
  firstName: ["firstname", "givenname"],
  lastName: ["lastname", "familyname", "surname"],
  email: ["email", "emailaddress"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber"],
  company: ["company", "organization", "organisation"],
  birthday: ["birthday", "dateofbirth"],
  address: ["address", "streetaddress"],
  notes: ["notes", "note"],
  favorite: ["favorite", "favourite"],
  reachout: ["reachout"],
};
let contacts = [];
let dataFile;
let preferencesFile;
let theme = "light";
let visibleFields = ["email", "phone"];
let sidebarWidth = 248;
let sidebarCollapsed = false;
let reminderStateFile;
let reminderCheckPromise = null;
let appReadyForRequests = false;
const isBirthdayReminderTask = process.argv.includes("--birthday-reminders");
const pendingSecondInstances = [];

app.setAppUserModelId("com.iaa.reachout");
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", (_event, commandLine) => {
  const isReminderTask = commandLine.includes("--birthday-reminders");
  if (!appReadyForRequests) {
    pendingSecondInstances.push(isReminderTask);
    return;
  }
  handleSecondInstance(isReminderTask).catch(showReminderError);
});

// Write through a temporary file so an interrupted save does not leave partial JSON.
async function persistContacts(nextContacts) {
  const temporaryFile = `${dataFile}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(nextContacts, null, 2), "utf8");
  await fs.rename(temporaryFile, dataFile);
}

async function loadContacts() {
  try {
    const contents = await fs.readFile(dataFile, "utf8");
    const parsed = JSON.parse(contents);
    // Validate the fields used by the UI before accepting data from disk.
    if (!Array.isArray(parsed) || !parsed.every((contact) => (
      contact && typeof contact.id === "string" &&
      (typeof contact.name === "string" || typeof contact.firstName === "string")
    ))) {
      throw new Error("Saved contacts data is invalid.");
    }
    contacts = parsed.map((contact) => ({
      ...contact,
      ...normalizeContact(contact),
    }));
    if (parsed.some((contact) => (
      typeof contact.firstName !== "string" || typeof contact.lastName !== "string" ||
      typeof contact.reachout !== "boolean"
    ))) {
      await persistContacts(contacts);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      // Initialize an empty address book on first launch.
      contacts = [];
      await persistContacts(contacts);
      return;
    }
    throw error;
  }
}

async function loadPreferences() {
  try {
    const contents = await fs.readFile(preferencesFile, "utf8");
    const preferences = JSON.parse(contents);
    if (preferences.theme === "dark" || preferences.theme === "light") {
      theme = preferences.theme;
    }
    if (Array.isArray(preferences.visibleFields)) {
      visibleFields = VISIBLE_FIELD_OPTIONS.filter((field) => preferences.visibleFields.includes(field));
    }
    if (Number.isInteger(preferences.sidebarWidth) && preferences.sidebarWidth >= 180 && preferences.sidebarWidth <= 360) {
      sidebarWidth = preferences.sidebarWidth;
    }
    if (typeof preferences.sidebarCollapsed === "boolean") {
      sidebarCollapsed = preferences.sidebarCollapsed;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function showReminderError(error) {
  dialog.showErrorBox("ReachOut birthday reminder error", error.message || String(error));
}

function draftBirthdayEmail(contact) {
  shell.openExternal(birthdayMailto(contact)).catch(showReminderError);
}

function showBirthdayNotification(contact) {
  const hasEmail = isValidEmail(contact.email);
  const title = `${contact.name}'s birthday is tomorrow`;
  const body = hasEmail
    ? "Send them birthday wishes with a quick email."
    : "Add an email address to this contact to draft a birthday email.";
  const options = {
    title,
    body,
    actions: hasEmail && process.platform === "darwin"
      ? [{ type: "button", text: "Draft Birthday Email" }]
      : [],
  };

  if (process.platform === "win32") {
    options.toastXml = birthdayToastXml(contact);
  }

  try {
    const notification = new Notification(options);
    if (process.platform === "darwin") {
      notification.on("action", (_event, actionIndex) => {
        if (actionIndex === 0 && hasEmail) draftBirthdayEmail(contact);
      });
    }
    notification.on("failed", (_event, error) => showReminderError(error));
    notification.show();
    return true;
  } catch (error) {
    showReminderError(error);
    return false;
  }
}

async function checkBirthdayReminders() {
  if (reminderCheckPromise) return reminderCheckPromise;
  reminderCheckPromise = (async () => {
    if (!Notification.isSupported()) {
      throw new Error("Desktop notifications are not supported on this system.");
    }

    const today = new Date();
    const notifiedOccurrences = new Map();
    try {
      const state = JSON.parse(await fs.readFile(reminderStateFile, "utf8"));
      if (state.notifiedOccurrences && typeof state.notifiedOccurrences === "object" &&
          !Array.isArray(state.notifiedOccurrences)) {
        for (const [contactId, occurrence] of Object.entries(state.notifiedOccurrences)) {
          if (typeof occurrence === "string") notifiedOccurrences.set(contactId, occurrence);
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    let stateChanged = false;
    for (const contact of contacts) {
      const occurrence = birthdayOccurrenceTomorrow(contact.birthday, today);
      if (!occurrence || notifiedOccurrences.get(contact.id) === occurrence) continue;
      if (!showBirthdayNotification(contact)) continue;
      notifiedOccurrences.set(contact.id, occurrence);
      stateChanged = true;
    }

    if (!stateChanged) return;
    const temporaryFile = `${reminderStateFile}.tmp`;
    await fs.writeFile(
      temporaryFile,
      JSON.stringify({ notifiedOccurrences: Object.fromEntries(notifiedOccurrences) }, null, 2),
      "utf8",
    );
    await fs.rename(temporaryFile, reminderStateFile);
  })();
  try {
    await reminderCheckPromise;
  } finally {
    reminderCheckPromise = null;
  }
}

function scheduleNextBirthdayCheck() {
  const now = new Date();
  const nextCheck = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  if (nextCheck <= now) nextCheck.setDate(nextCheck.getDate() + 1);
  setTimeout(() => {
    checkBirthdayReminders()
      .catch(showReminderError)
      .finally(scheduleNextBirthdayCheck);
  }, nextCheck.getTime() - now.getTime());
}

function requestBirthdayReminderCheck() {
  checkBirthdayReminders().catch(showReminderError);
}

async function registerBirthdayReminderTask() {
  if (process.platform !== "win32") return;

  const commandParts = [`"${process.execPath}"`];
  if (!app.isPackaged) commandParts.push(`"${app.getAppPath()}"`);
  commandParts.push("--birthday-reminders");
  await execFileAsync("schtasks.exe", [
    "/Create",
    "/F",
    "/SC", "DAILY",
    "/ST", "09:00",
    "/TN", "ReachOut Birthday Reminders",
    "/TR", commandParts.join(" "),
    "/RL", "LIMITED",
    "/IT",
  ], { windowsHide: true, timeout: 15000 });
}

async function handleSecondInstance(isReminderTask) {
  if (isReminderTask) {
    await checkBirthdayReminders();
    return;
  }
  openMainWindow();
}

function openMainWindow() {
  const existingWindow = BrowserWindow.getAllWindows()[0];
  if (existingWindow) {
    existingWindow.show();
    existingWindow.focus();
    return;
  }
  createWindow();
}

async function savePreferences(nextPreferences) {
  const temporaryFile = `${preferencesFile}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(nextPreferences, null, 2), "utf8");
  await fs.rename(temporaryFile, preferencesFile);
}

function normalizeContact(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Contact details are invalid.");
  }

  const contact = Object.fromEntries(
    // Copy only known fields so callers cannot persist arbitrary properties.
    CONTACT_FIELDS.map((field) => [
      field,
      typeof input[field] === "string" ? input[field].trim() : "",
    ]),
  );
  if (!contact.firstName && typeof input.name === "string") {
    const [firstName = "", ...lastName] = input.name.trim().split(/\s+/);
    contact.firstName = firstName;
    contact.lastName = lastName.join(" ");
  }
  contact.name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  contact.favorite = input.favorite === true;
  contact.reachout = input.reachout === true;

  if (!contact.firstName) {
    throw new Error("A first name is required.");
  }

  return contact;
}

function parseCSV(contents) {
  const rows = [];
  let cells = [];
  let value = "";
  let quoted = false;
  let afterQuote = false;
  let line = 1;
  let rowLine = 1;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];

    if (quoted) {
      if (character === '"') {
        if (contents[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && contents[index + 1] === "\n") index += 1;
        value += "\n";
        line += 1;
      } else {
        value += character;
      }
      continue;
    }

    if (afterQuote && character !== "," && character !== "\r" && character !== "\n" && !/\s/.test(character)) {
      throw new Error(`Unexpected character after a quoted value on line ${line}.`);
    }
    if (character === '"' && value.length === 0 && !afterQuote) {
      quoted = true;
    } else if (character === '"' && !afterQuote) {
      throw new Error(`Unexpected quote in an unquoted value on line ${line}.`);
    } else if (character === "," || character === "\r" || character === "\n") {
      cells.push(value.trim());
      value = "";
      afterQuote = false;
      if (character !== ",") {
        if (character === "\r" && contents[index + 1] === "\n") index += 1;
        if (cells.some(Boolean)) rows.push({ cells, line: rowLine });
        cells = [];
        line += 1;
        rowLine = line;
      }
    } else if (!afterQuote) {
      value += character;
    }
  }

  if (quoted) {
    throw new Error(`A quoted value is not closed (started on line ${rowLine}).`);
  }
  if (value.length || cells.length) {
    cells.push(value.trim());
    if (cells.some(Boolean)) rows.push({ cells, line: rowLine });
  }
  return rows;
}

function normalizeHeader(header) {
  return header.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function findColumn(headers, aliases, matchesHeader) {
  const index = headers.findIndex((header) => (
    aliases.includes(header) || matchesHeader?.(header)
  ));
  return index === -1 ? null : index;
}

function parseImportedContacts(contents) {
  const rows = parseCSV(contents.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    throw new Error("The CSV must contain a header row and at least one contact.");
  }

  const headers = rows[0].cells.map(normalizeHeader);
  const columns = Object.fromEntries(
    Object.entries(CSV_HEADERS).map(([field, aliases]) => [
      field,
      findColumn(headers, aliases, {
        email: (header) => header.startsWith("email") && header.endsWith("value"),
        phone: (header) => header.startsWith("phone") && header.endsWith("value"),
        company: (header) => /^(organization|organisation)\d*name$/.test(header),
        address: (header) => /^address\d*(formatted|value)$/.test(header),
      }[field]),
    ]),
  );
  if (columns.name === null && columns.firstName === null) {
    throw new Error("Add a Name or First Name column, then try again.");
  }

  const imported = [];
  const skipped = [];
  for (const row of rows.slice(1)) {
    const valueAt = (column) => column === null ? "" : row.cells[column] || "";
    const [fullNameFirst = "", ...fullNameLast] = valueAt(columns.name).trim().split(/\s+/);
    const firstName = valueAt(columns.firstName) || fullNameFirst;
    const lastName = valueAt(columns.lastName) || fullNameLast.join(" ");
    if (!firstName) {
      skipped.push(row.line);
      continue;
    }
    const favoriteValue = valueAt(columns.favorite).toLocaleLowerCase();
    imported.push(normalizeContact({
      firstName,
      lastName,
      email: valueAt(columns.email),
      phone: valueAt(columns.phone),
      company: valueAt(columns.company),
      birthday: valueAt(columns.birthday),
      address: valueAt(columns.address),
      notes: valueAt(columns.notes),
      favorite: ["true", "yes", "1", "favorite", "favourite"].includes(favoriteValue),
      reachout: ["true", "yes", "1"].includes(valueAt(columns.reachout).toLocaleLowerCase()),
    }));
  }

  if (!imported.length) {
    throw new Error("No contacts with a name were found in this CSV.");
  }
  return { imported, skipped };
}

function escapeCSV(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function serializeContactsCSV(contactList) {
  const fields = [
    ["First Name", "firstName"],
    ["Last Name", "lastName"],
    ["Email", "email"],
    ["Phone", "phone"],
    ["Company", "company"],
    ["Birthday", "birthday"],
    ["Address", "address"],
    ["Notes", "notes"],
    ["Favorite", "favorite"],
    ["ReachOut", "reachout"],
  ];
  const rows = [
    fields.map(([header]) => header),
    ...contactList.map((contact) => fields.map(([, field]) => (
      field === "favorite" ? (contact.favorite ? "true" : "false") : contact[field]
    ))),
  ];
  return `\uFEFF${rows.map((row) => row.map(escapeCSV).join(",")).join("\r\n")}\r\n`;
}

// These handlers are the renderer's narrow, validated interface to contact data.
ipcMain.handle("contacts:list", () => contacts);

ipcMain.handle("contacts:compose-email", async (_event, recipient) => {
  if (typeof recipient !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim())) {
    throw new Error("This contact doesn't have a valid email address.");
  }
  await shell.openExternal(`mailto:${encodeURIComponent(recipient.trim())}`);
});

ipcMain.handle("contacts:create", async (_event, input) => {
  const now = new Date().toISOString();
  const contact = {
    ...normalizeContact(input),
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const nextContacts = [contact, ...contacts];
  // Persist first so a failed disk write cannot report an unsaved change as successful.
  await persistContacts(nextContacts);
  contacts = nextContacts;
  requestBirthdayReminderCheck();
  return contact;
});

ipcMain.handle("contacts:update", async (_event, id, input) => {
  const existing = contacts.find((contact) => contact.id === id);
  if (!existing) {
    throw new Error("This contact no longer exists.");
  }

  const updatedContact = {
    ...existing,
    ...normalizeContact(input),
    reachout: existing.reachout,
    updatedAt: new Date().toISOString(),
  };
  const nextContacts = contacts.map((contact) => (contact.id === id ? updatedContact : contact));
  await persistContacts(nextContacts);
  contacts = nextContacts;
  requestBirthdayReminderCheck();
  return updatedContact;
});

ipcMain.handle("contacts:delete", async (_event, id) => {
  if (!contacts.some((contact) => contact.id === id)) {
    throw new Error("This contact no longer exists.");
  }
  const nextContacts = contacts.filter((contact) => contact.id !== id);
  await persistContacts(nextContacts);
  contacts = nextContacts;
  return id;
});

ipcMain.handle("contacts:toggle-favorite", async (_event, id) => {
  const existing = contacts.find((contact) => contact.id === id);
  if (!existing) {
    throw new Error("This contact no longer exists.");
  }
  const updatedContact = {
    ...existing,
    favorite: !existing.favorite,
    updatedAt: new Date().toISOString(),
  };
  const nextContacts = contacts.map((contact) => (contact.id === id ? updatedContact : contact));
  await persistContacts(nextContacts);
  contacts = nextContacts;
  return updatedContact;
});

ipcMain.handle("contacts:toggle-reachout", async (_event, id) => {
  const existing = contacts.find((contact) => contact.id === id);
  if (!existing) {
    throw new Error("This contact no longer exists.");
  }
  const updatedContact = {
    ...existing,
    reachout: !existing.reachout,
    updatedAt: new Date().toISOString(),
  };
  const nextContacts = contacts.map((contact) => (contact.id === id ? updatedContact : contact));
  await persistContacts(nextContacts);
  contacts = nextContacts;
  return updatedContact;
});

ipcMain.handle("contacts:import-csv", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
    title: "Import contacts from CSV",
    properties: ["openFile"],
    filters: [{ name: "CSV files", extensions: ["csv"] }],
  });
  if (canceled || !filePaths[0]) {
    return { canceled: true, imported: 0, skipped: [] };
  }

  const contents = await fs.readFile(filePaths[0], "utf8");
  const { imported, skipped } = parseImportedContacts(contents);
  const now = new Date().toISOString();
  const newContacts = imported.map((contact) => ({
    ...contact,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  }));
  const nextContacts = [...newContacts, ...contacts];
  await persistContacts(nextContacts);
  contacts = nextContacts;
  requestBirthdayReminderCheck();
  return { canceled: false, imported: newContacts.length, skipped };
});

ipcMain.handle("contacts:export-csv", async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
    title: "Export contacts as CSV",
    defaultPath: "reachout-contacts.csv",
    filters: [{ name: "CSV files", extensions: ["csv"] }],
  });
  if (canceled || !filePath) {
    return { canceled: true, exported: 0 };
  }

  await fs.writeFile(filePath, serializeContactsCSV(contacts), "utf8");
  return { canceled: false, exported: contacts.length };
});

ipcMain.handle("preferences:get-theme", () => theme);
ipcMain.handle("preferences:get-visible-fields", () => visibleFields);
ipcMain.handle("preferences:get-sidebar-layout", () => ({ width: sidebarWidth, collapsed: sidebarCollapsed }));

ipcMain.handle("preferences:set-sidebar-layout", async (_event, layout) => {
  if (!layout || !Number.isInteger(layout.width) || layout.width < 180 || layout.width > 360 ||
      typeof layout.collapsed !== "boolean") {
    throw new Error("Sidebar layout is invalid.");
  }
  await savePreferences({ theme, visibleFields, sidebarWidth: layout.width, sidebarCollapsed: layout.collapsed });
  sidebarWidth = layout.width;
  sidebarCollapsed = layout.collapsed;
  return { width: sidebarWidth, collapsed: sidebarCollapsed };
});

ipcMain.handle("preferences:set-visible-fields", async (_event, nextFields) => {
  if (!Array.isArray(nextFields) || nextFields.some((field) => !VISIBLE_FIELD_OPTIONS.includes(field))) {
    throw new Error("Visible contact fields are invalid.");
  }
  const nextVisibleFields = VISIBLE_FIELD_OPTIONS.filter((field) => nextFields.includes(field));
  await savePreferences({ theme, visibleFields: nextVisibleFields, sidebarWidth, sidebarCollapsed });
  visibleFields = nextVisibleFields;
  return visibleFields;
});

ipcMain.handle("preferences:set-theme", async (_event, nextTheme) => {
  if (nextTheme !== "light" && nextTheme !== "dark") {
    throw new Error("Theme must be light or dark.");
  }
  // Save preferences atomically before updating the value returned to the renderer.
  await savePreferences({ theme: nextTheme, visibleFields, sidebarWidth, sidebarCollapsed });
  theme = nextTheme;
  return theme;
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#f6f7f9",
    title: "ReachOut — Contacts",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // Keep Node APIs out of the page; preload exposes only the required IPC methods.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  // Store user data in Electron's per-user application data directory.
  const userDataPath = app.getPath("userData");
  dataFile = path.join(userDataPath, "contacts.json");
  preferencesFile = path.join(userDataPath, "preferences.json");
  reminderStateFile = path.join(userDataPath, "birthday-reminders.json");
  await loadContacts();
  await loadPreferences();
  if (!isBirthdayReminderTask) {
    createWindow();
  }
  appReadyForRequests = true;

  if (process.platform === "win32" && !isBirthdayReminderTask) {
    try {
      await registerBirthdayReminderTask();
    } catch (error) {
      dialog.showErrorBox(
        "Birthday reminders aren't scheduled",
        `ReachOut couldn't schedule the daily 9:00 AM birthday reminder task.\n\n${error.stderr?.trim() || error.message}`,
      );
    }
  }
  try {
    await checkBirthdayReminders();
  } catch (error) {
    showReminderError(error);
  }
  if (isBirthdayReminderTask) {
    app.quit();
    return;
  }
  scheduleNextBirthdayCheck();

  while (pendingSecondInstances.length) {
    await handleSecondInstance(pendingSecondInstances.shift());
  }

  app.on("activate", () => {
    // macOS commonly keeps the app running after its last window is closed.
    if (BrowserWindow.getAllWindows().length === 0) openMainWindow();
  });
}).catch((error) => {
  // Surface startup and data-file errors instead of opening with missing state.
  dialog.showErrorBox("Couldn't open ReachOut", error.message);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
