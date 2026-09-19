const base = require('./app.json').expo;
module.exports = () => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const googleScheme = iosClientId?.endsWith('.apps.googleusercontent.com')
    ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}` : undefined;
  return {
    ...base,
    ios: { ...base.ios, usesAppleSignIn: true },
    plugins: [
      ...base.plugins,
      'expo-apple-authentication',
      'expo-notifications',
      ...(googleScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleScheme }]] : []),
    ],
  };
};
