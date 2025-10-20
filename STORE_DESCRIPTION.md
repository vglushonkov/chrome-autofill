FormFiller is a Chrome extension that allows you to save and automatically fill form field values on websites with a clean, unobtrusive interface.

⚡ EASY TO USE  
1 Right click any field on any site
2 Select Autofill in context menu
3 Enter and Save value
PROFIT: Now this value is always there when you open this page

🎯 SITE-SPECIFIC
Saved values are organized by website for better organization and security.

✨ FEATURES:
• Save form field values with custom names
• Automatically fill text inputs, checkboxes, and radio buttons
• Organize data by website
• Edit or delete saved values
• Clear data for specific sites or all sites
• Privacy-focused: all data stays on your device
• Clean interface without field highlighting
• Smart badge indicator showing count of filled fields
• Alternative filling via "Autofill Focused Field" button

📋 SUPPORTED FIELDS:
• Text inputs
• Email fields
• Password fields
• Phone numbers
• URLs
• Search fields
• Number inputs
• Textareas
• Select dropdowns
• Checkboxes
• Radio buttons

🔧 HOW IT WORKS:
1. Install the extension
2. Visit any website with form fields
3. Right-click on a form field and select "Autofill"
4. Choose to save a new value or use a previously saved one
5. Manage all your saved data through the extension popup

🛡️ SECURITY:
• Data stored locally in your browser
• No data transmitted to external servers
• HTML escaping to prevent XSS
• Privacy policy available

🔒 PRIVACY FIRST
All data is stored locally on your device. Nothing is sent to external servers.

SINGLE PURPOSE:
The Fields Autofill extension helps users save and automatically fill frequently used data in web forms, saving time and eliminating manual data entry across different websites.

PERMISSIONS JUSTIFICATIONS:

activeTab:
Required to interact with the current tab to identify form fields, get page URLs for site-specific data storage, display extension badge with saved fields count, and inject saved values into forms when users activate autofill.

contextMenus:
Essential for adding "Autofill" option to right-click context menu on input fields. This is the primary method for users to save field values for future autofill functionality.

storage:
Used to store user data locally via chrome.storage.local. All saved field values and site URLs are stored exclusively on the user's device, ensuring maximum privacy with no data transmission to external servers.

HOST PERMISSIONS (<all_urls>):
Required for the extension to work on any website users visit. Form autofill functionality must be available across all sites, not limited to specific domains. Used to detect input fields, inject content scripts, and manage autofill on any site where users need it.

REMOTE CODE:
This extension does NOT use remote code. All functionality is contained within the extension package. No scripts are loaded from external servers, ensuring consistent and secure behavior.

DATA USAGE:
The extension does NOT collect or transmit any personal data. All user data (field values, URLs) is stored locally using chrome.storage.local and never leaves the user's device. No analytics or tracking is implemented.

For more information, visit: https://codecube01.store/autofill