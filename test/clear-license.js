/**
 * Quick Script to Clear License Data (for testing)
 * Run in browser DevTools console (F12) when app is open
 */

console.log('🧹 Clearing all license data...');

// Clear localStorage
const keysToRemove = [
  'hl-license-activated',
  'hl-license-tier',
  'hl-license-expiry'
];

keysToRemove.forEach(key => {
  if (localStorage.getItem(key)) {
    console.log(`  ❌ Removed: ${key} = ${localStorage.getItem(key)}`);
    localStorage.removeItem(key);
  }
});

// Call deactivate API
if (window.electronAPI?.deactivateLicense) {
  window.electronAPI.deactivateLicense()
    .then(() => {
      console.log('  ✅ Backend license deactivated');
      console.log('  🔄 Reloading app...');
      setTimeout(() => window.location.reload(), 500);
    })
    .catch(err => {
      console.error('  ❌ Deactivate failed:', err);
    });
} else {
  console.log('  ⚠️  electronAPI.deactivateLicense not available');
  console.log('  🔄 Reloading app anyway...');
  setTimeout(() => window.location.reload(), 500);
}
