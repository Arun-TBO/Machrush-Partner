import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface PlaceholderImageProps {
  width?: number;
  height?: number;
  style?: any;
}

/**
 * Placeholder component for design assets
 * Use this until you have actual images to replace
 */
export const PlaceholderImage: React.FC<PlaceholderImageProps> = ({
  width: w = 320,
  height: h = 400,
  style,
}) => {
  return (
    <View
      style={[
        styles.placeholder,
        {
          width: w,
          height: h,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#D9D9D9',
    borderRadius: 8,
  },
});
