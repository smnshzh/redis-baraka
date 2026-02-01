import React, { useEffect, useMemo, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const DEFAULT_WS_URL = "ws://localhost:3000";

export default function App() {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [roomId, setRoomId] = useState("1");
  const [userId, setUserId] = useState("1");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("disconnected");
  const [events, setEvents] = useState([]);

  const socket = useMemo(() => {
    let connection;
    return {
      connect() {
        connection = new WebSocket(wsUrl);
        connection.onopen = () => setStatus("connected");
        connection.onclose = () => setStatus("disconnected");
        connection.onerror = () => setStatus("error");
        connection.onmessage = (event) => {
          setEvents((prev) => [JSON.parse(event.data), ...prev]);
        };
      },
      send(payload) {
        if (!connection || connection.readyState !== WebSocket.OPEN) return;
        connection.send(JSON.stringify(payload));
      },
      close() {
        if (connection) connection.close();
      },
    };
  }, [wsUrl]);

  useEffect(() => {
    return () => socket.close();
  }, [socket]);

  const handleJoin = () => {
    socket.connect();
    socket.send({ type: "join", roomId: Number(roomId) });
  };

  const handleSend = () => {
    socket.send({
      type: "message",
      roomId: Number(roomId),
      userId: Number(userId),
      content: message.trim(),
    });
    setMessage("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>چت زنده Redis + Postgres</Text>
          <Text style={styles.subtitle}>وضعیت اتصال: {status}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>اتصال</Text>
          <TextInput
            style={styles.input}
            value={wsUrl}
            onChangeText={setWsUrl}
            placeholder="آدرس وب‌سوکت"
          />
          <TextInput
            style={styles.input}
            value={roomId}
            onChangeText={setRoomId}
            placeholder="اتاق"
          />
          <TextInput
            style={styles.input}
            value={userId}
            onChangeText={setUserId}
            placeholder="کاربر"
          />
          <View style={styles.row}>
            <Button title="وصل شو" onPress={handleJoin} />
            <Button title="قطع اتصال" onPress={() => socket.close()} />
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>ارسال پیام</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={message}
            onChangeText={setMessage}
            placeholder="پیام خود را بنویسید"
            multiline
          />
          <Button title="ارسال" onPress={handleSend} disabled={!message.trim()} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>رویدادها</Text>
          {events.length === 0 && (
            <Text style={styles.empty}>هنوز پیامی نرسیده است.</Text>
          )}
          {events.map((event, index) => (
            <Text style={styles.event} key={`${event.type}-${index}`}>
              {JSON.stringify(event)}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  header: {
    padding: 16,
    backgroundColor: "#1e293b",
    borderRadius: 16,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#cbd5f5",
  },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  empty: {
    color: "#64748b",
  },
  event: {
    fontFamily: "Courier",
    fontSize: 12,
    color: "#0f172a",
  },
});
