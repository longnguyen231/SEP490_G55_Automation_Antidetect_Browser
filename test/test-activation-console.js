/**
 * Quick Test Script - Activate License from Console
 * Run in browser DevTools console (F12) when app is open
 */

// Your test JWT (1 year Pro license)
const testJWT = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJtYWNoaW5lQ29kZSI6IkMzRTAgRDZGRiAxNDcxIDk1QkQiLCJ0aWVyIjoicHJvIiwibWF4UHJvZmlsZXMiOi0xLCJmZWF0dXJlcyI6WyJ1bmxpbWl0ZWRfcHJvZmlsZXMiLCJhdXRvbWF0aW9uIiwidGVhbV9zaGFyaW5nIl0sImlzc3VlZEF0IjoxNzc2MjAwNDI4LCJleHBpcmVzQXQiOjE4MDc3MzY0MjgsImlhdCI6MTc3NjIwMDQyOH0.azqmOr2KFGyC7_58YN0RW9Jb-zn7_WMs5aLuXKT-W8R5LsE25JdGkzyDI-Xo6khV-SBBgXWutt5zW588vHvK0Oy0lzcwFqE0zK_f3PDbbQV0_ggiS5VIRgMLnVRIuxIP1FZXIikts4G-6d5Ra9pC2iZfSDYPnHL0r4v8j8-9vNyZFiLCeWSfqmaJrz1M55dRBtH79pjoKMXptVjC3dIw4A2fO6H7oZUue7gTxFzOSUGalM4AxX8VRgQ6WkKhzVQd-IvKflA9-kjCA8lvr58IBpWR6_xIAPRDuAiPDAbDvQkjkqkauozgKkEmUDLapRqUX1VuTZ-24UAf7iYFhnpM1w`;

console.log('🔑 Testing License Activation...');
console.log('JWT Length:', testJWT.length);

async function testActivation() {
  try {
    console.log('\n📡 Calling validateJwtLicense...');
    const result = await window.electronAPI.validateJwtLicense(testJWT);
    
    console.log('\n✅ Result:', result);
    
    if (result?.valid) {
      console.log('\n🎉 SUCCESS! License is valid!');
      console.log('  Tier:', result.payload?.tier);
      console.log('  Max Profiles:', result.payload?.maxProfiles);
      console.log('  Features:', result.payload?.features);
      console.log('  Expires At:', new Date(result.payload?.expiresAt * 1000).toLocaleString());
      
      console.log('\n💾 Saving to localStorage...');
      localStorage.setItem('hl-license-activated', 'true');
      localStorage.setItem('hl-license-tier', result.payload?.tier);
      if (result.payload?.expiresAt) {
        localStorage.setItem('hl-license-expiry', result.payload.expiresAt);
      }
      
      console.log('✅ Saved! Now reload to see changes.');
      console.log('🔄 Auto-reloading in 2 seconds...');
      
      setTimeout(() => window.location.reload(), 2000);
    } else {
      console.error('\n❌ VALIDATION FAILED!');
      console.error('  Error:', result?.error);
      console.error('  Expired:', result?.expired);
      console.error('  Machine Code Mismatch:', result?.machineCodeMismatch);
    }
  } catch (error) {
    console.error('\n❌ ERROR during activation:', error);
    console.error('  Message:', error.message);
    console.error('  Stack:', error.stack);
  }
}

// Check if electronAPI is available
if (!window.electronAPI?.validateJwtLicense) {
  console.error('❌ window.electronAPI.validateJwtLicense is not available!');
  console.error('   Make sure you are running this in the Electron app, not a regular browser.');
} else {
  console.log('✅ electronAPI.validateJwtLicense is available');
  testActivation();
}
