export type TimeHorizon = "now" | "+6h" | "+12h" | "+24h";

export type SpatialGridCell = {
  id: string;
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
  center: [number, number];
  elevation_m: number;
  slope_deg: number;
  distance_to_river_m: number;
  sar_water_fraction: number;
  risk_score: number;
  risk_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  forecast?: Record<TimeHorizon, {
    risk_score: number;
    sar_water_fraction: number;
    risk_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  }>;
};

export type HistoricalAllocation = {
  resource: string;
  resource_type: "AMBULANCE" | "RESCUE_BOAT";
  dispatch_mode?: string;
  village_id: string;
  village_name: string;
  priority_score: number;
  priority_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  population: number;
  distance_km: number;
  estimated_travel_time_min: number;
  assignment_score: number;
  reason: string;
};

export type HistoricalSnapshot = {
  timestamp: string;
  label: string;
  rainfall_24h_mm: number;
  river_level_m: number;
  mean_risk_score: number;
  hazard_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  affected_roads: string[];
  affected_villages: string[];
  affected_hospitals: string[];
  population_affected: number;
  satellite_pass_time: string;
  status_summary: string;
  historical_allocations: HistoricalAllocation[];
};

export type SectorVillage = {
  name: string;
  type: string;
  population: number;
  vulnerability: string;
  coords: [number, number];
};

export type SectorHospital = {
  name: string;
  type: string;
  capacity: number;
  role: string;
  coords: [number, number];
};

export type SectorShelter = {
  name: string;
  capacity: number;
  type: string;
  coords: [number, number];
};

export type SectorRoad = {
  name: string;
  type: string;
  significance: string;
  positions: [number, number][];
};

export type SectorData = {
  id: string;
  name: string;
  region: string;
  riverBasin: string;
  center: [number, number];
  aoiBounds?: [[number, number], [number, number]];
  riverChannelPolygon?: [number, number][];
  embankmentBund?: [number, number][];
  floodInundationPolygon?: [number, number][];
  floodInundationForecast?: Record<TimeHorizon, [number, number][]>;
  utilities?: Record<string, { name: string; type: string; status: string; coords: [number, number]; threshold: number }>;
  villages: Record<string, SectorVillage>;
  hospitals: Record<string, SectorHospital>;
  shelters: Record<string, SectorShelter>;
  ambulances: Record<string, { name: string; type: string; coords: [number, number] }>;
  resourceBases: Record<string, [number, number]>;
  roads: Record<string, SectorRoad>;
};

export const SECTOR_INFRASTRUCTURE: Record<string, SectorData> = {
  barauni: {
    id: "barauni",
    name: "Barauni - Sultanganj Diara",
    region: "Begusarai, Bihar",
    riverBasin: "Ganga River Main Channel",
    center: [25.148, 85.950],
    aoiBounds: [[25.130, 85.932], [25.166, 85.968]],
    riverChannelPolygon: [
      [25.1660, 85.9510],
      [25.1680, 85.9620],
      [25.1650, 85.9700],
      [25.1550, 85.9690],
      [25.1460, 85.9670],
      [25.1380, 85.9630],
      [25.1340, 85.9570],
      [25.1400, 85.9520],
      [25.1480, 85.9495],
      [25.1550, 85.9485],
      [25.1620, 85.9490],
    ],
    embankmentBund: [
      [25.1360, 85.9440],
      [25.1400, 85.9450],
      [25.1440, 85.9460],
      [25.1480, 85.9465],
      [25.1520, 85.9460],
      [25.1560, 85.9455],
      [25.1620, 85.9450],
      [25.1660, 85.9445],
    ],
    floodInundationPolygon: [
      [25.1440, 85.9468],
      [25.1485, 85.9466],
      [25.1530, 85.9462],
      [25.1580, 85.9458],
      [25.1640, 85.9455],
      [25.1680, 85.9550],
      [25.1670, 85.9660],
      [25.1590, 85.9680],
      [25.1490, 85.9660],
      [25.1400, 85.9620],
      [25.1350, 85.9550],
      [25.1390, 85.9480],
    ],
    floodInundationForecast: {
      now: [
        [25.1440, 85.9468],
        [25.1485, 85.9466],
        [25.1530, 85.9462],
        [25.1580, 85.9458],
        [25.1640, 85.9455],
        [25.1680, 85.9550],
        [25.1670, 85.9660],
        [25.1590, 85.9680],
        [25.1490, 85.9660],
        [25.1400, 85.9620],
        [25.1350, 85.9550],
        [25.1390, 85.9480],
      ],
      "+6h": [
        [25.1420, 85.9455],
        [25.1475, 85.9450],
        [25.1525, 85.9448],
        [25.1585, 85.9442],
        [25.1650, 85.9440],
        [25.1695, 85.9540],
        [25.1685, 85.9675],
        [25.1605, 85.9695],
        [25.1480, 85.9680],
        [25.1380, 85.9640],
        [25.1330, 85.9560],
        [25.1370, 85.9470],
      ],
      "+12h": [
        [25.1400, 85.9445],
        [25.1460, 85.9440],
        [25.1510, 85.9435],
        [25.1580, 85.9430],
        [25.1660, 85.9425],
        [25.1710, 85.9530],
        [25.1700, 85.9690],
        [25.1620, 85.9710],
        [25.1465, 85.9695],
        [25.1360, 85.9655],
        [25.1310, 85.9570],
        [25.1350, 85.9455],
      ],
      "+24h": [
        [25.1410, 85.9450],
        [25.1470, 85.9445],
        [25.1520, 85.9440],
        [25.1580, 85.9438],
        [25.1655, 85.9435],
        [25.1700, 85.9535],
        [25.1690, 85.9685],
        [25.1610, 85.9700],
        [25.1475, 85.9690],
        [25.1370, 85.9650],
        [25.1320, 85.9565],
        [25.1360, 85.9460],
      ],
    },
    utilities: {
      P1: { name: "Barauni 33kV Power Grid Substation", type: "Electrical Grid Substation", status: "OPERATIONAL", coords: [25.1460, 85.9470], threshold: 0.70 },
      T1: { name: "Jio/BSNL 4G BTS Telecom Tower", type: "Telecommunications Mast", status: "ONLINE", coords: [25.1540, 85.9540], threshold: 0.60 },
      G1: { name: "Barauni Ghat Rapid Rescue Launch Point", type: "Boat Launch Jetty", status: "STANDBY", coords: [25.1500, 85.9450], threshold: 0.40 },
      R_RAIL: { name: "Barauni Junction Rail Logistics Terminal", type: "Strategic Railhead", status: "OPEN", coords: [25.1380, 85.9410], threshold: 0.85 },
    },
    villages: {
      V1: { name: "Pipra Dewas", type: "Diara Riparian Panchayat", population: 5420, vulnerability: "Low-lying riparian settlement near river embankment", coords: [25.1480, 85.9428] },
      V2: { name: "Sultanganj Diara", type: "Island Settlement", population: 7850, vulnerability: "Severely flood-prone island; total road cutoff during surges", coords: [25.1595, 85.9572] },
      V3: { name: "Mirzapur Bandh", type: "Wetland Basin Panchayat", population: 4200, vulnerability: "Surrounds wetland basin; vulnerable to protracted waterlogging", coords: [25.1370, 85.9515] },
      V4: { name: "Simaria Ghat North", type: "Riparian Wetland Panchayat", population: 3600, vulnerability: "Pond basin settlement; vulnerable to western embankment breach", coords: [25.1495, 85.9395] },
      V5: { name: "Rajendra Bridge Approach", type: "Riverfront Diara Settlement", population: 4850, vulnerability: "Ghat-side residential cluster near Ambulance A2 base", coords: [25.1480, 85.9580] },
    },
    hospitals: {
      H1: { name: "Barauni Primary Health Centre (PHC)", type: "Sub-Divisional PHC", capacity: 60, role: "Immediate triage and emergency medical stabilization", coords: [25.1498, 85.9438] },
      H2: { name: "Sadar District Hospital (Begusarai)", type: "Main Referral Hospital", capacity: 180, role: "Critical ICU, trauma, surgical & flood referral centre", coords: [25.1610, 85.9580] },
      H3: { name: "Sultanganj Community Health Centre (CHC)", type: "Rural Health Centre", capacity: 80, role: "Flood rescue staging & mobile medical camp dispatch", coords: [25.1395, 85.9542] },
    },
    shelters: {
      S1: { name: "Rajkiya Uchh Vidyalaya Relief Camp", capacity: 850, type: "High-Ground Concrete Multi-Story School", coords: [25.1520, 85.9410] },
      S2: { name: "Panchayat Bhawan Disaster Centre", capacity: 600, type: "Administrative Relief Distribution Hub", coords: [25.1385, 85.9530] },
    },
    ambulances: {
      A1: { name: "ALS Ambulance A1 (Barauni Base)", type: "Advanced Life Support", coords: [25.1420, 85.9410] },
      A2: { name: "ALS Ambulance A2 (Sultanganj CHC Base)", type: "Advanced Life Support", coords: [25.1470, 85.9610] },
      A3: { name: "BLS Ambulance A3 (Sadar Hospital Base)", type: "Basic Life Support", coords: [25.1355, 85.9495] },
    },
    resourceBases: {
      A1: [25.1420, 85.9410],
      A2: [25.1470, 85.9610],
      A3: [25.1355, 85.9495],
      R1: [25.1440, 85.9430],
      R2: [25.1510, 85.9580],
      RB1: [25.1500, 85.9450],
      RB2: [25.1560, 85.9560],
    },
    roads: {
      R1: {
        name: "NH-31 High-Elevation Causeway",
        type: "National Highway Spine",
        significance: "Elevated (+2.5m) highway corridor; Primary Safe Evacuation Corridor to Camp S1",
        positions: [
          [25.1380, 85.9410], [25.1420, 85.9410], [25.1445, 85.9416], [25.1465, 85.9422],
          [25.1480, 85.9428], [25.1498, 85.9438], [25.1512, 85.9425], [25.1520, 85.9410]
        ]
      },
      R2: {
        name: "SH-58 Diara Access Corridor",
        type: "State Highway Causeway",
        significance: "Arterial causeway crossing river fairway to Sultanganj Diara & Sadar Hospital",
        positions: [
          [25.1520, 85.9410], [25.1530, 85.9430], [25.1540, 85.9455], [25.1550, 85.9485],
          [25.1563, 85.9512], [25.1578, 85.9538], [25.1590, 85.9558], [25.1595, 85.9572],
          [25.1605, 85.9578], [25.1610, 85.9580]
        ]
      },
      R3: {
        name: "MDR-14 Rural Embankment Bypass",
        type: "Major District Road",
        significance: "Southern bypass connecting Manjhaul Lowlands to Sultanganj CHC H3",
        positions: [
          [25.1355, 85.9495], [25.1362, 85.9502], [25.1370, 85.9515],
          [25.1380, 85.9528], [25.1395, 85.9542], [25.1430, 85.9570], [25.1470, 85.9610]
        ]
      },
      R4: {
        name: "Pond Embankment Rural Link",
        type: "Rural Connectivity Link",
        significance: "Protected mainland feeder connecting Mohanpur West to Relief Camp S1",
        positions: [
          [25.1420, 85.9410], [25.1440, 85.9400], [25.1465, 85.9394], [25.1480, 85.9393],
          [25.1495, 85.9395], [25.1508, 85.9402], [25.1520, 85.9410]
        ]
      },
      R5: {
        name: "Sultanganj Ghat Causeway",
        type: "Riverfront Embankment Link",
        significance: "Eastern riverbank corridor linking Sadar Hospital and Rampur Ghat to A2 Base",
        positions: [
          [25.1610, 85.9580], [25.1570, 85.9582], [25.1530, 85.9585], [25.1480, 85.9580],
          [25.1475, 85.9595], [25.1470, 85.9610]
        ]
      },
    },
  },

  supaul: {
    id: "supaul",
    name: "Supaul - Nirmali Embankment",
    region: "Supaul, Bihar",
    riverBasin: "Kosi River Basin (High Silt Floodplain)",
    center: [26.126, 86.598],
    villages: {
      V1: { name: "Nirmali Town Diara", type: "Riparian Urban Ward", population: 8200, vulnerability: "Low-lying settlement directly adjacent to Kosi flood bund", coords: [26.1280, 86.5920] },
      V2: { name: "Marouna Island Diara", type: "Isolated Island Cluster", population: 9450, vulnerability: "Surrounded by Kosi active channels; severed during barrage discharge", coords: [26.1390, 86.6080] },
      V3: { name: "Kishanpur Lowlands", type: "Wetland Flood Basin", population: 6100, vulnerability: "Agricultural depression vulnerable to protracted flash flooding", coords: [26.1150, 86.6010] },
      V4: { name: "Saraigarh Bund Cluster", type: "Western Bund Settlement", population: 5300, vulnerability: "Western afflux embankment breach risk during high discharge", coords: [26.1310, 86.5860] },
      V5: { name: "Pipra Kosi Bund Village", type: "Afflux Bund Panchayat", population: 7150, vulnerability: "Riparian cluster near downstream flood regulator gates", coords: [26.1220, 86.6110] },
    },
    hospitals: {
      H1: { name: "Nirmali Sub-Divisional Hospital", type: "Sub-Divisional Hospital", capacity: 75, role: "Emergency stabilization & waterborne epidemic triage", coords: [26.1295, 86.5935] },
      H2: { name: "Supaul Sadar District Referral Hospital", type: "District Referral Hospital", capacity: 220, role: "Main ICU, surgical & multi-trauma disaster center", coords: [26.1410, 86.6095] },
      H3: { name: "CHC Kishanpur Emergency Station", type: "Community Health Centre", capacity: 90, role: "Boat rescue landing triage and mobile field medicine", coords: [26.1170, 86.6030] },
    },
    shelters: {
      S1: { name: "Nirmali High School Mega Relief Camp", capacity: 1200, type: "Multi-Story Concrete Flood Shelter", coords: [26.1325, 86.5900] },
      S2: { name: "Kisan Bhawan Evacuation Hub", capacity: 800, type: "High-Ground Agricultural Disaster Center", coords: [26.1160, 86.6025] },
    },
    ambulances: {
      A1: { name: "ALS Ambulance A1 (Nirmali Corridor)", type: "Advanced Life Support", coords: [26.1210, 86.5890] },
      A2: { name: "ALS Ambulance A2 (Kosi Embankment Base)", type: "Advanced Life Support", coords: [26.1260, 86.6140] },
      A3: { name: "BLS Ambulance A3 (Kishanpur Staging)", type: "Basic Life Support", coords: [26.1130, 86.5980] },
    },
    resourceBases: {
      A1: [26.1210, 86.5890],
      A2: [26.1260, 86.6140],
      A3: [26.1130, 86.5980],
      R1: [26.1240, 86.5905],
      R2: [26.1345, 86.5940],
      RB1: [26.1350, 86.5980],
      RB2: [26.1370, 86.6060],
    },
    roads: {
      R1: {
        name: "NH-57 Kosi Mahasetu Approach",
        type: "National Highway Corridor",
        significance: "Major lifeline connecting Nirmali Hospital and Relief Camp S1",
        positions: [
          [26.1210, 86.5890], [26.1240, 86.5905], [26.1280, 86.5920], [26.1295, 86.5935], [26.1325, 86.5900]
        ]
      },
      R2: {
        name: "SH-66 Embankment Causeway",
        type: "State Highway Causeway",
        significance: "Corridor linking Marouna Diara island to Supaul District Hospital",
        positions: [
          [26.1325, 86.5900], [26.1345, 86.5940], [26.1370, 86.6010], [26.1390, 86.6080], [26.1410, 86.6095]
        ]
      },
      R3: {
        name: "MDR-9 Kishanpur Lowland Bypass",
        type: "Major District Road",
        significance: "Bypass connecting Kishanpur basin to Kisan Bhawan Shelter",
        positions: [
          [26.1130, 86.5980], [26.1140, 86.6000], [26.1150, 86.6010], [26.1160, 86.6025], [26.1170, 86.6030]
        ]
      },
      R4: {
        name: "Saraigarh Bund Road",
        type: "Rural Embankment Spur",
        significance: "Western bund connectivity between Saraigarh and Relief Camp S1",
        positions: [
          [26.1210, 86.5890], [26.1250, 86.5875], [26.1310, 86.5860], [26.1325, 86.5900]
        ]
      },
      R5: {
        name: "Kosi Right Afflux Causeway",
        type: "River Embankment Track",
        significance: "Direct access between Pipra Kosi Bund and CHC Kishanpur",
        positions: [
          [26.1260, 86.6140], [26.1240, 86.6125], [26.1220, 86.6110], [26.1190, 86.6070], [26.1170, 86.6030]
        ]
      },
    },
  },

  patna: {
    id: "patna",
    name: "Patna - Digha Ghat",
    region: "Patna, Bihar",
    riverBasin: "Ganga-Son Confluence",
    center: [25.594, 85.137],
    villages: {
      V1: { name: "Digha Diara Settlement", type: "Riparian Urban Diara", population: 11200, vulnerability: "Low-lying dense settlements right on the Ganga floodway", coords: [25.5970, 85.1310] },
      V2: { name: "Nakta Diara Sand Island", type: "Inhabited Sandbar Island", population: 8900, vulnerability: "Total cutoff from mainland when river crosses 49.5m MSL", coords: [25.6080, 85.1450] },
      V3: { name: "Kurji Riparian Slums", type: "Urban Embankment Slum", population: 9800, vulnerability: "Severely vulnerable to river backflow into drainage sluice gates", coords: [25.5840, 85.1390] },
      V4: { name: "Danapur Cantt Diara Fringe", type: "Military Cantonment Fringe", population: 6400, vulnerability: "Son river backwater inundation zone", coords: [25.5990, 85.1240] },
      V5: { name: "Sabalpur Ghat Diara", type: "Eastern Island Panchayat", population: 7500, vulnerability: "Eastern island cluster exposed to Ganga main current", coords: [25.5910, 85.1480] },
    },
    hospitals: {
      H1: { name: "Kurji Holy Family Hospital", type: "General Multi-Speciality", capacity: 160, role: "Immediate emergency intake, surgical & trauma stabilization", coords: [25.5985, 85.1325] },
      H2: { name: "PMCH Emergency Trauma Referral", type: "Apex Tertiary Medical College", capacity: 450, role: "Regional tertiary center with advanced life support & intensive ICU", coords: [25.6100, 85.1470] },
      H3: { name: "Danapur Sub-Divisional Hospital", type: "Sub-Divisional Hospital", capacity: 120, role: "Western district triage and flood relief staging", coords: [25.5865, 85.1410] },
    },
    shelters: {
      S1: { name: "Digha ITI Mega Flood Relief Camp", capacity: 1500, type: "Multi-Storey High Ground Educational Complex", coords: [25.6010, 85.1290] },
      S2: { name: "Danapur Community Relief Bhawan", capacity: 900, type: "Municipal Administrative Disaster Hub", coords: [25.5855, 85.1400] },
    },
    ambulances: {
      A1: { name: "ALS Ambulance A1 (PMCH Corridor)", type: "Advanced Life Support", coords: [25.5900, 85.1270] },
      A2: { name: "ALS Ambulance A2 (Kurji Trauma Base)", type: "Advanced Life Support", coords: [25.5930, 85.1510] },
      A3: { name: "BLS Ambulance A3 (Danapur Cantonment Base)", type: "Basic Life Support", coords: [25.5820, 85.1360] },
    },
    resourceBases: {
      A1: [25.5900, 85.1270],
      A2: [25.5930, 85.1510],
      A3: [25.5820, 85.1360],
      R1: [25.5935, 85.1290],
      R2: [25.6040, 85.1350],
      RB1: [25.6020, 85.1380],
      RB2: [25.6050, 85.1420],
    },
    roads: {
      R1: {
        name: "Ashok Rajpath River Corridor",
        type: "Arterial Urban Highway",
        significance: "Connects Kurji Hospital and Digha ITI Shelter",
        positions: [
          [25.5900, 85.1270], [25.5935, 85.1290], [25.5970, 85.1310], [25.5985, 85.1325], [25.6010, 85.1290]
        ]
      },
      R2: {
        name: "Digha-Danapur Causeway",
        type: "River Embankment Highway",
        significance: "Arterial link between Nakta Diara and PMCH Apex Hospital",
        positions: [
          [25.6010, 85.1290], [25.6040, 85.1350], [25.6060, 85.1400], [25.6080, 85.1450], [25.6100, 85.1470]
        ]
      },
      R3: {
        name: "Kurji Ghat Access Link",
        type: "Urban Connecting Track",
        significance: "Sub-arterial connecting Kurji Slums to Danapur Hospital",
        positions: [
          [25.5820, 85.1360], [25.5830, 85.1375], [25.5840, 85.1390], [25.5855, 85.1400], [25.5865, 85.1410]
        ]
      },
      R4: {
        name: "Digha AIIMS Elevated Spur",
        type: "Elevated Expressway Spur",
        significance: "Rapid transit corridor connecting Danapur Cantt to Digha Shelter",
        positions: [
          [25.5900, 85.1270], [25.5945, 85.1255], [25.5990, 85.1240], [25.6010, 85.1290]
        ]
      },
      R5: {
        name: "Sabalpur River Embankment Road",
        type: "Riverfront Bund Track",
        significance: "Connects Sabalpur Ghat Diara to Danapur Sub-Divisional Hospital",
        positions: [
          [25.5930, 85.1510], [25.5920, 85.1495], [25.5910, 85.1480], [25.5880, 85.1440], [25.5865, 85.1410]
        ]
      },
    },
  },

  darbhanga: {
    id: "darbhanga",
    name: "Darbhanga - Kusheshwar Asthan",
    region: "Darbhanga, Bihar",
    riverBasin: "Bagmati - Kamala Balan Basin",
    center: [26.154, 85.891],
    villages: {
      V1: { name: "Kusheshwar Asthan Town", type: "Wetland Town Settlement", population: 6800, vulnerability: "Surrounded by wet bird sanctuary; regular water logging", coords: [26.1560, 85.8850] },
      V2: { name: "Ber Diara Cluster", type: "Marsh Island Settlement", population: 5900, vulnerability: "Complete boat reliance during Kamala Balan surges", coords: [26.1670, 85.8990] },
      V3: { name: "Jhajhra Riparian Basin", type: "Agricultural Lowland", population: 4700, vulnerability: "Severe crop & property inundation from Bagmati overflow", coords: [26.1430, 85.8930] },
      V4: { name: "Asadpur Lowland Ward", type: "Riparian Panchayat", population: 4100, vulnerability: "Western wetland drainage bottleneck", coords: [26.1580, 85.8790] },
      V5: { name: "Mahishi Kamala Bund", type: "Embankment Settlement", population: 5200, vulnerability: "Kamala Balan left embankment erosion zone", coords: [26.1500, 85.9020] },
    },
    hospitals: {
      H1: { name: "CHC Kusheshwar Asthan", type: "Community Health Centre", capacity: 65, role: "Primary triage & anti-venom flood treatment", coords: [26.1575, 85.8865] },
      H2: { name: "DMCH Darbhanga Medical Center", type: "Tertiary Referral Hospital", capacity: 320, role: "Main regional medical college referral hospital", coords: [26.1690, 85.9010] },
      H3: { name: "Biraul Sub-Divisional Hospital", type: "Sub-Divisional Hospital", capacity: 90, role: "Sub-divisional disaster inpatient management", coords: [26.1455, 85.8950] },
    },
    shelters: {
      S1: { name: "Kusheshwar High School Flood Camp", capacity: 900, type: "Multi-Storey Educational High Ground", coords: [26.1600, 85.8830] },
      S2: { name: "Biraul Block Relief Centre", capacity: 650, type: "Block Administrative Distribution Complex", coords: [26.1445, 85.8940] },
    },
    ambulances: {
      A1: { name: "ALS Ambulance A1 (Biraul Highway)", type: "Advanced Life Support", coords: [26.1490, 85.8810] },
      A2: { name: "ALS Ambulance A2 (Kamala Bund Base)", type: "Advanced Life Support", coords: [26.1530, 85.9050] },
      A3: { name: "BLS Ambulance A3 (Wetland Mobile Unit)", type: "Basic Life Support", coords: [26.1410, 85.8900] },
    },
    resourceBases: {
      A1: [26.1490, 85.8810],
      A2: [26.1530, 85.9050],
      A3: [26.1410, 85.8900],
      R1: [26.1520, 85.8830],
      R2: [26.1620, 85.8920],
      RB1: [26.1610, 85.8910],
      RB2: [26.1640, 85.8960],
    },
    roads: {
      R1: {
        name: "SH-56 Kusheshwar Causeway",
        type: "State Highway Causeway",
        significance: "Connects Kusheshwar CHC to High School Shelter S1",
        positions: [
          [26.1490, 85.8810], [26.1520, 85.8830], [26.1560, 85.8850], [26.1575, 85.8865], [26.1600, 85.8830]
        ]
      },
      R2: {
        name: "Biraul-Kusheshwar Embankment Road",
        type: "District Embankment Highway",
        significance: "Arterial route linking Ber Diara to DMCH Referral Hospital",
        positions: [
          [26.1600, 85.8830], [26.1620, 85.8920], [26.1650, 85.8960], [26.1670, 85.8990], [26.1690, 85.9010]
        ]
      },
      R3: {
        name: "Jhajhra Lowland Connecting Track",
        type: "Major District Road",
        significance: "Connects Jhajhra wetland to Biraul Sub-Divisional Hospital",
        positions: [
          [26.1410, 85.8900], [26.1420, 85.8915], [26.1430, 85.8930], [26.1445, 85.8940], [26.1455, 85.8950]
        ]
      },
      R4: {
        name: "Asadpur Wetland Spur",
        type: "Rural Connectivity Link",
        significance: "Connects Asadpur settlement to Kusheshwar High School Shelter",
        positions: [
          [26.1490, 85.8810], [26.1530, 85.8800], [26.1580, 85.8790], [26.1600, 85.8830]
        ]
      },
      R5: {
        name: "Kamala Bund Riverfront Link",
        type: "River Embankment Track",
        significance: "Connects Mahishi Bund to Biraul Hospital",
        positions: [
          [26.1530, 85.9050], [26.1515, 85.9035], [26.1500, 85.9020], [26.1470, 85.8980], [26.1455, 85.8950]
        ]
      },
    },
  },

  bhagalpur: {
    id: "bhagalpur",
    name: "Bhagalpur - Kahalgaon",
    region: "Bhagalpur, Bihar",
    riverBasin: "Lower Ganga River Channel",
    center: [25.242, 86.984],
    villages: {
      V1: { name: "Kahalgaon Diara", type: "Riparian Diara Cluster", population: 7200, vulnerability: "Low-lying riparian settlement exposed to Ganga overflow", coords: [25.2440, 86.9780] },
      V2: { name: "Colgong Riparian Island", type: "Rocky River Island Settlement", population: 8100, vulnerability: "Isolated island; direct watercraft evacuation required", coords: [25.2550, 86.9920] },
      V3: { name: "Sabour Lowlands", type: "Agricultural Flood Basin", population: 5600, vulnerability: "Silty depression vulnerable to protracted waterlogging", coords: [25.2310, 86.9860] },
      V4: { name: "Sultanganj East Fringe", type: "Riparian Ward", population: 4900, vulnerability: "Erosion hotspot on the southern river bank", coords: [25.2460, 86.9720] },
      V5: { name: "Barari Embankment Settlement", type: "Riverfront Bund Settlement", population: 6300, vulnerability: "Ghat-side residential cluster vulnerable to high water levels", coords: [25.2380, 86.9950] },
    },
    hospitals: {
      H1: { name: "Sub-Divisional Hospital Kahalgaon", type: "Sub-Divisional Hospital", capacity: 80, role: "Immediate emergency intake & mobile triage", coords: [25.2455, 86.9795] },
      H2: { name: "JLNMCH Bhagalpur Medical College", type: "Tertiary Referral Medical College", capacity: 280, role: "Apex ICU, trauma surgery & disaster center", coords: [25.2570, 86.9940] },
      H3: { name: "CHC Sabour Emergency Unit", type: "Community Health Centre", capacity: 70, role: "Rural medical stabilization & dispatch staging", coords: [25.2335, 86.9880] },
    },
    shelters: {
      S1: { name: "NTPC Community Relief Centre S1", capacity: 1100, type: "Industrial Township High-Ground Complex", coords: [25.2480, 86.9760] },
      S2: { name: "Sabour High School Flood Camp S2", capacity: 750, type: "Multi-Storey Educational Flood Shelter", coords: [25.2325, 86.9870] },
    },
    ambulances: {
      A1: { name: "ALS Ambulance A1 (NH-80 Corridor)", type: "Advanced Life Support", coords: [25.2370, 86.9740] },
      A2: { name: "ALS Ambulance A2 (Kahalgaon Ghat Base)", type: "Advanced Life Support", coords: [25.2410, 86.9980] },
      A3: { name: "BLS Ambulance A3 (Sabour Rural Base)", type: "Basic Life Support", coords: [25.2290, 86.9830] },
    },
    resourceBases: {
      A1: [25.2370, 86.9740],
      A2: [25.2410, 86.9980],
      A3: [25.2290, 86.9830],
      R1: [25.2400, 86.9760],
      R2: [25.2510, 86.9850],
      RB1: [25.2490, 86.9840],
      RB2: [25.2520, 86.9890],
    },
    roads: {
      R1: {
        name: "NH-80 Ganga Lifeline Corridor",
        type: "National Highway Corridor",
        significance: "Connects Kahalgaon Hospital to NTPC Shelter S1",
        positions: [
          [25.2370, 86.9740], [25.2400, 86.9760], [25.2440, 86.9780], [25.2455, 86.9795], [25.2480, 86.9760]
        ]
      },
      R2: {
        name: "Kahalgaon Thermal Bund Track",
        type: "State Highway Causeway",
        significance: "Arterial route linking Colgong Island to JLNMCH Apex Hospital",
        positions: [
          [25.2480, 86.9760], [25.2510, 86.9850], [25.2530, 86.9890], [25.2550, 86.9920], [25.2570, 86.9940]
        ]
      },
      R3: {
        name: "Sabour Lowland Connecting Link",
        type: "Major District Road",
        significance: "Bypass connecting Sabour basin to CHC Sabour",
        positions: [
          [25.2290, 86.9830], [25.2300, 86.9845], [25.2310, 86.9860], [25.2325, 86.9870], [25.2335, 86.9880]
        ]
      },
      R4: {
        name: "Sultanganj East Bund Spur",
        type: "Rural Connectivity Link",
        significance: "Connects Sultanganj East settlement to NTPC Shelter S1",
        positions: [
          [25.2370, 86.9740], [25.2420, 86.9730], [25.2460, 86.9720], [25.2480, 86.9760]
        ]
      },
      R5: {
        name: "Barari River Embankment Road",
        type: "Riverfront Bund Track",
        significance: "Connects Barari settlement to CHC Sabour",
        positions: [
          [25.2410, 86.9980], [25.2395, 86.9965], [25.2380, 86.9950], [25.2350, 86.9910], [25.2335, 86.9880]
        ]
      },
    },
  },
};

// Generates dynamic infrastructure for custom GPS or unmapped locations
export function getSectorInfrastructure(
  locationId?: string,
  lat: number = 25.148,
  lon: number = 85.950,
  name: string = "Current Observation Zone"
): SectorData {
  if (locationId && (locationId === "barauni" || locationId === "diara" || locationId === "bund" || locationId === "manjhaul" || locationId === "railhead")) {
    const base = SECTOR_INFRASTRUCTURE.barauni;
    if (locationId === "diara") {
      return { ...base, id: "diara", name: "Sultanganj Diara River Island", center: [25.1595, 85.9572] };
    }
    if (locationId === "bund") {
      return { ...base, id: "bund", name: "Embankment Ring Bund (KM 12-18)", center: [25.1500, 85.9450] };
    }
    if (locationId === "manjhaul") {
      return { ...base, id: "manjhaul", name: "Manjhaul Lowlands Wetland Basin", center: [25.1370, 85.9515] };
    }
    if (locationId === "railhead") {
      return { ...base, id: "railhead", name: "Barauni Industrial Railhead Yard", center: [25.1420, 85.9410] };
    }
    return base;
  }

  if (locationId && SECTOR_INFRASTRUCTURE[locationId]) {
    return SECTOR_INFRASTRUCTURE[locationId];
  }

  // Synthesize dynamic local infrastructure around custom GPS coordinates
  return {
    id: locationId || "custom",
    name: name,
    region: "Local Operational Sector",
    riverBasin: "Local Hydrological Catchment Basin",
    center: [lat, lon],
    villages: {
      V1: { name: `${name} North Diara`, type: "Riparian Settlement", population: 5200, vulnerability: "Low-lying settlement in direct floodway", coords: [lat + 0.003, lon - 0.007] },
      V2: { name: `${name} East Island Cluster`, type: "Island Panchayat", population: 7400, vulnerability: "Severely flood-prone island; road cutoff during surges", coords: [lat + 0.011, lon + 0.007] },
      V3: { name: `${name} South Lowlands`, type: "Wetland Basin", population: 4100, vulnerability: "Drainage bottleneck vulnerable to protracted waterlogging", coords: [lat - 0.011, lon + 0.001] },
      V4: { name: `${name} West Bund Village`, type: "Embankment Settlement", population: 3800, vulnerability: "Western bund breach risk zone", coords: [lat + 0.002, lon - 0.010] },
      V5: { name: `${name} Riverfront Ghat`, type: "Riverfront Panchayat", population: 4900, vulnerability: "Ghat-side residential cluster exposed to high river stage", coords: [lat + 0.000, lon + 0.008] },
    },
    hospitals: {
      H1: { name: "Primary Emergency Triage Centre (PHC)", type: "Primary Health Centre", capacity: 65, role: "Immediate triage and emergency stabilization", coords: [lat + 0.002, lon - 0.006] },
      H2: { name: "District Referral & Trauma Hospital", type: "Main Referral Hospital", capacity: 200, role: "Critical ICU, trauma and surgical referral center", coords: [lat + 0.013, lon + 0.008] },
      H3: { name: "Community Health Centre (CHC)", type: "Rural Health Centre", capacity: 75, role: "Flood rescue staging & mobile medical camp dispatch", coords: [lat - 0.009, lon + 0.004] },
    },
    shelters: {
      S1: { name: "High-Ground Concrete Relief Camp S1", capacity: 1000, type: "Multi-Storey Flood Shelter", coords: [lat + 0.004, lon - 0.009] },
      S2: { name: "Community Disaster Evacuation Centre S2", capacity: 700, type: "Administrative Relief Distribution Hub", coords: [lat - 0.010, lon + 0.003] },
    },
    ambulances: {
      A1: { name: "ALS Ambulance A1 (Main Highway Base)", type: "Advanced Life Support", coords: [lat - 0.006, lon - 0.009] },
      A2: { name: "ALS Ambulance A2 (Riverfront Staging Base)", type: "Advanced Life Support", coords: [lat - 0.001, lon + 0.011] },
      A3: { name: "BLS Ambulance A3 (District Hospital Base)", type: "Basic Life Support", coords: [lat - 0.012, lon - 0.001] },
    },
    resourceBases: {
      A1: [lat - 0.006, lon - 0.009],
      A2: [lat - 0.001, lon + 0.011],
      A3: [lat - 0.012, lon - 0.001],
      R1: [lat - 0.004, lon - 0.007],
      R2: [lat + 0.003, lon + 0.008],
      RB1: [lat + 0.002, lon - 0.005],
      RB2: [lat + 0.008, lon + 0.006],
    },
    roads: {
      R1: {
        name: "Arterial Highway Link",
        type: "National Highway Link",
        significance: "Primary lifeline to Relief Camp S1 and PHC",
        positions: [
          [lat - 0.006, lon - 0.009], [lat - 0.003, lon - 0.008], [lat + 0.000, lon - 0.007], [lat + 0.002, lon - 0.006], [lat + 0.004, lon - 0.009]
        ]
      },
      R2: {
        name: "River Embankment Causeway",
        type: "State Highway Causeway",
        significance: "Corridor linking Island Settlement to Referral Hospital",
        positions: [
          [lat + 0.004, lon - 0.009], [lat + 0.006, lon - 0.004], [lat + 0.008, lon + 0.002], [lat + 0.011, lon + 0.007], [lat + 0.013, lon + 0.008]
        ]
      },
      R3: {
        name: "Lowland Rural Bypass",
        type: "Major District Road",
        significance: "Connecting track for Southern Lowlands",
        positions: [
          [lat - 0.012, lon - 0.001], [lat - 0.011, lon + 0.000], [lat - 0.011, lon + 0.001], [lat - 0.010, lon + 0.003], [lat - 0.009, lon + 0.004]
        ]
      },
      R4: {
        name: "Western Bund Track",
        type: "Rural Connectivity Link",
        significance: "Access spur for Western settlements",
        positions: [
          [lat - 0.006, lon - 0.009], [lat - 0.002, lon - 0.010], [lat + 0.002, lon - 0.010], [lat + 0.004, lon - 0.009]
        ]
      },
      R5: {
        name: "Riverfront Ghat Causeway",
        type: "Riverfront Embankment Link",
        significance: "Access between Riverfront Ghat and Community Health Centre",
        positions: [
          [lat - 0.001, lon + 0.011], [lat + 0.000, lon + 0.009], [lat + 0.000, lon + 0.008], [lat - 0.005, lon + 0.006], [lat - 0.009, lon + 0.004]
        ]
      },
    },
  };
}

// Backwards compatibility export
export const REAL_INFRASTRUCTURE_METADATA = SECTOR_INFRASTRUCTURE.barauni;

// Generates a 2D spatial raster grid of risk across the study bounding box
export function generateSpatialGrid(
  baseRainfall: number,
  waterLevelMultiplier: number = 1.0,
  centerLat: number = 25.148,
  centerLon: number = 85.950,
  timeHorizon: TimeHorizon = "now"
): SpatialGridCell[] {
  const span = 0.036; // ~4km high-resolution observation grid
  const minLat = centerLat - span / 2;
  const maxLat = centerLat + span / 2;
  const minLon = centerLon - span / 2;
  const maxLon = centerLon + span / 2;

  const latSteps = 8;
  const lonSteps = 8;
  const latDelta = (maxLat - minLat) / latSteps;
  const lonDelta = (maxLon - minLon) / lonSteps;

  const riverCenterLat = centerLat + 0.010;
  const riverCenterLon = centerLon + 0.002;

  const horizonMultipliers: Record<TimeHorizon, { rain: number; water: number }> = {
    now: { rain: 1.0, water: 1.0 },
    "+6h": { rain: 1.18, water: 1.10 },
    "+12h": { rain: 1.36, water: 1.25 },
    "+24h": { rain: 1.15, water: 1.14 },
  };

  const cells: SpatialGridCell[] = [];

  for (let i = 0; i < latSteps; i++) {
    for (let j = 0; j < lonSteps; j++) {
      const south = minLat + i * latDelta;
      const north = south + latDelta;
      const west = minLon + j * lonDelta;
      const east = west + lonDelta;

      const cLat = (south + north) / 2;
      const cLon = (west + east) / 2;

      // Distance to river calculation (approximate in meters)
      const distLat = (cLat - riverCenterLat) * 111000;
      const distLon = (cLon - riverCenterLon) * 111000 * Math.cos((cLat * Math.PI) / 180);
      const distanceToRiver = Math.max(80, Math.sqrt(distLat * distLat + distLon * distLon));

      // Elevation gradient: lower near river (approx 38m to 65m)
      const elevation = Math.round(38 + Math.min(27, distanceToRiver / 120));
      const slope = Number((0.2 + (distanceToRiver / 3000) * 1.5).toFixed(2));

      // Physical risk calculation based on rainfall, river proximity and elevation
      const proxFactor = Math.max(0, 1.0 - distanceToRiver / 2500);
      const elevFactor = Math.max(0, 1.0 - (elevation - 38) / 27);

      const cellForecasts: Record<TimeHorizon, { risk_score: number; sar_water_fraction: number; risk_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" }> = {
        now: { risk_score: 0.05, sar_water_fraction: 0.02, risk_level: "LOW" },
        "+6h": { risk_score: 0.05, sar_water_fraction: 0.02, risk_level: "LOW" },
        "+12h": { risk_score: 0.05, sar_water_fraction: 0.02, risk_level: "LOW" },
        "+24h": { risk_score: 0.05, sar_water_fraction: 0.02, risk_level: "LOW" },
      };

      for (const [hKey, hMult] of Object.entries(horizonMultipliers) as [TimeHorizon, { rain: number; water: number }][]) {
        const hRain = baseRainfall * hMult.rain;
        const hWaterMult = waterLevelMultiplier * hMult.water;
        const hRainFactor = Math.min(hRain / 180, 1.0);
        const hRaw = (0.45 * hRainFactor + 0.35 * proxFactor + 0.20 * elevFactor) * hWaterMult;
        const hRisk = Number(Math.min(0.98, Math.max(0.05, hRaw)).toFixed(2));
        const hSar = Number(Math.min(0.95, Math.max(0.02, hRisk * 0.92)).toFixed(2));

        let hLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
        if (hRisk >= 0.75) hLevel = "CRITICAL";
        else if (hRisk >= 0.5) hLevel = "HIGH";
        else if (hRisk >= 0.3) hLevel = "MODERATE";

        cellForecasts[hKey] = {
          risk_score: hRisk,
          sar_water_fraction: hSar,
          risk_level: hLevel,
        };
      }

      const activeForecast = cellForecasts[timeHorizon] || cellForecasts["now"];

      cells.push({
        id: `grid_${i}_${j}`,
        bounds: [
          [south, west],
          [north, east],
        ],
        center: [cLat, cLon],
        elevation_m: elevation,
        slope_deg: slope,
        distance_to_river_m: Math.round(distanceToRiver),
        sar_water_fraction: activeForecast.sar_water_fraction,
        risk_score: activeForecast.risk_score,
        risk_level: activeForecast.risk_level,
        forecast: cellForecasts,
      });
    }
  }

  return cells;
}


// Historical validation sequence for the 27 Sep 2024 Bihar flood event
export const HISTORICAL_2024_EVENT: HistoricalSnapshot[] = [
  {
    timestamp: "2024-09-25T06:00:00Z",
    label: "T-48h (Pre-Event Baseline)",
    rainfall_24h_mm: 14.2,
    river_level_m: 2.1,
    mean_risk_score: 0.16,
    hazard_level: "LOW",
    affected_roads: [],
    affected_villages: [],
    affected_hospitals: [],
    population_affected: 0,
    satellite_pass_time: "Sentinel-1A Orbit 2341 (05:42 UTC)",
    status_summary: "Normal seasonal flow. NH-31 and SH-58 open. Background SAR backscatter.",
    historical_allocations: [],
  },
  {
    timestamp: "2024-09-26T14:00:00Z",
    label: "T-24h (Monsoon Inflow Surge)",
    rainfall_24h_mm: 78.5,
    river_level_m: 5.4,
    mean_risk_score: 0.52,
    hazard_level: "HIGH",
    affected_roads: ["R1"],
    affected_villages: ["V1"],
    affected_hospitals: ["H1"],
    population_affected: 5420,
    satellite_pass_time: "GPM IMERG Early Run (12:30 UTC)",
    status_summary: "Precipitation surge detected. NH-31 embankment submerged; Pipra Dewas (5,420 pop) isolated.",
    historical_allocations: [
      {
        resource: "A1",
        resource_type: "AMBULANCE",
        village_id: "V1",
        village_name: "Pipra Dewas",
        priority_score: 0.71,
        priority_level: "HIGH",
        population: 5420,
        distance_km: 0.8,
        estimated_travel_time_min: 12,
        assignment_score: 0.74,
        reason: "Pipra Dewas isolated by NH-31 submergence. A1 (Barauni Base) dispatched via embankment bypass for medical triage.",
      },
    ],
  },
  {
    timestamp: "2024-09-27T18:00:00Z",
    label: "T-0 (Peak Flood Inundation)",
    rainfall_24h_mm: 184.0,
    river_level_m: 8.6,
    mean_risk_score: 0.89,
    hazard_level: "CRITICAL",
    affected_roads: ["R1", "R2", "R3", "R4", "R5"],
    affected_villages: ["V1", "V2", "V3", "V4", "V5"],
    affected_hospitals: ["H1", "H2"],
    population_affected: 25920,
    satellite_pass_time: "NRSC Sentinel-1A SAR Inundation Map (17:15 UTC)",
    status_summary: "Catastrophic river surge. All arterial roads & causeways severed. Sultanganj, Pipra Dewas, Mohanpur & Rampur cut off.",
    historical_allocations: [
      {
        resource: "A1",
        resource_type: "AMBULANCE",
        village_id: "V1",
        village_name: "Pipra Dewas",
        priority_score: 0.91,
        priority_level: "CRITICAL",
        population: 5420,
        distance_km: 0.8,
        estimated_travel_time_min: 18,
        assignment_score: 0.88,
        reason: "CRITICAL: Pipra Dewas completely inundated. A1 (Barauni ALS) primary medical evacuation — NH-31 submerged, boat access only.",
      },
      {
        resource: "A2",
        resource_type: "RESCUE_BOAT",
        village_id: "V2",
        village_name: "Sultanganj Diara",
        priority_score: 0.95,
        priority_level: "CRITICAL",
        population: 7850,
        distance_km: 2.1,
        estimated_travel_time_min: 35,
        assignment_score: 0.92,
        reason: "CRITICAL: Sultanganj Diara island fully surrounded. Rescue boat A2 (Sultanganj CHC) deployed for mass evacuation of 7,850 residents.",
      },
      {
        resource: "A3",
        resource_type: "RESCUE_BOAT",
        village_id: "V3",
        village_name: "Manjhaul Lowlands",
        priority_score: 0.78,
        priority_level: "HIGH",
        population: 4200,
        distance_km: 1.4,
        estimated_travel_time_min: 22,
        assignment_score: 0.80,
        reason: "HIGH: Manjhaul Lowlands waterlogged. A3 (Sadar Base BLS) dispatched for medical supply delivery and patient extraction via MDR-14.",
      },
      {
        resource: "SDRF-1",
        resource_type: "RESCUE_BOAT",
        village_id: "V4",
        village_name: "Mohanpur West",
        priority_score: 0.86,
        priority_level: "CRITICAL",
        population: 3600,
        distance_km: 0.9,
        estimated_travel_time_min: 15,
        assignment_score: 0.87,
        reason: "CRITICAL: Mohanpur West pond embankment breached. SDRF boat dispatched to evacuate 3,600 residents to Relief Camp S1.",
      },
      {
        resource: "NDRF-2",
        resource_type: "RESCUE_BOAT",
        village_id: "V5",
        village_name: "Rampur Ghat Diara",
        priority_score: 0.89,
        priority_level: "CRITICAL",
        population: 4850,
        distance_km: 0.4,
        estimated_travel_time_min: 10,
        assignment_score: 0.90,
        reason: "CRITICAL: Rampur Ghat Diara causeway overtopped. NDRF flood rescue craft dispatched from A2 Base for immediate triage.",
      },
    ],
  },
  {
    timestamp: "2024-09-28T12:00:00Z",
    label: "T+24h (Water Recession & Recovery)",
    rainfall_24h_mm: 32.0,
    river_level_m: 6.1,
    mean_risk_score: 0.62,
    hazard_level: "HIGH",
    affected_roads: ["R1", "R2"],
    affected_villages: ["V1", "V2"],
    affected_hospitals: ["H1"],
    population_affected: 13270,
    satellite_pass_time: "Sentinel-2 MSI Optical Cloud-Free Composite",
    status_summary: "Floodwaters gradually receding. MDR-14 reopened to Manjhaul. Relief staging active at Rajkiya Uchh Vidyalaya.",
    historical_allocations: [
      {
        resource: "A1",
        resource_type: "AMBULANCE",
        village_id: "V1",
        village_name: "Pipra Dewas",
        priority_score: 0.74,
        priority_level: "HIGH",
        population: 5420,
        distance_km: 0.8,
        estimated_travel_time_min: 14,
        assignment_score: 0.77,
        reason: "HIGH: Pipra Dewas still partially inundated. A1 continuing medical evacuation and injury triage.",
      },
      {
        resource: "A2",
        resource_type: "RESCUE_BOAT",
        village_id: "V2",
        village_name: "Sultanganj Diara",
        priority_score: 0.81,
        priority_level: "HIGH",
        population: 7850,
        distance_km: 2.1,
        estimated_travel_time_min: 28,
        assignment_score: 0.83,
        reason: "HIGH: Sultanganj Diara island partially accessible. A2 rescue boat deployed for final evacuation and relief supply staging.",
      },
    ],
  },
];
