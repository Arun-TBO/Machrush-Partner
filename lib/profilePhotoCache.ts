import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_PHOTO_CACHE_PREFIX = 'profilePhotoUrl:';

const getProfilePhotoCacheKey = (uid: string) => `${PROFILE_PHOTO_CACHE_PREFIX}${uid}`;

export const getCachedProfilePhotoUrl = async (uid: string) => {
  return AsyncStorage.getItem(getProfilePhotoCacheKey(uid));
};

export const setCachedProfilePhotoUrl = async (uid: string, url: string | null | undefined) => {
  const key = getProfilePhotoCacheKey(uid);

  if (url) {
    await AsyncStorage.setItem(key, url);
    return;
  }

  await AsyncStorage.removeItem(key);
};
