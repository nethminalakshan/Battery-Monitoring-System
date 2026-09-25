# RMS Battery Intelligence & Monitoring System

A comprehensive, industrial-grade **Remote Battery Monitoring System (RMS)** designed to provide real-time telemetry, state-of-charge calculation, internal resistance degradation tracking, and historical analytics for multi-cell battery installations (e.g. 12V Lead-Acid / Li-Ion storage banks).

The system combines **distributed Arduino/ESP8266 hardware nodes** over an **RS-485 industrial fieldbus**, a **cloud MQTT telemetry broker**, a **Node.js/Express backend service connected to MongoDB Atlas**, and an **aerospace cyberpunk glassmorphic React 19 web portal**.

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HARDWARE SENSOR LAYER                           │
│                                                                        │
│   ┌─────────────────────┐             ┌─────────────────────┐         │
│   │  Battery Cell #1    │             │  Battery Cell #2    │         │
│   │  Arduino TA1 Node   │             │  Arduino TA2 Node   │         │
│   │  (Voltage/Temp/IR)  │             │  (Voltage/Temp/IR)  │         │
│   └──────────┬──────────┘             └──────────┬──────────┘         │
│              │                                   │                     │
│              │            RS-485 Fieldbus        │                     │
│              └─────────────────┬─────────────────┘                     │
│                                │                                       │
│                     ┌──────────┴──────────┐                           │
│                     │   Arduino Uno TC    │ (Phase 3 Master)           │
│                     │  Current & Amb Temp │                           │
│                     └──────────┬──────────┘                           │
│                                │ Serial                                │
│                     ┌──────────┴──────────┐                           │
│                     │  ESP8266 NodeMCU CM │ (rms_cm)                  │
│                     │  WiFi + MQTT Client │                           │
│                     └──────────┬──────────┘                           │
└────────────────────────────────┼───────────────────────────────────────┘
                                 │
                     MQTT (broker.hivemq.com)
                                 │
     ┌───────────────────────────┴───────────────────────────┐
     │                                                       │
┌────▼─────────────────────────────────┐       ┌─────────────▼───────────────────────┐
│        BACKEND SERVICE (Node.js)     │       │     REACT FRONTEND (Vite / React 19)│
│  - Express REST API (/api/logs, etc.)│       │  - Live Cyber Glassmorphism UI      │
│  - MQTT Ingestion Engine             │       │  - Animated Battery Pack Visualizers│
│  - MongoDB Atlas Cloud Persistence   │       │  - Semi-circular Current Arc Gauge  │
│  - Auto Data Downsampling for Charts │       │  - Glowing Recharts Analytics       │
└─────────────────┬────────────────────┘       │  - Previous Logs Browser + CSV Export│
                  │                            │  - MongoDB Atlas Cloud Manager Modal│
                  ▼                            └─────────────────────────────────────┘
     ┌────────────────────────┐
     │   MongoDB Atlas Cloud   │
     │ (Online Cluster Storage│
     └────────────────────────┘
```

---

## Directory Structure

```
Battery Monitoring System/
├── README.md                      # Comprehensive project documentation
├── server/                        # Node.js + Express + MongoDB Atlas backend
│   ├── config/
│   │   └── db.js                  # Resilient Mongoose connection + DNS resolver
│   ├── models/
│   │   ├── BatteryLog.js          # Telemetry record schema with compound indexes
│   │   └── SystemEvent.js         # Fault and hardware alert schema
│   ├── routes/
│   │   └── api.js                 # REST endpoints (health, logs, stats, seed)
│   ├── services/
│   │   └── mqttService.js         # HiveMQ subscriber & MongoDB auto-logger
│   ├── .env                       # Environment variables (MongoDB URI & ports)
│   ├── .env.example               # Template environment configuration
│   ├── package.json               # Backend dependencies
│   └── server.js                  # Application entrypoint
│
├── react-dashboard/               # Modern React 19 + Vite frontend portal
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx         # Status badges, tabs, and connection indicators
│   │   │   ├── BatteryCard.jsx    # Animated cell pack with SoC bar & thermals
│   │   │   ├── SystemOverview.jsx # Current flow arc gauge & ambient thermometer
│   │   │   ├── AnalyticsCharts.jsx# Interactive glowing multi-variable charts
│   │   │   ├── PreviousLogsPortal.jsx # Historical logs browser with CSV export
│   │   │   ├── MongoConfigModal.jsx# In-app MongoDB Atlas connection manager
│   │   │   └── LiveLogsConsole.jsx# Real-time MQTT stream terminal
│   │   ├── App.jsx                # Root component coordinating MQTT & REST API
│   │   ├── App.css                # Layout, components, and responsive styling
│   │   ├── index.css              # Custom design system tokens & glows
│   │   └── main.jsx               # React entry point
│   ├── index.html                 # Web portal entry with Google Fonts
│   ├── package.json               # Frontend dependencies (lucide, recharts, mqtt)
│   └── vite.config.js             # Vite configuration
│
└── Firmware / Arduino Sketches/
    ├── rms_cm/                    # ESP8266 NodeMCU Central Monitor firmware
    │   └── rms_cm.ino             # SoftwareSerial RS-485 + WiFi + MQTT publish
    ├── rms_ta1_stage2_v2/         # Battery 1 Monitor Arduino firmware
    │   └── rms_ta1_stage2_v2.ino  # Voltage, Temperature, and IR measurement
    ├── rms_ta2_stage2_v2/         # Battery 2 Monitor Arduino firmware
    │   └── rms_ta2_stage2_v2.ino  # Voltage, Temperature, and IR measurement
    ├── rms_tc_phase2/             # Central Transceiver Phase 2 Arduino firmware
    │   └── rms_tc_phase2.ino
    └── rms_tc_phase3/             # Central Transceiver Phase 3 Arduino firmware
        └── rms_tc_phase3.ino      # ACS712 current sensing, ambient NTC, RS-485 master
```

---

## Comprehensive RMS Hardware Modules & Subsystem Deep-Dive

The RMS hardware layer is engineered as a **galvanically isolated, distributed telemetry architecture** that safely monitors multi-cell battery packs connected in series while preventing hazardous ground loops.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   RMS HARDWARE ARCHITECTURE                                     │
│                                                                                                 │
│   ┌────────────────────────────────┐                 ┌────────────────────────────────┐         │
│   │     RMS-TA #1 (Cell 1 Unit)     │                 │     RMS-TA #2 (Cell 2 Unit)     │         │
│   │  - V-Divider (270k/56k) -> A0  │                 │  - V-Divider (270k/56k) -> A0  │         │
│   │  - Pulsed MOSFET Load   -> D9  │                 │  - Pulsed MOSFET Load   -> D9  │         │
│   │  - DS18B20 Temp Probe   -> D2  │                 │  - DS18B20 Temp Probe   -> D2  │         │
│   │  - Isolated Serial      -> D10/D11               │  - Isolated Serial      -> D10/D11               │
│   └───────────────┬────────────────┘                 └───────────────┬────────────────┘         │
│                   │                                                  │                          │
│       [ADuM1201 Magnetic Isolator #1]                    [ADuM1201 Magnetic Isolator #2]        │
│       (2.5 kV Galvanic Barrier)                          (2.5 kV Galvanic Barrier)              │
│                   │                                                  │                          │
│                   └────────────────────────┬─────────────────────────┘                          │
│                                            │ Isolated Serial Lines                              │
│                                 ┌──────────▼──────────┐                                         │
│                                 │     RMS-TC MODULE   │                                         │
│                                 │  (Central Master)   │                                         │
│                                 │  - ACS712-30A -> A1 │                                         │
│                                 │  - Amb DS18B20 -> D3│                                         │
│                                 │  - RS-485 TX/RX->D5/D4                                        │
│                                 └──────────┬──────────┘                                         │
│                                            │ Differential Bus (A & B)                           │
│                                    [MAX3485 RS-485]                                             │
│                                            │                                                    │
│                                 ┌──────────▼──────────┐                                         │
│                                 │     RMS-CM MODULE   │                                         │
│                                 │  (ESP8266 NodeMCU)  │                                         │
│                                 │  - RS-485 -> D5/D6  │                                         │
│                                 │  - WiFi 802.11 b/g/n│                                         │
│                                 │  - Native USB Debug │                                         │
│                                 └──────────┬──────────┘                                         │
│                                            │ WiFi TCP:1883                                      │
│                                            ▼                                                    │
│                                    HiveMQ Cloud MQTT                                            │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1. RMS-TA Module (Terminal Acquisition Node — TA1 & TA2)
Each battery cell in the bank has a dedicated **RMS-TA** module mounted directly at its terminals.

- **Microcontroller**: Arduino Uno (ATmega328P @ 16 MHz, 5V logic).
- **Galvanic Isolation Principle**: In a series string (e.g. 24V or 48V bank), Cell #1 reference ground sits at 0V, but Cell #2 sits at +12V. Connecting shared ground wires across cells will create a catastrophic short-circuit. The RMS-TA module's communication lines pass through an **Analog Devices ADuM1201 dual-channel digital magnetic isolator** providing **2.5 kV RMS** galvanic isolation.

#### Sensing Circuits & Principles:
1. **Terminal Voltage Sensing**:
   - A precision resistor voltage divider ($R_1 = 270\,\text{k}\Omega$, $R_2 = 56\,\text{k}\Omega$) scales down 0–16V nominal terminal voltage into the 0–5V ADC input range:
     $$\text{Divider Ratio} = \frac{R_2}{R_1 + R_2} = \frac{56000}{270000 + 56000} \approx 0.17178$$
     $$V_{\text{cell}} = \left(\frac{\text{ADC}_{\text{raw}}}{1023}\right) \times 5.0\,\text{V} \times \frac{1}{\text{Divider Ratio}}$$
   - Uses an 8-sample rolling ADC average with 2 ms settling intervals to filter out high-frequency inverter ripple.

2. **Dynamic Internal Resistance ($R_{\text{int}}$) Measurement**:
   - Driven by pin `D9` (`PIN_IR_GATE`) controlling an N-Channel Power MOSFET.
   - The MOSFET pulses a switched high-power $12.0\,\Omega$ ceramic load resistor across the battery terminals for exactly **30 ms** (`IR_PULSE_MS`).
   - The module samples voltage immediately before the pulse ($V_{\text{before}}$) and during the pulse ($V_{\text{during}}$):
     $$\Delta V = V_{\text{before}} - V_{\text{during}}$$
     $$I_{\text{load}} = \frac{V_{\text{during}}}{12.0\,\Omega}$$
     $$R_{\text{int}} = \left(\frac{\Delta V}{I_{\text{load}}}\right) \times 1000 \quad [\text{measured in } m\Omega]$$
   - Internal resistance directly reflects battery state-of-health (SoH), plate sulfation, and electrolyte dry-out.

3. **Cell Post Temperature Sensing**:
   - Dallas/Maxim **DS18B20** digital temperature sensor mounted directly onto the battery positive lead terminal lug.
   - Operated in **non-blocking background mode** (9-bit resolution, converted every 5000 ms). Reading temperature in the background avoids the 750 ms blocking delay of default 12-bit DS18B20 reads, preventing poll timeouts on the isolated UART link.

#### TA Pin Mapping:
| Pin | Function | Hardware / Connection |
|---|---|---|
| `A0` | Analog Input | Voltage Divider output ($270\,\text{k}\Omega / 56\,\text{k}\Omega$) |
| `D9` | Digital Output | Gate of IR test MOSFET switch |
| `D2` | One-Wire Bus | DS18B20 temperature data (with 4.7k pullup to 5V) |
| `D10` | SoftwareSerial RX | ADuM1201 isolated RX link from TC |
| `D11` | SoftwareSerial TX | ADuM1201 isolated TX link to TC |
| `USB` | Hardware UART | 9600 baud local calibration and debug |

#### TA Inter-Module Protocol:
- **Poll Request (TC $\rightarrow$ TA)**: `[0xAA][ADDR][0x01]` (3 bytes, where `ADDR = 1` for TA1, `ADDR = 2` for TA2).
- **Poll Response (TA $\rightarrow$ TC)**: `[0xBB][ADDR][V:4 bytes float][T:4 bytes float][IR:4 bytes float][Checksum:1 byte]` (15 bytes total).

---

### 2. RMS-TC Module (Transceiver & Central Master — Phase 3)
The **RMS-TC** module acts as the central coordinator and master instrument node.

- **Microcontroller**: Arduino Uno (ATmega328P).
- **Core Role**:
  1. Manages dual isolated SoftwareSerial ports communicating independently with TA1 and TA2.
  2. Samples the system string current using a Hall-effect sensor.
  3. Measures ambient chamber temperature.
  4. Encapsulates all readings into a unified 35-byte binary telemetry packet and transmits it over RS-485 to the Central Monitor (CM).

#### Sensing Circuits:
1. **System Load Current (ACS712-30A)**:
   - Wired to analog pin `A1`.
   - Sensitivity: $0.066\,\text{V/A}$ ($66\,\text{mV/A}$).
   - Computes **True RMS Current** by sampling 1000 consecutive ADC readings over a 20 ms AC cycle window:
     $$I_{\text{RMS}} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} \left(\frac{V_i - V_{\text{quiescent}}}{\text{Sensitivity}}\right)^2}$$
2. **Ambient Chamber Temperature**:
   - Digital DS18B20 probe wired to pin `D3` measuring ambient battery cabinet air temperature.
3. **RS-485 Communication Subsystem**:
   - MAX3485/MAX485 differential bus transceiver connected on `D4` (RX) and `D5` (TX) with balanced lines $A$ and $B$.

#### TC Pin Mapping:
| Pin | Function | Hardware / Connection |
|---|---|---|
| `D10` | SoftwareSerial RX | TA #1 Link via ADuM1201 #1 output |
| `D11` | SoftwareSerial TX | TA #1 Link via ADuM1201 #1 input |
| `A2` | SoftwareSerial RX | TA #2 Link via ADuM1201 #2 output |
| `A3` | SoftwareSerial TX | TA #2 Link via ADuM1201 #2 input |
| `A1` | Analog Input | ACS712-30A Current Sensor OUT |
| `D3` | One-Wire Bus | DS18B20 Ambient Temperature Probe |
| `D4` | SoftwareSerial RX | MAX3485 Receiver Output (`RO`) from CM |
| `D5` | SoftwareSerial TX | MAX3485 Driver Input (`DI`) to CM |
| `D0/D1`| USB Serial | Native Serial monitor @ 9600 baud |

#### TC $\rightarrow$ CM 35-Byte Binary Response Frame Structure:
```
Byte 0       : 0xDD (Header)
Byte 1       : Status Flag Bitmask (bit 0 = TA1 valid, bit 1 = TA2 valid)
Bytes 2 - 5  : TA1 Voltage (32-bit IEEE 754 Float, Volts)
Bytes 6 - 9  : TA1 Temperature (32-bit Float, °C)
Bytes 10 - 13: TA1 Internal Resistance (32-bit Float, mΩ)
Bytes 14 - 17: TA2 Voltage (32-bit Float, Volts)
Bytes 18 - 21: TA2 Temperature (32-bit Float, °C)
Bytes 22 - 25: TA2 Internal Resistance (32-bit Float, mΩ)
Bytes 26 - 29: Main String Current (32-bit Float, Amperes RMS)
Bytes 30 - 33: Ambient Temperature (32-bit Float, °C)
Byte 34      : XOR Checksum of Bytes 0 to 33
```

---

### 3. RMS-CM Module (Central Monitor & IoT Cloud Gateway)
The **RMS-CM** is the network bridge that connects the local RS-485 bus to the cloud.

- **Microcontroller**: NodeMCU v1.0 (ESP8266 ESP-12E @ 80 MHz, 32-bit Tensilica L106).
- **Firmware Architecture (v2 RS-485 Fix)**:
  - Previous firmware shared Hardware UART0 (`GPIO1`/`GPIO3`) between the MAX3485 transceiver and the onboard USB-to-UART CP2102 bridge, causing USB noise to corrupt RS-485 packets.
  - **The v2 Architecture**: Relocated RS-485 communications entirely to `SoftwareSerial` on pins `D5` (GPIO14 RX) and `D6` (GPIO12 TX). Hardware UART0 is dedicated to clean, uninterrupted USB Serial monitoring at 115200 baud.
- **Polling Loop & Timing**:
  - Every **5000 ms** (`POLL_INTERVAL_MS`), the CM transmits poll command `[0xCC][0x01]` over RS-485.
  - Allows up to **2000 ms** for the TC module to poll both TA nodes, perform the 1000-sample ACS712 RMS calculation, and transmit the 35-byte reply.
  - Unpacks the binary floats, verifies the XOR checksum, and publishes individual MQTT topics directly to `broker.hivemq.com`.

#### CM Pin Mapping:
| NodeMCU Pin | GPIO | Function | Connection |
|---|---|---|---|
| `D5` | GPIO14 | SoftwareSerial RX | MAX3485 `RO` (Receiver Output from TC) |
| `D6` | GPIO12 | SoftwareSerial TX | MAX3485 `DI` (Driver Input to TC) |
| `D2` | GPIO4  | Direction Control | MAX3485 `DE` + `RE` (if manual flow module) |
| `3.3V / VIN` | — | Power Supply | 3.3V / 5V DC supply |
| `GND` | — | Common Ground | Common with TC ground |
| `USB (D0/D1)`| GPIO1/3 | Native Hardware UART | Serial debug console @ 115200 baud |

---

## MQTT Specification

The system communicates over HiveMQ public broker (`broker.hivemq.com`):
- **TCP Port (Hardware & Backend)**: `1883`
- **WebSocket Port (Web Browser)**: `8884/mqtt` (`wss://broker.hivemq.com:8884/mqtt`)

| Topic | Format | Unit | Description |
|---|---|---|---|
| `rms/battery/1/voltage` | Float | `V` | Battery Cell 1 terminal voltage (e.g. `12.52`) |
| `rms/battery/1/temperature` | Float | `°C` | Battery Cell 1 post temperature |
| `rms/battery/1/ir` | Float | `mΩ` | Battery Cell 1 internal resistance |
| `rms/battery/2/voltage` | Float | `V` | Battery Cell 2 terminal voltage (e.g. `14.28`) |
| `rms/battery/2/temperature` | Float | `°C` | Battery Cell 2 post temperature |
| `rms/battery/2/ir` | Float | `mΩ` | Battery Cell 2 internal resistance |
| `rms/system/current` | Float | `A` | Total load/charge current (e.g. `0.549`) |
| `rms/system/temperature` | Float | `°C` | Battery enclosure ambient temperature |
| `rms/status` | JSON | — | `{ "online": true, "ta1": true, "ta2": true, "tc_error": false, "uptime": 4130 }` |

---

## Web Portal Features

### 1. Live Monitor
- **Interactive Battery Pack Cards**:
  - Real-time animated **State of Charge (SoC)** bar (0–100%) mapped to nominal battery voltage curve.
  - Threshold alert pill badges (`Normal`, `Low Voltage < 11.5V`, `High Voltage > 14.0V`, `Overtemp > 45°C`).
  - Formatted readouts with disconnected sensor error suppression (negative values like `-999` cleanly rendered as `N/A`).
- **Semi-Circular Current Flow Arc Gauge**:
  - Radial SVG gauge measuring up to 30 Amperes with charging vs discharging state awareness.
- **Ambient Chamber Thermometer**:
  - Color-gradient heat bar for enclosure temperature.
- **Live MQTT Terminal Stream**:
  - Embedded real-time console with pause, resume, and clear controls.

### 2. Analytics & Glowing Charts (Recharts)
- **Dual Cell Voltage Waveforms**: Synchronized area waveforms comparing Cell 1 and Cell 2 against safety limit reference lines.
- **Current Flow Curve**: Dynamic load profile graph.
- **Thermal Dynamics**: Cell 1, Cell 2, and ambient temperature heatlines with a 45°C safety limit line.
- **Internal Resistance Degradation Curve**: Tracks cell wear in $m\Omega$ over time (primary battery state-of-health indicator).
- **Timeframe Selector**: Toggle between `1H`, `6H`, `24H`, `7D`, `30D`, and `ALL`.

### 3. Historical Logs Portal
- **Direct MongoDB Atlas Ingestion**: All telemetry received by the server is debounced and stored in your online cloud cluster.
- **Search & Filtering**: Filter by Cell (`Cell #1`, `Cell #2`, `All`), severity level (`Normal`, `Warnings`, `Critical Faults`), or text query.
- **Export to CSV**: Instant one-click export to download formatted Excel/CSV spreadsheets.
- **Seed Sample Logs**: Populate 120 realistic historical telemetry logs spanning a 24-hour cycle to test charts and tables anytime.

### 4. MongoDB Atlas Cloud Manager Modal
- Check connection status, active cluster hostname, and connection health directly from the navbar.
- Change or test your MongoDB Atlas connection string (`mongodb+srv://...`) directly in the UI without server restarts.

---

## Installation & Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or later (`node -v`)
- **npm**: v9.0.0 or later (`npm -v`)
- **Arduino IDE**: (if flashing firmware) with `ESP8266` board support and `PubSubClient` library.

---

### Step 1: Configure Backend Environment
Navigate to `server/` and create or edit `.env`:

```env
PORT=5000
MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/battery_monitoring?retryWrites=true&w=majority"
MQTT_BROKER=mqtt://broker.hivemq.com:1883
MQTT_CLIENT_ID=rms-server-backend
```

### Step 2: Start the Backend Server
```bash
cd server
npm install
npm start
```
The server will boot on `http://localhost:5000` and automatically connect to MongoDB Atlas and the HiveMQ broker.

### Vercel deployment

Deploy the `server/` directory as a separate Vercel project. In the server Vercel
project, add `MONGODB_URI` under **Settings > Environment Variables** for the
Production environment. Do not commit or upload `server/.env`.

Deploy `react-dashboard/` as the frontend Vercel project and add
`VITE_API_BASE_URL` with the deployed server URL, for example:

```text
https://your-server-project.vercel.app/api
```

Also add the Vercel server's outbound access in MongoDB Atlas Network Access
(using `0.0.0.0/0` if a fixed Vercel IP range is not available). Redeploy both
projects after changing environment variables.

### Step 3: Start the React Application
In a new terminal window:
```bash
cd react-dashboard
npm install
npm run dev
```
Open your browser and navigate to:
**[http://localhost:5173](http://localhost:5173)**

---

## REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check returning MongoDB connection state, MQTT broker status, and hardware heartbeat |
| `GET` | `/api/telemetry/live` | Current in-memory snapshot of all cells and subsystem status |
| `GET` | `/api/logs` | Paginated historical logs from MongoDB Atlas (supports `?page=1&limit=25&batteryId=1&level=warn`) |
| `GET` | `/api/stats/history` | Downsampled time-series data for analytics charts (`?timeframe=24h`) |
| `GET` | `/api/stats/summary` | Min/Max/Avg voltages, peak temps, and lifetime record counts |
| `POST` | `/api/logs/seed` | Generates and saves 120 realistic telemetry entries into MongoDB Atlas |
| `POST` | `/api/config/mongo-uri` | Dynamically updates and tests the MongoDB Atlas connection string |
| `DELETE` | `/api/logs/clear` | Purges test records from MongoDB Atlas |

---

## Firmware Configuration & Flashing

1. Open `rms_cm/rms_cm.ino` in Arduino IDE.
2. Under **USER CONFIGURATION**, update your WiFi credentials:
   ```cpp
   const char* WIFI_SSID     = "Your_WiFi_SSID";
   const char* WIFI_PASSWORD = "Your_WiFi_Password";
   ```
3. Board Selection: **NodeMCU 1.0 (ESP-12E Module)**.
4. Upload speed: `115200`.
5. Connect your ESP8266 via USB and click **Upload**.
6. Open Serial Monitor (`115200` baud) to verify WiFi connection and MQTT publish confirmation.

---

## License & Attribution
Developed for the Remote Battery Monitoring System (RMS) project.
Designed with React 19, Vite, Recharts, Lucide Icons, Express, Mongoose, and HiveMQ.
