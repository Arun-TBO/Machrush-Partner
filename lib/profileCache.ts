import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_CACHE_PREFIX = 'profile:';

const getProfileCacheKey = (uid: string, field: string) => `${PROFILE_CACHE_PREFIX}${uid}:${field}`;

export const getCachedProfilePhotoUrl = async (uid: string) => {
  return AsyncStorage.getItem(getProfileCacheKey(uid, 'photoUrl'));
};

export const setCachedProfilePhotoUrl = async (uid: string, url: string | null | undefined) => {
  const key = getProfileCacheKey(uid, 'photoUrl');

  if (url) {
    await AsyncStorage.setItem(key, url);
    return;
  }

  await AsyncStorage.removeItem(key);
};

export const getCachedDriverName = async (uid: string) => {
  return AsyncStorage.getItem(getProfileCacheKey(uid, 'name'));
};

export const setCachedDriverName = async (uid: string, name: string | null | undefined) => {
  const key = getProfileCacheKey(uid, 'name');

  if (name) {
    await AsyncStorage.setItem(key, name);
    return;
  }

  await AsyncStorage.removeItem(key);
};

export const getCachedAvailabilityStatus = async (uid: string) => {
  const value = await AsyncStorage.getItem(getProfileCacheKey(uid, 'availabilityStatus'));
  return value === 'online' || value === 'offline' ? value : null;
};

export const getCachedAvailabilityChangedAtMs = async (uid: string) => {
  const value = await AsyncStorage.getItem(getProfileCacheKey(uid, 'availabilityChangedAtMs'));
  const changedAtMs = Number(value);
  return Number.isFinite(changedAtMs) && changedAtMs > 0 ? changedAtMs : 0;
};

export const setCachedAvailabilityStatus = async (
  uid: string,
  status: 'online' | 'offline' | null | undefined
) => {
  const key = getProfileCacheKey(uid, 'availabilityStatus');

  if (status) {
    await AsyncStorage.setItem(key, status);
    return;
  }

  await AsyncStorage.removeItem(key);
};

export const setCachedAvailabilityChangedAtMs = async (
  uid: string,
  changedAtMs: number | null | undefined
) => {
  const key = getProfileCacheKey(uid, 'availabilityChangedAtMs');

  if (changedAtMs && Number.isFinite(changedAtMs) && changedAtMs > 0) {
    await AsyncStorage.setItem(key, String(changedAtMs));
    return;
  }

  await AsyncStorage.removeItem(key);
};
