/*
 * RMS-TC Module — Phase 3 Firmware
 * Board: Arduino Uno
 *
 * Phase 3 additions over Phase 2:
 *   - ACS712 main current (RMS) on A0
 *   - DS18B20 ambient temperature on D5 (cached every 5s)
 *   - RS-485 slave on D2(RX)/D3(TX)/D4(DE+RE) via SoftwareSerial + MAX485
 *
 * Operating mode:
 *   TC listens on RS-485, waiting for CM poll request [0xCC][0x01].
 *   On request, TC:
 *     1. Polls TA #1 via isolated UART (D10/D11)
 *     2. Polls TA #2 via isolated UART (A2/A3)
 *     3. Samples ACS712 -> computes RMS current
 *     4. Returns cached ambient temperature
 *     5. Sends 35-byte response to CM
 *   DS18B20 ambient temp refreshed in background every 5s.
 *
 * Pin Map (Arduino Uno) — matches actual soldered connections:
 *   D10  <- ADuM1201 #1 output  (SoftwareSerial RX, TA #1 link)
 *   D11  -> ADuM1201 #1 input   (SoftwareSerial TX, TA #1 link)
 *   A2   <- ADuM1201 #2 output  (SoftwareSerial RX, TA #2 link)
 *   A3   -> ADuM1201 #2 input   (SoftwareSerial TX, TA #2 link)
 *   D4   <- RS-485 module RX (SoftwareSerial RX, RS-485 from CM)
 *   D5   -> RS-485 module TX (SoftwareSerial TX, RS-485 to   CM)
 *   A1   <- ACS712-30A OUT (main current sense)
 *   D3   <- DS18B20 Data   (ambient temperature)
 *   D0/D1   USB Serial debug @ 9600 baud (reserved)
 *
 * RS-485 request frame  CM -> TC:
 *   [0xCC][0x01]   2 bytes
 *
 * RS-485 response frame  TC -> CM (35 bytes):
 *   [0]     0xDD             header
 *   [1]     status           bit0=TA1 valid, bit1=TA2 valid
 *   [2-5]   TA1 voltage      float (V)
 *   [6-9]   TA1 temperature  float (C)
 *   [10-13] TA1 IR           float (mOhm)
 *   [14-17] TA2 voltage      float (V)
 *   [18-21] TA2 temperature  float (C)
 *   [22-25] TA2 IR           float (mOhm)
 *   [26-29] main current     float (A, RMS)
 *   [30-33] ambient temp     float (C)
 *   [34]    XOR checksum
 *
 * TA frame (unchanged from Phase 2):
 *   Request:  [0xAA][ADDR][0x01]                   3 bytes
 *   Response: [0xBB][ADDR][V:4][T:4][IR:4][CHK:1]  15 bytes
 */

#include <SoftwareSerial.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ---- Pins --------------------------------------------------
#define PIN_TA1_RX    10
#define PIN_TA1_TX    11
#define PIN_TA2_RX    A2
#define PIN_TA2_TX    A3
#define PIN_RS485_RX  4      // D4 <- RS-485 module RX (verified signal input)
#define PIN_RS485_TX  5      // D5 -> RS-485 module TX (verified signal output)
#define PIN_ACS712    A1     // A1 <- ACS712-30A OUT (soldered)
#define PIN_DS18B20   3      // D3 <- DS18B20 Data   (soldered)

// ---- SoftwareSerial instances ------------------------------
SoftwareSerial ta1Serial  (PIN_TA1_RX,   PIN_TA1_TX);
SoftwareSerial ta2Serial  (PIN_TA2_RX,   PIN_TA2_TX);
SoftwareSerial rs485Serial(PIN_RS485_RX, PIN_RS485_TX);

// ---- TA Protocol -------------------------------------------
#define TA_REQ_HEADER   0xAA
#define TA_RESP_HEADER  0xBB
#define CMD_READ_ALL    0x01
#define TA_TIMEOUT_MS   300

// ---- CM Protocol -------------------------------------------
#define CM_REQ_HEADER   0xCC
#define CM_RESP_HEADER  0xDD
#define CM_CMD_POLL     0x01

// ---- ACS712 configuration ----------------------------------
// Set sensitivity for your ACS712 variant:
//   ACS712-5A  -> 0.185  (185 mV/A)
//   ACS712-20A -> 0.100  (100 mV/A)
//   ACS712-30A -> 0.066  ( 66 mV/A)
const float ACS712_SENSITIVITY = 0.066f;  // V/A  <-- change for your variant
const int   ACS712_SAMPLES     = 1000;    // samples for RMS (~20 ms window)

// ---- Ambient temperature cache -----------------------------
const unsigned long TEMP_REFRESH_MS = 5000;
unsigned long lastTempAt = 0;
float cachedAmbientC     = -999.0f;  // sentinel: not yet read
bool  ambientSensorConnected = false; // tracks DS18B20 presence for reconnect detection

// ---- Heartbeat status print (every 5s, independent of CM polling) ----
const unsigned long HEARTBEAT_MS = 5000;
unsigned long lastHeartbeatAt = 0;

OneWire            oneWire(PIN_DS18B20);
DallasTemperature  ambientSensor(&oneWire);

// ---- TA reading struct -------------------------------------
struct TaReading {
  bool  valid;
  float voltage;
  float tempC;
  float irMilliohms;
};

// ---- Last known TA readings (updated on each CM poll) ------
TaReading lastTA1 = { false, 0.0f, 0.0f, 0.0f };
TaReading lastTA2 = { false, 0.0f, 0.0f, 0.0f };

// ---- ACS712 DC current measurement -------------------------
// Battery system current is DC. At 0A, ACS712 outputs Vcc/2 (~2.50V, ADC ~512).
// Averages 100 samples to eliminate noise, converts to Amps.
// For ACS712-30A: Sensitivity = 0.066 V/A (66 mV/A).
float measureCurrent() {
  long sum = 0;
  const int SAMPLES = 100;
  for (int i = 0; i < SAMPLES; i++) {
    sum += analogRead(PIN_ACS712);
    delayMicroseconds(50);
  }
  float avgAdc = (float)sum / SAMPLES;
  float vOut = avgAdc * (5.0f / 1023.0f);
  float currentA = (vOut - 2.50f) / ACS712_SENSITIVITY;
  
  // Noise deadband: small readings (< 0.08A) clamped to 0.0A
  if (fabs(currentA) < 0.08f) return 0.0f;
  return fabs(currentA);
}

// ---- DS18B20 ambient temperature (background refresh) -----
// Automatically re-discovers the sensor if it was disconnected and reconnected.
void updateCachedAmbientTemp(bool force = false) {
  if (!force && (millis() - lastTempAt < TEMP_REFRESH_MS)) return;
  lastTempAt = millis();

  // Stop all SoftwareSerials to prevent interrupt conflict
  // with OneWire's timing-sensitive protocol
  ta1Serial.stopListening();
  ta2Serial.stopListening();
  rs485Serial.stopListening();

  // If sensor was previously missing, re-scan the bus so the library
  // can re-enumerate any sensor that was plugged back in.
  if (!ambientSensorConnected) {
    ambientSensor.begin();  // re-scan OneWire bus for devices
    ambientSensor.setResolution(9);
    ambientSensor.setWaitForConversion(true);
  }

  float t = DEVICE_DISCONNECTED_C;
  if (ambientSensor.getDeviceCount() > 0) {
    ambientSensor.requestTemperatures();
    delay(100);  // Allow 9-bit conversion (~94ms) to complete
    t = ambientSensor.getTempCByIndex(0);
  }

  rs485Serial.listen();  // always restore RS-485 listener

  if (t != DEVICE_DISCONNECTED_C && t > -55.0f && t < 125.0f) {
    if (!ambientSensorConnected) {
      Serial.println("[TC] DS18B20 reconnected - ambient sensor detected again");
    }
    ambientSensorConnected = true;
    cachedAmbientC = t;
    Serial.print("[TC] DS18B20 read: ");
    Serial.print(t, 2);
    Serial.println(" C");
  } else {
    if (ambientSensorConnected) {
      Serial.println("[TC] DS18B20 disconnected - ambient sensor not found");
    } else {
      Serial.println("[TC] DS18B20 not connected - waiting for ambient sensor");
    }
    ambientSensorConnected = false;
    // Keep cachedAmbientC as last known good value (or -999 if never read)
  }
}

// ---- Poll one TA module ------------------------------------
TaReading pollTaModule(SoftwareSerial &link, byte addr) {
  TaReading r = { false, 0.0f, 0.0f, 0.0f };

  link.listen();
  delay(2);
  while (link.available()) link.read();  // flush stale bytes

  link.write(TA_REQ_HEADER);
  link.write(addr);
  link.write((byte)CMD_READ_ALL);

  unsigned long start = millis();
  byte resp[15];
  int received = 0;

  while (millis() - start < TA_TIMEOUT_MS && received < 15) {
    if (link.available()) resp[received++] = link.read();
  }

  if (received < 15)                              return r;
  if (resp[0] != TA_RESP_HEADER || resp[1] != addr) return r;
  byte chk = 0;
  for (int i = 0; i < 14; i++) chk ^= resp[i];
  if (chk != resp[14])                            return r;

  memcpy(&r.voltage,     &resp[2],  4);
  memcpy(&r.tempC,       &resp[6],  4);
  memcpy(&r.irMilliohms, &resp[10], 4);
  r.valid = true;
  return r;
}

// ---- Handle CM poll request --------------------------------
void handleCmRequest() {
  if (!rs485Serial.available()) return;

  byte header = rs485Serial.read();
  Serial.print("[TC] RS485 RX byte: 0x");
  Serial.println(header, HEX);
  if (header != CM_REQ_HEADER) return;

  unsigned long ws = millis();
  while (!rs485Serial.available()) {
    if (millis() - ws > 50) return;  // incomplete frame
  }
  byte cmd = rs485Serial.read();
  Serial.print("[TC] RS485 CMD byte: 0x");
  Serial.println(cmd, HEX);
  if (cmd != CM_CMD_POLL) return;

  Serial.println("[TC] Poll from CM - gathering data...");

  TaReading r1 = pollTaModule(ta1Serial, 1);
  lastTA1 = r1;  // cache for heartbeat display
  if (r1.valid) {
    Serial.print("[TC] TA1 V="); Serial.print(r1.voltage, 2);
    Serial.print(" T="); Serial.print(r1.tempC, 1);
    Serial.print(" IR="); Serial.print(r1.irMilliohms, 1); Serial.println("mOhm");
  } else Serial.println("[TC] TA1 no response");

  TaReading r2 = pollTaModule(ta2Serial, 2);
  lastTA2 = r2;  // cache for heartbeat display
  if (r2.valid) {
    Serial.print("[TC] TA2 V="); Serial.print(r2.voltage, 2);
    Serial.print(" T="); Serial.print(r2.tempC, 1);
    Serial.print(" IR="); Serial.print(r2.irMilliohms, 1); Serial.println("mOhm");
  } else Serial.println("[TC] TA2 no response");

  float currentA = measureCurrent();
  Serial.print("[TC] Current="); Serial.print(currentA, 3); Serial.println("A");

  float ambientC = cachedAmbientC;
  Serial.print("[TC] Ambient="); Serial.print(ambientC, 1); Serial.println("C");

  // Build 34-byte payload + 1 checksum = 35 bytes total
  byte buf[34];
  byte status = 0x00;
  if (r1.valid) status |= 0x01;
  if (r2.valid) status |= 0x02;

  buf[0] = CM_RESP_HEADER;
  buf[1] = status;
  memcpy(&buf[2],  &r1.voltage,     4);
  memcpy(&buf[6],  &r1.tempC,       4);
  memcpy(&buf[10], &r1.irMilliohms, 4);
  memcpy(&buf[14], &r2.voltage,     4);
  memcpy(&buf[18], &r2.tempC,       4);
  memcpy(&buf[22], &r2.irMilliohms, 4);
  memcpy(&buf[26], &currentA,       4);
  memcpy(&buf[30], &ambientC,       4);

  byte chk = 0;
  for (int i = 0; i < 34; i++) chk ^= buf[i];

  // Transmit on RS-485 (auto-flow module automatically drives bus when transmitting)
  rs485Serial.listen();
  delay(2);
  rs485Serial.write(buf, 34);
  rs485Serial.write(chk);
  delay(10);

  Serial.println("[TC] Response sent.");
  rs485Serial.listen();
}

// ---- Periodic heartbeat: prints live TC status to serial every 5s ----
void printStatusHeartbeat() {
  if (millis() - lastHeartbeatAt < HEARTBEAT_MS) return;
  lastHeartbeatAt = millis();

  float currentA = measureCurrent();

  Serial.println("-------- [TC] STATUS --------");
  // TA1 line
  Serial.print(  "  TA1      : ");
  if (!lastTA1.valid) {
    Serial.println("no response");
  } else {
    Serial.print(lastTA1.voltage, 2); Serial.print("V  ");
    Serial.print(lastTA1.tempC,   1); Serial.print("C  ");
    Serial.print(lastTA1.irMilliohms, 1); Serial.println("mOhm");
  }
  // TA2 line
  Serial.print(  "  TA2      : ");
  if (!lastTA2.valid) {
    Serial.println("no response");
  } else {
    Serial.print(lastTA2.voltage, 2); Serial.print("V  ");
    Serial.print(lastTA2.tempC,   1); Serial.print("C  ");
    Serial.print(lastTA2.irMilliohms, 1); Serial.println("mOhm");
  }
  // Ambient sensor
  Serial.print(  "  AmbSensor: ");
  Serial.println(ambientSensorConnected ? "CONNECTED" : "DISCONNECTED");
  Serial.print(  "  Ambient  : ");
  if (cachedAmbientC <= -900.0f) Serial.println("-- (no reading yet)");
  else { Serial.print(cachedAmbientC, 2); Serial.println(" C"); }
  Serial.print(  "  Current  : "); Serial.print(currentA, 3); Serial.println(" A");
  Serial.println("----------------------------");
}

void setup() {
  Serial.begin(9600);
  ta1Serial.begin(9600);
  ta2Serial.begin(9600);
  rs485Serial.begin(9600);

  pinMode(PIN_RS485_RX, INPUT_PULLUP);

  ambientSensor.begin();
  ambientSensor.setResolution(9);  // 9-bit: ~94 ms, avoids 750 ms blocking
  ambientSensor.setWaitForConversion(true);

  Serial.print("[TC] DS18B20 devices found: ");
  Serial.println(ambientSensor.getDeviceCount());
  if (ambientSensor.getDeviceCount() == 0)
    Serial.println("[TC] WARNING: No DS18B20 on D3 - check wiring + 4.7k pull-up");

  lastTempAt = millis();
  updateCachedAmbientTemp(true);  // force initial read at boot

  rs485Serial.listen();

  Serial.print("[TC] RS-485 RX (D4) idle line state: ");
  if (digitalRead(PIN_RS485_RX) == HIGH) {
    Serial.println("HIGH (Good - bus is normal)");
  } else {
    Serial.println("LOW -> WARNING: A/B wires inverted or RX/TX wires swapped!");
  }

  Serial.println("=== RMS-TC Phase 3 Ready - Waiting for CM polls ===");
  lastHeartbeatAt = millis();
}

// ---- Main loop ---------------------------------------------
void loop() {
  handleCmRequest();          // respond to CM when polled
  updateCachedAmbientTemp();  // refresh ambient temp every 5s in background
  printStatusHeartbeat();     // print live status every 5s to serial monitor
}
