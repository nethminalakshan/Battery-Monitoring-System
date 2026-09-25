/*
 * RMS-CM — ESP8266 NodeMCU Firmware  (v2 — RS-485 fix)
 * Board: NodeMCU 1.0 (ESP-12E Module)
 *
 * v2 fix: RS-485 moved from UART0 (GPIO1/GPIO3 = USB-UART pins) to
 * SoftwareSerial on D5/D6. UART0 (Serial) is now free for USB debug
 * and is visible in the Arduino IDE Serial Monitor.
 *
 * Previous design used Serial (UART0) for RS-485 AND the USB-UART
 * chip (CP2102) is also wired to UART0 on NodeMCU. This caused:
 *   - RS-485 TX bytes also leaking onto USB, confusing the host PC
 *   - USB noise appearing as garbage bytes on RS-485 RX
 *   - Serial1 debug output was on GPIO2 (not USB-visible)
 *
 * ─────────────────────────────────────────────────────────────
 *  Pin Map (ESP8266 NodeMCU)
 * ─────────────────────────────────────────────────────────────
 *  D5  (GPIO14) ← MAX3485 RO   RS-485 RX from TC
 *  D6  (GPIO12) → MAX3485 DI   RS-485 TX to TC
 *  D2  (GPIO4)  → MAX3485 DE+RE direction control (or omit if auto-flow module)
 *  3.3V         → MAX3485 VCC
 *  GND          → MAX3485 GND (Common with TC ground!)
 *  USB (D1/D0)  → Arduino IDE Serial Monitor (debug, 115200 baud)
 * ─────────────────────────────────────────────────────────────
 *
 * TC actual wiring (Arduino Uno MAX3485):
 *   TC D4 ← MAX3485 RO    RS-485 RX from CM
 *   TC D5 → MAX3485 DI    RS-485 TX to CM
 *   TC D6 → MAX3485 DE+RE direction control (if module has DE/RE pins)
 *   MAX3485 A  ←→  MAX3485 A   (non-inverting)
 *   MAX3485 B  ←→  MAX3485 B   (inverting)
 *   IMPORTANT: A-to-A, B-to-B (not crossed), and common GND!
 * ─────────────────────────────────────────────────────────────
 *
 * Required libraries:
 *   - ESP8266WiFi    (included with ESP8266 board package)
 *   - PubSubClient   by Nick O'Leary
 *
 * MQTT topics published:
 *   rms/battery/1/voltage      rms/battery/1/temperature  rms/battery/1/ir
 *   rms/battery/2/voltage      rms/battery/2/temperature  rms/battery/2/ir
 *   rms/system/current         rms/system/temperature
 *   rms/status                 rms/debug (raw RX bytes, for diagnostics)
 */

#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <SoftwareSerial.h>

// ============================================================
//  USER CONFIGURATION  --  edit these before flashing
// ============================================================
const char* WIFI_SSID      = "Redmi 13C";
const char* WIFI_PASSWORD  = "00000000";

// MQTT broker - broker.hivemq.com for quick testing,
// or your local Mosquitto IP e.g. "192.168.1.100"
const char* MQTT_BROKER    = "broker.hivemq.com";
const int   MQTT_PORT      = 1883;
const char* MQTT_CLIENT_ID = "rms-cm-001";   // must be unique per broker
// ============================================================

// ---- RS-485 SoftwareSerial (Auto-flow control module) ------
// Wiring reference:
//   NodeMCU D5 (GPIO14) ← RS-485 module RXD (Receiver Output to ESP RX)
//   NodeMCU D6 (GPIO12) → RS-485 module TXD (Driver Input from ESP TX)
//   NodeMCU 3.3V/VIN    → RS-485 module VCC
//   NodeMCU GND         → RS-485 module GND (Common ground with TC!)
#define PIN_RS485_RX  D5   // D5 on NodeMCU (GPIO14)
#define PIN_RS485_TX  D6   // D6 on NodeMCU (GPIO12)

SoftwareSerial rs485(PIN_RS485_RX, PIN_RS485_TX);

// ---- Protocol constants ------------------------------------
#define CM_REQ_HEADER   0xCC
#define CM_CMD_POLL     0x01
#define CM_RESP_HEADER  0xDD
// TC needs up to ~650ms to poll both TAs + measure current
// Give 2s total timeout to be safe
#define TC_TIMEOUT_MS   2000

// ---- Poll interval -----------------------------------------
const unsigned long POLL_INTERVAL_MS = 5000;
unsigned long lastPollAt = 0;

WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);

// ---- WiFi connect (blocking) -------------------------------
void connectWiFi() {
  Serial.print("[CM] Connecting WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (++attempts > 40) {
      Serial.println("\n[CM] WiFi timeout - rebooting");
      ESP.restart();
    }
  }
  Serial.println();
  Serial.print("[CM] WiFi OK, IP: ");
  Serial.println(WiFi.localIP());
}

// ---- MQTT connect (blocking with retry) --------------------
void connectMQTT() {
  while (!mqtt.connected()) {
    if (mqtt.connect(MQTT_CLIENT_ID)) {
      Serial.println(" connected.");
      mqtt.publish("rms/status", "{\"online\":true,\"ta1\":false,\"ta2\":false,\"tc_error\":false}", false);
    } else {
      Serial.print(" failed rc=");
      Serial.print(mqtt.state());
      Serial.println(" - retry in 5s");
      delay(5000);
    }
  }
}

// ---- Publish a float value as a string ---------------------
void publishFloat(const char* topic, float value, int decimals = 2) {
  char buf[16];
  dtostrf(value, 1, decimals, buf);
  mqtt.publish(topic, buf, false);
}

// ---- Poll TC via RS-485 ------------------------------------
bool pollTC(float &v1,  float &t1,  float &ir1,
            float &v2,  float &t2,  float &ir2,
            float &cur, float &amb,
            bool  &ta1ok, bool &ta2ok) {

  // Flush any stale RX bytes
  while (rs485.available()) rs485.read();

  // Transmit poll request: [0xCC][0x01]
  Serial.print("[CM] Polling TC [0xCC 0x01]... ");
  rs485.write((byte)CM_REQ_HEADER);
  rs485.write((byte)CM_CMD_POLL);
  rs485.flush();                      // wait for all bits to leave TX pin
  Serial.println("poll sent, waiting for response...");

  // Collect 35-byte response
  unsigned long start = millis();
  byte resp[35];
  int received = 0;

  while (millis() - start < TC_TIMEOUT_MS && received < 35) {
    if (rs485.available()) resp[received++] = rs485.read();
  }

  Serial.print(received);
  Serial.println("/35 bytes received");

  // Publish raw RX count to MQTT for dashboard diagnostics
  char dbg[48];
  snprintf(dbg, sizeof(dbg), "{\"rx_bytes\":%d,\"timeout_ms\":%lu}",
           received, millis() - start);
  mqtt.publish("rms/debug", dbg, false);

  if (received == 0) {
    Serial.println("[CM] ERROR: No bytes received - check RS-485 wiring / TC firmware");
    return false;
  }
  if (received < 35) {
    Serial.print("[CM] ERROR: Partial response - got "); Serial.print(received);
    Serial.println(" bytes. TC may still be polling TAs, increase TC_TIMEOUT_MS.");
    // Print hex dump for debugging
    Serial.print("[CM] Hex: ");
    for (int i = 0; i < received; i++) {
      if (resp[i] < 0x10) Serial.print("0");
      Serial.print(resp[i], HEX); Serial.print(" ");
    }
    Serial.println();
    return false;
  }
  if (resp[0] != CM_RESP_HEADER) {
    Serial.print("[CM] ERROR: Bad header 0x");
    Serial.println(resp[0], HEX);
    return false;
  }

  // Verify XOR checksum
  byte chk = 0;
  for (int i = 0; i < 34; i++) chk ^= resp[i];
  if (chk != resp[34]) {
    Serial.print("[CM] ERROR: Checksum fail (got 0x");
    Serial.print(resp[34], HEX);
    Serial.print(", expected 0x");
    Serial.print(chk, HEX);
    Serial.println(")");
    return false;
  }

  // Parse payload
  byte status = resp[1];
  ta1ok = (status & 0x01) != 0;
  ta2ok = (status & 0x02) != 0;

  memcpy(&v1,  &resp[2],  4);
  memcpy(&t1,  &resp[6],  4);
  memcpy(&ir1, &resp[10], 4);
  memcpy(&v2,  &resp[14], 4);
  memcpy(&t2,  &resp[18], 4);
  memcpy(&ir2, &resp[22], 4);
  memcpy(&cur, &resp[26], 4);
  memcpy(&amb, &resp[30], 4);

  Serial.print("[CM] OK - TA1:");  Serial.print(ta1ok ? "OK" : "ERR");
  Serial.print(" TA2:"); Serial.print(ta2ok ? "OK" : "ERR");
  Serial.print(" I="); Serial.print(cur, 3);
  Serial.print("A Amb="); Serial.print(amb, 1); Serial.println("C");
  return true;
}

// ---- Setup -------------------------------------------------
void setup() {
  // UART0 = USB debug (visible in Arduino IDE Serial Monitor at 9600 baud)
  Serial.begin(9600);
  delay(200);
  Serial.println("\n=== RMS-CM v2 booting (9600 baud) ===");

  // RS-485 SoftwareSerial
  pinMode(PIN_RS485_RX, INPUT_PULLUP);
  rs485.begin(9600);

  Serial.print("[CM] RS-485 RX (D5) idle line state: ");
  if (digitalRead(PIN_RS485_RX) == HIGH) {
    Serial.println("HIGH (Good - bus is normal)");
  } else {
    Serial.println("LOW -> WARNING: A/B wires inverted or TX/RX swapped!");
  }

  connectWiFi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setKeepAlive(30);
  connectMQTT();

  Serial.println("[CM] Ready - polling TC every 5s");
}

// ---- Main loop ---------------------------------------------
void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  if (millis() - lastPollAt >= POLL_INTERVAL_MS) {
    lastPollAt = millis();

    float v1, t1, ir1, v2, t2, ir2, cur, amb;
    bool ta1ok, ta2ok;
    bool ok = pollTC(v1, t1, ir1, v2, t2, ir2, cur, amb, ta1ok, ta2ok);

    if (ok) {
      if (ta1ok) {
        publishFloat("rms/battery/1/voltage",     v1,  2);
        publishFloat("rms/battery/1/temperature", t1,  1);
        publishFloat("rms/battery/1/ir",          ir1, 1);
      }
      if (ta2ok) {
        publishFloat("rms/battery/2/voltage",     v2,  2);
        publishFloat("rms/battery/2/temperature", t2,  1);
        publishFloat("rms/battery/2/ir",          ir2, 1);
      }
      publishFloat("rms/system/current",     cur, 3);
      publishFloat("rms/system/temperature", amb, 1);

      char statusJson[128];
      snprintf(statusJson, sizeof(statusJson),
               "{\"ta1\":%s,\"ta2\":%s,\"tc_error\":false,\"current\":%.3f,\"online\":true,\"uptime\":%lu}",
               ta1ok ? "true" : "false",
               ta2ok ? "true" : "false",
               cur,
               millis() / 1000UL);
      mqtt.publish("rms/status", statusJson, false);
    } else {
      mqtt.publish("rms/status", "{\"tc_error\":true,\"online\":true}", false);
    }
  }
}
