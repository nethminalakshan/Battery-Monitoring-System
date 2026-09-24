/*
 * RMS-TA Module - Stage 2 Firmware (TA #1) - FIXED v2
 * Board: Arduino Uno
 * Isolated link: SoftwareSerial D10(RX)/D11(TX) via ADuM1201
 * Debug console: native USB (Serial), 9600 baud
 *
 * FIX (v2): DS18B20 read moved out of the request/response path.
 * Root cause of v1 issues:
 *   1. tempSensor.requestTemperatures() blocks ~750ms at default
 *      12-bit resolution - far longer than TC's 300ms poll timeout.
 *   2. SoftwareSerial and OneWire both need precise interrupt timing
 *      and conflict with each other, causing DS18B20 reads to fail
 *      (-127.0C = DEVICE_DISCONNECTED) whenever SoftwareSerial is active.
 *   3. Late/misaligned responses arriving after TC already gave up
 *      caused garbled data on the NEXT poll cycle.
 *
 * Fix: read temperature in the background every few seconds (not on
 * every request), use 9-bit resolution for a faster conversion, and
 * respond to requests instantly using the cached value.
 *
 * NOTE: Identical code runs on TA #2 - only TA_ADDRESS differs (set to 2 there).
 */

#include <SoftwareSerial.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ---- Address for THIS module ----
#define TA_ADDRESS 1   // <-- TA #2 uses 2

// ---- Pins ----
#define PIN_VSENSE   A0
#define PIN_IR_GATE  9
#define PIN_ONEWIRE  2
#define PIN_CHAIN_RX 10
#define PIN_CHAIN_TX 11

SoftwareSerial chainSerial(PIN_CHAIN_RX, PIN_CHAIN_TX);

// ---- Voltage divider (270k/56k) ----
const float DIVIDER_RATIO = 56000.0 / (270000.0 + 56000.0);
const float ADC_VREF = 5.0;
const int   ADC_MAX  = 1023;

// ---- IR test ----
const float LOAD_RESISTANCE  = 12.0;
const int   IR_PULSE_MS      = 30;*
const int   SAMPLES_PER_READ = 8;

// ---- Protocol ----
#define REQ_HEADER   0xAA
#define RESP_HEADER  0xBB
#define CMD_READ_ALL 0x01

// ---- Temperature caching ----
const unsigned long TEMP_READ_INTERVAL_MS = 5000; // background refresh every 5s
unsigned long lastTempReadAt = 0;
float cachedTempC = -999.0; // obvious sentinel: no sensor detected yet / all reads failed
bool  sensorConnected = false;  // tracks DS18B20 presence for reconnect detection

// ---- Heartbeat status print (every 5s, independent of TC polling) ----
const unsigned long HEARTBEAT_MS = 5000;
unsigned long lastHeartbeatAt = 0;

OneWire oneWire(PIN_ONEWIRE);
DallasTemperature tempSensor(&oneWire);

int readAdcAveraged(int pin, int samples) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delay(2);
  }
  return sum / samples;
}

float readCellVoltage() {
  int raw = readAdcAveraged(PIN_VSENSE, SAMPLES_PER_READ);
  float vAdc = (raw / (float)ADC_MAX) * ADC_VREF;
  return vAdc / DIVIDER_RATIO;
}

float measureInternalResistance() {
  float vBefore = readCellVoltage();
  digitalWrite(PIN_IR_GATE, HIGH);
  delay(5);
  float vDuring = readCellVoltage();
  delay(IR_PULSE_MS);
  digitalWrite(PIN_IR_GATE, LOW);

  float deltaV = vBefore - vDuring;
  float iLoad  = vDuring / LOAD_RESISTANCE;
  if (iLoad <= 0.001) return -1.0;
  return (deltaV / iLoad) * 1000.0; // milliohms
}

// Runs in the background, NOT during request handling
// Automatically re-discovers DS18B20 if it was disconnected and reconnected.
void updateCachedTemperature() {
  if (millis() - lastTempReadAt < TEMP_READ_INTERVAL_MS) return;
  lastTempReadAt = millis();

  // Briefly stop listening on the isolated link while OneWire does its
  // precise timing - reduces interrupt contention with SoftwareSerial
  chainSerial.stopListening();

  // If sensor was previously missing, re-scan the bus so the library
  // can re-enumerate any sensor that was plugged back in.
  if (!sensorConnected) {
    tempSensor.begin();  // re-scan OneWire bus for devices
  }

  float t = DEVICE_DISCONNECTED_C;
  if (tempSensor.getDeviceCount() > 0) {
    tempSensor.requestTemperatures();
    delay(100); // wait for 9-bit conversion (~94 ms)
    t = tempSensor.getTempCByIndex(0);
  }

  chainSerial.listen();

  if (t != DEVICE_DISCONNECTED_C && t > -55.0f && t < 125.0f) {
    if (!sensorConnected) {
      Serial.println("[TA-1] DS18B20 reconnected - sensor detected again");
    }
    sensorConnected = true;
    cachedTempC = t; // only update on a good read, keep last-known-good otherwise
    Serial.print("[TA-1] Temp: ");
    Serial.print(t, 2);
    Serial.println(" C");
  } else {
    if (sensorConnected) {
      Serial.println("[TA-1] DS18B20 disconnected - sensor not found");
    } else {
      Serial.println("[TA-1] DS18B20 not connected - waiting for sensor");
    }
    sensorConnected = false;
    // Keep cachedTempC as last known good value (or -999 if never read)
  }
}

void handleRequest() {
  if (chainSerial.available() < 1) return;

  byte header = chainSerial.read();
  if (header != REQ_HEADER) return;

  unsigned long waitStart = millis();
  while (chainSerial.available() < 2) {
    if (millis() - waitStart > 100) return; // partial frame, give up
  }
  byte addr = chainSerial.read();
  byte cmd  = chainSerial.read();

  if (addr != TA_ADDRESS || cmd != CMD_READ_ALL) return;

  float voltage      = readCellVoltage();       // fast, ~16ms
  float tempC         = cachedTempC;              // instant, no blocking
  float irMilliohms   = measureInternalResistance(); // ~65ms

  // [0xBB][ADDR][V(4)][T(4)][IR(4)][CHK(1)] = 15 bytes total
  byte buf[14];
  buf[0] = RESP_HEADER;
  buf[1] = addr;
  memcpy(&buf[2],  &voltage,      4);
  memcpy(&buf[6],  &tempC,        4);
  memcpy(&buf[10], &irMilliohms,  4);

  byte chk = 0;
  for (int i = 0; i < 14; i++) chk ^= buf[i];

  chainSerial.write(buf, 14);
  chainSerial.write(chk);

  Serial.print("[TA-");
  Serial.print(TA_ADDRESS);
  Serial.print("] Responded: V=");
  Serial.print(voltage, 2);
  Serial.print("V T=");
  Serial.print(tempC, 1);
  Serial.print("C IR=");
  Serial.print(irMilliohms, 1);
  Serial.println("mOhm");
}

// ---- Periodic heartbeat: prints live readings to serial every 5s ----
void printStatusHeartbeat() {
  if (millis() - lastHeartbeatAt < HEARTBEAT_MS) return;
  lastHeartbeatAt = millis();

  float voltage     = readCellVoltage();
  float irMilliohms = measureInternalResistance();

  Serial.println("-------- [TA-1] STATUS --------");
  Serial.print(  "  Sensor   : ");
  Serial.println(sensorConnected ? "CONNECTED" : "DISCONNECTED");
  Serial.print(  "  Voltage  : "); Serial.print(voltage, 3);     Serial.println(" V");
  Serial.print(  "  Temp     : ");
  if (cachedTempC <= -900.0f) Serial.println("-- (no reading yet)");
  else { Serial.print(cachedTempC, 2); Serial.println(" C"); }
  Serial.print(  "  Int.Res  : "); Serial.print(irMilliohms, 2); Serial.println(" mOhm");
  Serial.println("------------------------------");
}

void setup() {
  Serial.begin(9600);
  chainSerial.begin(9600);
  delay(300);
  Serial.print("=== RMS-TA-");
  Serial.print(TA_ADDRESS);
  Serial.println(" Stage 2 Firmware v2 (fixed) ===");

  pinMode(PIN_IR_GATE, OUTPUT);
  digitalWrite(PIN_IR_GATE, LOW);

  tempSensor.begin();
  tempSensor.setResolution(9); // 9-bit = ~94ms conversion instead of ~750ms

  Serial.print("DS18B20 devices found: ");
  Serial.println(tempSensor.getDeviceCount());
  if (tempSensor.getDeviceCount() == 0) {
    Serial.println("WARNING: no DS18B20 detected - check wiring/pull-up resistor");
  }

  chainSerial.listen();

  // Do one temperature read at boot so cachedTempC isn't just the default
  lastTempReadAt = 0;
  updateCachedTemperature();

  lastHeartbeatAt = millis();
}

void loop() {
  handleRequest();
  updateCachedTemperature(); // only actually runs every 5s, rest of the time it's a cheap check
  printStatusHeartbeat();    // print live status every 5s to serial monitor
}
