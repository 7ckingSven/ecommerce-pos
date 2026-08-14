import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RegisterScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>
      <Text style={styles.text}>
        This screen is not implemented yet, but navigation is now wired up.
      </Text>

      <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f0fdf4',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    color: '#3f3f46',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
