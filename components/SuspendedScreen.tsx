import React from 'react';
import { Image, Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

const suspendedAccountImage = require('@/assets/images/profile/suspended-account.png');
const supportCallImage = require('@/assets/images/profile/support-call.png');
const supportEmailImage = require('@/assets/images/profile/support-email.png');

function SupportRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: number;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.supportRow, pressed ? styles.supportRowPressed : null]}
      onPress={onPress}
    >
      <Image source={icon} style={styles.supportIcon} resizeMode="contain" />
      <View style={styles.supportTextGroup}>
        <Text style={styles.supportLabel}>{label}</Text>
        <Text style={styles.supportValue}>{value}</Text>
      </View>
    </Pressable>
  );
}

export function SuspendedScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>This account is suspended</Text>
          <Text style={styles.description}>
            Your account has been suspended for violating MACHRUSH terms and conditions.
          </Text>
        </View>

        <Image
          source={suspendedAccountImage}
          style={styles.illustration}
          resizeMode="contain"
        />

        <View style={styles.supportSection}>
          <Text style={styles.appealText}>
            To appeal this suspension, contact our support team.
          </Text>
          <View style={styles.supportList}>
            <SupportRow
              icon={supportCallImage}
              label="Call us (24x7)"
              value="022276110864"
              onPress={() => Linking.openURL('tel:022276110864')}
            />
            <SupportRow
              icon={supportEmailImage}
              label="Email us"
              value="machrush@support.com"
              onPress={() =>
                Linking.openURL(
                  'mailto:machrush@support.com?subject=Suspension%20appeal'
                )
              }
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default SuspendedScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 64,
    paddingBottom: 24,
    gap: 40,
  },
  header: {
    width: '100%',
    gap: 12,
  },
  title: {
    width: '100%',
    fontFamily: 'Poppins',
    fontSize: 32,
    fontWeight: '500',
    lineHeight: 32,
    color: '#1c1c1c',
  },
  description: {
    width: '100%',
    maxWidth: 380,
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#5e5e58',
  },
  illustration: {
    width: '100%',
    maxWidth: 380,
    height: 282,
    alignSelf: 'center',
  },
  supportSection: {
    width: '100%',
    gap: 16,
  },
  appealText: {
    width: '100%',
    maxWidth: 380,
    fontFamily: 'Poppins',
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 32,
    color: '#5e5e58',
  },
  supportList: {
    width: '100%',
    gap: 8,
  },
  supportRow: {
    width: '100%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(27, 124, 255, 0.1)',
    overflow: 'hidden',
  },
  supportRowPressed: {
    opacity: 0.75,
  },
  supportIcon: {
    width: 52,
    height: 52,
  },
  supportTextGroup: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  supportLabel: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#606060',
  },
  supportValue: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1c1c',
    letterSpacing: -0.5,
  },
});
