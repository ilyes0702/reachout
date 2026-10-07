# ReachOut

ReachOut is a local-first desktop address book built with Electron. Store and
manage contact details on your computer, search your address book, and keep
favorite people easy to find.

## Run locally

```powershell
npm install
npm start
```

Run the JavaScript syntax checks with:

```powershell
npm run check
```

## Manage contacts

Create a contact with a first name (required) and any of these optional details:
last name, email address, phone number, company, birthday, address, and notes.
You can also mark a contact as a favorite.

Use the ReachOut button beside a contact's pencil to add them to the ReachOut
list, a short-term list of people you plan to contact. Select **ReachOut** in
the sidebar to view that list.

Contacts with a birthday receive a system reminder at 9:00 AM the day before.
On Windows, reminders are scheduled to work while the main window is closed;
ReachOut must be opened once to register the daily task, and Windows must be
signed in at reminder time. The reminder includes a **Draft Birthday Email**
button when the contact has an email address. Choosing it opens a new email
draft with a birthday subject. February 29 birthdays are observed on March 1
in non-leap years. Uninstalling the Windows installer removes the scheduled
task; before deleting a portable copy, remove **ReachOut Birthday Reminders**
from Windows Task Scheduler.

Search contacts from the toolbar. Click a contact row to open its read-only
detail card, which displays every saved field. Use the pencil beside the name
on the card to edit the contact. Contact rows also have a pencil button to open
the edit form directly, a ReachOut button, a heart button to toggle favorite
status, and a delete button.

Click an email address in the contact list to open a new draft in your system's
default email application.

## Import and export

The sidebar's **Tools** section contains **Import CSV** and **Export CSV**.
Import accepts CSV files with a `Name` column or a `First Name` column; `Last
Name` is optional. Full names in a `Name` column are split into first and last
names. Optional headers include `Email`, `Phone`, `Company`, `Birthday`,
`Address`, `Notes`, `Favorite`, and `ReachOut`. Quoted values, including commas
and line breaks, are supported. Rows without a name are skipped and reported.

Export saves all contacts and their details as a CSV file, regardless of which
columns are currently visible in the list.

## Customize the workspace

- Use the **Sort** menu to sort by first or last name in ascending `(A-Z)` or
  descending `(Z-A)` order.
- Use the **Fields** menu to choose which optional columns appear in the
  contact list. The name and row actions remain visible. Hiding a column only
  changes the list display; saved contact details are preserved and remain
  available in the contact card and edit form.
- Use the sidebar's appearance toggle to switch between light and dark mode.
- Drag the sidebar's right edge to resize it. Focus the resize handle and use
  the arrow keys for keyboard resizing.
- Press **Ctrl+B** to collapse or restore the sidebar.

Your theme, visible columns, and sidebar layout are remembered in local
preferences on this device.

## Local data

Contact data and app preferences are stored locally in Electron's per-user
`userData` folder. ReachOut does not require a remote account or contact
syncing service.
