# Fix: ReferenceError - advancedToggle is not defined

## 🐛 Issue

JavaScript error in `popup.js` line 115:

```txt
Uncaught ReferenceError: advancedToggle is not defined
```

## 🔍 Root Cause

When removing the "Preserve manual colors" feature, I removed the variable declarations for `advancedToggle` and `advancedContent` but forgot to remove the event listener that used them.

## ✅ Fix Applied

### 1. Removed Empty Advanced Section from HTML

**Files Modified:**

- `src/public/popup.html` - Removed entire `advanced-section` div
- `src/public/sidebar.html` - Removed entire `advanced-section` div

**Before:**

```html
<div class="advanced-section">
  <button class="advanced-toggle">
    <span class="noselect">Advanced</span>
    <!-- ... arrow SVG ... -->
  </button>
</div>
```

**After:**

```html
<!-- Section completely removed -->
```

### 2. Removed Orphaned Event Listener from JavaScript

**File Modified:**

- `src/public/popup.js` - Removed event listener for advanced toggle

**Before:**

```javascript
// Advanced section toggle.
advancedToggle.addEventListener("click", () => {
  advancedToggle.classList.toggle("open")
  advancedContent.classList.toggle("open")
})
```

**After:**

```javascript
// Code completely removed
```

## 🎯 Result

- ✅ **JavaScript error fixed** - No more ReferenceError
- ✅ **Cleaner UI** - Removed empty/unused advanced section
- ✅ **Extension builds successfully** for both Chrome and Firefox
- ✅ **All functionality preserved** - No impact on core features

## 🧪 Testing

The extension now loads without JavaScript errors and the popup interface is cleaner without the unused advanced section.

**Previous UI:**

- Auto-grouping toggle
- Group by subdomain toggle  
- Custom Rules section
- **Advanced section (empty)** ← Removed

**Current UI:**

- Auto-grouping toggle
- Group by subdomain toggle
- Custom Rules section
- *(No advanced section - cleaner interface)*
