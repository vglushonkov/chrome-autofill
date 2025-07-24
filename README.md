# Fields Autofill - Chrome Extension

[![GitHub release](https://img.shields.io/github/release/vglushonkov/chrome-autofill.svg)](https://github.com/vglushonkov/chrome-autofill/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Coming%20Soon-yellow.svg)](#)

A Chrome extension that allows you to save and automatically fill input field values on websites with a clean, unobtrusive interface.

## ✨ Features

- ✅ "Autofill" context menu for any input field
- ✅ Save values for specific fields on specific pages
- ✅ Automatic filling of saved values when page loads
- ✅ **🆕 Clean UI without field highlighting** - no more distracting glowing borders
- ✅ **🆕 Smart badge indicator** - extension icon shows count of filled fields
- ✅ **🆕 Real-time icon updates** - badge updates when switching tabs or filling fields
- ✅ Manage saved data through popup interface
- ✅ Support for dynamically added fields
- ✅ Unique field identification using all available attributes
- ✅ Privacy-focused - all data stored locally, no external servers

## Installation

### Local Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `autofill` folder
5. The extension will be installed and ready to use

## Usage

### Saving Field Values

1. Navigate to any website with input fields
2. Right-click on any input field
3. Select "Autofill" from the context menu
4. Enter the value you want to save for this field
5. Click OK

### Automatic Filling

- Saved values will be automatically filled on subsequent page visits
- Fields are only filled if they are empty
- Supports dynamically added fields
- **Clean interface** - no visual highlighting of filled fields
- **Extension icon badge** shows the number of filled fields on the current page
- Badge updates in real-time when switching tabs or navigating

### Managing Data

1. Click the extension icon in Chrome's toolbar
2. In the popup interface you can:
   - **Current Page**: View and manage fields for the current page
   - **All Sites**: View all saved sites
   - Edit field values
   - Delete individual fields
   - Clear data for entire page or all sites

## Supported Field Types

- `input[type="text"]`
- `input[type="email"]`
- `input[type="password"]`
- `input[type="tel"]`
- `input[type="url"]`
- `input[type="search"]`
- `input[type="number"]`
- `textarea`
- `select`

## Architecture

### File Structure

```
autofill/
├── manifest.json              # Extension configuration
├── popup/
│   ├── popup.html             # Popup UI
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styles
├── content/
│   └── content.js             # Content script
├── background/
│   └── background.js          # Service worker
├── storage/
│   └── storage.js             # Storage management
├── utils/
│   └── field-identifier.js    # Field identification
└── icons/                     # Extension icons
```

### Field Identification

Each field gets a unique ID based on:
- Element tag (`input`, `textarea`, `select`)
- Field type (`text`, `email`, `password`, etc.)
- `id` attribute
- `name` attribute
- `placeholder` attribute (cleaned of spaces)
- Position on page (as fallback)

Example ID: `input_email_loginEmail_userEmail_Enteryouremail_pos0`

### Data Storage

Data is saved in `chrome.storage.local` in the following format:

```javascript
{
  "https://example.com/login": {
    "input_email_loginEmail_userEmail_Enteryouremail_pos0": "user@example.com",
    "input_password_loginPassword_pos1": "mypassword"
  }
}
```

## Security

- Data is stored locally in the user's browser
- No data is transmitted to external servers
- HTML escaping is supported to prevent XSS
- Passwords and other sensitive data are handled as plain text

## Development

### Code Structure

- **Content Script** (`content/content.js`): Main logic for page interaction
- **Background Script** (`background/background.js`): Service worker for context menu
- **Popup** (`popup/`): Data management interface
- **Storage** (`storage/storage.js`): Storage API
- **Utils** (`utils/field-identifier.js`): Field identification utilities

### Debugging

1. Open Developer Tools on a webpage
2. Extension logs will appear in the console:
   - `Fields Autofill: Initializing...`
   - `Auto-filled field [ID] with value: [VALUE]`
   - And other debug messages

## Compatibility

- Chrome 88+
- Manifest V3
- Works on all HTTP/HTTPS websites

## Limitations

- Does not work on internal Chrome pages (`chrome://`, `chrome-extension://`)
- Requires permission to access all websites
- File input fields are not supported
- Some websites may block automatic filling through CSP

## License

MIT License
