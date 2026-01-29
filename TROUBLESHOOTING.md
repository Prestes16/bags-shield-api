# Troubleshooting Guide

## MetaMask "Failed to connect" Error

**Issue:** You see an error in the console: `Unhandled promise rejection: i: Failed to connect to MetaMask`

**Cause:** This error comes from the MetaMask browser extension automatically trying to connect when it detects a Web3 page. Bags Shield is a **Solana-first** application and does not use MetaMask or Ethereum.

**Impact:** This is a **cosmetic error only**. It does not affect the functionality of Bags Shield. All features work normally despite this console message.

**Solutions:**

### Option 1: Ignore the Error (Recommended)
The error is harmless and can be safely ignored. It does not affect your Solana transactions or security scans.

### Option 2: Disable MetaMask Extension
If you want to eliminate the error message:
1. Open your browser's extension manager
2. Disable the MetaMask extension
3. Refresh the Bags Shield page

### Option 3: Use a Separate Browser Profile
Create a dedicated browser profile for Solana apps without MetaMask installed.

**Chrome:**
1. Click your profile icon (top-right)
2. Click "Add profile"
3. Don't install MetaMask in the new profile

**Firefox:**
1. Type `about:profiles` in the address bar
2. Click "Create a New Profile"
3. Don't install MetaMask in the new profile

---

## Other Common Issues

### Environment Variables
If you see errors about missing environment variables, set them in the **Vars** section of the v0 sidebar (left side of the screen).

### Theme Not Changing
Clear your browser cache and local storage:
- Chrome/Edge: Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
- Select "Cookies and other site data" and "Cached images and files"
- Click "Clear data"

### Mobile Display Issues
Make sure you're viewing on a screen width between 360-430px for optimal mobile experience. The app is mobile-first designed.
