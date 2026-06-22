import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type AppAlertAction = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AppAlertState = {
  title: string;
  message?: string;
  actions: AppAlertAction[];
} | null;

function AppAlertModal({
  alert,
  onClose,
}: {
  alert: AppAlertState;
  onClose: () => void;
}) {
  const actions = alert?.actions?.length ? alert.actions : [{ text: 'OK' }];

  return (
    <Modal
      visible={Boolean(alert)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <View style={styles.copy}>
            <Text style={styles.title}>{alert?.title}</Text>
            {alert?.message ? <Text style={styles.message}>{alert.message}</Text> : null}
          </View>

          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.text}
                accessibilityRole="button"
                style={[
                  styles.actionButton,
                  action.style === 'destructive' ? styles.destructiveButton : null,
                ]}
                onPress={() => {
                  onClose();
                  action.onPress?.();
                }}
              >
                <Text
                  style={[
                    styles.actionText,
                    action.style === 'destructive' ? styles.destructiveText : null,
                  ]}
                >
                  {action.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function useAppAlert() {
  const [alert, setAlert] = React.useState<AppAlertState>(null);

  const hideAlert = React.useCallback(() => {
    setAlert(null);
  }, []);

  const showAlert = React.useCallback(
    (title: string, message?: string, actions?: AppAlertAction[]) => {
      setAlert({
        title,
        message,
        actions: actions?.length ? actions : [{ text: 'OK' }],
      });
    },
    []
  );

  const alertModal = React.useMemo(
    () => <AppAlertModal alert={alert} onClose={hideAlert} />,
    [alert, hideAlert]
  );

  return {
    alertModal,
    showAlert,
    hideAlert,
  };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    gap: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  copy: {
    width: '100%',
    gap: 8,
  },
  title: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    textAlign: 'center',
  },
  message: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0055cc',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  destructiveButton: {
    backgroundColor: '#d00416',
  },
  actionText: {
    color: '#ffffff',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    textAlign: 'center',
  },
  destructiveText: {
    color: '#ffffff',
  },
});
