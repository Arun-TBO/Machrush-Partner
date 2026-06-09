import { Dimensions, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');

const guidelineWidth = 390;
const guidelineHeight = 844;
const shortestSide = Math.min(width, height); 
const longestSide = Math.max(width, height);

export const isCompactPhone = shortestSide < 360;

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const rs = (size: number, min = size * 0.86, max = size * 1.12) => {
  return PixelRatio.roundToNearestPixel(clamp((shortestSide / guidelineWidth) * size, min, max));
};

export const vs = (size: number, min = size * 0.86, max = size * 1.12) => {
  return PixelRatio.roundToNearestPixel(clamp((longestSide / guidelineHeight) * size, min, max));
};

export const fs = (size: number, min = size * 0.88, max = size * 1.08) => {
  return PixelRatio.roundToNearestPixel(clamp((shortestSide / guidelineWidth) * size, min, max));
};

export const hit = (size: number) => {
  return Math.max(44, rs(size));
};
