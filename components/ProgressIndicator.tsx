import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius } from '@/lib/theme';

interface ProgressIndicatorProps {
  total: number;
  current: number;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ total, current }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === current ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  dot: {
    height: 12,
    borderRadius: Radius.full,
  },
  dotActive: {
    width: 80,
    backgroundColor: Colors.primary,
  },
  dotInactive: {
    width: 12,
    backgroundColor: '#D9D9D9',
  },
});
