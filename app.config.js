const appJson = require('./app.json');

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

module.exports = {
  expo: {
    ...appJson.expo,
    ios: {
      ...appJson.expo.ios,
      config: {
        ...appJson.expo.ios?.config,
        googleMapsApiKey,
      },
    },
    android: {
      ...appJson.expo.android,
      config: {
        ...appJson.expo.android?.config,
        googleMaps: {
          ...appJson.expo.android?.config?.googleMaps,
          apiKey: googleMapsApiKey,
        },
      },
    },
    extra: {
      ...appJson.expo.extra,
      eas: {
        ...appJson.expo.extra?.eas,
        projectId: 'b6c4c1d3-4595-4e89-94ce-a70a4facd70a',
      },
    },
  },
};
