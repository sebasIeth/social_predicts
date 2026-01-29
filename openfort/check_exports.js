import * as ReactSDK from '@openfort/react';
console.log('Keys:', Object.keys(ReactSDK));
if (ReactSDK.AuthProvider) {
    console.log('AuthProvider:', ReactSDK.AuthProvider);
} else {
    console.log('AuthProvider missing');
}
