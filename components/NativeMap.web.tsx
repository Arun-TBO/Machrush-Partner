import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type MapViewHandle = {
  animateCamera: () => void;
};

type MapViewProps = {
  children?: React.ReactNode;
  style?: object;
};

type MapElementProps = {
  children?: React.ReactNode;
};

const MapView = React.forwardRef<MapViewHandle, MapViewProps>(({ style }, ref) => {
  React.useImperativeHandle(ref, () => ({
    animateCamera: () => undefined,
  }));

  return (
    <View style={[styles.mapFallback, style]}>
      <Text style={styles.mapFallbackTitle}>Map preview unavailable on web</Text>
      <Text style={styles.mapFallbackText}>Open this screen on Android or iOS for live navigation.</Text>
    </View>
  );
});

MapView.displayName = 'MapView';

function Marker({ children }: MapElementProps) {
  return <>{children}</>;
}

function Polyline() {
  return null;
}

const PROVIDER_GOOGLE = undefined;

const styles = StyleSheet.create({
  mapFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dfe8f2',
    paddingHorizontal: 24,
  },
  mapFallbackTitle: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1c',
    textAlign: 'center',
  },
  mapFallbackText: {
    marginTop: 6,
    fontFamily: 'Poppins',
    fontSize: 12,
    color: '#606060',
    textAlign: 'center',
  },
});

export { Marker, Polyline, PROVIDER_GOOGLE };
export type MapViewRef = MapViewHandle;
export default MapView;
