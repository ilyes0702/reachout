const elements = {
  list: document.getElementById("contact-list"),
  listTable: document.getElementById("list-table"),
  listHeader: document.getElementById("list-label-row"),
  listFooter: document.getElementById("list-footer"),
  search: document.getElementById("search-input"),
  sortPicker: document.getElementById("sort-picker-trigger"),
  sortPickerMenu: document.getElementById("sort-picker-menu"),
  dialog: document.getElementById("contact-dialog"),
  contactCardDialog: document.getElementById("contact-card-dialog"),
  contactCardTitle: document.getElementById("contact-card-title"),
  contactCardDetails: document.getElementById("contact-card-details"),
  contactCardEditButton: document.getElementById("contact-card-edit-button"),
  form: document.getElementById("contact-form"),
  dialogTitle: document.getElementById("dialog-title"),
  formError: document.getElementById("form-error"),
  saveButton: document.getElementById("save-contact-button"),
  headingCount: document.getElementById("heading-count"),
  pageTitle: document.getElementById("page-title"),
  breadcrumb: document.getElementById("breadcrumb-current"),
  allCount: document.getElementById("all-count"),
  favoriteCount: document.getElementById("favorite-count"),
  themeToggle: document.getElementById("theme-toggle"),
  themeToggleIcon: document.getElementById("theme-toggle-icon"),
  themeToggleLabel: document.getElementById("theme-toggle-label"),
  themeError: document.getElementById("theme-error"),
  importButton: document.getElementById("import-csv-button"),
  exportButton: document.getElementById("export-csv-button"),
  fieldPicker: document.getElementById("field-picker-trigger"),
  fieldPickerMenu: document.getElementById("field-picker-menu"),
  sidebar: document.querySelector(".sidebar"),
  sidebarResizeHandle: document.getElementById("sidebar-resize-handle"),
  appShell: document.querySelector(".app-shell"),
};

const visibleFieldOptions = [
  { key: "email", label: "EMAIL ADDRESS" },
  { key: "phone", label: "PHONE NUMBER" },
  { key: "company", label: "COMPANY" },
  { key: "birthday", label: "BIRTHDAY" },
  { key: "address", label: "ADDRESS" },
  { key: "notes", label: "NOTES" },
];
let currentTheme = "light";
let contacts = [];
let visibleFields = ["email", "phone"];
let activeFilter = "all";
let editingId = null;
let sortOrder = "firstName-asc";
let loadError = "";
let sidebarWidth = 248;
let sidebarCollapsed = false;
let activeCardContactId = null;

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  const isDark = theme === "dark";
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  elements.themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  elements.themeToggleIcon.textContent = isDark ? "☼" : "☾";
  elements.themeToggleLabel.textContent = isDark ? "Light mode" : "Dark mode";
}

function applySidebarLayout(layout) {
  sidebarWidth = layout.width;
  sidebarCollapsed = layout.collapsed;
  document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
  elements.appShell.classList.toggle("sidebar-collapsed", sidebarCollapsed);
  elements.sidebarResizeHandle.setAttribute("aria-valuenow", String(sidebarWidth));
  elements.sidebarResizeHandle.setAttribute("aria-valuetext", sidebarCollapsed ? "Collapsed" : `${sidebarWidth} pixels`);
}

async function saveSidebarLayout() {
  try {
    applySidebarLayout(await window.contactsAPI.setSidebarLayout({
      width: sidebarWidth,
      collapsed: sidebarCollapsed,
    }));
  } catch (error) {
    elements.listFooter.classList.add("list-footer-error");
    elements.listFooter.textContent = error.message || "Couldn't save the sidebar layout.";
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}

function colorIndexFor(contact) {
  const hash = [...contact.id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return hash % 6;
}

function setVisibleFields(fields) {
  visibleFields = visibleFieldOptions.map(({ key }) => key).filter((key) => fields.includes(key));
  elements.listTable.className = `list-table columns-${visibleFields.length}`;
  elements.listHeader.replaceChildren(
    Object.assign(document.createElement("span"), { textContent: "NAME" }),
    ...visibleFields.map((key) => {
      const header = document.createElement("span");
      header.dataset.fieldColumn = key;
      header.textContent = visibleFieldOptions.find((field) => field.key === key).label;
      return header;
    }),
    Object.assign(document.createElement("span"), { className: "actions-heading" }),
  );
  document.querySelectorAll("[data-visible-field]").forEach((checkbox) => {
    checkbox.checked = visibleFields.includes(checkbox.dataset.visibleField);
  });
}

function displayFieldValue(contact, field) {
  if (field === "birthday" && contact.birthday) {
    const date = new Date(`${contact.birthday}T00:00:00`);
    return Number.isNaN(date.getTime()) ? contact.birthday : date.toLocaleDateString();
  }
  return contact[field] || "—";
}

function visibleContacts() {
  const query = elements.search.value.trim().toLocaleLowerCase();
  return contacts
    .filter((contact) => activeFilter !== "favorites" || contact.favorite)
    .filter((contact) => !query || [
      contact.name, contact.email, contact.phone, contact.company, contact.address, contact.notes,
    ].some((value) => value?.toLocaleLowerCase().includes(query)))
    .sort((first, second) => {
      const [primaryField, direction] = sortOrder.split("-");
      const primaryComparison = (first[primaryField] || "").localeCompare(
        second[primaryField] || "",
        undefined,
        { sensitivity: "base" },
      );
      const comparison = primaryComparison || (first[primaryField === "lastName" ? "firstName" : "lastName"] || "")
        .localeCompare(second[primaryField === "lastName" ? "firstName" : "lastName"] || "", undefined, { sensitivity: "base" });
      return direction === "asc" ? comparison : -comparison;
    });
}

function render() {
  const favorites = contacts.filter((contact) => contact.favorite).length;
  const visible = visibleContacts();
  elements.allCount.textContent = contacts.length;
  elements.favoriteCount.textContent = favorites;
  elements.headingCount.textContent = visible.length;
  elements.listFooter.classList.remove("list-footer-error");
  elements.listFooter.textContent = visible.length
    ? `Showing ${visible.length} of ${contacts.length} ${contacts.length === 1 ? "contact" : "contacts"}`
    : "";

  if (activeFilter === "favorites") {
    elements.pageTitle.firstChild.textContent = "Favorites ";
    elements.breadcrumb.textContent = "Favorites";
  } else {
    elements.pageTitle.firstChild.textContent = "All contacts ";
    elements.breadcrumb.textContent = "All contacts";
  }

  elements.list.innerHTML = "";
  if (loadError) {
    elements.list.innerHTML = `<div class="list-empty"><strong>Couldn't load your contacts</strong>${escapeHTML(loadError)}</div>`;
    return;
  }
  if (!visible.length) {
    const title = elements.search.value.trim()
      ? "No contacts found"
      : activeFilter === "favorites" ? "No favorites yet" : "Your address book is ready";
    const message = elements.search.value.trim()
      ? "Try a different name, email, phone number, or company."
      : activeFilter === "favorites" ? "Mark a contact as a favorite and they'll show up here." : "Add someone to keep their details close at hand.";
    elements.list.innerHTML = `<div class="list-empty"><strong>${title}</strong>${message}</div>`;
  } else {
    elements.list.innerHTML = visible.map((contact) => {
      const colorIndex = colorIndexFor(contact);
      const fieldCells = visibleFields.map((field) => {
        const value = displayFieldValue(contact, field);
        if (field === "email" && contact.email) {
          return `<button class="contact-email email-link" type="button" data-action="email" aria-label="Write an email to ${escapeHTML(contact.name)}" title="Write an email to ${escapeHTML(contact.name)}">${escapeHTML(value)}</button>`;
        }
        return `<span class="contact-cell" title="${escapeHTML(value)}">${escapeHTML(value)}</span>`;
      }).join("");
      return `
        <div class="contact-row" data-id="${escapeHTML(contact.id)}" title="View ${escapeHTML(contact.name)}">
          <button class="contact-person contact-open-button" type="button" data-action="view" aria-label="View ${escapeHTML(contact.name)}">
            <span class="avatar avatar-tone-${colorIndex}">${escapeHTML(initials(contact.name))}</span>
            <span class="contact-name">${escapeHTML(contact.name)}</span>
          </button>
          ${fieldCells}
          <div class="contact-actions">
            <button class="row-action row-edit" type="button" data-action="edit" aria-label="Edit ${escapeHTML(contact.name)}" title="Edit contact">✎</button>
            <button class="row-action row-favorite${contact.favorite ? " is-favorite" : ""}" type="button" data-action="favorite" aria-label="${contact.favorite ? "Remove from favorites" : "Add to favorites"}" aria-pressed="${contact.favorite}">♥</button>
            <button class="row-action row-delete" type="button" data-action="delete" aria-label="Delete ${escapeHTML(contact.name)}">×</button>
          </div>
        </div>`;
    }).join("");
  }
}

function openForm(contact) {
  editingId = contact?.id ?? null;
  elements.form.reset();
  elements.formError.textContent = "";
  elements.dialogTitle.textContent = editingId ? "Edit contact" : "Add a contact";
  elements.saveButton.textContent = editingId ? "Save changes" : "Save contact";
  for (const field of elements.form.elements) {
    if (field.name && contact && field.type !== "checkbox") field.value = contact[field.name] || "";
    if (field.name === "favorite") field.checked = Boolean(contact?.favorite);
  }
  elements.dialog.showModal();
  elements.form.elements.firstName.focus();
}

function openContactCard(contact) {
  activeCardContactId = contact.id;
  elements.contactCardTitle.textContent = contact.name;
  const details = [
    ["First name", contact.firstName],
    ["Last name", contact.lastName],
    ["Email address", contact.email],
    ["Phone number", contact.phone],
    ["Company", contact.company],
    ["Birthday", contact.birthday ? displayFieldValue(contact, "birthday") : ""],
    ["Address", contact.address],
    ["Notes", contact.notes],
    ["Favorite", contact.favorite ? "Yes" : "No"],
  ];
  elements.contactCardDetails.innerHTML = details.map(([label, value]) => `
      <div class="contact-card-field">
        <span class="contact-card-label">${escapeHTML(label)}</span>
        <span class="contact-card-value">${escapeHTML(value || "—")}</span>
      </div>`).join("");
  elements.contactCardDialog.showModal();
}

async function refresh() {
  try {
    contacts = await window.contactsAPI.list();
    loadError = "";
  } catch (error) {
    loadError = error.message || "Please restart the app and try again.";
  }
  render();
}

document.getElementById("add-contact-button").addEventListener("click", () => openForm());
elements.importButton.addEventListener("click", async () => {
  elements.importButton.disabled = true;
  elements.listFooter.classList.remove("list-footer-error");
  try {
    const result = await window.contactsAPI.importCSV();
    if (result.canceled) return;

    activeFilter = "all";
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.filter === "all"));
    elements.search.value = "";
    await refresh();

    const skippedRows = result.skipped.slice(0, 5).join(", ");
    const additionalSkipped = result.skipped.length > 5 ? ` and ${result.skipped.length - 5} more` : "";
    elements.listFooter.textContent = result.skipped.length
      ? `Imported ${result.imported} ${result.imported === 1 ? "contact" : "contacts"}; skipped ${result.skipped.length} row${result.skipped.length === 1 ? "" : "s"} without a name (row${result.skipped.length === 1 ? "" : "s"} ${skippedRows}${additionalSkipped}).`
      : `Imported ${result.imported} ${result.imported === 1 ? "contact" : "contacts"}.`;
  } catch (error) {
    elements.listFooter.classList.add("list-footer-error");
    elements.listFooter.textContent = error.message || "Couldn't import contacts from that CSV file.";
  } finally {
    elements.importButton.disabled = false;
  }
});
elements.exportButton.addEventListener("click", async () => {
  elements.exportButton.disabled = true;
  elements.listFooter.classList.remove("list-footer-error");
  try {
    const result = await window.contactsAPI.exportCSV();
    if (!result.canceled) {
      elements.listFooter.textContent = `Exported ${result.exported} ${result.exported === 1 ? "contact" : "contacts"} to CSV.`;
    }
  } catch (error) {
    elements.listFooter.classList.add("list-footer-error");
    elements.listFooter.textContent = error.message || "Couldn't export contacts to CSV.";
  } finally {
    elements.exportButton.disabled = false;
  }
});
elements.themeToggle.addEventListener("click", () => {
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  elements.themeToggle.disabled = true;
  elements.themeError.hidden = true;
  window.contactsAPI.setTheme(nextTheme)
    .then(applyTheme)
    .catch((error) => {
      elements.themeError.textContent = error.message || "Couldn't save the appearance setting.";
      elements.themeError.hidden = false;
    })
    .finally(() => {
      elements.themeToggle.disabled = false;
    });
});
document.querySelectorAll(".close-dialog").forEach((button) => {
  button.addEventListener("click", () => elements.dialog.close());
});
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});
document.querySelectorAll(".close-contact-card").forEach((button) => {
  button.addEventListener("click", () => elements.contactCardDialog.close());
});
elements.contactCardDialog.addEventListener("click", (event) => {
  if (event.target === elements.contactCardDialog) elements.contactCardDialog.close();
});
elements.contactCardEditButton.addEventListener("click", () => {
  const contact = contacts.find((item) => item.id === activeCardContactId);
  if (!contact) return;
  elements.contactCardDialog.close();
  openForm(contact);
});
elements.search.addEventListener("input", () => {
  render();
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

elements.sortPicker.addEventListener("click", () => {
  const isOpen = elements.sortPicker.getAttribute("aria-expanded") === "true";
  elements.sortPicker.setAttribute("aria-expanded", String(!isOpen));
  elements.sortPickerMenu.hidden = isOpen;
});
document.querySelectorAll("[data-sort-order]").forEach((option) => {
  option.addEventListener("click", () => {
    sortOrder = option.dataset.sortOrder;
    document.querySelectorAll("[data-sort-order]").forEach((item) => {
      item.setAttribute("aria-checked", String(item === option));
    });
    elements.sortPicker.setAttribute("aria-expanded", "false");
    elements.sortPickerMenu.hidden = true;
    elements.sortPicker.focus();
    render();
  });
});

function closeToolbarMenus() {
  elements.fieldPicker.setAttribute("aria-expanded", "false");
  elements.fieldPickerMenu.hidden = true;
  elements.sortPicker.setAttribute("aria-expanded", "false");
  elements.sortPickerMenu.hidden = true;
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".field-picker, .sort-picker")) {
    closeToolbarMenus();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const sortMenuWasOpen = elements.sortPicker.getAttribute("aria-expanded") === "true";
    const fieldMenuWasOpen = elements.fieldPicker.getAttribute("aria-expanded") === "true";
    closeToolbarMenus();
    if (sortMenuWasOpen) {
      elements.sortPicker.focus();
    } else if (fieldMenuWasOpen) {
      elements.fieldPicker.focus();
    }
  }
});

elements.fieldPicker.addEventListener("click", () => {
  const isOpen = elements.fieldPicker.getAttribute("aria-expanded") === "true";
  elements.fieldPicker.setAttribute("aria-expanded", String(!isOpen));
  elements.fieldPickerMenu.hidden = isOpen;
});
document.querySelectorAll("[data-visible-field]").forEach((checkbox) => {
  checkbox.addEventListener("change", async () => {
    const previousFields = visibleFields;
    setVisibleFields(
      Array.from(document.querySelectorAll("[data-visible-field]:checked"), (field) => field.dataset.visibleField),
    );
    render();
    document.querySelectorAll("[data-visible-field]").forEach((field) => { field.disabled = true; });
    elements.fieldPicker.disabled = true;
    try {
      await window.contactsAPI.setVisibleFields(visibleFields);
    } catch (error) {
      setVisibleFields(previousFields);
      render();
      elements.listFooter.classList.add("list-footer-error");
      elements.listFooter.textContent = error.message || "Couldn't save visible fields.";
    } finally {
      document.querySelectorAll("[data-visible-field]").forEach((field) => { field.disabled = false; });
      elements.fieldPicker.disabled = false;
    }
  });
});
elements.list.addEventListener("click", async (event) => {
  const row = event.target.closest(".contact-row");
  if (!row) return;
  const contact = contacts.find((item) => item.id === row.dataset.id);
  const button = event.target.closest("[data-action]");
  if (!contact) return;
  if (!button || button.dataset.action === "view") {
    openContactCard(contact);
    return;
  }
  if (button.dataset.action === "edit") {
    openForm(contact);
    return;
  }
  try {
    if (button.dataset.action === "email") {
      await window.contactsAPI.composeEmail(contact.email);
    }
    if (button.dataset.action === "delete") {
      if (!window.confirm(`Delete ${contact.name} from your contacts? This can't be undone.`)) return;
      await window.contactsAPI.delete(contact.id);
      await refresh();
    }
    if (button.dataset.action === "favorite") {
      await window.contactsAPI.toggleFavorite(contact.id);
      await refresh();
    }
  } catch (error) {
    elements.listFooter.textContent = error.message || "Couldn't update this contact.";
    elements.listFooter.classList.add("list-footer-error");
  }
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.formError.textContent = "";
  elements.saveButton.disabled = true;
  const formData = new FormData(elements.form);
  const contact = Object.fromEntries(formData.entries());
  contact.favorite = formData.has("favorite");
  try {
    if (editingId) {
      await window.contactsAPI.update(editingId, contact);
    } else {
      await window.contactsAPI.create(contact);
    }
    activeFilter = "all";
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.filter === "all"));
    elements.search.value = "";
    elements.dialog.close();
    await refresh();
  } catch (error) {
    elements.formError.textContent = error.message || "Couldn't save this contact. Please try again.";
  } finally {
    elements.saveButton.disabled = false;
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.search.focus();
    return;
  }
  if (event.ctrlKey && !event.repeat && event.key.toLowerCase() === "b") {
    event.preventDefault();
    sidebarCollapsed = !sidebarCollapsed;
    applySidebarLayout({ width: sidebarWidth, collapsed: sidebarCollapsed });
    saveSidebarLayout();
  }
});

let resizeStartX = 0;
let resizeStartWidth = sidebarWidth;
elements.sidebarResizeHandle.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || sidebarCollapsed) return;
  resizeStartX = event.clientX;
  resizeStartWidth = sidebarWidth;
  elements.sidebarResizeHandle.setPointerCapture(event.pointerId);
});
elements.sidebarResizeHandle.addEventListener("pointermove", (event) => {
  if (!elements.sidebarResizeHandle.hasPointerCapture(event.pointerId)) return;
  sidebarWidth = Math.round(Math.max(180, Math.min(360, resizeStartWidth + event.clientX - resizeStartX)));
  applySidebarLayout({ width: sidebarWidth, collapsed: false });
});
elements.sidebarResizeHandle.addEventListener("pointerup", (event) => {
  if (elements.sidebarResizeHandle.hasPointerCapture(event.pointerId)) {
    elements.sidebarResizeHandle.releasePointerCapture(event.pointerId);
    saveSidebarLayout();
  }
});
elements.sidebarResizeHandle.addEventListener("pointercancel", () => saveSidebarLayout());
elements.sidebarResizeHandle.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const adjustment = event.key === "ArrowLeft" ? -12 : 12;
  sidebarWidth = Math.max(180, Math.min(360, sidebarWidth + adjustment));
  applySidebarLayout({ width: sidebarWidth, collapsed: false });
  saveSidebarLayout();
});

window.contactsAPI.getSidebarLayout()
  .then(applySidebarLayout)
  .catch((error) => {
    elements.listFooter.classList.add("list-footer-error");
    elements.listFooter.textContent = error.message || "Couldn't load the sidebar layout.";
  });
window.contactsAPI.getTheme()
  .then(applyTheme)
  .catch((error) => {
    elements.themeError.textContent = error.message || "Couldn't load the appearance setting.";
    elements.themeError.hidden = false;
  });
window.contactsAPI.getVisibleFields()
  .then(setVisibleFields)
  .then(render)
  .catch((error) => {
    elements.listFooter.classList.add("list-footer-error");
    elements.listFooter.textContent = error.message || "Couldn't load visible fields.";
  });
refresh();
