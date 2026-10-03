# ReachOut

ReachOut is a local-first desktop address book built with Electron. Add and manage
contacts, search by name or details, and keep favorite people close. Contact data
is stored on this computer in the app's Electron user-data folder.

## Run locally

```powershell
npm install
npm start
```

## Contact details

Each contact can include a first name, last name, email address, phone number,
company, birthday, address, notes, and a favorite flag. First name is required.

Use **Import CSV** under the sidebar's **Tools** section to import a CSV with a
`Name` column or a `First Name` column; `Last Name` is optional. Full names in a
`Name` column are split into first name and last name. Optional headers include
`Email`, `Phone`, `Company`, `Birthday`, `Address`, `Notes`, and `Favorite`.
Quoted CSV values, including commas and line breaks, are supported; rows without
a name are skipped and reported. Use **Export CSV** in the same section to save
all contacts and their details as a CSV file.

Use the sort dropdown in the contacts toolbar to choose ascending or descending
alphabetical order by first name or last name.

Use the sidebar's appearance toggle to switch between light and dark mode. The
selected theme is remembered in the app's local preferences on this device.
Drag the sidebar's right edge to resize it, or press **Ctrl+B** to collapse or
restore it. The sidebar layout is remembered on this device.

Use the **Fields** menu beside the contacts controls to choose which optional
columns appear in the contact list. The name and row actions remain visible,
and your field selection is saved locally without changing contact data. All
fields remain available in the add and edit contact forms.

Select a contact to open its read-only detail card, which shows all contact
fields. Use the pencil beside the name in the card, or the pencil on a contact
row, to open the existing edit form.
