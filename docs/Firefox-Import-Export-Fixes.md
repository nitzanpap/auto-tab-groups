# Firefox Import/Export Fixes - Test Plan

## Issues Fixed

### 1. ✅ Missing Export/Import in Firefox Sidebar

- **Problem**: Export/Import buttons were only added to popup.html, not sidebar.html
- **Solution**: Added identical export/import UI elements to sidebar.html
- **Files Updated**: `src/public/sidebar.html`

### 2. ✅ Firefox Popup Closing During Import

- **Problem**: When popup is open and user clicks import, file dialog causes popup to close
- **Solution**: Implemented context detection with fallback strategies:
  - **Primary**: Open dedicated import page in new tab for popup context
  - **Secondary**: Show user instructions and try direct file input
  - **Sidebar**: Use direct file input (works fine in sidebar context)
- **Files Created**:
  - `src/public/import-rules.html` - Dedicated import page
  - `src/public/import-rules.js` - Import page functionality
- **Files Updated**: `src/public/popup.js` - Enhanced import function

## Testing Checklist

### Firefox Sidebar (Should work perfectly)

- [ ] ✅ Export button visible and functional
- [ ] ✅ Import button visible and functional  
- [ ] ✅ File picker opens without issues
- [ ] ✅ Import processes correctly
- [ ] ✅ Success/error messages display

### Firefox Popup (Fixed with workaround)

- [ ] ✅ Export button visible and functional
- [ ] ✅ Import button opens new tab with import page
- [ ] ✅ Import page allows file selection
- [ ] ✅ Import page shows options (merge/replace)
- [ ] ✅ Import processes and shows results
- [ ] ✅ Fallback message shows if tab opening fails

### Chrome (Should work as before)

- [ ] ✅ Export button works in both popup and side panel
- [ ] ✅ Import button works in both popup and side panel
- [ ] ✅ File picker works in all contexts

## Technical Implementation Details

### Context Detection

```javascript
const isPopupContext = !document.querySelector(".sidebar-container")
```

### Import Strategy

```
if (isPopupContext) {
  // Open dedicated import page in new tab
  browserAPI.tabs.create({ url: "public/import-rules.html" })
} else {
  // Use direct file input (sidebar context)
  importFileInput.click()
}
```

### Import Page Features

- Drag & drop file selection
- Visual file validation
- Import mode selection (merge/replace)
- Real-time import progress
- Detailed result reporting
- Auto-close functionality

## User Experience Improvements

1. **Better Instructions**: Clear guidance for popup users
2. **Drag & Drop**: Enhanced file selection on import page  
3. **Visual Feedback**: Better progress indication
4. **Error Handling**: Comprehensive error reporting
5. **Context Awareness**: Automatic adaptation to popup vs sidebar

## Files Modified/Created

### Modified

- `src/public/sidebar.html` - Added export/import buttons
- `src/public/popup.js` - Enhanced import function with context detection

### Created

- `src/public/import-rules.html` - Dedicated import page
- `src/public/import-rules.js` - Import page functionality

### Unchanged (but benefits from fixes)

- `src/services/RulesService.js` - Backend functionality remains the same
- `src/background.js` - Message handling remains the same
- `src/public/popup.css` - Styling applies to all contexts
