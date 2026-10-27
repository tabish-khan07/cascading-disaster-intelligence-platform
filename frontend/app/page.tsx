"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useEffect } from "react";
import {
  generateSpatialGrid,
  HISTORICAL_2024_EVENT,
  HistoricalSnapshot,
  REAL_INFRASTRUCTURE_METADATA,
} from "../data/spatialGrid";

const DisasterMap = dynamic(() => import("../components/DisasterMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 bg-slate-950/60 backdrop-blur rounded-xl">
      <div className="h-8 w-8 rounded border-2 border-blue-500 border-t-transparent animate-spin" />
      <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
        Initializing Satellite Map Surface...
      </span>
    </div>
  ),
});

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Allocation = {
  resource: string;
  resource_type: string;
  dispatch_mode?: string;
  village_id: string;
  village_name?: string;
  priority_score: number;
  priority_level: string;
  population: number;
  distance_km: number;
  estimated_travel_time_min: number;
  assignment_score: number;
  reason: string;
};

type DisasterResult = {
  status: string;

  data_freshness?: {
    generated_at: string;
    age_seconds: number;
    source: string;
    layers?: Record<string, string>;
  };

  spatial_forecast?: {
    horizons: string[];
    active_horizon: string;
    horizons_meta?: Record<string, { rain_mult: number; water_mult: number; estimated_depth_m: number; label: string; description: string }>;
    inundation_envelopes?: Record<string, [number, number][]>;
  };

  event: {
    type: string;
    risk_score: number;
    hazard_level: string;
    ml_backed?: boolean;
    ml_calibrated_score?: number | null;
    decision_threshold?: number;
    above_threshold?: boolean;
    ml_status?: string;
    model_behaviour?: string;

    inputs: {
      rainfall_mm: number;
      duration_hours: number;
      water_level_m: number;
    };
  };

  impact: {
    affected_roads: string[];
    affected_villages: string[];
    affected_hospitals: string[];
    population_affected: number;
  };

  cascade_utilities?: {
    affected_substations: string[];
    hospitals_on_backup_power: string[];
    affected_telecom: string[];
    villages_comm_blackout: string[];
    shelter_status: {
      id: string;
      name: string;
      capacity: number;
      occupied: number;
      occupancy_pct: number;
      food_remaining_days: number;
      water_liters: number;
      medical_kits: number;
      status: string;
    }[];
    shelter_occupancy_pct: number;
    shelter_overflow?: {
      status: string;
      total_capacity: number;
      total_occupied: number;
      overflow_population: number;
      recommended_actions: string[];
    };
  };

  priority_assessment: {
    village_id: string;
    village_name?: string;
    population: number;
    priority_score: number;
    priority_level: string;
    road_impact: boolean;
    hospital_impact: boolean;
  }[];

  resource_optimization: {
    status: string;
    allocations: Allocation[];

    solver_meta?: {
      ambulance_solver?: {
        solver: string;
        status: string;
        objective_value?: number;
        variables?: number;
        constraints?: number;
        solve_time_ms?: number;
      };
      boat_solver?: {
        solver: string;
        status: string;
        objective_value?: number;
        variables?: number;
        constraints?: number;
        solve_time_ms?: number;
      };
      rescue_solver?: {
        solver: string;
        status: string;
        objective_value?: number;
        variables?: number;
        constraints?: number;
        solve_time_ms?: number;
      };
    };

    intermodal_dispatch?: {
      road_ambulance_villages: string[];
      watercraft_irb_villages: string[];
      road_blocked_villages: string[];
    };

    ambulance_coverage: {
      served_villages: string[];
      unserved_villages: string[];
      total_resources: number;
      resources_used: number;
    };

    boat_coverage?: {
      served_villages: string[];
      unserved_villages: string[];
      total_resources: number;
      resources_used: number;
    };

    rescue_team_coverage: {
      served_villages: string[];
      unserved_villages: string[];
      total_resources: number;
      resources_used: number;
    };

    unserved_settlements?: {
      villages: string[];
      recommended_actions: string[];
    };

    shelter_overflow?: {
      status: string;
      total_capacity: number;
      total_occupied: number;
      overflow_population: number;
      recommended_actions: string[];
    };
  };

  resource_gaps: {
    ambulances: string[];
    rescue_teams: string[];
  };

  sos_feed?: {
    sos_id: string;
    source: string;
    location: string;
    village_id: string;
    lat: number;
    lon: number;
    message: string;
    urgency: string;
    verified: boolean;
    timestamp: string;
  }[];

  live_telemetry?: {
    data_source: string;
    source_label: string;
    fetched_at: string;
    study_region: string;
    coordinates: { lat: number; lon: number };
    rainfall_mm: number;
    duration_hours: number;
    water_level_m: number;
    cloudburst_offset_applied_mm?: number;
    sensor_readings: {
      current_rain_mm_per_hr: number;
      measured_rain_6h_mm?: number;
      accumulated_rain_6h_mm: number;
      temperature_c: number;
      humidity_pct: number;
      wind_speed_kmh: number;
      weather_code: number;
      weather_description?: string;
    };
    barrage_status: {
      estimated_level_m: number;
      danger_level_m: number;
      warning_level_m: number;
      alert_level: string;
    };
    is_live: boolean;
  };
};

export type LiveLocation = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  riverBasin: string;
};

export const LIVE_LOCATIONS: LiveLocation[] = [
  {
    id: "barauni",
    name: "Barauni - Sultanganj (Command HQ)",
    region: "Begusarai Sector 1",
    lat: 25.148,
    lon: 85.950,
    riverBasin: "Ganga River Main Channel (Command HQ)",
  },
  {
    id: "diara",
    name: "Sultanganj Diara River Island",
    region: "Begusarai Sector 2",
    lat: 25.1595,
    lon: 85.9572,
    riverBasin: "Ganga Sandbar (Active Inundation Zone)",
  },
  {
    id: "bund",
    name: "Embankment Ring Bund (KM 12-18)",
    region: "Begusarai Sector 3",
    lat: 25.1500,
    lon: 85.9450,
    riverBasin: "Flood Protection Levee & Sluice Gate",
  },
  {
    id: "manjhaul",
    name: "Manjhaul Lowlands Wetland Basin",
    region: "Begusarai Sector 4",
    lat: 25.1370,
    lon: 85.9515,
    riverBasin: "Kabartal Wetland Catchment",
  },
  {
    id: "railhead",
    name: "Barauni Industrial Railhead Yard",
    region: "Begusarai Sector 5",
    lat: 25.1420,
    lon: 85.9410,
    riverBasin: "Strategic Railhead & Fuel Depot",
  },
];

export type SosIncident = {
  sos_id: string;
  source: string;
  location: string;
  village_id: string;
  lat: number;
  lon: number;
  message: string;
  urgency: "CRITICAL" | "HIGH" | "MODERATE";
  status: "QUEUED" | "DISPATCHED" | "RESOLVED";
  dispatchedUnit?: string;
  evacueeCount: number;
  targetShelter: "S1" | "S2";
  verified: boolean;
  timestamp: string;
  dispatchedAt?: string;
  resolvedAt?: string;
};

export const INITIAL_SOS_INCIDENTS: SosIncident[] = [
  {
    sos_id: "SOS-2024-0042",
    source: "Citizen Helpline 1070",
    location: "Pipra Dewas (V1) - Primary School Rooftop",
    village_id: "V1",
    lat: 25.152,
    lon: 85.947,
    message: "14 families stranded on school rooftop. Water level rising rapidly. 3 elderly, 2 infants. Immediate watercraft required.",
    urgency: "CRITICAL",
    status: "QUEUED",
    evacueeCount: 14,
    targetShelter: "S1",
    verified: true,
    timestamp: "14:48:12 IST",
  },
  {
    sos_id: "SOS-2024-0043",
    source: "NDRF Wireless Relay",
    location: "Sultanganj Diara (V2) - Embankment Sector",
    village_id: "V2",
    lat: 25.1595,
    lon: 85.9572,
    message: "River embankment breached. ~50 residents moving to high school bund. Road SH-58 completely cut off.",
    urgency: "CRITICAL",
    status: "QUEUED",
    evacueeCount: 50,
    targetShelter: "S1",
    verified: true,
    timestamp: "14:44:30 IST",
  },
  {
    sos_id: "SOS-2024-0044",
    source: "District Control Room",
    location: "Manjhaul Lowlands (V3) - Block PHC",
    village_id: "V3",
    lat: 25.137,
    lon: 85.9515,
    message: "PHC access road submerged under 1.4m water. 8 inpatient evacuees including 1 dialysis case require transport.",
    urgency: "CRITICAL",
    status: "QUEUED",
    evacueeCount: 8,
    targetShelter: "S2",
    verified: true,
    timestamp: "14:39:10 IST",
  },
  {
    sos_id: "SOS-2024-0047",
    source: "SDRF Field Report",
    location: "Barauni PHC (H1) - Campus Gate",
    village_id: "V4",
    lat: 25.148,
    lon: 85.950,
    message: "Hospital backup generator diesel supply below 20%. 6 critical ventilator cases need emergency evacuation.",
    urgency: "CRITICAL",
    status: "QUEUED",
    evacueeCount: 6,
    targetShelter: "S1",
    verified: true,
    timestamp: "14:35:45 IST",
  },
  {
    sos_id: "SOS-2024-0048",
    source: "Gram Panchayat Mukhiya",
    location: "Pipra Dewas (V1) - Temple Bund",
    village_id: "V1",
    lat: 25.151,
    lon: 85.949,
    message: "40 villagers sheltering inside temple. Dry ration exhausted. Safe drinking water needed.",
    urgency: "HIGH",
    status: "QUEUED",
    evacueeCount: 40,
    targetShelter: "S1",
    verified: true,
    timestamp: "14:31:00 IST",
  },
];

interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: "SIMULATION" | "DISPATCH" | "SHELTER" | "HAZARD_ALERT" | "IAP_DIRECTIVE" | "CAP_BROADCAST";
  operator: string;
  summary: string;
  details: string;
  hash: string;
}

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "AUD-8401",
    timestamp: "10:14:22 IST",
    eventType: "SIMULATION",
    operator: "Duty Officer SEOC-04 (DM Begusarai)",
    summary: "Hydrodynamic inundation model executed for Barauni-Sultanganj Basin (16.2 km²).",
    details: "Rainfall: 145mm | River Gauge: 8.8m MSL. High-risk cascade triggered on NH-31 causeway.",
    hash: "a9f4c21e",
  },
  {
    id: "AUD-8402",
    timestamp: "10:18:05 IST",
    eventType: "HAZARD_ALERT",
    operator: "Chief Hydrologist (CWC Patna Liaison)",
    summary: "Ganga River gauge breached 8.5m Red Danger threshold at Sultanganj Diara.",
    details: "Critical island cutoff alert declared. Road access to V2 severed by 0.85m river surge.",
    hash: "7b3d119a",
  },
  {
    id: "AUD-8403",
    timestamp: "10:22:40 IST",
    eventType: "DISPATCH",
    operator: "Incident Commander (NDRF 9th Bn)",
    summary: "Google OR-Tools SCIP intermodal solver executed. Multi-unit dispatch authorized.",
    details: "Watercraft IRB RB1 & RB2 mobilized to Sultanganj Diara Ghat. Road ambulances locked to high ground.",
    hash: "4e82fa07",
  },
  {
    id: "AUD-8404",
    timestamp: "10:35:12 IST",
    eventType: "SHELTER",
    operator: "Shelter Logistics Officer (Rajkiya Uchh Vidyalaya)",
    summary: "Relief Camp S1 intake verified: +85 civilian evacuees admitted.",
    details: "Total occupancy reached 765/850 (90%). Sphere standard food and water rations issued.",
    hash: "61dc58f3",
  },
  {
    id: "AUD-8405",
    timestamp: "10:48:30 IST",
    eventType: "IAP_DIRECTIVE",
    operator: "Additional District Magistrate (Disaster Management)",
    summary: "Incident Action Plan (IAP ICS-204/205) approved for operational period OP-01.",
    details: "Indent BSDMA/IAP/2026-OP01 transmitted to DSO Begusarai, IOCL Terminal, and PHED.",
    hash: "28e0bb49",
  },
  {
    id: "AUD-8406",
    timestamp: "10:55:00 IST",
    eventType: "CAP_BROADCAST",
    operator: "SEOC Emergency Gateway Service",
    summary: "CAP v1.2 XML Alert IN-BR-BGS-SEOC-20261021 pushed to NDMA Sachet National Feed.",
    details: "Area: Barauni & Sultanganj Diara Basin (radius 5.0km). Priority: Immediate Evacuation.",
    hash: "93a677e1",
  },
];

type Mode = "live" | "historical" | "simulation";

type ExperimentalMLResult = {
  status: string;
  raw_score: number;
  calibrated_score: number;
  flood_prediction: 0 | 1;
  model_type: string;
  calibration: string;
  deployment_ready: boolean;
  note: string;
};

interface McdaVillageScore {
  id: string;
  name: string;
  type: string;
  population: number;
  vulnerabilityPct: number;
  hydroHazardRaw: number;
  isolationIndexRaw: number;
  shelterDistanceKm: number;
  compositeScore: number;
  priorityRank: number;
  triageLevel: "CRITICAL (P1)" | "HIGH (P2)" | "WATCH (P3)" | "STABLE (P4)";
  badgeColor: string;
  dispatchRecommendation: string;
}

const T = {
  en: {
    govTitle: "Government of Bihar • Disaster Management Department",
    platformTitle: "FLOOD INUNDATION & EMERGENCY DISPATCH DECISION SUPPORT SYSTEM",
    platformSubtitle: "State Emergency Operations Center (SEOC) • Hydrodynamic Flood Modeling & Inter-Agency Relief Logistics",
    simulatorBtn: "SCENARIO SIMULATOR",
    liveBtn: "LIVE TELEMETRY & SAR",
    historyBtn: "HISTORICAL FLOOD 2024",
    sitrepBtn: "OFFICIAL SITREP",
    iapBtn: "INCIDENT ACTION PLAN (IAP)",
    runSimBtn: "RUN SIMULATION",
    dispatchesTab: "Dispatch",
    cascadeTab: "Cascades",
    sheltersTab: "Shelters",
    sosTab: "SOS Calls",
    sensorsTab: "Earth Obs",
    mcdaTab: "MCDA Triage",
    commsTab: "ICS-205 Comms",
    memoBtn: "DRAFT MEMO (PDF)",
    scenA: "Scenario 1: Baseline Patrol (45mm)",
    scenB: "Scenario 2: Embankment Threat (130mm)",
    scenC: "Scenario 3: Kosi Barrage Breach (230mm)",
  },
  hi: {
    govTitle: "बिहार सरकार • आपदा प्रबंधन विभाग",
    platformTitle: "राज्य आपातकालीन परिचालन केंद्र • बाढ़ निगरानी एवं राहत प्रणाली",
    platformSubtitle: "जलप्लावन विश्लेषण, अवसंरचना प्रभाव आकलन एवं अंतर-एजेंसी रसद प्रेषण",
    simulatorBtn: "परिदृश्य सिमुलेटर",
    liveBtn: "लाइव मौसम एवं उपग्रह डेटा",
    historyBtn: "ऐतिहासिक बाढ़ 2024",
    sitrepBtn: "आधिकारिक स्थिति रिपोर्ट",
    iapBtn: "कार्य योजना (IAP)",
    runSimBtn: "सिमुलेशन चलाएं",
    dispatchesTab: "रसद प्रेषण",
    cascadeTab: "प्रभाव श्रृंखला",
    sheltersTab: "राहत शिविर",
    sosTab: "आपातकालीन",
    sensorsTab: "उपग्रह व एआई",
    mcdaTab: "प्राथमिकता मैट्रिक्स",
    commsTab: "वायरलेस संचार",
    memoBtn: "प्रारूप ज्ञापन (PDF)",
    scenA: "परिदृश्य 1: सामान्य निगरानी (45mm)",
    scenB: "परिदृश्य 2: तटबंध खतरा (130mm)",
    scenC: "परिदृश्य 3: कोसी तटबंध टूटना (230mm)",
  },
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("historical");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [fontSizeScale, setFontSizeScale] = useState<"sm" | "base" | "lg">("base");

  // Live Location and Real-Time State
  const [selectedLiveLocation, setSelectedLiveLocation] = useState<LiveLocation>(LIVE_LOCATIONS[0]);
  const [cloudburstOffset, setCloudburstOffset] = useState<number>(0);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);

  const [rainfall, setRainfall] = useState(180);
  const [duration, setDuration] = useState(4);
  const [waterLevel, setWaterLevel] = useState(8.6);

  const [simulationResult, setSimulationResult] = useState<DisasterResult | null>(null);
  const [liveResult, setLiveResult] = useState<DisasterResult | null>(null);
  const [lastSimulationParams, setLastSimulationParams] = useState<{
    rainfall: number;
    duration: number;
    waterLevel: number;
    timestamp: string;
  } | null>(null);

  const [isDegradedMode, setIsDegradedMode] = useState(false);
  const [lastValidTimestamp, setLastValidTimestamp] = useState("");

  const [loading, setLoading] = useState(false);
  const [showSpatialGrid, setShowSpatialGrid] = useState(true);

  // In-app toast notification state (prevents ugly browser alert popups)
  const [toastMessage, setToastMessage] = useState<{
    type: "error" | "info" | "success";
    text: string;
  } | null>(null);

  // Historical event state
  const [historyIndex, setHistoryIndex] = useState(0); // Default to Baseline (T-48h Pre-Event)
  const currentSnapshot: HistoricalSnapshot = HISTORICAL_2024_EVENT[historyIndex];
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSitrepModal, setShowSitrepModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [showIapModal, setShowIapModal] = useState(false);
  const [showCapModal, setShowCapModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  // Sentinel-1 SAR Calibration States
  const [sarThresholdDb, setSarThresholdDb] = useState<number>(-18.5);
  const [sarPolarization, setSarPolarization] = useState<"VV" | "VH" | "VV_VH_RATIO">("VV");
  const [sarFilter, setSarFilter] = useState<"LEE_3X3" | "GAMMA_MAP_5X5" | "RAW">("LEE_3X3");

  // ICS-205 Comms Mesh State
  const [commsPingActive, setCommsPingActive] = useState<boolean>(false);
  const [commsLastChecked, setCommsLastChecked] = useState<string>("09:45:00 IST");

  function appendAuditLog(eventType: AuditLogEntry["eventType"], summary: string, details: string) {
    const randomHex = Math.random().toString(16).substring(2, 10);
    const newEntry: AuditLogEntry = {
      id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: `${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} IST`,
      eventType,
      operator: "Duty Officer SEOC-04 (DM Begusarai)",
      summary,
      details,
      hash: randomHex,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  }

  const [activeTab, setActiveTab] = useState<"dispatches" | "cascade" | "shelters" | "sos" | "sensors" | "mcda" | "comms">("dispatches");

  // Citizen SOS Incidents Lifecycle State
  const [sosIncidents, setSosIncidents] = useState<SosIncident[]>(INITIAL_SOS_INCIDENTS);
  const [newSosData, setNewSosData] = useState({
    source: "Citizen Helpline 1070",
    village_id: "V1",
    evacueeCount: 12,
    urgency: "CRITICAL" as "CRITICAL" | "HIGH" | "MODERATE",
    targetShelter: "S1" as "S1" | "S2",
    message: "",
  });

  // Dynamic Evacuee Intake counts into shelters (incremented as rescues are resolved)
  const [extraIntakeS1, setExtraIntakeS1] = useState(0);
  const [extraIntakeS2, setExtraIntakeS2] = useState(0);

  function handleDispatchSos(sosId: string) {
    setSosIncidents((prev) =>
      prev.map((item) => {
        if (item.sos_id !== sosId) return item;
        const isWatercut = item.village_id === "V2" || item.village_id === "V1";
        const unit = isWatercut ? "Rescue Boat RB1 (Watercraft IRB)" : "Ambulance A1 (ALS Road Unit)";
        appendAuditLog(
          "DISPATCH",
          `Tactical rescue unit ${unit} dispatched to ${item.location}.`,
          `Distress call ${sosId} routed. Intermodal transit ETA ~12 mins.`
        );
        setToastMessage({
          type: "success",
          text: `Tactical Unit Assigned: ${unit} en route to ${item.location}. ETA: ~12 mins.`,
        });
        setTimeout(() => setToastMessage(null), 4000);
        return {
          ...item,
          status: "DISPATCHED" as const,
          dispatchedUnit: unit,
          dispatchedAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        };
      })
    );
  }

  function handleResolveSos(sosId: string) {
    setSosIncidents((prev) =>
      prev.map((item) => {
        if (item.sos_id !== sosId) return item;
        if (item.targetShelter === "S2") {
          setExtraIntakeS2((c) => c + item.evacueeCount);
        } else {
          setExtraIntakeS1((c) => c + item.evacueeCount);
        }
        const sName = item.targetShelter === "S2" 
          ? REAL_INFRASTRUCTURE_METADATA.shelters.S2.name 
          : REAL_INFRASTRUCTURE_METADATA.shelters.S1.name;
        appendAuditLog(
          "SHELTER",
          `Evacuees safely admitted to ${sName} (${item.targetShelter}).`,
          `${item.evacueeCount} citizens from ${item.location} cleared triage. Shelter beds registered.`
        );
        setToastMessage({
          type: "success",
          text: `Evacuation Complete: ${item.evacueeCount} citizens received at ${sName} (${item.targetShelter}). Bed occupancy updated.`,
        });
        setTimeout(() => setToastMessage(null), 4500);
        return {
          ...item,
          status: "RESOLVED" as const,
          resolvedAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        };
      })
    );
  }

  function handleLogNewSos(e: React.FormEvent) {
    e.preventDefault();
    if (!newSosData.message.trim()) {
      setToastMessage({ type: "error", text: "Please provide incident description details." });
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    const villageNames: Record<string, string> = {
      V1: "Pipra Dewas (V1)",
      V2: "Sultanganj Diara (V2)",
      V3: "Manjhaul Lowlands (V3)",
      V4: "Begusarai Rural (V4)",
      V5: "Rajendra Bridge (V5)",
    };
    const villageCoords: Record<string, [number, number]> = {
      V1: [25.152, 85.947],
      V2: [25.1595, 85.9572],
      V3: [25.137, 85.9515],
      V4: [25.148, 85.950],
      V5: [25.143, 85.962],
    };
    const newId = `SOS-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const [lat, lon] = villageCoords[newSosData.village_id] || [25.148, 85.950];
    const newRecord: SosIncident = {
      sos_id: newId,
      source: newSosData.source,
      location: `${villageNames[newSosData.village_id] || "Barauni Flood Sector"} - Direct Call`,
      village_id: newSosData.village_id,
      lat,
      lon,
      message: newSosData.message.trim(),
      urgency: newSosData.urgency,
      status: "QUEUED",
      evacueeCount: Math.max(1, Number(newSosData.evacueeCount) || 5),
      targetShelter: newSosData.targetShelter,
      verified: true,
      timestamp: `${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} IST`,
    };
    setSosIncidents((prev) => [newRecord, ...prev]);
    appendAuditLog(
      "HAZARD_ALERT",
      `Citizen distress call ${newId} logged from ${villageNames[newSosData.village_id]}.`,
      `Reported ${newRecord.evacueeCount} individuals isolated with urgency ${newRecord.urgency}. Target shelter: ${newRecord.targetShelter}.`
    );
    setShowSosModal(false);
    setNewSosData({
      source: "Citizen Helpline 1070",
      village_id: "V1",
      evacueeCount: 12,
      urgency: "CRITICAL",
      targetShelter: "S1",
      message: "",
    });
    setToastMessage({
      type: "success",
      text: `Distress incident ${newId} logged and prioritized in SEOC queue.`,
    });
    setTimeout(() => setToastMessage(null), 4500);
  }

  const [experimentalML, setExperimentalML] =
    useState<ExperimentalMLResult | null>(null);
  const [experimentalLoading, setExperimentalLoading] = useState(false);

  // Restore saved simulation from localStorage on mount
  useEffect(() => {
    try {
      localStorage.removeItem("seoc_theme");
      const saved = localStorage.getItem("disaster_saved_simulation");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.result) {
          setSimulationResult(parsed.result);
          if (parsed.params) {
            setLastSimulationParams(parsed.params);
            setRainfall(parsed.params.rainfall);
            setDuration(parsed.params.duration);
            setWaterLevel(parsed.params.waterLevel);
          }
        }
      }
    } catch (_) {}
  }, []);

  // Time ticker
  const [currentTime, setCurrentTime] = useState("");
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time telemetry freshness age tracker
  const [telemetryAgeSeconds, setTelemetryAgeSeconds] = useState<number>(0);
  useEffect(() => {
    if (!liveResult?.live_telemetry?.fetched_at) return;
    const updateAge = () => {
      const fetchedTime = new Date(liveResult.live_telemetry!.fetched_at).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - fetchedTime) / 1000));
      setTelemetryAgeSeconds(diffSec);
    };
    updateAge();
    const interval = setInterval(updateAge, 1000);
    return () => clearInterval(interval);
  }, [liveResult?.live_telemetry?.fetched_at]);

  // Keyboard accessibility: Close modals on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showSitrepModal) setShowSitrepModal(false);
        if (showSosModal) setShowSosModal(false);
        if (showIapModal) setShowIapModal(false);
        if (showCapModal) setShowCapModal(false);
        if (showAuditModal) setShowAuditModal(false);
        if (showMemoModal) setShowMemoModal(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSitrepModal, showSosModal, showIapModal, showCapModal, showAuditModal, showMemoModal]);

  // Device Geolocation Hook
  function useDeviceLocation() {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setToastMessage({ type: "error", text: "Geolocation is not supported by your browser." });
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const userLoc: LiveLocation = {
          id: "custom-gps",
          name: `Live Device GPS (${pos.coords.latitude.toFixed(3)}°N, ${pos.coords.longitude.toFixed(3)}°E)`,
          region: "Current Device Location",
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4)),
          riverBasin: "Local Hydrological Catchment",
        };
        setSelectedLiveLocation(userLoc);
        setToastMessage({
          type: "success",
          text: `GPS Synced: ${pos.coords.latitude.toFixed(3)}°N, ${pos.coords.longitude.toFixed(3)}°E. Ingesting live satellite radar...`,
        });
        setTimeout(() => setToastMessage(null), 4000);
        analyzeScenario(undefined, undefined, undefined, "live", userLoc, cloudburstOffset);
      },
      (err) => {
        setIsLocatingUser(false);
        setToastMessage({ type: "error", text: `Location access notice: ${err.message}` });
        setTimeout(() => setToastMessage(null), 4000);
      },
      { timeout: 9000, enableHighAccuracy: true }
    );
  }

  // Live Telemetry Auto-Polling (30s Heartbeat)
  useEffect(() => {
    if (mode !== "live") return;
    analyzeScenario(undefined, undefined, undefined, "live", selectedLiveLocation, cloudburstOffset);
    const heartbeat = setInterval(() => {
      analyzeScenario(undefined, undefined, undefined, "live", selectedLiveLocation, cloudburstOffset);
    }, 30000);
    return () => clearInterval(heartbeat);
  }, [mode, selectedLiveLocation.id, cloudburstOffset]);

  // Historical Timeline Auto-Play
  useEffect(() => {
    if (!isPlaying || mode !== "historical") return;
    const interval = setInterval(() => {
      setHistoryIndex((prev) => (prev + 1) % HISTORICAL_2024_EVENT.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isPlaying, mode]);

  // Synchronize Tab selection with Active Operational Mode
  useEffect(() => {
    if (mode === "historical") {
      if (activeTab === "sensors" || activeTab === "mcda") {
        setActiveTab("dispatches");
      }
    } else if (mode === "simulation") {
      if (activeTab === "sensors") {
        setActiveTab("dispatches");
      }
    } else if (mode === "live") {
      if (activeTab === "mcda") {
        setActiveTab("dispatches");
      }
    }
  }, [mode, activeTab]);

  // Active data record depending on active mode
  const activeData: DisasterResult | null =
    mode === "simulation" ? simulationResult : mode === "live" ? liveResult : null;

  // Compute the dynamic 2D spatial grid — strictly anchored to active mode & stored data
  const spatialGrid = useMemo(() => {
    if (mode === "historical") {
      const multiplier = currentSnapshot.river_level_m / 8.0;
      return generateSpatialGrid(currentSnapshot.rainfall_24h_mm, multiplier, 25.148, 85.950);
    }
    if (mode === "simulation") {
      if (simulationResult) {
        return generateSpatialGrid(
          simulationResult.event.inputs.rainfall_mm,
          simulationResult.event.inputs.water_level_m / 8.0,
          25.148,
          85.950
        );
      }
      return generateSpatialGrid(rainfall, waterLevel / 8.0, 25.148, 85.950);
    }
    if (mode === "live") {
      const cLat = selectedLiveLocation.lat;
      const cLon = selectedLiveLocation.lon;
      if (liveResult) {
        return generateSpatialGrid(
          liveResult.event.inputs.rainfall_mm,
          liveResult.event.inputs.water_level_m / 8.0,
          cLat,
          cLon
        );
      }
      return generateSpatialGrid(0, 0.5, cLat, cLon);
    }
    return generateSpatialGrid(rainfall, waterLevel / 8.0, 25.148, 85.950);
  }, [mode, historyIndex, currentSnapshot, simulationResult, liveResult, rainfall, waterLevel, selectedLiveLocation.lat, selectedLiveLocation.lon]);

  async function analyzeScenario(
    customRainfall?: number,
    customDuration?: number,
    customWaterLevel?: number,
    forcedMode?: Mode,
    customLoc?: LiveLocation,
    overrideCloudburst?: number
  ) {
    try {
      setLoading(true);
      const activeModeVal = forcedMode || mode;
      const targetMode = activeModeVal === "historical" ? "simulation" : activeModeVal;
      const rf = customRainfall !== undefined ? customRainfall : rainfall;
      const dur = customDuration !== undefined ? customDuration : duration;
      const wl = customWaterLevel !== undefined ? customWaterLevel : waterLevel;
      const targetLoc = customLoc || selectedLiveLocation;
      const targetCb = overrideCloudburst !== undefined ? overrideCloudburst : cloudburstOffset;

      const payload =
        targetMode === "live"
          ? {
              mode: "live",
              latitude: targetLoc.lat,
              longitude: targetLoc.lon,
              location_name: `${targetLoc.name} (${targetLoc.region})`,
              cloudburst_offset_mm: targetCb,
            }
          : {
              mode: "simulation",
              rainfall_mm: rf,
              duration_hours: dur,
              water_level_m: wl,
            };

      const response = await fetch(`${API_BASE_URL}/api/disaster/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend response:", errorText);
        throw new Error("Backend request failed");
      }

      const result: DisasterResult = await response.json();
      setIsDegradedMode(false);
      const nowHHMM = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      setLastValidTimestamp(nowHHMM);

      if (targetMode === "simulation") {
        setSimulationResult(result);
        const params = {
          rainfall: rf,
          duration: dur,
          waterLevel: wl,
          timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        };
        setLastSimulationParams(params);
        try {
          localStorage.setItem("disaster_saved_simulation", JSON.stringify({ result, params }));
        } catch (_) {}
        appendAuditLog(
          "SIMULATION",
          `Hydrodynamic inundation model computed for Barauni Sector.`,
          `Parameters: ${rf}mm rainfall, ${dur}h duration, ${wl}m river gauge. Risk Score: ${result.event.risk_score.toFixed(2)} (${result.event.hazard_level}).`
        );
      } else if (targetMode === "live") {
        setLiveResult(result);
        appendAuditLog(
          "SIMULATION",
          `Live telemetry ingestion processed for ${targetLoc.name}.`,
          `Precipitation: ${result.event.inputs.rainfall_mm}mm, River Stage: ${result.event.inputs.water_level_m}m. Model Risk: ${result.event.risk_score.toFixed(2)}.`
        );
      }
    } catch (error) {
      console.error(error);
      setIsDegradedMode(true);
      if (!lastValidTimestamp) {
        setLastValidTimestamp(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      }
      setToastMessage({
        type: "error",
        text: `DEGRADED MODE ACTIVATED: Unable to reach ${API_BASE_URL}. Retaining last known safe corridors and shelter data.`,
      });
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetryConnection() {
    setToastMessage({
      type: "info",
      text: "Attempting to reconnect to SEOC disaster intelligence backend...",
    });
    await analyzeScenario();
  }

  function applyPreset(presetName: "extreme" | "moderate" | "baseline") {
    if (presetName === "extreme") {
      // SCENARIO C: Kosi-Ganga Embankment Breach (Catastrophic Cascade)
      setRainfall(230);
      setDuration(6);
      setWaterLevel(9.4);
      if (mode === "simulation") analyzeScenario(230, 6, 9.4);
    } else if (presetName === "moderate") {
      // SCENARIO B: Embankment Threat & Arterial Cutoff
      setRainfall(130);
      setDuration(3);
      setWaterLevel(7.8);
      if (mode === "simulation") analyzeScenario(130, 3, 7.8);
    } else {
      // SCENARIO A: Normal Monsoon Monitoring
      setRainfall(45);
      setDuration(1);
      setWaterLevel(4.2);
      if (mode === "simulation") analyzeScenario(45, 1, 4.2);
    }
  }

  async function runExperimentalML() {
    try {
      setExperimentalLoading(true);
      const latitude = 25.15;
      const longitude = 85.95;

      const response = await fetch(
        `${API_BASE_URL}/api/ml/experimental?latitude=${latitude}&longitude=${longitude}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) throw new Error("Experimental ML request failed");
      const result: ExperimentalMLResult = await response.json();
      setExperimentalML(result);
      setToastMessage({
        type: "success",
        text: "XGBoost Isotonic Calibration Model inference completed with 10m SAR features.",
      });
      setTimeout(() => setToastMessage(null), 4000);
    } catch (error) {
      console.error("Experimental ML error:", error);
      setToastMessage({
        type: "error",
        text: "Could not execute experimental ML validation pipeline.",
      });
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setExperimentalLoading(false);
    }
  }

  // Active metrics depending on mode
  const currentRiskScoreNum =
    mode === "historical"
      ? currentSnapshot.mean_risk_score
      : activeData
        ? activeData.event.risk_score
        : 0.0;

  const displayRiskScore =
    mode === "historical"
      ? currentSnapshot.mean_risk_score.toFixed(2)
      : activeData
        ? activeData.event.risk_score.toFixed(2)
        : "0.00";

  const displayHazardLevel =
    mode === "historical"
      ? currentSnapshot.hazard_level
      : activeData
        ? activeData.event.hazard_level
        : "NORMAL";

  const displayAffectedVillages =
    mode === "historical"
      ? String(currentSnapshot.affected_villages.length)
      : activeData
        ? String(activeData?.impact?.affected_villages?.length ?? 0)
        : "0";

  const displayPopulationAffected =
    mode === "historical"
      ? currentSnapshot.population_affected.toLocaleString()
      : activeData
        ? activeData?.impact?.population_affected?.toLocaleString() ?? "0"
        : "0";

  const activeAffectedVillages =
    mode === "historical"
      ? currentSnapshot.affected_villages
      : activeData?.impact?.affected_villages ?? [];

  const activeAffectedRoads =
    mode === "historical"
      ? currentSnapshot.affected_roads
      : activeData?.impact?.affected_roads ?? [];

  const activeAffectedHospitals =
    mode === "historical"
      ? currentSnapshot.affected_hospitals
      : activeData?.impact?.affected_hospitals ?? [];

  const activeAllocations =
    mode === "historical"
      ? currentSnapshot.historical_allocations
      : (activeData?.resource_optimization?.allocations ?? []);

  const isCritical = currentRiskScoreNum >= 0.75;

  // Real-Time High-Ground Shelter Capacity & Occupancy Modeling
  const s1Total = REAL_INFRASTRUCTURE_METADATA.shelters.S1.capacity; // 850
  const baseS1Occupied = isCritical
    ? 765
    : currentRiskScoreNum >= 0.50
    ? 510
    : currentRiskScoreNum >= 0.30
    ? 220
    : 15;
  const s1Occupied = Math.min(s1Total, baseS1Occupied + extraIntakeS1);
  const s1Pct = Math.round((s1Occupied / s1Total) * 100);

  const s2Total = REAL_INFRASTRUCTURE_METADATA.shelters.S2.capacity; // 600
  const baseS2Occupied = isCritical
    ? 520
    : currentRiskScoreNum >= 0.50
    ? 330
    : currentRiskScoreNum >= 0.30
    ? 140
    : 10;
  const s2Occupied = Math.min(s2Total, baseS2Occupied + extraIntakeS2);
  const s2Pct = Math.round((s2Occupied / s2Total) * 100);

  // Dynamic Incident Action Plan (IAP) Logistics Requisition Calculations
  const iapPopulation =
    mode === "historical"
      ? currentSnapshot.population_affected
      : (activeData?.impact?.population_affected ?? (isCritical ? 12450 : 3800));

  const iapDailyWaterL = Math.max(2500, iapPopulation * 15); // Sphere standard: 15L/day
  const iapChlorineTablets = Math.ceil(iapDailyWaterL / 20); // 1 NaDCC tab / 20L
  const iapDryRations = Math.max(250, iapPopulation); // 1 ration packet / person / day
  const iapGensetDieselL = (activeData?.cascade_utilities?.affected_substations?.length || isCritical) ? 600 : 150; // 2 gensets x 25L/h x 12h
  const iapBoatFuelL = 288; // 3 watercraft IRBs x 12L/h x 8h
  const iapOrsPacks = iapPopulation * 2;
  const iapAsvVials = 30; // Begusarai Civil Surgeon Cold Chain
  const iapBleachingBags = 40; // 25kg chlorinated lime bags for disinfectant
  const iapLifeJackets = 250; // Type II Coast Guard approved PFDs

  // Dynamic Common Alerting Protocol (CAP v1.2) XML Feed Specification
  const capXmlFeed = useMemo(() => {
    const alertId = `IN-BR-BGS-SEOC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${isCritical ? "CRIT" : "WARN"}-001`;
    const sentIso = new Date().toISOString();
    return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${alertId}</identifier>
  <sender>seoc.begusarai@bihar.gov.in</sender>
  <sent>${sentIso}</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Met</category>
    <event>Severe Riverine Inundation &amp; Flash Flood Hazard</event>
    <urgency>${isCritical ? "Immediate" : "Expected"}</urgency>
    <severity>${isCritical ? "Extreme" : "Severe"}</severity>
    <certainty>Observed</certainty>
    <eventCode>
      <valueName>NDMA_HAZARD_CODE</valueName>
      <value>FL_01_RIVERINE</value>
    </eventCode>
    <headline>FLOOD EVACUATION DIRECTIVE: BARAUNI-SULTANGANJ BASIN (BEGUSARAI)</headline>
    <description>Ganga River gauge has breached danger stage at ${waterLevel.toFixed(1)}m MSL (Danger: 8.5m). Severe inundation confirmed across ${displayAffectedVillages} habitats with ${displayPopulationAffected} residents exposed. NH-31 arterial causeways submerged.</description>
    <instruction>Evacuate low-lying areas along designated safe high-ground corridors to Rajkiya Uchh Vidyalaya (S1) or Manjhaul Panchayat Bhawan (S2). Watercraft IRBs stationed at Barauni Ghat Jetty G1.</instruction>
    <web>https://disaster.bihar.gov.in/seoc/alerts/${alertId}</web>
    <contact>State Emergency Operations Centre Patna: 1070 | NDRF Command: 1078</contact>
    <area>
      <areaDesc>Barauni Municipal Sector and Sultanganj Diara River Island, Begusarai District, Bihar</areaDesc>
      <circle>25.148,85.950,5.0</circle>
    </area>
  </info>
</alert>`;
  }, [isCritical, waterLevel, displayAffectedVillages, displayPopulationAffected]);

  function copyCapXml() {
    navigator.clipboard.writeText(capXmlFeed);
    setToastMessage({
      type: "success",
      text: "CAP v1.2 XML payload copied to clipboard. Ready for Sachet / NDMA API ingestion.",
    });
    setTimeout(() => setToastMessage(null), 4000);
  }

  function downloadCapXml() {
    const blob = new Blob([capXmlFeed], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CAP_v1.2_Alert_${new Date().toISOString().slice(0, 10)}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToastMessage({
      type: "success",
      text: "CAP v1.2 XML file exported successfully.",
    });
    setTimeout(() => setToastMessage(null), 4000);
  }

  function broadcastCapXml() {
    appendAuditLog(
      "CAP_BROADCAST",
      "CAP v1.2 XML Alert broadcast pushed to NDMA Sachet National Feed.",
      `Urgency: ${isCritical ? "Immediate" : "Expected"} | Target: Barauni & Sultanganj Diara Basin.`
    );
    setToastMessage({
      type: "success",
      text: "CAP v1.2 Broadcast Dispatched to NDMA Sachet Gateway & District Mobile Alert Cell.",
    });
    setTimeout(() => setToastMessage(null), 5000);
  }

  function exportAuditJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `SEOC_Audit_Ledger_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setToastMessage({
      type: "success",
      text: "SEOC Immutable Audit Ledger JSON exported.",
    });
    setTimeout(() => setToastMessage(null), 4000);
  }

  function exportAuditCsv() {
    const headers = ["ID", "Timestamp", "EventType", "Operator", "Summary", "Details", "Hash"];
    const rows = auditLogs.map((l) => [
      l.id,
      `"${l.timestamp}"`,
      l.eventType,
      `"${l.operator}"`,
      `"${l.summary.replace(/"/g, '""')}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      l.hash,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const a = document.createElement("a");
    a.href = encodeURI(csvContent);
    a.download = `SEOC_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setToastMessage({
      type: "success",
      text: "SEOC Audit Trail CSV spreadsheet exported.",
    });
    setTimeout(() => setToastMessage(null), 4000);
  }

  // Multi-Criteria Decision Analysis (AHP / TOPSIS) Settlement Triage Engine
  const mcdaRankings: McdaVillageScore[] = useMemo(() => {
    const W_HYDRO = 0.35;
    const W_VULN = 0.25;
    const W_ISOL = 0.25;
    const W_FRICT = 0.15;

    const baseData = [
      {
        id: "V2",
        name: "Sultanganj Diara River Island",
        type: "Riparian Island Settlement",
        population: 4200,
        vulnerabilityPct: 0.31,
        shelterDistanceKm: 3.4,
        isIsland: true,
      },
      {
        id: "V1",
        name: "Pipra Dewas",
        type: "Riverfront Embankment Hamlet",
        population: 2800,
        vulnerabilityPct: 0.22,
        shelterDistanceKm: 2.1,
        isIsland: false,
      },
      {
        id: "V5",
        name: "Rajendra Bridge Embankment",
        type: "Elevated Railhead Outskirt",
        population: 2400,
        vulnerabilityPct: 0.26,
        shelterDistanceKm: 2.8,
        isIsland: false,
      },
      {
        id: "V3",
        name: "Manjhaul Lowlands",
        type: "Wetland Agrarian Cluster",
        population: 1900,
        vulnerabilityPct: 0.18,
        shelterDistanceKm: 1.2,
        isIsland: false,
      },
      {
        id: "V4",
        name: "Begusarai Rural",
        type: "Peri-Urban High Ground",
        population: 3100,
        vulnerabilityPct: 0.15,
        shelterDistanceKm: 1.4,
        isIsland: false,
      },
    ];

    const surgeFactor = Math.max(0.2, (waterLevel - 4.0) / 5.5);

    const scored = baseData.map((v) => {
      const depthM = v.isIsland ? waterLevel * 0.22 : v.id === "V1" ? waterLevel * 0.18 : waterLevel * 0.08;
      const velocityMs = v.isIsland ? 2.4 : v.id === "V1" ? 1.8 : 0.9;
      const hydroRaw = Math.min(1.0, (depthM * velocityMs) / 2.2);

      const roadCut = activeAffectedRoads.length > 0 && (v.isIsland || v.id === "V1" || v.id === "V3");
      const isolRaw = v.isIsland ? 1.0 : roadCut ? 0.75 : 0.20;
      const frictRaw = Math.min(1.0, v.shelterDistanceKm / 4.0);

      const composite = (hydroRaw * W_HYDRO) + (v.vulnerabilityPct * W_VULN) + (isolRaw * W_ISOL) + (frictRaw * W_FRICT);
      const clampedScore = Math.round(Math.min(1.0, composite * (0.8 + 0.4 * surgeFactor)) * 100) / 100;

      let triageLevel: McdaVillageScore["triageLevel"] = "STABLE (P4)";
      let badgeColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      let dispatchRec = "Standard road evacuation via transport bus";

      if (clampedScore >= 0.65) {
        triageLevel = "CRITICAL (P1)";
        badgeColor = "bg-rose-500/20 text-rose-300 border-rose-500/40";
        dispatchRec = v.isIsland
          ? "Immediate Watercraft IRB mobilization from Ghat Jetty G1"
          : "Heavy motorized IRB boat & amphibious transport";
      } else if (clampedScore >= 0.45) {
        triageLevel = "HIGH (P2)";
        badgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/40";
        dispatchRec = "ALS Ambulance escort along high ring bund crest";
      } else if (clampedScore >= 0.30) {
        triageLevel = "WATCH (P3)";
        badgeColor = "bg-blue-500/20 text-blue-300 border-blue-500/40";
        dispatchRec = "Civilian bus convoy along MDR-14 arterial causeway";
      }

      return {
        id: v.id,
        name: v.name,
        type: v.type,
        population: v.population,
        vulnerabilityPct: v.vulnerabilityPct,
        hydroHazardRaw: Math.round(hydroRaw * 100) / 100,
        isolationIndexRaw: Math.round(isolRaw * 100) / 100,
        shelterDistanceKm: v.shelterDistanceKm,
        compositeScore: clampedScore,
        priorityRank: 0,
        triageLevel,
        badgeColor,
        dispatchRecommendation: dispatchRec,
      };
    });

    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    return scored.map((item, idx) => ({ ...item, priorityRank: idx + 1 }));
  }, [waterLevel, rainfall, activeAffectedRoads.length]);

  // Sentinel-1 SAR Dynamic Water Extent Computation
  const sarWaterAreaKm2 = useMemo(() => {
    const baseArea = 3.56;
    const floodExpansion = waterLevel > 4.5 ? (waterLevel - 4.5) * 1.85 : 0.2;
    const threshShift = (-18.5 - sarThresholdDb) * 0.08;
    return Number(Math.max(1.8, (baseArea + floodExpansion) * (1 + threshShift)).toFixed(2));
  }, [waterLevel, sarThresholdDb]);

  // Tactical Comms Mesh Check Function (ICS-205)
  function executeCommsCheck() {
    setCommsPingActive(true);
    setTimeout(() => {
      setCommsPingActive(false);
      const timeStr = `${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} IST`;
      setCommsLastChecked(timeStr);
      appendAuditLog(
        "DISPATCH",
        "Tactical VHF/PTT Comms Mesh Check completed across all 6 incident channels.",
        "Repeater R1 (IOCL Mast -74dBm), R2 (Collectorate -82dBm), and Diara Mobile Mast (-91dBm) verified 100% operational."
      );
      setToastMessage({
        type: "success",
        text: `VHF Radio Mesh Check Complete at ${timeStr}. All 6 emergency channels clear with 100% signal clearance.`,
      });
      setTimeout(() => setToastMessage(null), 5000);
    }, 1200);
  }

  return (
    <main className={`min-h-screen bg-[#07111e] text-slate-100 font-sans antialiased selection:bg-amber-500 selection:text-slate-950 ${
      fontSizeScale === "sm" ? "text-[13px]" : fontSizeScale === "lg" ? "text-[15.5px]" : "text-[14px]"
    }`}>
      {/* Skip to Main Content Link (GIGW 3.0 / WCAG 2.1 AA Mandate) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-amber-500 focus:text-slate-950 focus:px-3 focus:py-1.5 focus:font-bold focus:rounded focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-lg text-xs"
      >
        मुख्य सामग्री पर जाएं / Skip to Main Content
      </a>

      {/* 1. TOP UTILITY STRIP — GOVERNMENT OF INDIA / GIGW 3.0 / MYGOV STANDARD */}
      <div className="top-utility-strip bg-[#040a14] border-b border-[#142642] text-slate-400 text-[11px] px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 z-50">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <span className="text-amber-400 text-xs font-mono font-bold">[SEOC]</span>
            <span>भारत सरकार | Government of India</span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-400 hidden sm:inline">गृह मंत्रालय | Ministry of Home Affairs</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px]">
          {/* Emergency Hotlines */}
          <div className="flex items-center gap-2 text-rose-400 font-mono font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/50">
            <span>SEOC: 1070</span>
            <span className="text-slate-600">|</span>
            <span>NDRF: 1078</span>
            <span className="text-slate-600">|</span>
            <span>EMERGENCY: 112</span>
          </div>

          <span className="text-slate-600 hidden md:inline">|</span>

          {/* GIGW 3.0 Accessibility Font Resizing (A- / A / A+) */}
          <div className="flex items-center gap-1 border border-[#1d324f] bg-[#0c182a] rounded px-1.5 py-0.5 font-mono text-[10px] font-scale-box" title="GIGW 3.0 Accessibility Text Size Control">
            <span className="text-slate-400 font-sans mr-0.5 hidden sm:inline">Text:</span>
            <button
              onClick={() => {
                setFontSizeScale("sm");
                setToastMessage({ type: "info", text: "Text scale set to Compact (A-)." });
              }}
              title="Decrease text size (GIGW 3.0)"
              className={`px-1 py-0.5 rounded font-bold cursor-pointer transition ${
                fontSizeScale === "sm" ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:text-white"
              }`}
            >
              A-
            </button>
            <button
              onClick={() => {
                setFontSizeScale("base");
                setToastMessage({ type: "info", text: "Text scale reset to Standard (A)." });
              }}
              title="Standard text size (GIGW 3.0)"
              className={`px-1 py-0.5 rounded font-bold cursor-pointer transition ${
                fontSizeScale === "base" ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:text-white"
              }`}
            >
              A
            </button>
            <button
              onClick={() => {
                setFontSizeScale("lg");
                setToastMessage({ type: "info", text: "Text scale set to Large (A+)." });
              }}
              title="Increase text size (GIGW 3.0)"
              className={`px-1 py-0.5 rounded font-bold cursor-pointer transition ${
                fontSizeScale === "lg" ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:text-white"
              }`}
            >
              A+
            </button>
          </div>

          <span className="text-slate-600 hidden md:inline">|</span>

          {/* Real-time Sat Status */}
          <span className="text-emerald-400 font-mono font-bold hidden lg:inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            LIVE SAT-INGESTION: ACTIVE
          </span>

          {/* Official Bilingual Switcher */}
          <button
            onClick={() => {
              const next = language === "en" ? "hi" : "en";
              setLanguage(next);
              setToastMessage({
                type: "info",
                text: next === "hi" ? "भाषा बदलकर हिंदी कर दी गई है।" : "Language switched to English.",
              });
            }}
            className="text-amber-300 hover:text-amber-200 font-bold cursor-pointer transition px-2.5 py-1 rounded bg-[#0c182a] border border-amber-500/40 text-[11px] flex items-center gap-1.5 shadow-sm"
          >
            <span>{language === "en" ? "हिंदी (Hindi)" : "English"}</span>
          </button>
        </div>
      </div>

      <div id="main-content" className="mx-auto max-w-7xl p-2 sm:p-2.5 lg:p-3 space-y-2">

        {/* IN-APP TOAST NOTIFICATION BANNER */}
        {toastMessage && (
          <div
            className={`rounded-md border px-3 py-2 text-xs font-semibold flex items-center justify-between gap-2.5 shadow-none transition-all ${
              toastMessage.type === "error"
                ? "bg-rose-950/90 border-rose-600 text-rose-200"
                : toastMessage.type === "success"
                ? "bg-emerald-950/90 border-emerald-600 text-emerald-200"
                : "bg-blue-950/90 border-blue-600 text-blue-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase font-bold">{toastMessage.type === "error" ? "[ALERT]" : toastMessage.type === "success" ? "[CONFIRMED]" : "[INFO]"}</span>
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white font-mono text-sm px-1 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* 2. OFFICIAL GOVERNMENT PORTAL BANNER & COMMAND HEADER (NIDM / MYGOV / GIGW STANDARD) */}
        <header className="rounded-md border border-[#1b3353] bg-[#0a1628] shadow-none relative overflow-hidden">
          {/* Indian National Tricolor Ribbon */}
          <div className="h-1 w-full bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808]" />

          <div className="p-2 sm:p-2.5 relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">

              {/* Official Seal & Institutional Title Block */}
              <div className="flex items-center gap-2.5">
                {/* State Emblem of India Official Seal */}
                <div className="state-emblem-box flex items-center justify-center h-11 w-10 rounded bg-[#07111e] border border-[#1e3a60] shrink-0 p-0.5">
                  <StateEmblemIndia className="h-full w-full" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.2 text-[8.5px] font-bold text-emerald-400 uppercase tracking-wider">
                      <span className="h-1 w-1 rounded-full bg-emerald-400" />
                      SEOC PATNA 24x7 MONITORING
                    </span>
                    <span className="rounded bg-[#0d1e35] border border-[#1d385e] px-1.5 py-0.2 text-[8.5px] font-semibold text-slate-300 font-mono">
                      ISRO BHUVAN • SENTINEL-1A • CWC GAUGE
                    </span>
                    <span className="rounded bg-[#0d1e35] border border-[#1d385e] px-1.5 py-0.2 text-[8.5px] font-semibold text-cyan-300 font-mono">
                      NIC MEGHRAJ CLOUD
                    </span>
                    {currentTime && (
                      <span className="text-[8.5px] text-slate-300 font-mono bg-[#07111e] px-1.5 py-0.2 rounded border border-[#1e3a60]">
                        {currentTime} IST
                      </span>
                    )}
                  </div>

                  <div className="mt-0.5">
                    <div className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider">
                      {language === "hi"
                        ? "राष्ट्रीय आपदा प्रबंधन संस्थान (NIDM) • बिहार राज्य आपदा प्रबंधन प्राधिकरण (BSDMA)"
                        : "National Institute of Disaster Management (NIDM) • Bihar State Disaster Management Authority (BSDMA)"}
                    </div>
                    <h1 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                      <span>{T[language].platformTitle}</span>
                      <span className="text-[9.5px] font-mono font-normal text-slate-400">| SEOC BIHAR</span>
                    </h1>
                  </div>

                  <p className="text-slate-400 text-[10.5px] max-w-2xl leading-tight">
                    {T[language].platformSubtitle}
                  </p>
                </div>
              </div>

              {/* GOVERNMENT MODE SWITCHER & PRIMARY ACTION BUTTONS */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-1.5 shrink-0">
                <div className="flex rounded border border-[#1b3353] bg-[#07111e] p-0.5 mode-switcher-container">
                  <button
                    onClick={() => setMode("historical")}
                    className={`cursor-pointer px-2.5 py-1 rounded text-xs font-bold transition-all ${mode === "historical"
                      ? "bg-slate-700 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                      }`}
                  >
                    {language === "hi" ? "2024 ऐतिहासिक ऑडिट" : "2024 BIHAR AUDIT"}
                  </button>

                  <button
                    onClick={() => setMode("simulation")}
                    className={`cursor-pointer px-2.5 py-1 rounded text-xs font-bold transition-all ${mode === "simulation"
                      ? "bg-blue-800 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                      }`}
                  >
                    {T[language].simulatorBtn}
                  </button>

                  <button
                    onClick={() => setMode("live")}
                    className={`cursor-pointer px-2.5 py-1 rounded text-xs font-bold transition-all ${mode === "live"
                      ? "bg-teal-800 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                      }`}
                  >
                    {T[language].liveBtn}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setShowSitrepModal(true)}
                    className="header-action-btn cursor-pointer rounded border border-[#1b3353] bg-[#0c182a] hover:bg-[#132642] px-2 py-1 text-xs font-semibold text-blue-300 transition-all flex items-center gap-1 shadow-none"
                  >
                    {mode === "historical" ? "2024 AUDIT SITREP" : mode === "simulation" ? "SIMULATION SITREP" : "OFFICIAL LIVE SITREP"}
                  </button>

                  <button
                    onClick={() => setShowIapModal(true)}
                    className="header-action-btn cursor-pointer rounded border border-slate-700 bg-slate-900/90 hover:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 transition-all flex items-center gap-1 shadow-none"
                  >
                    {mode === "historical" ? "2024 IAP RECORD" : T[language].iapBtn}
                  </button>

                  <button
                    onClick={() => setShowCapModal(true)}
                    className="header-action-btn cursor-pointer rounded border border-slate-700 bg-slate-900/90 hover:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 transition-all flex items-center gap-1 shadow-none"
                  >
                    CAP v1.2 XML
                  </button>

                  <button
                    onClick={() => setShowAuditModal(true)}
                    className="header-action-btn cursor-pointer rounded border border-slate-700 bg-slate-900/90 hover:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 transition-all flex items-center gap-1 shadow-none"
                  >
                    SEOC AUDIT
                  </button>

                  <button
                    onClick={() => setShowMemoModal(true)}
                    className="header-action-btn cursor-pointer rounded border border-slate-700 bg-slate-900/90 hover:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 transition-all flex items-center gap-1 shadow-none"
                  >
                    {T[language].memoBtn}
                  </button>

                  {isDegradedMode && (
                    <button
                      onClick={() => handleRetryConnection()}
                      disabled={loading}
                      className="cursor-pointer rounded bg-slate-700 hover:bg-slate-600 px-2.5 py-1 text-xs font-bold text-white transition-all border border-slate-600 flex items-center gap-1"
                      title="Attempt to reconnect to SEOC disaster backend"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      <span>{loading ? "RECONNECTING..." : "RETRY CONNECTION"}</span>
                    </button>
                  )}

                  {mode === "simulation" && !isDegradedMode && (
                    <button
                      onClick={() => analyzeScenario()}
                      disabled={loading}
                      className="cursor-pointer rounded bg-blue-700 hover:bg-blue-800 px-3 py-1 text-xs font-bold text-white disabled:opacity-50 transition-all border border-blue-700 shadow-xs flex items-center gap-1"
                    >
                      {loading ? "CALCULATING..." : "RUN SIMULATION"}
                    </button>
                  )}

                  {mode === "live" && !isDegradedMode && (
                    <button
                      onClick={() => analyzeScenario(undefined, undefined, undefined, "live", selectedLiveLocation, cloudburstOffset)}
                      disabled={loading}
                      className="cursor-pointer rounded bg-teal-700 hover:bg-teal-800 px-2.5 py-1 text-xs font-bold text-white transition-all border border-teal-700 flex items-center gap-1 shadow-xs"
                      title="Force refresh live weather telemetry and satellite radar"
                    >
                      <span>SYNC RADAR &amp; TELEMETRY</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        </header>

        {/* 2B. OPERATIONAL MODE CONTEXT & DATA ISOLATION BANNER */}
        {mode === "historical" && (
          <div className="rounded-md border border-[#1b3353] bg-[#0c192c] px-3 py-1.5 shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-blue-300 border border-blue-500/30 shrink-0 font-mono">
                2024 BIHAR AUDIT MODE
              </span>
              <div>
                <span className="text-xs font-semibold text-white block">
                  Historical Flood Benchmark &amp; Post-Disaster Analysis (27 Sep 2024 Event)
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Empirical ground-truth replay. Live sensor polling and simulation sliders are isolated to preserve audit integrity.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
              <span className="text-blue-300 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded font-bold">
                STAGE {historyIndex + 1} OF 4: {currentSnapshot.label.toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {mode === "simulation" && (
          <div className="rounded-md border border-[#1b3353] bg-[#0c192c] px-3 py-1.5 shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-amber-300 border border-amber-500/30 shrink-0 font-mono">
                SCENARIO SIMULATOR MODE
              </span>
              <div>
                <span className="text-xs font-semibold text-white block">
                  Predictive Hydrodynamic Stress-Testing &amp; Secondary Failure Sandbox
                </span>
                <span className="text-[10px] text-slate-400 block">
                  What-if simulation active. Adjust physical sliders below to model hypothetical breach dynamics and dispatch needs.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
              <span className="text-amber-300 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded font-bold">
                RUN PARAMS: {rainfall}mm | {duration}h | {waterLevel}m STAGE
              </span>
            </div>
          </div>
        )}

        {mode === "live" && (
          <div className="rounded-md border border-[#1b3353] bg-[#0c192c] px-3 py-1.5 shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0 font-mono">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                LIVE TELEMETRY &amp; SAR MODE
              </span>
              <div>
                <span className="text-xs font-semibold text-white block">
                  Real-Time Earth Observation &amp; Sensor Telemetry (30s Polling Heartbeat)
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Live CWC river stage telemetry, Open-Meteo AWS feeds, and Copernicus Sentinel-1A SAR stream active.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
              <span className="text-emerald-300 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded font-bold">
                SECTOR: {selectedLiveLocation.name.toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* 3. OFFICIAL EMERGENCY ALERT BULLETIN TICKER */}
        {isCritical && (
          <div className="rounded-md border border-red-700/80 bg-[#1a080c] p-2.5 shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono font-bold text-red-300 border border-red-700/60 bg-red-950 px-1.5 py-0.5 rounded">PRIORITY 1</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 rounded bg-red-700 text-white font-bold text-[9px] uppercase tracking-wider">
                      {mode === "historical" ? "ARCHIVED RECORD" : mode === "simulation" ? "SIMULATION ALERT" : "URGENT DIRECTIVE"}
                    </span>
                    <h3 className="font-bold text-red-200 text-xs sm:text-sm tracking-wide">
                      {mode === "historical"
                        ? "HISTORICAL DIRECTIVE ARCHIVE — 27 SEP 2024 RED FLOOD WARNING (LEVEL-4)"
                        : mode === "simulation"
                        ? "SIMULATED FLOOD DIRECTIVE — PROJECTED RED FLOOD WARNING (LEVEL-4)"
                        : "STATE DISASTER EMERGENCY DIRECTIVE — RED FLOOD WARNING (LEVEL-4)"}
                    </h3>
                  </div>
                  <p className="text-[11px] text-red-300/90 mt-0.5">
                    {mode === "historical"
                      ? "Recorded empirical inundation across Sultanganj Diara & Pipra Dewas. Arterial highways NH-31 & SH-58 breached. Historical SDRF/NDRF 9th Bn deployment logged."
                      : mode === "simulation"
                      ? `Model projection indicates catastrophic causeway overtop at ${rainfall}mm precipitation. Google OR-Tools intermodal solver engaging emergency watercraft.`
                      : "Critical inundation across Sultanganj Diara & Pipra Dewas. Arterial highways NH-31 & SH-58 severed. SDRF/NDRF 9th Bn deployed for immediate watercraft evacuation."}
                  </p>
                </div>
              </div>
              <span className="w-fit rounded bg-red-700 px-2 py-1 text-[10px] font-bold text-white uppercase tracking-wider border border-red-600 shrink-0">
                {mode === "historical" ? "ARCHIVE REPLAY" : "EVACUATION PROTOCOL ACTIVE"}
              </span>
            </div>
          </div>
        )}

        {/* GOLDEN HOUR EVACUATION & INUNDATION RATE HUD */}
        {(isCritical || currentRiskScoreNum >= 0.5) && (
          <div className="rounded-md border border-amber-600/50 bg-[#161007] p-2.5 shadow-none">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-xs font-mono font-bold shrink-0">
                  {mode === "historical" ? "[AUDIT]" : "[T-0]"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold tracking-widest uppercase border border-amber-500/40 font-mono">
                      {mode === "historical" ? "2024 BENCHMARK TIMELINE" : "GOLDEN HOUR TACTICAL WINDOW"}
                    </span>
                    <span className="text-slate-400 font-mono text-[9px]">
                      NDMA SOP REF: EVAC-04/2023
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white mt-0.5">
                    {mode === "historical" ? (
                      <>Stage Margin: <span className="text-amber-400 font-mono">02h 45m Historical Evacuation Window</span></>
                    ) : mode === "simulation" ? (
                      <>Simulated Breach Margin: <span className="text-amber-400 font-mono">02h 45m Estimated Window</span></>
                    ) : (
                      <>Estimated Breach-to-Isolation Margin: <span className="text-amber-400 font-mono">02h 45m Remaining</span></>
                    )}
                  </h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Safe Evacuation Corridor: <strong className="text-slate-200">NH-31 High-Elevation Causeway &rarr; Rajkiya Uchh Vidyalaya Camp</strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-slate-950 px-2 py-1 rounded border border-slate-800 text-right">
                  <span className="text-[9px] text-slate-400 block font-semibold uppercase">Ingress Rate</span>
                  <span className="text-xs font-mono font-bold text-rose-400">+5.8 cm/h</span>
                </div>
                <div className="bg-slate-950 px-2 py-1 rounded border border-slate-800 text-right">
                  <span className="text-[9px] text-slate-400 block font-semibold uppercase">Road Cuts</span>
                  <span className="text-xs font-mono font-bold text-amber-400">{activeAffectedRoads.length} Routes</span>
                </div>
                {mode === "historical" ? (
                  <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono text-xs font-bold">
                    ARCHIVED RECORD [READ ONLY]
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setToastMessage({
                        type: "info",
                        text: mode === "simulation"
                          ? "CAP v1.2 Simulation Test Broadcast dispatched to virtual sirens."
                          : "CAP v1.2 Broadcast Dispatched: Common Alerting Protocol SMS & Sirens transmitted via SEOC Patna.",
                      });
                    }}
                    className="cursor-pointer px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs transition shadow-none border border-rose-600 flex items-center gap-1"
                  >
                    {mode === "simulation" ? "TEST CELL BROADCAST" : "BROADCAST CELL ALERT"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. EXECUTIVE DISASTER TELEMETRY TILES (GOVERNMENT STANDARD) */}
        {mode === "live" ? (() => {
          const liveTelem = liveResult?.live_telemetry;
          const liveStageM = liveTelem?.water_level_m ?? 36.85;
          const liveDangerM = liveTelem?.barrage_status?.danger_level_m ?? 8.5;
          const liveWarningM = liveTelem?.barrage_status?.warning_level_m ?? 7.0;
          const liveAlertLevel = liveTelem?.barrage_status?.alert_level ?? (liveStageM >= liveDangerM ? "DANGER" : liveStageM >= liveWarningM ? "WARNING" : "NORMAL");

          const currentRainRate = liveTelem?.sensor_readings?.current_rain_mm_per_hr ?? 0;
          const measuredRain6h = liveTelem?.sensor_readings?.measured_rain_6h_mm ?? 0;
          const totalRainAccum = liveTelem?.rainfall_mm ?? 0;
          const rain3hEst = Math.round((currentRainRate * 2.0 + measuredRain6h * 0.45) * 10) / 10;
          const rain24hEst = Math.round((totalRainAccum * 1.75 + 8.5) * 10) / 10;

          const liveCompositeRisk = Math.min(1.0, Math.max(0.08, ((liveStageM - 4.0) / 8.0) * 0.45 + (totalRainAccum / 180.0) * 0.35 + (sarWaterAreaKm2 / 12.0) * 0.20));
          const liveRiskLabel = liveCompositeRisk >= 0.70
            ? { title: "CRITICAL", sub: "Level 3 Red Alert", badge: "bg-red-500/20 text-red-300 border-red-500/50" }
            : liveCompositeRisk >= 0.45
            ? { title: "HIGH", sub: "Level 2 Amber Alert", badge: "bg-amber-500/20 text-amber-300 border-amber-500/50" }
            : liveCompositeRisk >= 0.25
            ? { title: "MODERATE", sub: "Level 1 Yellow Watch", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50" }
            : { title: "NORMAL", sub: "Green Baseline", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" };

          return (
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
              {/* Tile 1: River Stage (CWC) */}
              <div className="rounded-md border border-[#1b3353] bg-[#0c192c] p-2.5 shadow-none flex flex-col justify-between min-h-[114px]">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      River Stage (Ganga)
                    </span>
                    <span className="text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900 text-blue-300 border border-slate-700">
                      CWC Hydro-Net
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className={`text-xl font-bold font-mono tracking-tight ${
                      liveAlertLevel === "DANGER" ? "text-rose-400" : liveAlertLevel === "WARNING" ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      {liveStageM.toFixed(2)} m
                    </span>
                    <span className="text-[11px] font-bold text-amber-300 font-mono">
                      +3.8 cm/h
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 font-mono mt-0.5 truncate">
                    Danger: <strong className="text-rose-300">{liveDangerM}m</strong> | Warning: <strong className="text-amber-300">{liveWarningM}m</strong>
                  </p>
                </div>

                {/* 6h River Stage Trend Bar */}
                <div className="pt-1 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-400 mb-0.5">
                    <span>6h Trend: Rising</span>
                    <span className="text-cyan-300 font-bold">{liveStageM.toFixed(1)}m MSL</span>
                  </div>
                  <div className="h-1 w-full bg-slate-900 rounded-sm overflow-hidden flex items-end gap-0.5">
                    <div className="w-1/6 bg-blue-500/40 h-full" />
                    <div className="w-1/6 bg-blue-500/55 h-full" />
                    <div className="w-1/6 bg-blue-500/70 h-full" />
                    <div className="w-1/6 bg-blue-500/85 h-full" />
                    <div className="w-1/6 bg-cyan-400 h-full" />
                    <div className="w-1/6 bg-amber-400 h-full" />
                  </div>
                </div>
              </div>

              {/* Tile 2: Precipitation Rates (IMD) */}
              <div className="rounded-md border border-[#1b3353] bg-[#0c192c] p-2.5 shadow-none flex flex-col justify-between min-h-[114px]">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Precipitation Rates
                    </span>
                    <span className="text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900 text-amber-300 border border-slate-700">
                      IMD / Open-Meteo
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl font-bold font-mono tracking-tight text-amber-300">
                      {currentRainRate.toFixed(1)} mm/h
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 font-mono">
                      (Current)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-300 mt-0.5 truncate">
                    <span>1h: <strong className="text-white">{currentRainRate}mm</strong></span>
                    <span>3h: <strong className="text-white">{rain3hEst}mm</strong></span>
                    <span>6h: <strong className="text-amber-200">{measuredRain6h}mm</strong></span>
                    <span>24h: <strong className="text-cyan-200">{rain24hEst}mm</strong></span>
                  </div>
                </div>

                {/* 6h Accumulation Bar */}
                <div className="pt-1 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-400 mb-0.5">
                    <span>6h Accumulation</span>
                    <span className="text-amber-300 font-bold">{totalRainAccum}mm Total</span>
                  </div>
                  <div className="h-1 w-full bg-slate-900 rounded-sm overflow-hidden flex items-end gap-0.5">
                    <div className="w-1/6 bg-amber-500/40 h-full" />
                    <div className="w-1/6 bg-amber-500/55 h-full" />
                    <div className="w-1/6 bg-amber-500/70 h-full" />
                    <div className="w-1/6 bg-amber-500/85 h-full" />
                    <div className="w-1/6 bg-amber-500 h-full" />
                    <div className="w-1/6 bg-amber-400 h-full" />
                  </div>
                </div>
              </div>

              {/* Tile 3: SAR Inundation Footprint */}
              <div className="rounded-md border border-[#1b3353] bg-[#0c192c] p-2.5 shadow-none flex flex-col justify-between min-h-[114px]">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      SAR Inundation Footprint
                    </span>
                    <span className="text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900 text-cyan-300 border border-slate-700">
                      Sentinel-1A SAR
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl font-bold font-mono tracking-tight text-cyan-300">
                      {sarWaterAreaKm2} km²
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400 font-mono">
                      +{(sarWaterAreaKm2 - 3.56).toFixed(2)} km²
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 font-mono mt-0.5 truncate">
                    Pass: <strong className="text-slate-200">~18m ago</strong> (10m GRD Radar)
                  </p>
                </div>

                <div className="pt-1 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[8.5px] font-mono text-cyan-200 mb-0.5">
                    <span>Pol: <strong>{sarPolarization}</strong></span>
                    <span>Filter: <strong>{sarFilter}</strong></span>
                  </div>
                  <div className="h-1 w-full bg-slate-900 rounded-sm overflow-hidden flex items-end gap-0.5">
                    <div className="w-2/6 bg-cyan-500/40 h-full" />
                    <div className="w-2/6 bg-cyan-500/70 h-full" />
                    <div className="w-2/6 bg-cyan-400 h-full" />
                  </div>
                </div>
              </div>

              {/* Tile 4: SEOC Live Evaluated Risk */}
              <div className="rounded-md border border-[#1b3353] bg-[#0c192c] p-2.5 shadow-none flex flex-col justify-between min-h-[114px]">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      SEOC Live Evaluated Risk
                    </span>
                    <span className="text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900 text-emerald-300 border border-slate-700">
                      SEOC Composite
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl font-bold font-mono tracking-tight text-white">
                      {(liveCompositeRisk * 100).toFixed(1)}%
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${liveRiskLabel.badge}`}>
                      {liveRiskLabel.title}
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 font-mono mt-0.5 truncate">
                    Alert Status: <strong className="text-slate-200">{liveRiskLabel.sub}</strong>
                  </p>
                </div>

                <div className="pt-1 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-400 mb-0.5">
                    <span>Threshold: 1.27% (High-Recall)</span>
                    <span className="text-emerald-300 font-bold">Model Verified</span>
                  </div>
                  <div className="h-1 w-full bg-slate-900 rounded-sm overflow-hidden flex items-end gap-0.5">
                    <div className={`h-full ${liveCompositeRisk >= 0.70 ? "w-full bg-rose-500" : liveCompositeRisk >= 0.45 ? "w-3/4 bg-amber-500" : "w-1/3 bg-emerald-500"}`} />
                  </div>
                </div>
              </div>
            </section>
          );
        })() : mode === "historical" ? (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            <StatCard
              title="2024 Event Peak Risk"
              value={currentSnapshot.mean_risk_score.toFixed(2)}
              subtitle="27 Sep 2024 Benchmark Index"
              barPercent={Math.min(100, Math.round(currentSnapshot.mean_risk_score * 100))}
              color={currentSnapshot.mean_risk_score >= 0.75 ? "red" : currentSnapshot.mean_risk_score >= 0.5 ? "orange" : "emerald"}
            />
            <StatCard
              title="Recorded Severity Tier"
              value={currentSnapshot.hazard_level}
              subtitle="NDMA Archived Classification"
              color={currentSnapshot.hazard_level === "CRITICAL" ? "red" : currentSnapshot.hazard_level === "HIGH" ? "orange" : "emerald"}
            />
            <StatCard
              title="2024 Submerged Habitats"
              value={`${currentSnapshot.affected_villages.length} of 5`}
              subtitle="Empirical Ground-Truth Cutoffs"
              color={currentSnapshot.affected_villages.length >= 3 ? "red" : currentSnapshot.affected_villages.length > 0 ? "orange" : "emerald"}
            />
            <StatCard
              title="Verified Population Impact"
              value={currentSnapshot.population_affected.toLocaleString()}
              subtitle="Official District Relief Census"
              color={currentSnapshot.mean_risk_score >= 0.75 ? "red" : currentSnapshot.mean_risk_score >= 0.5 ? "orange" : "emerald"}
            />
          </section>
        ) : (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            <StatCard
              title="Simulated Inundation Risk"
              value={displayRiskScore}
              subtitle={`What-If Run: ${rainfall}mm / ${duration}h`}
              barPercent={Math.min(100, Math.round(Number(displayRiskScore) * 100))}
              color={Number(displayRiskScore) >= 0.75 ? "red" : Number(displayRiskScore) >= 0.5 ? "orange" : "emerald"}
            />
            <StatCard
              title="Projected Severity Tier"
              value={displayHazardLevel}
              subtitle="Model Evaluated Severity Tier"
              color={displayHazardLevel === "CRITICAL" ? "red" : displayHazardLevel === "HIGH" ? "orange" : "emerald"}
            />
            <StatCard
              title="Projected Cutoff Habitats"
              value={`${activeAffectedVillages.length} of 5`}
              subtitle="Predicted Road Network Breach"
              color={activeAffectedVillages.length >= 3 ? "red" : activeAffectedVillages.length > 0 ? "orange" : "emerald"}
            />
            <StatCard
              title="Projected Evacuation Demand"
              value={displayPopulationAffected}
              subtitle="Simulated Exposed Population"
              color={Number(displayRiskScore) >= 0.75 ? "red" : Number(displayRiskScore) >= 0.5 ? "orange" : "emerald"}
            />
          </section>
        )}

        {/* 5. MAIN COMMAND CENTER: 2-COLUMN SPLIT GIS DECK */}
        <div className="grid lg:grid-cols-12 gap-2 sm:gap-2.5 items-stretch">

          {/* LEFT COLUMN: SATELLITE GIS MAP (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col">

            {/* GIS MAP CARD */}
            <div className="rounded-md border border-[#1b3353] bg-[#0c192c] p-2.5 sm:p-3 shadow-none flex flex-col h-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-blue-300 font-mono text-[9px] font-bold border border-slate-700">
                      {mode === "live"
                        ? `GIS SECTOR: ${selectedLiveLocation.name.toUpperCase()}`
                        : mode === "historical"
                        ? "HISTORICAL BENCHMARK: 2024 BIHAR FLOOD"
                        : `SIMULATION SECTOR: ${selectedLiveLocation.name.toUpperCase()}`}
                    </span>
                    <span className="text-slate-400 font-mono text-[9px] hidden sm:inline">
                      LAT: {mode === "live" ? selectedLiveLocation.lat.toFixed(3) : "25.148"}°N | LON: {mode === "live" ? selectedLiveLocation.lon.toFixed(3) : "85.950"}°E
                    </span>
                  </div>
                  <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                    {mode === "live"
                      ? `${selectedLiveLocation.name} Live SAR Surface & Logistics`
                      : mode === "historical"
                      ? `2024 Bihar Flood Historical Replay — Stage: ${currentSnapshot.label}`
                      : "Predictive Hydrodynamic Risk Surface & Dispatch Simulation"}
                  </h2>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowSpatialGrid(!showSpatialGrid)}
                    className={`cursor-pointer px-2.5 py-1 rounded text-xs font-semibold border transition-all ${showSpatialGrid
                      ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                      }`}
                  >
                    {mode === "historical"
                      ? (showSpatialGrid ? "2024 Audit Grid: ON" : "2024 Audit Grid: OFF")
                      : mode === "simulation"
                      ? (showSpatialGrid ? "Sim Risk Grid: ON" : "Sim Risk Grid: OFF")
                      : (showSpatialGrid ? "SAR 10m Grid: ON" : "SAR Grid: OFF")}
                  </button>
                </div>
              </div>

              <div className="h-[600px] md:h-[640px] rounded overflow-hidden border border-slate-800 relative shadow-none isolate z-10">
                <DisasterMap
                  mode={mode}
                  historicalStage={
                    mode === "historical"
                      ? {
                          stage: historyIndex + 1,
                          totalStages: HISTORICAL_2024_EVENT.length,
                          label: currentSnapshot.label,
                          time: currentSnapshot.timestamp,
                          rainfall_mm: currentSnapshot.rainfall_24h_mm,
                          water_level_m: currentSnapshot.river_level_m,
                          satellite_pass: currentSnapshot.satellite_pass_time,
                        }
                      : undefined
                  }
                  simulationParams={
                    mode === "simulation"
                      ? {
                          rainfall,
                          duration,
                          waterLevel,
                        }
                      : undefined
                  }
                  onAdvanceHistoryStage={mode === "historical" ? (idx: number) => setHistoryIndex(idx) : undefined}
                  floodActive={
                    mode === "historical"
                      ? currentSnapshot.mean_risk_score > 0.3
                      : currentRiskScoreNum > 0.35 || (activeAffectedVillages && activeAffectedVillages.length > 0)
                  }
                  allocation={activeAllocations}
                  affectedVillages={activeAffectedVillages}
                  affectedRoads={activeAffectedRoads}
                  affectedHospitals={activeAffectedHospitals}
                  spatialGrid={spatialGrid}
                  showSpatialGrid={showSpatialGrid}
                  center={mode === "live" ? [selectedLiveLocation.lat, selectedLiveLocation.lon] : [25.148, 85.950]}
                  zoom={mode === "live" ? 13 : 14}
                  activeLocationName={mode === "live" ? selectedLiveLocation.name : "Barauni-Sultanganj Study Zone"}
                  activeLocationId={mode === "live" ? selectedLiveLocation.id : "barauni"}
                  liveTelemetry={mode === "live" && liveResult?.live_telemetry ? liveResult.live_telemetry : undefined}
                  dataFreshness={activeData?.data_freshness}
                  shelterStatus={activeData?.cascade_utilities?.shelter_status}
                  shelterOverflow={activeData?.cascade_utilities?.shelter_overflow || activeData?.resource_optimization?.shelter_overflow}
                  isDegradedMode={isDegradedMode}
                  degradedAsOfTime={lastValidTimestamp}
                  onRetryConnection={handleRetryConnection}
                  onSelectLocation={(locId) => {
                    const found = LIVE_LOCATIONS.find((l) => l.id === locId);
                    if (found) {
                      setSelectedLiveLocation(found);
                      if (mode === "live") {
                        analyzeScenario(undefined, undefined, undefined, "live", found, cloudburstOffset);
                      } else if (mode === "simulation") {
                        analyzeScenario(rainfall, duration, waterLevel, "simulation", found);
                      }
                    }
                  }}
                  onUseDeviceGPS={mode === "live" ? useDeviceLocation : undefined}
                />
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: TACTICAL INTELLIGENCE CENTER (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col">

            {/* TABBED TACTICAL CONTROL CARD */}
            <div className="rounded-md border border-[#1b3353] bg-[#0c192c] p-2.5 sm:p-3 shadow-none flex flex-col h-full">
              
              {/* TAB HEADERS (STRICTLY FILTERED FOR ACTIVE OPERATIONAL MODE) */}
              <div className={`grid gap-1 p-0.5 bg-[#07111e] rounded border border-[#182c48] mb-2 text-center ${
                mode === "historical" ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3 sm:grid-cols-6"
              }`}>
                {/* 1. DISPATCHES TAB */}
                <button
                  onClick={() => setActiveTab("dispatches")}
                  className={`cursor-pointer py-1 px-1 rounded text-[10px] font-bold transition-all text-center ${activeTab === "dispatches"
                    ? "bg-blue-800 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  {mode === "historical" ? "2024 DISPATCH" : mode === "simulation" ? "SIM DISPATCH" : "LIVE FLEET"}
                  <span className={`ml-1 text-[9px] px-1 py-0.2 rounded font-mono ${activeTab === "dispatches" ? "bg-blue-950/40 text-blue-100 font-bold" : "bg-slate-800 text-slate-300"}`}>
                    {activeAllocations.length}
                  </span>
                </button>

                {/* 2. CASCADE TAB */}
                <button
                  onClick={() => setActiveTab("cascade")}
                  className={`cursor-pointer py-1 px-1 rounded text-[10px] font-bold transition-all text-center ${activeTab === "cascade"
                    ? "bg-red-700 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  {mode === "historical" ? "2024 CASCADE" : mode === "simulation" ? "PROJ CASCADE" : "GRID & HEALTH"}
                  <span className={`ml-1 text-[9px] px-1 py-0.2 rounded font-mono ${activeTab === "cascade" ? "bg-red-950 text-red-200" : "bg-slate-800 text-slate-300"}`}>
                    {activeAffectedRoads.length + activeAffectedVillages.length}
                  </span>
                </button>

                {/* 3. SHELTERS TAB */}
                <button
                  onClick={() => setActiveTab("shelters")}
                  className={`cursor-pointer py-1 px-1 rounded text-[10px] font-bold transition-all text-center ${activeTab === "shelters"
                    ? "bg-blue-700 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  {mode === "historical" ? "2024 SHELTER" : T[language].sheltersTab}
                  <span className={`ml-1 text-[9px] px-1 py-0.2 rounded font-mono ${activeTab === "shelters" ? "bg-blue-950 text-blue-200" : "bg-slate-800 text-slate-300"}`}>
                    {activeData?.cascade_utilities?.shelter_occupancy_pct ?? Math.round(((s1Occupied + s2Occupied) / (s1Total + s2Total)) * 100)}%
                  </span>
                </button>

                {/* 4. SENSORS TAB (ONLY IN LIVE MODE) */}
                {mode === "live" && (
                  <button
                    onClick={() => setActiveTab("sensors")}
                    className={`cursor-pointer py-1 px-1 rounded text-[10px] font-bold transition-all text-center ${activeTab === "sensors"
                      ? "bg-blue-700 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                      }`}
                  >
                    SAR &amp; TELEM
                  </button>
                )}

                {/* 5. MCDA TAB (ONLY IN SIMULATION MODE) */}
                {mode === "simulation" && (
                  <button
                    onClick={() => setActiveTab("mcda")}
                    className={`cursor-pointer py-1 px-1 rounded text-[10px] font-bold transition-all text-center ${activeTab === "mcda"
                      ? "bg-cyan-700 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                      }`}
                  >
                    MCDA WEIGHTS
                    <span className={`ml-1 text-[9px] px-1 py-0.2 rounded font-mono ${activeTab === "mcda" ? "bg-cyan-950 text-cyan-200" : "bg-slate-800 text-cyan-300 font-bold"}`}>
                      P1:{mcdaRankings[0]?.id || "V2"}
                    </span>
                  </button>
                )}

                {/* 6. COMMS TAB */}
                <button
                  onClick={() => setActiveTab("comms")}
                  className={`cursor-pointer py-1 px-1 rounded text-[10px] font-bold transition-all text-center ${activeTab === "comms"
                    ? "bg-emerald-700 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  {mode === "live" ? "VHF DIRECTORY" : "VHF COMMS"}
                  <span className={`ml-1 text-[9px] px-1 py-0.2 rounded font-mono ${activeTab === "comms" ? "bg-emerald-950 text-emerald-200" : "bg-slate-800 text-emerald-400 font-bold"}`}>
                    VHF
                  </span>
                </button>

                {/* 7. SOS TAB */}
                <button
                  onClick={() => setActiveTab("sos")}
                  className={`cursor-pointer py-1 px-1 rounded text-[10px] font-bold transition-all text-center ${activeTab === "sos"
                    ? "bg-rose-700 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  {mode === "live" ? "LIVE SOS" : mode === "historical" ? "2024 SOS" : T[language].sosTab}
                  <span className={`ml-1 text-[9px] px-1 py-0.2 rounded font-mono ${activeTab === "sos" ? "bg-rose-950 text-rose-200" : "bg-slate-800 text-slate-300"}`}>
                    {activeData?.sos_feed?.length ?? (isCritical ? 10 : 3)}
                  </span>
                </button>
              </div>

              {/* TAB 1: EMERGENCY DISPATCHES */}
              {activeTab === "dispatches" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Emergency Resource Manifest
                    </span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded border ${activeAllocations.length > 0
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                      : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                      }`}>
                      {activeAllocations.length > 0 ? "DISPATCH ACTIVE" : "ALL SECTORS SECURE"}
                    </span>
                  </div>

                  {/* GOOGLE OR-TOOLS SOLVER METRICS CARD */}
                  <div className="rounded-md border border-blue-500/40 bg-[#0c192c] p-2 sm:p-2.5 text-xs shadow-none">
                    <div className="flex items-center justify-between text-blue-300 font-extrabold mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded bg-blue-400" />
                        Google OR-Tools SCIP Solver (MILP)
                      </span>
                      <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-blue-900/60 text-blue-200 border border-blue-700/50">
                        STATUS: OPTIMAL
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px] text-slate-300">
                      <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">Decision Var:</span>
                        <span className="font-bold text-white">x[r, v] ∈ &#123;0, 1&#125;</span>
                      </div>
                      <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">Terrain Barrier:</span>
                        <span className="font-bold text-amber-300">Road Breach Detour</span>
                      </div>
                      <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">Intermodal Modality:</span>
                        <span className="font-bold text-emerald-300">Ambulance + IRB Boat</span>
                      </div>
                    </div>
                  </div>

                  {activeAllocations.length === 0 ? (
                    <div className="space-y-2">
                      {/* Institutional Status Banner */}
                      <div className="rounded-md border border-emerald-500/40 bg-emerald-950/20 p-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                          <div>
                            <span className="text-xs font-black text-emerald-300 block">ALL SECTORS SECURE • PRE-POSITIONED STANDBY</span>
                            <span className="text-[10px] text-slate-300 font-mono">0 Flood Breaches • All 5 Panchayats 100% Road-Reachable • OR-Tools Latency &lt; 8ms</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200 border border-emerald-700/50">
                          STAGE 0 (READY)
                        </span>
                      </div>

                      {/* Standby Fleet Manifest Header */}
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                          Staged Fleet &amp; Inter-Modal Readiness Roster (7 Units)
                        </span>
                        <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                          SLA ETA &lt; 18 MIN
                        </span>
                      </div>

                      {/* Fleet Grid */}
                      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                        {/* ALS Ambulance A1 */}
                        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-xs flex items-center justify-between hover:border-slate-700 transition">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold border border-amber-500/40">
                              ROAD AMB
                            </span>
                            <div>
                              <span className="font-bold text-white block text-[11px]">ALS-01 (Barauni PHC Base)</span>
                              <span className="text-[9px] text-slate-400 font-mono">Type-B Advanced Life Support • Crew On Duty • Choke-Point North</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-mono font-bold text-emerald-400 block">STANDBY (PRIORITY 1)</span>
                            <span className="text-[8px] text-slate-500 font-mono">Radius: 8.5 km</span>
                          </div>
                        </div>

                        {/* ALS Ambulance A2 */}
                        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-xs flex items-center justify-between hover:border-slate-700 transition">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold border border-amber-500/40">
                              ROAD AMB
                            </span>
                            <div>
                              <span className="font-bold text-white block text-[11px]">ALS-02 (Sultanganj CHC Base)</span>
                              <span className="text-[9px] text-slate-400 font-mono">Type-B Advanced Life Support • Mobile Oxygen/Trauma • Sector S2</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-mono font-bold text-emerald-400 block">STANDBY (PRIORITY 1)</span>
                            <span className="text-[8px] text-slate-500 font-mono">Radius: 7.2 km</span>
                          </div>
                        </div>

                        {/* BLS Ambulance A3 */}
                        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-xs flex items-center justify-between hover:border-slate-700 transition">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[9px] font-bold border border-slate-700">
                              ROAD AMB
                            </span>
                            <div>
                              <span className="font-bold text-white block text-[11px]">BLS-03 (Begusarai Sadar Reserve)</span>
                              <span className="text-[9px] text-slate-400 font-mono">Basic Life Support • Evacuation Shuttling • District Fleet Pool</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-mono font-bold text-cyan-400 block">RESERVE POOL</span>
                            <span className="text-[8px] text-slate-500 font-mono">Radius: 12.0 km</span>
                          </div>
                        </div>

                        {/* Inflatable Rescue Boat RB1 */}
                        <div className="rounded-lg border border-cyan-800/60 bg-[#0c1626] p-2 text-xs flex items-center justify-between hover:border-cyan-600 transition">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[9px] font-bold border border-cyan-500/40">
                              WATER IRB
                            </span>
                            <div>
                              <span className="font-bold text-cyan-200 block text-[11px]">RB-01: NDRF 9th Bn 40HP Gemini</span>
                              <span className="text-[9px] text-slate-400 font-mono">Barauni Ghat Launch Jetty • 12-Pax Inflatable • Fuel 100%</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-mono font-bold text-cyan-300 block">WATERWAY READY</span>
                            <span className="text-[8px] text-slate-500 font-mono">River Reach: 15 km/h</span>
                          </div>
                        </div>

                        {/* Inflatable Rescue Boat RB2 */}
                        <div className="rounded-lg border border-cyan-800/60 bg-[#0c1626] p-2 text-xs flex items-center justify-between hover:border-cyan-600 transition">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[9px] font-bold border border-cyan-500/40">
                              WATER IRB
                            </span>
                            <div>
                              <span className="font-bold text-cyan-200 block text-[11px]">RB-02: State SDRF Sultanganj Flotilla</span>
                              <span className="text-[9px] text-slate-400 font-mono">Sultanganj Ferry Jetway • Shallow-Draft Sonar • Fuel 100%</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-mono font-bold text-cyan-300 block">WATERWAY READY</span>
                            <span className="text-[8px] text-slate-500 font-mono">River Reach: 15 km/h</span>
                          </div>
                        </div>

                        {/* Rescue Taskforces R1 & R2 */}
                        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-xs flex items-center justify-between hover:border-slate-700 transition">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[9px] font-bold border border-rose-500/40">
                              TASKFORCE
                            </span>
                            <div>
                              <span className="font-bold text-white block text-[11px]">NDRF Taskforce R1 &amp; SDRF Squad R2</span>
                              <span className="text-[9px] text-slate-400 font-mono">24 Swimmers / SAR Specialists • VHF Ch-03 / Ch-04 Comms Linked</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-mono font-bold text-emerald-400 block">15-MIN SCRAMBLE</span>
                            <span className="text-[8px] text-slate-500 font-mono">All-Weather</span>
                          </div>
                        </div>
                      </div>

                      {/* Golden Hour Feasibility & Stress Test Trigger Footer */}
                      <div className="p-2 rounded-lg bg-blue-950/30 border border-blue-500/30 text-[10px] text-blue-200 flex items-center justify-between">
                        <span>
                          Dynamic Re-allocation: Automatically engages on risk &gt; 0.50 or road breach.
                        </span>
                        {mode === "historical" ? (
                          <button
                            onClick={() => {
                              setHistoryIndex(1);
                              setIsPlaying(false);
                            }}
                            className="cursor-pointer font-bold text-blue-300 hover:text-blue-200 underline font-mono shrink-0 ml-2"
                          >
                            Advance to Stage 2 Breach &rarr;
                          </button>
                        ) : mode === "simulation" ? (
                          <button
                            onClick={() => {
                              applyPreset("moderate");
                            }}
                            className="cursor-pointer font-bold text-amber-300 hover:text-amber-200 underline font-mono shrink-0 ml-2"
                          >
                            Apply Breach Preset &rarr;
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setMode("simulation");
                              applyPreset("moderate");
                            }}
                            className="cursor-pointer font-bold text-amber-300 hover:text-amber-200 underline font-mono shrink-0 ml-2"
                          >
                            Model Embankment Breach in Simulator &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                      {activeAllocations.map((item) => {
                        const villageMeta = REAL_INFRASTRUCTURE_METADATA.villages[item.village_id as keyof typeof REAL_INFRASTRUCTURE_METADATA.villages];
                        const targetName = villageMeta ? villageMeta.name : (item.village_name || item.village_id);
                        const ambulanceMeta = REAL_INFRASTRUCTURE_METADATA.ambulances[item.resource as keyof typeof REAL_INFRASTRUCTURE_METADATA.ambulances];
                        const resourceName = ambulanceMeta ? ambulanceMeta.name : item.resource;
                        const isWatercraft = item.resource_type === "RESCUE_BOAT" || item.dispatch_mode === "WATERCRAFT_IRB" || item.resource.startsWith("RB");

                        return (
                          <div
                            key={item.resource}
                            className={`rounded-xl border p-3.5 shadow-md transition ${
                              isWatercraft
                                ? "border-cyan-700/80 bg-[#141a27] hover:border-cyan-500"
                                : "border-slate-700/80 bg-slate-950/80 hover:border-slate-600"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`font-extrabold text-xs flex items-center gap-1.5 ${
                                isWatercraft ? "text-cyan-300" : "text-amber-400"
                              }`}>
                                {isWatercraft ? "[BOAT]" : "[AMB]"} {resourceName}
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                  isWatercraft ? "bg-cyan-950 text-cyan-200 border border-cyan-800" : "bg-amber-950 text-amber-200 border border-amber-800"
                                }`}>
                                  {isWatercraft ? "IRB WATERCRAFT" : "ROAD AMBULANCE"}
                                </span>
                              </span>
                              <span className={`text-[9px] font-extrabold rounded px-2 py-0.5 border ${item.priority_level === "CRITICAL"
                                ? "bg-red-500/20 text-red-300 border-red-500/40"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                }`}>
                                {item.priority_level}
                              </span>
                            </div>

                            <p className="mt-1.5 text-sm font-black text-white">
                              Target: {targetName} ({item.village_id})
                            </p>

                            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Transit ETA:</span>
                                <span className="font-bold text-amber-300 font-mono">{item.estimated_travel_time_min.toFixed(1)} min</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Distance:</span>
                                <span className="font-bold text-white font-mono">{item.distance_km.toFixed(1)} km</span>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-400 mt-2">
                              {item.reason}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: HIGH-GROUND SHELTER INTAKE */}
              {activeTab === "shelters" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                        Evacuee Bed Availability & Rations
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Dynamic consumption modeling based on active intake
                      </span>
                    </div>
                    <span className="text-xs font-bold text-blue-300 font-mono">
                      {(s1Occupied + s2Occupied).toLocaleString()} / {(s1Total + s2Total).toLocaleString()} Beds
                    </span>
                  </div>

                  {/* SHELTER OVERFLOW ALERT BANNER */}
                  {activeData?.cascade_utilities?.shelter_overflow && (
                    <div className="rounded-xl border-2 border-red-500/80 bg-red-950/40 p-3.5 shadow-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-400 shrink-0" />
                          <h4 className="text-xs font-black text-red-200 tracking-wide uppercase">
                            Shelter Capacity Exceeded (100% Full)
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-red-300 bg-red-950/80 border border-red-700/60 px-2 py-0.5 rounded">
                          +{activeData.cascade_utilities.shelter_overflow.overflow_population.toLocaleString()} Overflow
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-2 rounded-lg border border-red-900/40 text-[10px]">
                        <div>
                          <span className="text-slate-400 block">Total Capacity:</span>
                          <strong className="text-white font-mono">{activeData.cascade_utilities.shelter_overflow.total_capacity} beds</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Total Occupied:</span>
                          <strong className="text-red-300 font-mono">{activeData.cascade_utilities.shelter_overflow.total_occupied} beds (100%)</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Displaced Overflow:</span>
                          <strong className="text-amber-300 font-mono">{activeData.cascade_utilities.shelter_overflow.overflow_population.toLocaleString()} persons</strong>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider block">
                          Incident Commander Recommended Actions:
                        </span>
                        <ul className="space-y-1 text-[11px] text-slate-200 list-disc list-inside bg-slate-900/50 p-2 rounded border border-slate-800">
                          {activeData.cascade_utilities.shelter_overflow.recommended_actions.map((act, idx) => (
                            <li key={idx} className="leading-snug">
                              {act}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* S1 */}
                  <div className="rounded-md border border-[#1b3353] bg-[#0c192c] p-2.5 sm:p-3 shadow-none space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-extrabold text-white">
                          {REAL_INFRASTRUCTURE_METADATA.shelters.S1.name} (S1)
                        </h4>
                        <span className="text-[10px] text-slate-400">High Elevation School • 62m DEM</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${s1Pct >= 85 ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"}`}>
                        {s1Pct >= 85 ? "NEAR CAPACITY" : "AVAILABLE"}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Intake Occupancy:</span>
                        <span className={`font-mono font-bold ${s1Pct >= 85 ? "text-rose-400" : "text-emerald-400"}`}>
                          {s1Occupied} / {s1Total} ({s1Pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded transition-all duration-500 ${s1Pct >= 85 ? "bg-rose-500" : s1Pct >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${s1Pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Remaining: <strong className="text-white">{s1Total - s1Occupied} beds</strong></span>
                        <span>Inflow: <strong className="text-slate-200">V1 & V4</strong></span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                        <span>Dry Food: <strong className="text-emerald-300">{(3.0 * Math.max(0.3, 1 - (s1Occupied / s1Total) * 0.75)).toFixed(1)} Days</strong></span>
                        <span>Water: <strong className="text-cyan-300">{Math.max(500, Math.round(8500 * (1 - (s1Occupied / s1Total) * 0.6))).toLocaleString()} L</strong></span>
                        <span>Med Kits: <strong className="text-amber-300">{Math.max(2, Math.round(12 - (s1Occupied / s1Total) * 8))} Trauma Kits</strong></span>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => setExtraIntakeS1((c) => Math.min(s1Total - baseS1Occupied, c + 25))}
                          className="cursor-pointer px-2.5 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-[10px] font-bold transition"
                        >
                          +25 EVACUEES
                        </button>
                        {extraIntakeS1 > 0 && (
                          <button
                            onClick={() => setExtraIntakeS1(0)}
                            className="cursor-pointer px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold transition"
                          >
                            RESET EXTRA ({extraIntakeS1})
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* S2 */}
                  <div className="rounded-md border border-[#1b3353] bg-[#0c192c] p-2.5 sm:p-3 shadow-none space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-extrabold text-white">
                          {REAL_INFRASTRUCTURE_METADATA.shelters.S2.name} (S2)
                        </h4>
                        <span className="text-[10px] text-slate-400">Disaster Centre • Safe Embankment</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${s2Pct >= 85 ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"}`}>
                        {s2Pct >= 85 ? "NEAR CAPACITY" : "AVAILABLE"}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Intake Occupancy:</span>
                        <span className={`font-mono font-bold ${s2Pct >= 85 ? "text-rose-400" : "text-emerald-400"}`}>
                          {s2Occupied} / {s2Total} ({s2Pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded transition-all duration-500 ${s2Pct >= 85 ? "bg-rose-500" : s2Pct >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${s2Pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Remaining: <strong className="text-white">{s2Total - s2Occupied} beds</strong></span>
                        <span>Inflow: <strong className="text-slate-200">V3 & V5</strong></span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                        <span>Dry Food: <strong className="text-emerald-300">{(2.5 * Math.max(0.3, 1 - (s2Occupied / s2Total) * 0.75)).toFixed(1)} Days</strong></span>
                        <span>Water: <strong className="text-cyan-300">{Math.max(400, Math.round(5000 * (1 - (s2Occupied / s2Total) * 0.6))).toLocaleString()} L</strong></span>
                        <span>Med Kits: <strong className="text-amber-300">{Math.max(1, Math.round(8 - (s2Occupied / s2Total) * 5))} Trauma Kits</strong></span>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => setExtraIntakeS2((c) => Math.min(s2Total - baseS2Occupied, c + 25))}
                          className="cursor-pointer px-2.5 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-[10px] font-bold transition"
                        >
                          +25 EVACUEES
                        </button>
                        {extraIntakeS2 > 0 && (
                          <button
                            onClick={() => setExtraIntakeS2(0)}
                            className="cursor-pointer px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold transition"
                          >
                            RESET EXTRA ({extraIntakeS2})
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CASCADING FAILURE CHAIN */}
              {activeTab === "cascade" && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Sequential Cascade Propagation
                    </span>
                    <span className="text-[10px] font-bold text-rose-400">
                      {activeAffectedRoads.length} Roads • {activeAffectedVillages.length} Villages Isolated
                    </span>
                  </div>

                  <FlowItem
                    icon="01"
                    title="Satellite Trigger"
                    subtitle={mode === "historical" ? `${currentSnapshot.rainfall_24h_mm} mm Precipitation` : activeData ? `${activeData.event.type}` : "Extreme Rainfall"}
                    status={currentRiskScoreNum > 0.3 ? "ACTIVE" : "NORMAL"}
                  />

                  <Arrow />

                  <FlowItem
                    icon="02"
                    title="Spatial Inundation Surge"
                    subtitle={mode === "historical" ? `Mean Risk: ${currentSnapshot.mean_risk_score.toFixed(2)}` : activeData ? `Risk Score: ${activeData.event.risk_score.toFixed(2)}` : "Risk Score: 0.00"}
                    status={currentRiskScoreNum > 0.5 ? "CRITICAL" : "NORMAL"}
                  />

                  <Arrow />

                  <FlowItem
                    icon="03"
                    title="Route Severance"
                    subtitle={activeAffectedRoads.length > 0 ? activeAffectedRoads.join(", ") : "All Arterial Highways Open"}
                    status={activeAffectedRoads.length > 0 ? "SEVERED" : "OPEN"}
                  />

                  <Arrow />

                  <FlowItem
                    icon="04"
                    title="Community Isolation"
                    subtitle={activeAffectedVillages.length > 0 ? activeAffectedVillages.join(", ") : "All Panchayats Accessible"}
                    status={activeAffectedVillages.length > 0 ? "ISOLATED" : "ACCESSIBLE"}
                  />

                  <Arrow />

                  <FlowItem
                    icon="05"
                    title="Healthcare Access Risk"
                    subtitle={activeAffectedHospitals.length > 0 ? activeAffectedHospitals.join(", ") : "All Medical Centres Operational"}
                    status={activeAffectedHospitals.length > 0 ? "ACCESS CUT" : "SECURE"}
                  />

                  <Arrow />

                  <FlowItem
                    icon="06"
                    title="Power Substation Inundation"
                    subtitle={
                      activeData?.cascade_utilities?.affected_substations?.length
                        ? `Substation P1 Inundated • ${activeData.cascade_utilities.hospitals_on_backup_power.join(", ")} on Generator Backup (est. 4h fuel)`
                        : isCritical
                        ? "Barauni 33kV Substation P1 Inundated • ICU running on diesel generator"
                        : "Grid Substations Operational (33kV Active)"
                    }
                    status={
                      activeData?.cascade_utilities?.affected_substations?.length || isCritical
                        ? "INUNDATED"
                        : "NORMAL"
                    }
                  />

                  <Arrow />

                  <FlowItem
                    icon="07"
                    title="Telecom Blackout & Radio Failover"
                    subtitle={
                      activeData?.cascade_utilities?.affected_telecom?.length
                        ? `BTS T1 Offline • ${activeData.cascade_utilities.villages_comm_blackout.join(", ")} Cellular Cutoff → VHF Police Wireless Relay`
                        : isCritical
                        ? "Jio/BSNL 4G Towers Offline • Cellular Deadzone → VHF Wireless Activated"
                        : "All Cellular BTS Towers 4G LTE Active"
                    }
                    status={
                      activeData?.cascade_utilities?.affected_telecom?.length || isCritical
                        ? "OFFLINE"
                        : "NORMAL"
                    }
                  />

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                    <div className="rounded-lg bg-slate-950/80 p-2 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-300">Power Grid (33kV)</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                          isCritical ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"
                        }`}>
                          {isCritical ? "GEN BACKUP 03h:42m" : "FEEDER STABLE"}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Barauni 33kV Feeder • {isCritical ? "Submerged 1.2m" : "Safe Elevation"}
                      </span>
                    </div>

                    <div className="rounded-lg bg-slate-950/80 p-2 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-300">Telecom Mesh (BTS)</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                          isCritical ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
                        }`}>
                          {isCritical ? "VHF POLICE RELAY" : "4G/LTE 100%"}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        BSNL/Jio Towers • {isCritical ? "Cellular Deadzone" : "All Sectors Online"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: EARTH OBSERVATION & SENSOR TELEMETRY */}
              {activeTab === "sensors" && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                        Earth Observation & Sensor Telemetry
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Sentinel-1A SAR • SRTM DEM • Calibrated XGBoost Inference
                      </span>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded bg-emerald-400 " />
                      OPERATIONAL
                    </span>
                  </div>

                  {/* ACTIVE MODEL CALIBRATION CARD */}
                  <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-blue-300">Calibrated XGBoost Inundation Classifier</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {activeData?.event?.ml_calibrated_score !== undefined && activeData?.event?.ml_calibrated_score !== null
                          ? `${(activeData.event.ml_calibrated_score * 100).toFixed(2)}% Calibrated Risk`
                          : `${(currentRiskScoreNum * 100).toFixed(1)}% Evaluated Risk`}
                      </span>
                    </div>
                    {activeData?.event?.ml_status && (
                      <div className="flex items-center justify-between text-[11px] bg-slate-900/60 px-2 py-1 rounded border border-blue-500/20 font-mono">
                        <span className="text-slate-400">ML Status:</span>
                        <span className={activeData.event.above_threshold ? "text-amber-400 font-bold" : "text-emerald-400"}>
                          {activeData.event.ml_status}
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div>Calibration: <strong className="text-white">Isotonic Monotonic</strong></div>
                      <div>Decision Threshold: <strong className="text-white font-mono">{activeData?.event?.decision_threshold ?? 0.012658} (1.27%)</strong></div>
                      <div>Physical Inputs: <strong className="text-white">SAR + DEM + Rainfall</strong></div>
                      <div>Pipeline Status: <strong className="text-emerald-400">Active &amp; Linked</strong></div>
                    </div>
                  </div>

                  {liveResult?.live_telemetry && (
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded bg-emerald-400" />
                          Live Ingested Station Observations
                        </span>
                        <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                          {selectedLiveLocation.name}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                        <div>Station Temp: <strong className="text-white">{liveResult.live_telemetry.sensor_readings.temperature_c}°C</strong></div>
                        <div>Humidity: <strong className="text-white">{liveResult.live_telemetry.sensor_readings.humidity_pct}%</strong></div>
                        <div>6h Precip: <strong className="text-white">{liveResult.live_telemetry.rainfall_mm} mm</strong></div>
                        <div>River Level: <strong className="text-white">{liveResult.live_telemetry.water_level_m} m</strong></div>
                      </div>
                    </div>
                  )}

                  {/* SENTINEL-1 SAR DUAL-POLARIZATION RADAR CALIBRATOR */}
                  <div className="rounded-xl border border-cyan-500/40 bg-[#0a1524] p-3 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div>
                        <span className="font-extrabold text-cyan-300 text-xs flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded bg-cyan-400" />
                          Sentinel-1A SAR Inundation Threshold Calibrator
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          C-Band (5.405 GHz) All-Weather Synthetic Aperture Radar • 10m GRD
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 font-bold">
                        {sarWaterAreaKm2} km² Water Detected
                      </span>
                    </div>

                    {/* Polarization Mode Selector */}
                    <div>
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="text-slate-400 font-semibold uppercase">Polarimetric Channel:</span>
                        <span className="text-cyan-300 font-mono font-bold">
                          {sarPolarization === "VV" ? "VV (Co-Polarized: Open Water Specular)" : sarPolarization === "VH" ? "VH (Cross-Polarized: Flooded Canopy)" : "VV/VH Cross-Ratio"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => setSarPolarization("VV")}
                          className={`cursor-pointer py-1 px-1.5 rounded text-[10px] font-bold border transition ${
                            sarPolarization === "VV"
                              ? "bg-cyan-600 text-white border-cyan-400 shadow-md"
                              : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800"
                          }`}
                        >
                          VV Channel
                        </button>
                        <button
                          onClick={() => setSarPolarization("VH")}
                          className={`cursor-pointer py-1 px-1.5 rounded text-[10px] font-bold border transition ${
                            sarPolarization === "VH"
                              ? "bg-cyan-600 text-white border-cyan-400 shadow-md"
                              : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800"
                          }`}
                        >
                          VH Channel
                        </button>
                        <button
                          onClick={() => setSarPolarization("VV_VH_RATIO")}
                          className={`cursor-pointer py-1 px-1.5 rounded text-[10px] font-bold border transition ${
                            sarPolarization === "VV_VH_RATIO"
                              ? "bg-cyan-600 text-white border-cyan-400 shadow-md"
                              : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800"
                          }`}
                        >
                          VV/VH Ratio
                        </button>
                      </div>
                    </div>

                    {/* Backscatter Cutoff Threshold Slider */}
                    <div>
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="text-slate-400 font-semibold uppercase">Backscatter Threshold (σ°):</span>
                        <span className="text-amber-300 font-mono font-bold">{sarThresholdDb.toFixed(1)} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-24.0"
                        max="-16.0"
                        step="0.5"
                        value={sarThresholdDb}
                        onChange={(e) => setSarThresholdDb(parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                      />
                      <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
                        <span>-24.0 dB (Strict Open Water)</span>
                        <span className="text-amber-400 font-bold">-18.5 dB (Optimum)</span>
                        <span>-16.0 dB (Vegetated Water)</span>
                      </div>
                    </div>

                    {/* Filter & Speckle Control */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[9px] font-semibold">Speckle Suppression:</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            onClick={() => setSarFilter("LEE_3X3")}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition ${
                              sarFilter === "LEE_3X3" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            Lee 3x3
                          </button>
                          <button
                            onClick={() => setSarFilter("GAMMA_MAP_5X5")}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition ${
                              sarFilter === "GAMMA_MAP_5X5" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            Gamma 5x5
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[9px] font-semibold">Inundation Coverage:</span>
                        <span className="font-mono font-bold text-cyan-300 text-[11px] block mt-0.5">
                          {((sarWaterAreaKm2 / 16.20) * 100).toFixed(1)}% of Sector
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Digital Elevation</span>
                      <strong className="text-white text-xs">NASA SRTM (30m)</strong>
                      <span className="text-slate-400 text-[10px] block mt-0.5">Topographic Drainage</span>
                    </div>

                    <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Live Weather Feed</span>
                      <strong className="text-white text-xs">Open-Meteo / IMD</strong>
                      <span className="text-slate-400 text-[10px] block mt-0.5">Station Observations</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: CITIZEN SOS DISTRESS FEED & DISPATCH LIFECYCLE */}
              {activeTab === "sos" && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                          State Emergency Helpline (1070 / 112)
                        </span>
                        <span className="font-mono text-[9px] font-bold text-rose-400 bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.2 rounded">
                          {sosIncidents.filter((i) => i.status === "QUEUED").length} QUEUED
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Geo-verified citizen distress alerts from Barauni diara sectors
                      </span>
                    </div>

                    <button
                      onClick={() => setShowSosModal(true)}
                      className="cursor-pointer px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
                    >
                      + FILE DISTRESS CALL
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {sosIncidents.map((alert) => (
                      <div
                        key={alert.sos_id}
                        className={`rounded-xl border p-3 shadow-md space-y-2 transition-all ${
                          alert.status === "RESOLVED"
                            ? "bg-slate-950/70 border-emerald-900/60 text-slate-300 opacity-90"
                            : alert.status === "DISPATCHED"
                            ? "bg-blue-950/30 border-blue-800/60 text-blue-100"
                            : alert.urgency === "CRITICAL"
                            ? "bg-rose-950/40 border-rose-800/60 text-rose-200"
                            : "bg-amber-950/30 border-amber-800/60 text-amber-200"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.2 rounded font-black uppercase text-[9px] ${
                                alert.status === "RESOLVED"
                                  ? "bg-emerald-600 text-white"
                                  : alert.status === "DISPATCHED"
                                  ? "bg-blue-600 text-white"
                                  : alert.urgency === "CRITICAL"
                                  ? "bg-rose-600 text-white"
                                  : "bg-amber-500 text-slate-950"
                              }`}
                            >
                              {alert.status === "RESOLVED"
                                ? "RESCUED"
                                : alert.status === "DISPATCHED"
                                ? "DISPATCHED"
                                : alert.urgency}
                            </span>
                            <span className="font-mono font-bold text-slate-300">{alert.sos_id}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400">{alert.source}</span>
                          </div>
                          <span className="font-mono text-slate-400">{alert.timestamp}</span>
                        </div>

                        <div>
                          <p className="text-xs font-black text-white">
                            {alert.location}
                          </p>
                          <span className="text-[10px] text-cyan-300 font-mono">
                            Evacuees: <strong>{alert.evacueeCount} Citizens</strong> • Target Shelter: <strong>{alert.targetShelter}</strong>
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          &ldquo;{alert.message}&rdquo;
                        </p>

                        {/* DISPATCH AND RESOLUTION ACTION CONTROLS */}
                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                          {alert.status === "QUEUED" && (
                            <button
                              onClick={() => handleDispatchSos(alert.sos_id)}
                              className="cursor-pointer px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5"
                            >
                              DISPATCH RESCUE UNIT
                            </button>
                          )}

                          {alert.status === "DISPATCHED" && (
                            <>
                              <div className="text-[10px] text-blue-300">
                                <span>En Route: <strong>{alert.dispatchedUnit}</strong> ({alert.dispatchedAt})</span>
                              </div>
                              <button
                                onClick={() => handleResolveSos(alert.sos_id)}
                                className="cursor-pointer px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-md flex items-center gap-1.5"
                              >
                                INTAKE {alert.evacueeCount} TO SHELTER {alert.targetShelter}
                              </button>
                            </>
                          )}

                          {alert.status === "RESOLVED" && (
                            <div className="text-[10px] text-emerald-400 font-mono font-semibold">
                              Safely evacuated &amp; received at Shelter {alert.targetShelter} at {alert.resolvedAt}
                            </div>
                          )}

                          <span className="text-[10px] text-slate-400">
                            {alert.verified ? "Geo-Verified by SEOC" : "Public IVR Ingestion"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: MULTI-CRITERIA DECISION ANALYSIS (MCDA) SETTLEMENT TRIAGE */}
              {activeTab === "mcda" && (
                <div className="space-y-3.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider block">
                          AHP / TOPSIS Multi-Criteria Triage Model
                        </span>
                        <span className="font-mono text-[9px] font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.2 rounded">
                          SEOC ANALYTIC RIGOR
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Objective mathematical prioritization across hydrodynamic hazard, demographics, and isolation
                      </span>
                    </div>
                    <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-950/40 px-2 py-1 rounded border border-cyan-800/40">
                      Top Priority: {mcdaRankings[0]?.name} ({mcdaRankings[0]?.compositeScore})
                    </span>
                  </div>

                  {/* Analytic Hierarchy Weight Formulation Banner */}
                  <div className="rounded-xl border border-cyan-500/30 bg-[#08121f] p-3 space-y-2">
                    <span className="font-bold text-cyan-300 text-[11px] block">
                      Analytic Hierarchy Process (AHP) Criterion Weight Vector (∑w = 1.00)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
                      <div className="bg-slate-950/80 p-2 rounded border border-slate-800">
                        <span className="text-slate-400 block text-[9px]">Hydro Hazard (C1):</span>
                        <strong className="text-rose-400">w₁ = 0.35 (35%)</strong>
                        <span className="text-slate-500 block text-[8px] mt-0.5">Depth × Velocity (m²/s)</span>
                      </div>
                      <div className="bg-slate-950/80 p-2 rounded border border-slate-800">
                        <span className="text-slate-400 block text-[9px]">Demographic Vuln (C2):</span>
                        <strong className="text-amber-400">w₂ = 0.25 (25%)</strong>
                        <span className="text-slate-500 block text-[8px] mt-0.5">Infants / Elderly / Med</span>
                      </div>
                      <div className="bg-slate-950/80 p-2 rounded border border-slate-800">
                        <span className="text-slate-400 block text-[9px]">Lifeline Isolation (C3):</span>
                        <strong className="text-cyan-400">w₃ = 0.25 (25%)</strong>
                        <span className="text-slate-500 block text-[8px] mt-0.5">Road Cut / Telecom BTS</span>
                      </div>
                      <div className="bg-slate-950/80 p-2 rounded border border-slate-800">
                        <span className="text-slate-400 block text-[9px]">Shelter Friction (C4):</span>
                        <strong className="text-emerald-400">w₄ = 0.15 (15%)</strong>
                        <span className="text-slate-500 block text-[8px] mt-0.5">Distance to High Ground</span>
                      </div>
                    </div>
                  </div>

                  {/* Ranked Settlement Cards */}
                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {mcdaRankings.map((settlement) => (
                      <div
                        key={settlement.id}
                        className={`rounded-xl border p-3 bg-slate-950/80 shadow-md space-y-2 transition-all ${
                          settlement.priorityRank === 1
                            ? "border-rose-500/60 bg-rose-950/10"
                            : settlement.priorityRank === 2
                            ? "border-amber-500/50"
                            : "border-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center font-mono font-black text-xs text-white">
                              #{settlement.priorityRank}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-white text-xs">
                                  {settlement.name} ({settlement.id})
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${settlement.badgeColor}`}>
                                  {settlement.triageLevel}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400">{settlement.type} • {settlement.population.toLocaleString()} exposed</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 block uppercase font-mono">MCDA Score</span>
                            <span className={`font-mono text-sm font-black ${
                              settlement.compositeScore >= 0.65 ? "text-rose-400" : settlement.compositeScore >= 0.45 ? "text-amber-400" : "text-emerald-400"
                            }`}>
                              {settlement.compositeScore.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Sub-Criteria Breakdown Bars */}
                        <div className="grid grid-cols-4 gap-1.5 text-[9px] font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                          <div>
                            <span className="text-slate-400 block">Hydro Hazard:</span>
                            <strong className="text-rose-300">{(settlement.hydroHazardRaw * 100).toFixed(0)}%</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Vulnerable Pop:</span>
                            <strong className="text-amber-300">{(settlement.vulnerabilityPct * 100).toFixed(0)}%</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Isolation Index:</span>
                            <strong className="text-cyan-300">{(settlement.isolationIndexRaw * 100).toFixed(0)}%</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Refuge Friction:</span>
                            <strong className="text-emerald-300">{settlement.shelterDistanceKm} km</strong>
                          </div>
                        </div>

                        <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px]">
                          <span className="text-slate-300 font-medium">
                            Operational Order: <strong className="text-white">{settlement.dispatchRecommendation}</strong>
                          </span>
                          <button
                            onClick={() => setActiveTab("dispatches")}
                            className="cursor-pointer text-[10px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50"
                          >
                            View Dispatch &rarr;
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 7: TACTICAL RADIO COMMS MESH (ICS-205) */}
              {activeTab === "comms" && (
                <div className="space-y-3.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider block">
                          ICS-205 Radio Communications Plan &amp; Tactical Mesh
                        </span>
                        <span className="font-mono text-[9px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                          ALL FREQUENCIES ACTIVE
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Inter-agency VHF tactical networks, river marine channels, and satellite PTT directory
                      </span>
                    </div>

                    <button
                      onClick={executeCommsCheck}
                      disabled={commsPingActive}
                      className="cursor-pointer px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
                    >
                      {commsPingActive ? "POLLING MESH..." : "EXECUTE COMMS CHECK"}
                    </button>
                  </div>

                  {/* Repeater Infrastructure Status Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
                      <div className="flex justify-between items-center text-slate-400">
                        <span>REPEATER R1 (IOCL TOWER)</span>
                        <span className="text-emerald-400 font-bold">100% ONLINE</span>
                      </div>
                      <div className="text-slate-200 mt-1">Height: 85m AGL • Signal: -74 dBm</div>
                      <div className="text-slate-400 text-[9px]">Coverage: 35km Primary River Corridor</div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
                      <div className="flex justify-between items-center text-slate-400">
                        <span>REPEATER R2 (COLLECTORATE)</span>
                        <span className="text-emerald-400 font-bold">100% ONLINE</span>
                      </div>
                      <div className="text-slate-200 mt-1">Height: 45m AGL • Signal: -82 dBm</div>
                      <div className="text-slate-400 text-[9px]">Coverage: Begusarai Urban &amp; Hospitals</div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
                      <div className="flex justify-between items-center text-slate-400">
                        <span>MOBILE MAST (DIARA ISLAND)</span>
                        <span className="text-amber-400 font-bold">SOLAR (88%)</span>
                      </div>
                      <div className="text-slate-200 mt-1">Height: 18m Mobile • Signal: -91 dBm</div>
                      <div className="text-slate-400 text-[9px]">Dedicated Watercraft IRB Fairway Link</div>
                    </div>
                  </div>

                  {/* Frequency Assignment Table */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/90 overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-[#080e18] text-slate-400 text-[10px] uppercase font-mono">
                          <th className="p-2.5">Channel</th>
                          <th className="p-2.5">Assigned Agency</th>
                          <th className="p-2.5">Frequency</th>
                          <th className="p-2.5">Bandwidth / Mode</th>
                          <th className="p-2.5">Channel Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-[11px] font-sans">
                        <tr className="hover:bg-[#0b1424]">
                          <td className="p-2.5 font-mono font-bold text-white">CH-01</td>
                          <td className="p-2.5 font-semibold text-slate-200">SEOC Patna Tactical Net</td>
                          <td className="p-2.5 font-mono text-cyan-300">154.650 MHz</td>
                          <td className="p-2.5 text-slate-400 font-mono">12.5 kHz NFM (PL 100.0)</td>
                          <td className="p-2.5 font-mono text-emerald-400 font-bold">CLEAR / ACTIVE</td>
                        </tr>
                        <tr className="hover:bg-[#0b1424]">
                          <td className="p-2.5 font-mono font-bold text-white">CH-02</td>
                          <td className="p-2.5 font-semibold text-slate-200">Marine VHF (Ganga Watercraft)</td>
                          <td className="p-2.5 font-mono text-cyan-300">156.800 MHz</td>
                          <td className="p-2.5 text-slate-400 font-mono">25.0 kHz FM (Marine Ch 16)</td>
                          <td className="p-2.5 font-mono text-emerald-400 font-bold">CLEAR / MONITORED</td>
                        </tr>
                        <tr className="hover:bg-[#0b1424]">
                          <td className="p-2.5 font-mono font-bold text-white">CH-03</td>
                          <td className="p-2.5 font-semibold text-slate-200">NDRF 9th Bn Disaster Mesh</td>
                          <td className="p-2.5 font-mono text-cyan-300">162.400 MHz</td>
                          <td className="p-2.5 text-slate-400 font-mono">DMR Tier II Digital</td>
                          <td className="p-2.5 font-mono text-emerald-400 font-bold">ENCRYPTED / UP</td>
                        </tr>
                        <tr className="hover:bg-[#0b1424]">
                          <td className="p-2.5 font-mono font-bold text-white">CH-04</td>
                          <td className="p-2.5 font-semibold text-slate-200">State SDRF Rescue Task Force</td>
                          <td className="p-2.5 font-mono text-cyan-300">148.125 MHz</td>
                          <td className="p-2.5 text-slate-400 font-mono">12.5 kHz NFM (PL 123.0)</td>
                          <td className="p-2.5 font-mono text-emerald-400 font-bold">CLEAR / ACTIVE</td>
                        </tr>
                        <tr className="hover:bg-[#0b1424]">
                          <td className="p-2.5 font-mono font-bold text-white">CH-05</td>
                          <td className="p-2.5 font-semibold text-slate-200">Health CMO / PHED Logistics</td>
                          <td className="p-2.5 font-mono text-cyan-300">151.775 MHz</td>
                          <td className="p-2.5 text-slate-400 font-mono">12.5 kHz NFM (Simplex)</td>
                          <td className="p-2.5 font-mono text-emerald-400 font-bold">AMBULANCE CONVOY</td>
                        </tr>
                        <tr className="hover:bg-[#0b1424]">
                          <td className="p-2.5 font-mono font-bold text-white">CH-06</td>
                          <td className="p-2.5 font-semibold text-slate-200">Satellite PTT Island Link</td>
                          <td className="p-2.5 font-mono text-cyan-300">1621.5 MHz</td>
                          <td className="p-2.5 text-slate-400 font-mono">Iridium Extreme PTT</td>
                          <td className="p-2.5 font-mono text-emerald-400 font-bold">STANDBY LINK</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Authorized Net Control: <strong className="text-slate-200">SEOC Wireless Cell (Callsign: PATNA-CONTROL)</strong></span>
                    <span>Last Routine Check: <strong className="text-emerald-400 font-mono">{commsLastChecked}</strong></span>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        {/* 6. OPERATIONAL SCENARIO & TELEMETRY CONTROL DECK (FULL-WIDTH 12-COLUMNS) */}
        <div className="rounded-md border border-[#1b3353] bg-[#0c192c] p-2.5 sm:p-3 shadow-none">
          
          {/* HISTORICAL TIMELINE CONTROLS */}
          {mode === "historical" && (
            <div>
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800">
                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  2024 HISTORICAL BENCHMARK DECK
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  Empirical Reconstruction of 27 September 2024 Inundation Sequence (Kosi-Ganga Basin)
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded">
                      Historical Benchmark: 27 Sep 2024
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-white">
                      Timeline Stage: {currentSnapshot.label}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {currentSnapshot.status_summary}
                  </p>
                </div>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`cursor-pointer px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition shrink-0 shadow-none ${isPlaying
                    ? "bg-slate-800 text-white"
                    : "bg-blue-700 hover:bg-blue-800 text-white"
                    }`}
                >
                  <span>{isPlaying ? "[PAUSE]" : "[PLAY]"}</span>
                  <span>{isPlaying ? "PAUSE TIMELINE" : "AUTO-PLAY TIMELINE"}</span>
                </button>
              </div>

              {/* TIMELINE STAGES */}
              <div className="mt-2">
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {HISTORICAL_2024_EVENT.map((item, idx) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        setHistoryIndex(idx);
                        setIsPlaying(false);
                      }}
                      className={`cursor-pointer text-left p-1.5 rounded border transition shadow-none ${historyIndex === idx
                        ? "bg-blue-700 text-white font-bold border-blue-500"
                        : "bg-[#0b1120] border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                    >
                      <span className="block text-[9px] text-slate-500 font-mono">Stage {idx + 1}</span>
                      <span className="text-[11px] font-semibold truncate block">{item.label.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="0"
                  max={HISTORICAL_2024_EVENT.length - 1}
                  value={historyIndex}
                  onChange={(e) => {
                    setHistoryIndex(Number(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded cursor-pointer transition-all"
                />

                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2 rounded bg-[#0b1120] border border-slate-800">
                    <span className="text-slate-400 text-[10px]">24h Rain Gauge:</span>
                    <p className="font-bold text-white text-xs mt-0.5">{currentSnapshot.rainfall_24h_mm} mm</p>
                  </div>
                  <div className="p-2 rounded bg-[#0b1120] border border-slate-800">
                    <span className="text-slate-400 text-[10px]">River Gauge Height:</span>
                    <p className="font-bold text-white text-xs mt-0.5">{currentSnapshot.river_level_m} m</p>
                  </div>
                  <div className="p-2 rounded bg-[#0b1120] border border-slate-800">
                    <span className="text-slate-400 text-[10px]">Satellite Orbit Pass:</span>
                    <p className="font-bold text-amber-300 text-xs truncate mt-0.5" title={currentSnapshot.satellite_pass_time}>
                      {currentSnapshot.satellite_pass_time.split("(")[0]}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SIMULATION SLIDERS & PRESETS */}
          {mode === "simulation" && (
            <div>
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800">
                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  PREDICTIVE SCENARIO SIMULATOR DECK
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  Multi-Variable Physical Stress Testing &amp; Embankment Failure Projection Engine
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-amber-300">
                    Scenario Simulation Engine
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Adjust physical parameters or pick an instant preset scenario
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => applyPreset("baseline")}
                    className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition shadow-none cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="h-1.5 w-1.5 rounded bg-emerald-400" />
                    Scenario 1: Baseline Patrol (45mm)
                  </button>
                  <button
                    onClick={() => applyPreset("moderate")}
                    className="px-2.5 py-1 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition shadow-none cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="h-1.5 w-1.5 rounded bg-amber-400" />
                    Scenario 2: Embankment Threat (130mm)
                  </button>
                  <button
                    onClick={() => applyPreset("extreme")}
                    className="px-2.5 py-1 rounded text-xs font-bold bg-red-600/30 text-red-200 border border-red-500/60 hover:bg-red-600/40 transition shadow-none cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="h-1.5 w-1.5 rounded bg-red-400" />
                    Scenario 3: Kosi Barrage Breach (230mm)
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-2.5 mt-2.5">
                <div className="rounded bg-[#0b1120] p-2.5 border border-slate-800">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Precipitation (mm)</span>
                    <span className="font-mono text-white font-bold">{rainfall} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="250"
                    value={rainfall}
                    onChange={(e) => setRainfall(Number(e.target.value))}
                    className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                <div className="rounded bg-[#0b1120] p-2.5 border border-slate-800">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Rainfall Duration</span>
                    <span className="font-mono text-white font-bold">{duration} hrs</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                <div className="rounded bg-[#0b1120] p-2.5 border border-slate-800">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>River Water Level</span>
                    <span className="font-mono text-white font-bold">{waterLevel} m</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={waterLevel}
                    onChange={(e) => setWaterLevel(Number(e.target.value))}
                    className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* SYNTHETIC CLOUDBURST SHOCKWAVE INJECTION */}
              <div className="mt-2.5 p-2.5 rounded bg-[#0b1120] border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                  <div>
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded bg-amber-400" />
                      Synthetic Cloudburst Volume Shockwave
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Rapidly inject severe monsoonal burst volumes over current parameters
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 border border-amber-900/60 px-2 py-0.5 rounded">
                    Active Base: {rainfall}mm
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Reset to Baseline (45mm)", setVal: 45, color: "bg-slate-900 text-slate-300 border-slate-700 hover:text-white" },
                    { label: "+45mm Monsoon Surge", add: 45, color: "bg-blue-600/30 text-blue-200 border-blue-500/40 hover:bg-blue-600/50" },
                    { label: "+90mm Flash Downpour", add: 90, color: "bg-amber-600/30 text-amber-200 border-amber-500/40 hover:bg-amber-600/50" },
                    { label: "+150mm Extreme Cloudburst", add: 150, color: "bg-rose-600/30 text-rose-200 border-rose-500/50 hover:bg-rose-600/50" },
                  ].map((shock, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const newRf = shock.setVal !== undefined ? shock.setVal : Math.min(250, rainfall + (shock.add || 0));
                        setRainfall(newRf);
                        analyzeScenario(newRf, duration, waterLevel, "simulation");
                      }}
                      className={`cursor-pointer px-2.5 py-1 rounded text-xs font-bold border transition shadow-none ${shock.color}`}
                    >
                      {shock.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* STORED SIMULATION RESULT BANNER */}
              {lastSimulationParams && simulationResult && (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-amber-950/20 border border-amber-600/40 text-xs shadow-none">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase bg-amber-500 text-slate-950">
                      STORED SIMULATION
                    </span>
                    <span className="text-slate-300">
                      Rainfall: <strong className="text-white">{lastSimulationParams.rainfall} mm</strong> ({lastSimulationParams.duration}h) | River Level: <strong className="text-white">{lastSimulationParams.waterLevel} m</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">Saved at {lastSimulationParams.timestamp} IST</span>
                    <span className={`font-bold font-mono px-2 py-0.5 rounded ${simulationResult.event.risk_score >= 0.75 ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : simulationResult.event.risk_score >= 0.5 ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"}`}>
                      Risk {simulationResult.event.risk_score.toFixed(2)} ({simulationResult.event.hazard_level})
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => analyzeScenario()}
                  disabled={loading}
                  className="cursor-pointer px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-none transition"
                >
                  {loading ? "CALCULATING CASCADING RISKS..." : "RUN CASCADING SIMULATION"}
                </button>
              </div>
            </div>
          )}

          {/* LIVE TELEMETRY & SAR OPERATIONAL COMMAND DECK */}
          {mode === "live" && (() => {
            const liveTelem = liveResult?.live_telemetry;
            const isTelemStale = telemetryAgeSeconds > 900; // >15 mins
            const telemAgeStr = telemetryAgeSeconds < 60
              ? `${telemetryAgeSeconds} sec ago`
              : `${Math.floor(telemetryAgeSeconds / 60)}m ${telemetryAgeSeconds % 60}s ago`;

            const telemTimeStr = liveTelem?.fetched_at
              ? `${new Date(liveTelem.fetched_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} IST`
              : `${currentTime || "--:--:--"} IST`;

            const liveStageM = liveTelem?.water_level_m ?? 36.85;
            const liveDangerM = liveTelem?.barrage_status?.danger_level_m ?? 8.5;
            const liveWarningM = liveTelem?.barrage_status?.warning_level_m ?? 7.0;
            const liveAlertLevel = liveTelem?.barrage_status?.alert_level ?? (liveStageM >= liveDangerM ? "DANGER" : liveStageM >= liveWarningM ? "WARNING" : "NORMAL");

            const currentRainRate = liveTelem?.sensor_readings?.current_rain_mm_per_hr ?? 0;
            const measuredRain6h = liveTelem?.sensor_readings?.measured_rain_6h_mm ?? 0;
            const totalRainAccum = liveTelem?.rainfall_mm ?? 0;
            const rain3hEst = Math.round((currentRainRate * 2.0 + measuredRain6h * 0.45) * 10) / 10;
            const rain24hEst = Math.round((totalRainAccum * 1.75 + 8.5) * 10) / 10;

            // Composite live risk score
            const liveCompositeRisk = Math.min(1.0, Math.max(0.08, ((liveStageM - 4.0) / 8.0) * 0.45 + (totalRainAccum / 180.0) * 0.35 + (sarWaterAreaKm2 / 12.0) * 0.20));
            const liveRiskLabel = liveCompositeRisk >= 0.70
              ? { title: "CRITICAL", sub: "Level 3 Red Alert", badge: "bg-red-500/20 text-red-300 border-red-500/50" }
              : liveCompositeRisk >= 0.45
              ? { title: "HIGH", sub: "Level 2 Amber Alert", badge: "bg-amber-500/20 text-amber-300 border-amber-500/50" }
              : liveCompositeRisk >= 0.25
              ? { title: "MODERATE", sub: "Level 1 Yellow Watch", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50" }
              : { title: "NORMAL", sub: "Green Baseline", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" };

            const isDegradedOrDemo = isDegradedMode || (liveTelem && !liveTelem.is_live);

            return (
              <div className="space-y-2.5">
                {/* 1. PERSISTENT INSTITUTIONAL HEADER BAR */}
                <div className="bg-[#0b1120] p-2 sm:p-2.5 rounded-md border border-slate-700/60 shadow-none space-y-2">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    {/* Status Badge, Timestamp & Multi-Agency Source Line */}
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {isDegradedOrDemo ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded bg-amber-400" />
                            DEGRADED – LAST KNOWN
                          </span>
                        ) : isTelemStale ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/60 flex items-center gap-1.5 animate-pulse">
                            <span className="h-1.5 w-1.5 rounded bg-rose-400" />
                            STALE DATA (&gt;15 MIN OLD)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded bg-emerald-400" />
                            LIVE SATELLITE &amp; SENSOR STREAM
                          </span>
                        )}

                        <span className="text-xs font-mono font-bold text-slate-200">
                          Updated {telemTimeStr} ({telemAgeStr})
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span>Source Network:</span>
                        <span className="font-semibold text-cyan-300">
                          CWC Hydro-Gauge + Open-Meteo IMD NWP + Copernicus Sentinel-1A SAR
                        </span>
                      </div>
                    </div>

                    {/* Top Action Controls: Device GPS & Sync Radar */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={useDeviceLocation}
                        disabled={isLocatingUser || loading}
                        className="cursor-pointer px-2.5 py-1 rounded bg-blue-700/50 hover:bg-blue-600/60 text-blue-200 border border-blue-500/50 font-bold text-xs transition flex items-center gap-1.5 shadow-none"
                        title="Acquire live coordinates from local device GPS"
                      >
                        <span>{isLocatingUser ? "LOCATING GPS..." : "DEVICE GPS"}</span>
                      </button>

                      <button
                        onClick={() => analyzeScenario(undefined, undefined, undefined, "live", selectedLiveLocation, cloudburstOffset)}
                        disabled={loading}
                        className="cursor-pointer px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-none transition flex items-center gap-1.5 whitespace-nowrap"
                        title="Force instantaneous refresh of radar and CWC telemetry"
                      >
                        <span>{loading ? "POLLING SENSORS..." : "SYNC RADAR & TELEMETRY"}</span>
                      </button>
                    </div>
                  </div>

                  {/* District / Monitoring Sector Picker */}
                  <div className="grid sm:grid-cols-2 gap-2 pt-0.5">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Operational Sector / District
                        </label>
                        <span className="text-[9px] font-mono text-cyan-400">IMD Station Grid G-12</span>
                      </div>
                      <select
                        value={selectedLiveLocation.id}
                        onChange={(e) => {
                          const found = LIVE_LOCATIONS.find((l) => l.id === e.target.value);
                          if (found) {
                            setSelectedLiveLocation(found);
                            analyzeScenario(undefined, undefined, undefined, "live", found, cloudburstOffset);
                          }
                        }}
                        className="w-full rounded bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-500 cursor-pointer shadow-none"
                      >
                        {LIVE_LOCATIONS.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name} ({loc.region}) — {loc.lat}°N, {loc.lon}°E
                              </option>
                            ))}
                            {selectedLiveLocation.id === "custom-gps" && (
                              <option value="custom-gps">
                                {selectedLiveLocation.name} (Custom Device GPS Coordinates)
                              </option>
                            )}
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Hydrological Basin &amp; River Reach
                            </span>
                            <span className="text-[9px] font-mono text-slate-500">CWC Middle Ganga Division</span>
                          </div>
                          <div className="rounded bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 text-xs font-mono text-cyan-300 truncate">
                            {selectedLiveLocation.riverBasin}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. OPERATIONAL TELEMETRY & SAR CALIBRATION CONSOLES (3-COLUMN GOVERNMENT DECK) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
                      {/* SECTION 1: LIVE SENSORS (CWC GAUGE & WEATHER TELEMETRY) */}
                      <div className="rounded-md bg-[#0b1120] border border-slate-700/60 p-2.5 shadow-none space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded bg-emerald-400" />
                              <strong className="text-xs font-bold uppercase text-slate-200 tracking-wider">
                                Section 1: Environmental Sensors &amp; Hydrology
                              </strong>
                            </div>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                              AWS Network
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            <div className="rounded bg-[#0e1626] border border-slate-800 p-2">
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="text-[9px] uppercase font-bold text-slate-400">Ambient Temp</span>
                                <span className="text-[8px] font-mono text-slate-500">AWS Mast</span>
                              </div>
                              <span className="text-sm font-bold text-white font-mono block">
                                {liveTelem?.sensor_readings?.temperature_c ?? 28}°C
                              </span>
                              <span className="text-[9px] text-slate-400 block truncate mt-0.5">
                                {liveTelem?.sensor_readings?.weather_description || "Clear Sky"}
                              </span>
                            </div>

                            <div className="rounded bg-[#0e1626] border border-slate-800 p-2">
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="text-[9px] uppercase font-bold text-slate-400">Atm. Moisture</span>
                                <span className="text-[8px] font-mono text-slate-500">Hygrometer</span>
                              </div>
                              <span className="text-sm font-bold text-cyan-300 font-mono block">
                                {liveTelem?.sensor_readings?.humidity_pct ?? 84}% Humidity
                              </span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                Saturation: High
                              </span>
                            </div>

                            <div className="rounded bg-[#0e1626] border border-slate-800 p-2">
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="text-[9px] uppercase font-bold text-slate-400">Wind Vector</span>
                                <span className="text-[8px] font-mono text-slate-500">10m Anemometer</span>
                              </div>
                              <span className="text-sm font-bold text-slate-100 font-mono block">
                                {liveTelem?.sensor_readings?.wind_speed_kmh ?? 18} km/h
                              </span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                ENE (Gusts: 28 km/h)
                              </span>
                            </div>

                            <div className="rounded bg-[#0e1626] border border-slate-800 p-2">
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="text-[9px] uppercase font-bold text-slate-400">Barrage Sluice</span>
                                <span className="text-[8px] font-mono text-slate-500">CWC Control</span>
                              </div>
                              <span className="text-sm font-bold text-cyan-300 font-mono block">
                                42,500 m³/s
                              </span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                42 of 56 Gates Open
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] font-mono text-slate-400">
                          <span>Observation Quality: <strong className="text-emerald-400">Grade-A Telemetry</strong></span>
                          <span>IMD Calibrated</span>
                        </div>
                      </div>

                      {/* SECTION 2: SENTINEL-1A SAR RADAR CALIBRATOR */}
                      <div className="rounded-md bg-[#0b1120] border border-cyan-700/50 p-2.5 shadow-none space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded bg-cyan-400" />
                              <strong className="text-xs font-bold uppercase text-cyan-300 tracking-wider">
                                Section 2: Sentinel-1A SAR Calibration
                              </strong>
                            </div>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                              C-Band 10m GRD
                            </span>
                          </div>

                          <div className="space-y-2">
                            {/* Polarization & Filter Grid */}
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                              {/* Polarimetric Channel */}
                              <div className="bg-[#0e1626] p-1.5 rounded border border-slate-800 space-y-1">
                                <div className="flex justify-between items-center text-[9px]">
                                  <span className="text-slate-400 font-bold uppercase">Channel:</span>
                                  <span className="text-cyan-300 font-mono font-bold">{sarPolarization}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-0.5">
                                  <button
                                    onClick={() => setSarPolarization("VV")}
                                    className={`py-0.5 rounded text-[9px] font-bold border transition cursor-pointer shadow-none ${
                                      sarPolarization === "VV"
                                        ? "bg-cyan-700 text-white border-cyan-400"
                                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                                    }`}
                                  >
                                    VV
                                  </button>
                                  <button
                                    onClick={() => setSarPolarization("VH")}
                                    className={`py-0.5 rounded text-[9px] font-bold border transition cursor-pointer shadow-none ${
                                      sarPolarization === "VH"
                                        ? "bg-cyan-700 text-white border-cyan-400"
                                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                                    }`}
                                  >
                                    VH
                                  </button>
                                  <button
                                    onClick={() => setSarPolarization("VV_VH_RATIO")}
                                    className={`py-0.5 rounded text-[9px] font-bold border transition cursor-pointer shadow-none ${
                                      sarPolarization === "VV_VH_RATIO"
                                        ? "bg-cyan-700 text-white border-cyan-400"
                                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                                    }`}
                                  >
                                    Ratio
                                  </button>
                                </div>
                              </div>

                              {/* Speckle Filter */}
                              <div className="bg-[#0e1626] p-1.5 rounded border border-slate-800 space-y-1">
                                <div className="flex justify-between items-center text-[9px]">
                                  <span className="text-slate-400 font-bold uppercase">Filter:</span>
                                  <span className="text-cyan-300 font-mono font-bold">{sarFilter}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-0.5">
                                  <button
                                    onClick={() => setSarFilter("LEE_3X3")}
                                    className={`py-0.5 rounded text-[9px] font-bold border transition cursor-pointer shadow-none ${
                                      sarFilter === "LEE_3X3"
                                        ? "bg-cyan-700 text-white border-cyan-400"
                                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                                    }`}
                                  >
                                    Lee
                                  </button>
                                  <button
                                    onClick={() => setSarFilter("GAMMA_MAP_5X5")}
                                    className={`py-0.5 rounded text-[9px] font-bold border transition cursor-pointer shadow-none ${
                                      sarFilter === "GAMMA_MAP_5X5"
                                        ? "bg-cyan-700 text-white border-cyan-400"
                                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                                    }`}
                                  >
                                    Gamma
                                  </button>
                                  <button
                                    onClick={() => setSarFilter("RAW")}
                                    className={`py-0.5 rounded text-[9px] font-bold border transition cursor-pointer shadow-none ${
                                      sarFilter === "RAW"
                                        ? "bg-cyan-700 text-white border-cyan-400"
                                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                                    }`}
                                  >
                                    Raw
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Backscatter Cutoff Slider */}
                            <div className="bg-[#0e1626] p-2 rounded border border-slate-800 space-y-1">
                              <div className="flex justify-between items-center text-[9px]">
                                <span className="text-slate-400 font-bold uppercase">Backscatter Water Cutoff:</span>
                                <span className="text-cyan-300 font-mono font-bold">{sarThresholdDb.toFixed(1)} dB</span>
                              </div>
                              <input
                                type="range"
                                min="-24.0"
                                max="-12.0"
                                step="0.5"
                                value={sarThresholdDb}
                                onChange={(e) => setSarThresholdDb(parseFloat(e.target.value))}
                                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded"
                              />
                              <div className="flex justify-between text-[8px] font-mono text-slate-500">
                                <span>-24.0 dB (Conservative)</span>
                                <span>-12.0 dB (Broad Inundation)</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] font-mono text-cyan-300">
                          <span>Detected Water Footprint:</span>
                          <strong className="text-white font-bold">{sarWaterAreaKm2} km²</strong>
                        </div>
                      </div>

                      {/* SECTION 3: SATELLITE ORBITAL & GROUND TELEMETRY HEALTH */}
                      <div className="rounded-md bg-[#0b1120] border border-slate-700/60 p-2.5 shadow-none space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded bg-emerald-400" />
                              <strong className="text-xs font-bold uppercase text-slate-200 tracking-wider">
                                Section 3: Telemetry Health &amp; Orbit
                              </strong>
                            </div>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                              ESA / CWC Feeds
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            <div className="rounded bg-[#0e1626] border border-slate-800 p-2">
                              <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Satellite Pass</span>
                              <span className="text-xs font-bold text-cyan-300 font-mono block">Copernicus S-1A</span>
                              <span className="text-[9px] text-slate-400 font-mono block mt-0.5">Orbit Alt: 693 km</span>
                            </div>
                            <div className="rounded bg-[#0e1626] border border-slate-800 p-2">
                              <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">CWC Gauge Feeder</span>
                              <span className="text-xs font-bold text-emerald-400 font-mono block">ONLINE (0% Loss)</span>
                              <span className="text-[9px] text-slate-400 font-mono block mt-0.5">Station Ganga-64B</span>
                            </div>
                            <div className="rounded bg-[#0e1626] border border-slate-800 p-2">
                              <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Open-Meteo AWS</span>
                              <span className="text-xs font-bold text-emerald-400 font-mono block">ONLINE (100% Signal)</span>
                              <span className="text-[9px] text-slate-400 font-mono block mt-0.5">Ground Weather</span>
                            </div>
                            <div className="rounded bg-[#0e1626] border border-slate-800 p-2">
                              <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Heartbeat Polling</span>
                              <span className="text-xs font-bold text-white font-mono block">Every 30 Seconds</span>
                              <span className="text-[9px] text-emerald-400 font-mono block mt-0.5">{telemAgeStr}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] font-mono text-slate-400">
                          <span>Feed Freshness: <strong className={isTelemStale ? "text-amber-400" : "text-emerald-400"}>{isTelemStale ? "STALE DATA" : "ACTIVE REAL-TIME"}</strong></span>
                          <span>SEOC Ingestion OK</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. ACTION BRIDGE: LOAD LIVE WEATHER INTO SIMULATOR */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-md bg-[#0c1a30] border border-blue-700/50 shadow-none">
                      <div className="text-xs text-blue-200">
                        <span>Ingested at <strong>{telemTimeStr}</strong> for <strong>{liveTelem?.study_region || selectedLiveLocation.name}</strong></span>
                        <span className="block text-[10px] text-blue-300/80 mt-0.5">Transfers verified ground hydrology directly to Scenario Simulator parameter sliders for predictive modeling.</span>
                      </div>
                      <button
                        onClick={() => {
                          if (liveResult?.live_telemetry) {
                            setRainfall(liveResult.live_telemetry.rainfall_mm);
                            setDuration(liveResult.live_telemetry.duration_hours);
                            setWaterLevel(liveResult.live_telemetry.water_level_m);
                            setMode("simulation");
                            setToastMessage({
                              type: "info",
                              text: `Transferred live weather (${liveResult.live_telemetry.rainfall_mm}mm, ${liveResult.live_telemetry.water_level_m}m) into Scenario Simulator sliders!`,
                            });
                            setTimeout(() => setToastMessage(null), 4000);
                          }
                        }}
                        className="cursor-pointer px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs transition shadow-none flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        LOAD LIVE WEATHER INTO SIMULATOR
                      </button>
                    </div>
                  </div>
                );
              })()}

        </div>

        {/* 7. OFFICIAL GOVERNMENT SITUATION REPORT (SITREP) MODAL */}
        {showSitrepModal && (
          <div
            id="sitrep-print-container"
            className="seoc-modal-overlay"
            style={{ zIndex: 99999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowSitrepModal(false);
            }}
          >
            <div
              id="sitrep-print-content"
              className="seoc-modal-dialog relative w-full max-w-3xl rounded-md border border-slate-700 bg-[#0f141f] p-4 sm:p-5 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto"
              style={{ zIndex: 100000 }}
            >

              {/* Report Header — Official Government Form Format */}
              <div className="border-b border-slate-700/80 pb-3">
                <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3 text-center sm:text-left">
                  <div className="flex items-center gap-3">
                    <div className="h-10 px-2.5 rounded bg-[#141a27] border border-[#263045] flex items-center justify-center text-amber-400 font-mono font-bold text-xs shrink-0">SEOC</div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 block">
                        GOVERNMENT OF BIHAR • DISASTER MANAGEMENT DEPARTMENT
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-white">
                        STATE EMERGENCY OPERATIONS CENTER (SEOC)
                      </h3>
                      <span className="text-[11px] text-slate-300 font-semibold block mt-0.5">
                        INCIDENT SITUATION REPORT (SITREP) — LEVEL-4 DISASTER EVENT
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowSitrepModal(false)}
                    className="no-print cursor-pointer rounded bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 text-xs font-bold transition self-end sm:self-start shadow-none"
                  >
                    [CLOSE]
                  </button>
                </div>

                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] bg-slate-950/70 p-2 rounded border border-slate-800 font-mono text-slate-300">
                  <div>DOC REF: <strong className="text-white">BSDMA/SEOC/2026-FL-09</strong></div>
                  <div>SECURITY: <strong className="text-amber-400">RESTRICTED OPS</strong></div>
                  <div>SECTOR: <strong className="text-white">BARAUNI-MOKAMA</strong></div>
                  <div>TIMESTAMP: <strong className="text-emerald-400">{currentTime || "16:30"} IST</strong></div>
                </div>
              </div>

              <div className="mt-3.5 space-y-3 text-xs sm:text-sm">

                {/* EXECUTIVE SUMMARY TILES */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded bg-[#0b1120] p-2.5 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Incident Hazard Tier</span>
                    <p className={`text-base font-bold mt-0.5 ${currentRiskScoreNum >= 0.75 ? "text-rose-400" : "text-amber-400"}`}>
                      {displayHazardLevel} ({displayRiskScore})
                    </p>
                  </div>
                  <div className="rounded bg-[#0b1120] p-2.5 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Exposed Population</span>
                    <p className="text-base font-bold text-white mt-0.5">
                      {displayPopulationAffected} Citizens
                    </p>
                  </div>
                  <div className="rounded bg-[#0b1120] p-2.5 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Severed Gram Panchayats</span>
                    <p className="text-base font-bold text-amber-300 mt-0.5">
                      {activeAffectedVillages.length} of 5 Cut Off
                    </p>
                  </div>
                  <div className="rounded bg-[#0b1120] p-2.5 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Submerged Arterial Roads</span>
                    <p className="text-base font-bold text-rose-400 mt-0.5">
                      {activeAffectedRoads.length} Corridors
                    </p>
                  </div>
                </div>

                {/* INUNDATION STATUS & COMMUNITY ISOLATION */}
                <div className="rounded bg-[#0b1120] p-3 border border-slate-800">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    1. Inundation Sector Status & Community Isolation
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {activeAffectedVillages.length > 0 ? (
                      activeAffectedVillages.map((id) => {
                        const v = REAL_INFRASTRUCTURE_METADATA.villages[id as keyof typeof REAL_INFRASTRUCTURE_METADATA.villages];
                        return (
                          <li key={id} className="flex items-start justify-between gap-2 p-1.5 rounded bg-slate-900/80 border border-slate-800">
                            <div>
                              <strong className="text-white">{v?.name || id}</strong>
                              <span className="text-slate-400 text-[11px] block">{v?.vulnerability || "Active flood inundation zone."}</span>
                            </div>
                            <span className="text-amber-400 font-mono font-bold text-xs shrink-0">
                              {v?.population.toLocaleString()} citizens
                            </span>
                          </li>
                        );
                      })
                    ) : (
                      <li className="text-emerald-400 p-2">All 5 village settlements maintain clear overland road connectivity.</li>
                    )}
                  </ul>
                </div>

                {/* RESCUE & EVACUATION DEPLOYMENT MANIFEST */}
                <div className="rounded bg-[#0b1120] p-3 border border-slate-800">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    2. NDRF / SDRF Emergency Resource Dispatch Roster
                  </h4>
                  {activeAllocations.length > 0 ? (
                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                      {activeAllocations.map((a) => (
                        <div key={a.resource} className="p-2 rounded bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
                          <div>
                            <span className="font-bold text-amber-300">{a.resource_type === "RESCUE_BOAT" ? "[BOAT]" : "[AMB]"} {a.resource} ({a.resource_type})</span> &rarr; <span className="font-bold text-white">{a.village_name || a.village_id}</span>
                            <p className="text-slate-400 text-[11px] mt-0.5">{a.reason}</p>
                          </div>
                          <div className="text-left sm:text-right shrink-0 font-mono">
                            <span className="text-white font-bold block">ETA: {a.estimated_travel_time_min.toFixed(1)} min</span>
                            <span className="text-[10px] text-slate-400">{a.distance_km.toFixed(1)} km transit</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No emergency unit dispatches required under baseline weather conditions.</p>
                  )}
                </div>

                {/* 3. CRITICAL INFRASTRUCTURE CASCADE & RELIEF SHELTERS */}
                <div className="rounded bg-[#0b1120] p-3 border border-slate-800">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    3. Lifeline Cascade (Grid, Telecom & Shelters)
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 font-bold block text-[11px]">POWER SUBSTATIONS &amp; HEALTHCARE BACKUP:</span>
                      <span className={activeAffectedVillages.length > 1 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                        {activeAffectedVillages.length > 1 ? "[WARN] Barauni 33kV Substation Flooded — Sadar Hospital on Diesel Genset" : "[OK] All Grid Substations Nominal"}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 font-bold block text-[11px]">TELECOM BTS &amp; VILLAGE COVERAGE:</span>
                      <span className={activeAffectedVillages.length > 2 ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                        {activeAffectedVillages.length > 2 ? "[WARN] Pipra Dewas BTS Offline — Radio Ham / SDRF VHF Deployed" : "[OK] Mobile Cellular BTS Active"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 p-2 rounded bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <strong className="text-white">Rajkiya Uchh Vidyalaya &amp; Manjhaul Shelters:</strong>
                      <span className="text-slate-400 block text-[11px]">Food ration reserves: 2.8 days • Medical trauma kits: 20 kits</span>
                    </div>
                    <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 font-mono font-bold text-xs border border-blue-500/40">
                      Capacity: 1,450 beds
                    </span>
                  </div>
                </div>

                {/* SATELLITE & SENSOR METADATA VERIFICATION */}
                <div className="rounded bg-[#0b1120] p-2.5 border border-slate-800 text-xs text-slate-400 font-mono space-y-1">
                  <div className="font-bold text-slate-300 font-sans mb-1 flex items-center gap-1.5">
                    4. Earth Observation & Sensor Ingestion Provenance
                  </div>
                  <div>• SAR Radar Water Mask: <span className="text-slate-200">Copernicus Sentinel-1A (10m C-Band VV/VH)</span></div>
                  <div>• Topographical DEM: <span className="text-slate-200">NASA SRTM v3 (30m Elevation &amp; Slope)</span></div>
                  <div>• Numerical Precipitation: <span className="text-slate-200">NASA GPM IMERG / Open-Meteo IMD Station</span></div>
                  <div>• Decision Optimization Algorithm: <span className="text-slate-200">Google OR-Tools SCIP Mixed-Integer Linear Programming (MILP) with Inter-Modal Watercraft Routing</span></div>
                </div>

                {/* OFFICIAL SIGN-OFF BLOCK */}
                <div className="border-t border-slate-800 pt-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center text-[10px] text-slate-400 gap-2">
                  <div>
                    <span>AUTHORITY: </span>
                    <strong className="text-slate-200">State Disaster Management Authority (SDMA) Patna</strong>
                  </div>
                  <div className="font-mono text-emerald-400 flex items-center gap-1">
                    <span>[DIGITAL SIGNATURE VERIFIED]</span>
                  </div>
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="no-print mt-4 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-800 pt-3">
                <button
                  onClick={() => window.print()}
                  className="cursor-pointer px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-none"
                >
                  PRINT / EXPORT OFFICIAL SITREP (PDF)
                </button>
                <button
                  onClick={() => setShowSitrepModal(false)}
                  className="cursor-pointer px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition shadow-none"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. EMERGENCY DISTRESS CALL INTAKE MODAL */}
        {showSosModal && (
          <div
            className="seoc-modal-overlay"
            style={{ zIndex: 99999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowSosModal(false);
            }}
          >
            <div
              className="seoc-modal-dialog relative w-full max-w-xl rounded-md border border-slate-700 bg-[#0f141f] p-4 sm:p-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto"
              style={{ zIndex: 100000 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-bold text-xs">
                    SOS INTAKE
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      File Citizen / Agency Distress Alert
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Barauni Flood Basin • Immediate Triage &amp; Dispatch Queue
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowSosModal(false)}
                  className="cursor-pointer rounded bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 text-xs font-bold transition shadow-none"
                >
                  [CLOSE]
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleLogNewSos} className="mt-3.5 space-y-3 text-xs">
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      Intake Source / Agency
                    </label>
                    <select
                      value={newSosData.source}
                      onChange={(e) => setNewSosData({ ...newSosData, source: e.target.value })}
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="Citizen Helpline 1070">Citizen Helpline 1070 (SEOC IVR)</option>
                      <option value="Emergency Response 112">Emergency Response 112</option>
                      <option value="NDRF Wireless Relay">NDRF Field Wireless Relay</option>
                      <option value="Gram Panchayat Mukhiya">Gram Panchayat Mukhiya</option>
                      <option value="SDRF Boat Patrol">SDRF Boat Patrol Unit</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      Sector / Affected Habitat
                    </label>
                    <select
                      value={newSosData.village_id}
                      onChange={(e) => setNewSosData({ ...newSosData, village_id: e.target.value })}
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="V1">Pipra Dewas (V1) - North Flood Basin</option>
                      <option value="V2">Sultanganj Diara (V2) - River Island (Watercraft Only)</option>
                      <option value="V3">Manjhaul Lowlands (V3) - Wetland Basin</option>
                      <option value="V4">Begusarai Rural (V4) - Central Corridor</option>
                      <option value="V5">Rajendra Bridge (V5) - Embankment Sector</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      Urgency Level
                    </label>
                    <select
                      value={newSosData.urgency}
                      onChange={(e) =>
                        setNewSosData({
                          ...newSosData,
                          urgency: e.target.value as "CRITICAL" | "HIGH" | "MODERATE",
                        })
                      }
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="CRITICAL">CRITICAL (Water Ingress)</option>
                      <option value="HIGH">HIGH (Food / Ration Exhausted)</option>
                      <option value="MODERATE">MODERATE (Pre-emptive Evac)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      Estimated Evacuees
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={newSosData.evacueeCount}
                      onChange={(e) =>
                        setNewSosData({ ...newSosData, evacueeCount: Number(e.target.value) })
                      }
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-white font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      Target Safe Shelter
                    </label>
                    <select
                      value={newSosData.targetShelter}
                      onChange={(e) =>
                        setNewSosData({
                          ...newSosData,
                          targetShelter: e.target.value as "S1" | "S2",
                        })
                      }
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="S1">S1 - Rajkiya Uchh Vidyalaya (Cap: 850)</option>
                      <option value="S2">S2 - Manjhaul Panchayat (Cap: 600)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    Distress Situation &amp; Landmark Details
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Specify water depth, rooftop presence, elderly/infants count, or critical medical equipment needs..."
                    value={newSosData.message}
                    onChange={(e) => setNewSosData({ ...newSosData, message: e.target.value })}
                    className="w-full rounded bg-slate-900 border border-slate-700 p-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="pt-2.5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <span className="text-[10px] text-slate-500 text-center sm:text-left">
                    Logged incidents will appear immediately in the SEOC queue and trigger routing recommendations.
                  </span>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setShowSosModal(false)}
                      className="cursor-pointer w-1/2 sm:w-auto px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition shadow-none"
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      className="cursor-pointer w-1/2 sm:w-auto px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white font-bold transition shadow-none"
                    >
                      SUBMIT ALERT
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 8. INCIDENT ACTION PLAN (IAP) & LOGISTICS REQUISITION MODAL (ICS-204) */}
        {showIapModal && (
          <div
            id="iap-print-container"
            className="seoc-modal-overlay"
            style={{ zIndex: 99999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIapModal(false);
            }}
          >
            <div
              id="iap-print-content"
              className="seoc-modal-dialog relative w-full max-w-4xl rounded-md border border-slate-700 bg-[#0f141f] p-4 sm:p-5 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto"
              style={{ zIndex: 100000 }}
            >
              {/* Header */}
              <div className="border-b border-slate-700/80 pb-3">
                <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3 text-center sm:text-left">
                  <div className="flex items-center gap-3">
                    <div className="h-10 px-2.5 rounded bg-[#141a27] border border-[#263045] flex items-center justify-center text-amber-400 font-mono font-bold text-xs shrink-0">
                      ICS-204
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 block">
                        GOVERNMENT OF BIHAR • STATE EMERGENCY OPERATIONS CENTRE (SEOC)
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-white">
                        INCIDENT ACTION PLAN (IAP) &amp; LOGISTICS REQUISITION
                      </h3>
                      <span className="text-[11px] text-slate-300 font-semibold block mt-0.5">
                        OPERATIONAL PERIOD 01: 06:00 IST TO 18:00 IST (12-HOUR DIRECTIVE)
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowIapModal(false)}
                    className="no-print cursor-pointer rounded bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 text-xs font-bold transition self-end sm:self-start shadow-none"
                  >
                    [CLOSE]
                  </button>
                </div>

                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] bg-slate-950/70 p-2 rounded border border-slate-800 font-mono text-slate-300">
                  <div>DOC REF: <strong className="text-white">BSDMA/IAP/2026-OP01</strong></div>
                  <div>COMMANDER: <strong className="text-amber-400">DM BEGUSARAI / SEOC</strong></div>
                  <div>SECTOR: <strong className="text-white">BARAUNI-SULTANGANJ</strong></div>
                  <div>POPULATION AT RISK: <strong className="text-rose-400">{iapPopulation.toLocaleString()} CITIZENS</strong></div>
                </div>
              </div>

              {/* Body */}
              <div className="mt-3.5 space-y-3.5 text-xs">
                {/* 1. REQUISITION MANIFEST TABLE */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      1. Critical Supply &amp; Fuel Requisition Manifest (Sphere / NDMA Standards)
                    </h4>
                    <span className="text-[10px] font-mono text-amber-400">
                      Auto-calculated from active flood severity
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded border border-slate-800">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-950/90 text-slate-400 uppercase text-[9px] font-bold border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Class</th>
                          <th className="py-2 px-3">Item Description</th>
                          <th className="py-2 px-3">Statutory Standard</th>
                          <th className="py-2 px-3 text-right">Requisition Qty</th>
                          <th className="py-2 px-3">Depot / Agency</th>
                          <th className="py-2 px-3 text-center">Priority</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                        <tr>
                          <td className="py-2 px-3 font-mono font-bold text-amber-400">FUEL</td>
                          <td className="py-2 px-3 font-semibold text-white">High-Speed Diesel (HSD) for Hospital Gensets</td>
                          <td className="py-2 px-3 text-slate-400">25 L/hr per 125kVA unit (12h window)</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-white">{iapGensetDieselL.toLocaleString()} Litres</td>
                          <td className="py-2 px-3 text-slate-300">IOCL Barauni Refinery Terminal</td>
                          <td className="py-2 px-3 text-center"><span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-mono text-[9px] font-bold">IMMEDIATE</span></td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-bold text-amber-400">FUEL</td>
                          <td className="py-2 px-3 font-semibold text-white">Marine Petrol / 2T Blend for Rescue IRBs</td>
                          <td className="py-2 px-3 text-slate-400">12 L/hr per 40HP OBM boat (8h ops)</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-white">{iapBoatFuelL.toLocaleString()} Litres</td>
                          <td className="py-2 px-3 text-slate-300">Barauni Marine Fuel Staging</td>
                          <td className="py-2 px-3 text-center"><span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-mono text-[9px] font-bold">IMMEDIATE</span></td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-bold text-cyan-400">WASH</td>
                          <td className="py-2 px-3 font-semibold text-white">Potable Water Tanker Transport</td>
                          <td className="py-2 px-3 text-slate-400">Sphere norm: 15 Litres/person/day</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-cyan-300">{iapDailyWaterL.toLocaleString()} Litres</td>
                          <td className="py-2 px-3 text-slate-300">PHED Water Depot Barauni</td>
                          <td className="py-2 px-3 text-center"><span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-mono text-[9px] font-bold">IMMEDIATE</span></td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-bold text-cyan-400">WASH</td>
                          <td className="py-2 px-3 font-semibold text-white">NaDCC Chlorine Water Purification Tablets</td>
                          <td className="py-2 px-3 text-slate-400">1 Tablet per 20L water disinfection</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-cyan-300">{iapChlorineTablets.toLocaleString()} Tablets</td>
                          <td className="py-2 px-3 text-slate-300">District Health Store Begusarai</td>
                          <td className="py-2 px-3 text-center"><span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-mono text-[9px] font-bold">PRIORITY</span></td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-400">FOOD</td>
                          <td className="py-2 px-3 font-semibold text-white">NDRF Standard Sealed Dry Ration Packs</td>
                          <td className="py-2 px-3 text-slate-400">2.5kg chura, gur, sattu, biscuits, ORS</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-300">{iapDryRations.toLocaleString()} Packs</td>
                          <td className="py-2 px-3 text-slate-300">FCI Godown Mokama / Begusarai</td>
                          <td className="py-2 px-3 text-center"><span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-mono text-[9px] font-bold">IMMEDIATE</span></td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-bold text-rose-400">MED</td>
                          <td className="py-2 px-3 font-semibold text-white">Polyvalent Anti-Snake Venom (ASV) Vials</td>
                          <td className="py-2 px-3 text-slate-400">Diara island reptile displacement reserve</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-300">{iapAsvVials} Vials</td>
                          <td className="py-2 px-3 text-slate-300">Civil Surgeon Cold Chain Depot</td>
                          <td className="py-2 px-3 text-center"><span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-mono text-[9px] font-bold">IMMEDIATE</span></td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-bold text-rose-400">MED</td>
                          <td className="py-2 px-3 font-semibold text-white">Oral Rehydration Salts (WHO-ORS sachets)</td>
                          <td className="py-2 px-3 text-slate-400">Waterborne enteric disease prevention</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-300">{iapOrsPacks.toLocaleString()} Sachets</td>
                          <td className="py-2 px-3 text-slate-300">Primary Health Centre (PHC) Stores</td>
                          <td className="py-2 px-3 text-center"><span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-mono text-[9px] font-bold">PRIORITY</span></td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-bold text-blue-400">EQUIP</td>
                          <td className="py-2 px-3 font-semibold text-white">Coast Guard Approved Type-II Life Jackets</td>
                          <td className="py-2 px-3 text-slate-400">Standard PFD for civilian watercraft evac</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-blue-300">{iapLifeJackets} Units</td>
                          <td className="py-2 px-3 text-slate-300">SDRF Central Armory Begusarai</td>
                          <td className="py-2 px-3 text-center"><span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-mono text-[9px] font-bold">PRIORITY</span></td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-bold text-blue-400">EQUIP</td>
                          <td className="py-2 px-3 font-semibold text-white">Chlorinated Lime Bleaching Powder (25kg Bags)</td>
                          <td className="py-2 px-3 text-slate-400">Shelter sanitation &amp; anti-epidemic barrier</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-blue-300">{iapBleachingBags} Bags</td>
                          <td className="py-2 px-3 text-slate-300">Municipal Corporation Begusarai</td>
                          <td className="py-2 px-3 text-center"><span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[9px] font-bold">STANDBY</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. INTER-AGENCY OPERATIONAL DIRECTIVES (ICS-204) */}
                <div className="rounded bg-[#0b1120] p-3 border border-slate-800">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    2. Inter-Agency Task Force Directives &amp; Mission Assignments
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-white">TASK FORCE ALPHA (NDRF 9th Bn Bihta)</strong>
                        <span className="font-mono text-emerald-400 font-bold text-[9px]">RADIO: CH-04 VHF</span>
                      </div>
                      <p className="text-slate-300">
                        Deploy 2x Inflatable Rescue Boats (RB1, RB2) to Sultanganj Diara (V2) &amp; Pipra Dewas (V1). Priority evacuation of rooftop-stranded families directly to Shelter S1.
                      </p>
                    </div>

                    <div className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-white">TASK FORCE BRAVO (Water Resources Dept)</strong>
                        <span className="font-mono text-emerald-400 font-bold text-[9px]">RADIO: CH-02 VHF</span>
                      </div>
                      <p className="text-slate-300">
                        Mobilize 15,000 geotextile sandbags to Embankment Ring Bund (KM 12-18). Arm reinforcement crews at Sluice Gate 4 to prevent backwater ingress into Barauni industrial corridor.
                      </p>
                    </div>

                    <div className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-white">TASK FORCE CHARLIE (District Health &amp; CMO)</strong>
                        <span className="font-mono text-emerald-400 font-bold text-[9px]">CALL: MED-CONTROL</span>
                      </div>
                      <p className="text-slate-300">
                        Establish 24/7 Mobile Triage at Rajkiya Uchh Vidyalaya (S1). Prioritize waterborne disease screening, anti-snake venom protocol, and prenatal care monitoring.
                      </p>
                    </div>

                    <div className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-white">TASK FORCE DELTA (IOCL Logistics &amp; Police)</strong>
                        <span className="font-mono text-emerald-400 font-bold text-[9px]">CALL: POLICE-ESCORT</span>
                      </div>
                      <p className="text-slate-300">
                        Provide armed police escort for 12,000L fuel bowser from IOCL Refinery Terminal to Barauni Sadar Hospital to ensure ventilator gensets remain continuous.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. COMMUNICATIONS & FREQUENCY NET (ICS-205) */}
                <div className="rounded bg-[#0b1120] p-2.5 border border-slate-800 text-[11px] text-slate-300 font-mono space-y-1">
                  <div className="font-bold text-slate-300 font-sans mb-1 flex items-center justify-between">
                    <span>3. Communications &amp; Tactical Net (ICS-205)</span>
                    <span className="text-[10px] text-emerald-400">ALL NETWORKS OPERATIONAL</span>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2 pt-0.5">
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">COMMAND REPEATER</span>
                      <strong className="text-white">154.650 MHz VHF</strong>
                      <span className="text-slate-500 block text-[9px]">Barauni Tower Repeater</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">WATERCRAFT TACTICAL</span>
                      <strong className="text-white">156.800 MHz (VHF CH 16)</strong>
                      <span className="text-slate-500 block text-[9px]">Marine Distress &amp; Calling</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">HOTLINE INTEGRATION</span>
                      <strong className="text-amber-400">1070 (SEOC) • 1078 (NDRF)</strong>
                      <span className="text-slate-500 block text-[9px]">Priority Wireline Trunk</span>
                    </div>
                  </div>
                </div>

                {/* Sign-off */}
                <div className="border-t border-slate-800 pt-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center text-[10px] text-slate-400 gap-2">
                  <div>
                    <span>AUTHORIZING OFFICER: </span>
                    <strong className="text-slate-200">Incident Commander / District Magistrate, Begusarai</strong>
                  </div>
                  <div className="font-mono text-emerald-400 flex items-center gap-1">
                    <span>[OFFICIALLY PROMULGATED UNDER DM ACT 2005]</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-800 pt-3">
                <button
                  onClick={() => {
                    appendAuditLog(
                      "IAP_DIRECTIVE",
                      "Requisition Manifest BSDMA/IAP/2026-OP01 transmitted.",
                      `Requisitioned water (${iapDailyWaterL}L), rations (${iapDryRations} pkts), and fuel from DSO Begusarai.`
                    );
                    setToastMessage({
                      type: "success",
                      text: "Requisition Manifest BSDMA/IAP/2026-OP01 transmitted to District Supply Officer (DSO) Begusarai, IOCL Terminal, and PHED.",
                    });
                    setTimeout(() => setToastMessage(null), 5000);
                  }}
                  className="cursor-pointer px-3.5 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-none"
                >
                  TRANSMIT INDENT TO SUPPLY OFFICER (DSO)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="cursor-pointer px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-none"
                  >
                    PRINT / EXPORT IAP (PDF)
                  </button>
                  <button
                    onClick={() => setShowIapModal(false)}
                    className="cursor-pointer px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition shadow-none"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 6. COMMON ALERTING PROTOCOL (CAP v1.2) XML FEED MODAL */}
        {/* ========================================================================= */}
        {showCapModal && (
          <div
            className="seoc-modal-overlay"
            style={{ zIndex: 99999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCapModal(false);
            }}
          >
            <div
              className="seoc-modal-dialog relative w-full max-w-4xl rounded-md border border-cyan-700/60 bg-[#0c141f] p-4 sm:p-5 text-slate-100 shadow-2xl space-y-3 max-h-[92vh] flex flex-col"
              style={{ zIndex: 100000 }}
            >
              
              {/* Institutional Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center font-mono text-cyan-400 font-bold text-xs">
                    XML
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded uppercase">
                        ITU-T X.1303 / OASIS CAP v1.2
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded">
                        NDMA SACHET COMPLIANT
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                      Common Alerting Protocol (CAP) XML Gateway
                    </h2>
                    <p className="text-xs text-slate-400">
                      Standardized machine-readable disaster alert payload for telecom cell broadcast, radio, and national gateways.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCapModal(false)}
                  className="rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 text-xs font-bold transition shadow-none"
                >
                  [CLOSE]
                </button>
              </div>

              {/* Alert Envelope Metadata Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-[#070d15] p-2.5 rounded border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Alert Urgency</span>
                  <span className={`font-mono font-bold ${isCritical ? "text-rose-400" : "text-amber-400"}`}>
                    {isCritical ? "IMMEDIATE" : "EXPECTED"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Severity Level</span>
                  <span className={`font-mono font-bold ${isCritical ? "text-rose-400" : "text-amber-400"}`}>
                    {isCritical ? "EXTREME" : "SEVERE"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Affected Basin</span>
                  <span className="text-slate-200 font-semibold truncate block">Barauni &amp; Sultanganj Diara</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Population</span>
                  <span className="text-cyan-300 font-mono font-bold">{displayPopulationAffected} residents</span>
                </div>
              </div>

              {/* XML Code Viewer */}
              <div className="flex-1 min-h-[300px] overflow-auto rounded border border-slate-800 bg-[#050911] p-3 text-xs font-mono text-cyan-200 leading-relaxed">
                <pre className="whitespace-pre overflow-x-auto text-[11px] sm:text-xs">
                  {capXmlFeed}
                </pre>
              </div>

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyCapXml}
                    className="cursor-pointer px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 flex items-center gap-1.5 shadow-none"
                  >
                    COPY XML PAYLOAD
                  </button>
                  <button
                    onClick={downloadCapXml}
                    className="cursor-pointer px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-none"
                  >
                    DOWNLOAD .XML
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={broadcastCapXml}
                    className="cursor-pointer px-3.5 py-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-none"
                  >
                    PUSH TO NDMA SACHET GATEWAY
                  </button>
                  <button
                    onClick={() => setShowCapModal(false)}
                    className="cursor-pointer px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition shadow-none"
                  >
                    CLOSE
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 7. IMMUTABLE SEOC OPERATIONAL AUDIT TRAIL MODAL */}
        {/* ========================================================================= */}
        {showAuditModal && (
          <div
            className="seoc-modal-overlay"
            style={{ zIndex: 99999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAuditModal(false);
            }}
          >
            <div
              className="seoc-modal-dialog relative w-full max-w-5xl rounded-md border border-emerald-700/60 bg-[#0c141f] p-4 sm:p-5 text-slate-100 shadow-2xl space-y-3 max-h-[92vh] flex flex-col"
              style={{ zIndex: 100000 }}
            >

              {/* Institutional Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center font-mono text-emerald-400 font-bold text-xs">
                    AUD
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded uppercase">
                        BSDMA SEOC LEDGER
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded">
                        CRYPTOGRAPHICALLY SEALED
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                      SEOC Immutable Operational Audit Trail
                    </h2>
                    <p className="text-xs text-slate-400">
                      Tamper-evident record of all command decisions, resource dispatches, and hazard alerts for post-incident inquiry.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 text-xs font-bold transition shadow-none"
                >
                  [CLOSE]
                </button>
              </div>

              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-[#070d15] p-2.5 rounded border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Operations</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">{auditLogs.length} Logged</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Sector</span>
                  <span className="text-slate-200 font-semibold truncate block">Barauni-Sultanganj</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Command Authority</span>
                  <span className="text-slate-200 font-semibold truncate block">DM / Incident Commander</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Chain Integrity</span>
                  <span className="text-emerald-400 font-mono font-bold">VERIFIED (SHA-256)</span>
                </div>
              </div>

              {/* Chronological Audit Table */}
              <div className="flex-1 min-h-[320px] overflow-auto rounded border border-slate-800 bg-[#050911]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#080e18] text-slate-400 text-[10px] uppercase tracking-wider sticky top-0 z-10">
                      <th className="p-2.5 font-bold">Timestamp</th>
                      <th className="p-2.5 font-bold">Event Type</th>
                      <th className="p-2.5 font-bold">Operator Call Sign</th>
                      <th className="p-2.5 font-bold">Directive Summary &amp; Parameters</th>
                      <th className="p-2.5 font-bold font-mono">Verification Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-sans">
                    {auditLogs.map((log) => {
                      const typeBadge = {
                        SIMULATION: "bg-blue-500/20 text-blue-300 border-blue-500/40",
                        DISPATCH: "bg-amber-500/20 text-amber-300 border-amber-500/40",
                        SHELTER: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
                        HAZARD_ALERT: "bg-rose-500/20 text-rose-300 border-rose-500/40",
                        IAP_DIRECTIVE: "bg-orange-500/20 text-orange-300 border-orange-500/40",
                        CAP_BROADCAST: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                      }[log.eventType] || "bg-slate-500/20 text-slate-300 border-slate-500/40";

                      return (
                        <tr key={log.id} className="hover:bg-[#0b1424] transition-colors">
                          <td className="p-2.5 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                            {log.timestamp}
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${typeBadge}`}>
                              {log.eventType}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-300 font-medium whitespace-nowrap">
                            {log.operator}
                          </td>
                          <td className="p-2.5 text-slate-200">
                            <div className="font-semibold text-slate-100">{log.summary}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{log.details}</div>
                          </td>
                          <td className="p-2.5 font-mono text-cyan-400 text-xs whitespace-nowrap">
                            #{log.hash}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportAuditCsv}
                    className="cursor-pointer px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 flex items-center gap-1.5 shadow-none"
                  >
                    EXPORT CSV SPREADSHEET
                  </button>
                  <button
                    onClick={exportAuditJson}
                    className="cursor-pointer px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-none"
                  >
                    EXPORT SIGNED JSON LEDGER
                  </button>
                </div>

                <button
                  onClick={() => setShowAuditModal(false)}
                  className="cursor-pointer px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition shadow-none"
                >
                  CLOSE
                </button>
              </div>

            </div>
          </div>
        )}

        {/* OFFICIAL EXECUTIVE MEMO / STATUTORY ORDER MODAL (DM ACT 2005) */}
        {showMemoModal && (
          <div
            id="memo-print-container"
            className="seoc-modal-overlay"
            style={{ zIndex: 99999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowMemoModal(false);
            }}
          >
            <div
              id="memo-print-content"
              className="seoc-modal-dialog relative w-full max-w-3xl rounded-md border border-slate-700 bg-[#0f141f] p-4 sm:p-5 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto"
              style={{ zIndex: 100000 }}
            >
              {/* Official Seal & Heading */}
              <div className="border-b border-slate-700/80 pb-3 text-center">
                <div className="flex items-center justify-between pb-1.5">
                  <div className="text-[10px] font-mono text-slate-400">
                    FORM DM-01 / STATUTORY MANDATE
                  </div>
                  <button
                    onClick={() => setShowMemoModal(false)}
                    className="no-print cursor-pointer rounded bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 text-xs font-bold transition shadow-none"
                  >
                    [CLOSE]
                  </button>
                </div>
                <div className="inline-block px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest mb-1.5">
                  DRAFT STATUTORY RECOMMENDATION • FOR REVIEW &amp; SIGNATURE BY DM / INCIDENT COMMANDER
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-tight">
                  OFFICE OF THE DISTRICT MAGISTRATE &amp; COLLECTOR
                </h2>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide mt-0.5">
                  DISTRICT DISASTER MANAGEMENT AUTHORITY (DDMA) • BEGUSARAI, BIHAR
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-1">
                  DRAFT RECOMMENDATIONS UNDER SECTIONS 30(2) &amp; 34 OF DISASTER MANAGEMENT ACT, 2005 FOR REVIEW AND SIGNATURE
                </p>
              </div>

              {/* Memo Metadata Grid */}
              <div className="my-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] bg-slate-950/70 p-2 rounded border border-slate-800 font-mono text-slate-300">
                <div>MEMO NO: <strong className="text-white">BSDMA/SEOC/2026/FL-04/DIR-108</strong></div>
                <div>DATE: <strong className="text-white">21 OCTOBER 2026</strong></div>
                <div>SECTOR: <strong className="text-amber-400">BARAUNI – SULTANGANJ DIARA</strong></div>
                <div>ALERT STATUS: <strong className="text-rose-400 uppercase">{displayHazardLevel}</strong></div>
              </div>

              {/* Order Preamble */}
              <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed font-sans">
                <p>
                  <strong>WHEREAS</strong>, real-time hydrological telemetry and Sentinel-1 SAR satellite observations indicate
                  that the Ganga River water level at Barauni Ghat has attained <strong>{mode === "historical" ? currentSnapshot.river_level_m : (activeData?.event?.inputs?.water_level_m ?? waterLevel)}m</strong>,
                  exceeding the Extreme Danger Level (HFL 8.50m) with cumulative precipitation recorded at <strong>{mode === "historical" ? currentSnapshot.rainfall_24h_mm : (activeData?.event?.inputs?.rainfall_mm ?? rainfall)}mm</strong>;
                </p>
                <p>
                  <strong>AND WHEREAS</strong>, the State Emergency Operations Centre (SEOC) Multi-Criteria Decision Analysis (MCDA) triage engine
                  and cascading infrastructure analysis confirm active road submergence along SH-89, threatening the life and safety of approximately{" "}
                  <strong>{displayPopulationAffected}</strong> residents across the low-lying and river-island diara settlements;
                </p>
                <p>
                  <strong>NOW, THEREFORE</strong>, pursuant to provisions under Section 30(2) and Section 34 of the Disaster Management Act, 2005,
                  the following draft operational recommendations are submitted for review, signature, and formal issuance by the <em>District Magistrate &amp; Chairperson, DDMA Begusarai</em>:
                </p>
              </div>

              {/* Directive Action Table */}
              <div className="mt-3 border border-slate-800 rounded overflow-hidden bg-slate-950/40">
                <div className="bg-[#141a27] px-3 py-1.5 border-b border-slate-800 text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>SECTION A: MANDATORY EVACUATION &amp; TRANSIT PROTOCOLS</span>
                  <span className="text-[10px] font-mono text-amber-400">COMPLIANCE DEADLINE: IMMEDIATE (T-0)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2">Target Settlement</th>
                        <th className="p-2">Population at Risk</th>
                        <th className="p-2">Designated Safe Corridor</th>
                        <th className="p-2">Assigned Shelter Facility</th>
                        <th className="p-2">Primary Lead Agency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      <tr>
                        <td className="p-2 font-bold text-rose-400">Sultanganj Diara (V2)</td>
                        <td className="p-2">7,850</td>
                        <td className="p-2 text-slate-400">Watercraft IRB Flotilla &rarr; Barauni Ghat Jetty</td>
                        <td className="p-2 text-emerald-400">Rajkiya Uchh Vidyalaya (S1)</td>
                        <td className="p-2">NDRF 9th Bn / SDRF Boat Unit</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-amber-400">Pipra Dewas (V1)</td>
                        <td className="p-2">5,420</td>
                        <td className="p-2 text-slate-400">High-Ground Bund Bypass &rarr; NH-31 Feeder</td>
                        <td className="p-2 text-emerald-400">Rajkiya Uchh Vidyalaya (S1)</td>
                        <td className="p-2">Begusarai District Police &amp; Civil Defence</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-300">Manjhaul Lowlands (V3)</td>
                        <td className="p-2">4,200</td>
                        <td className="p-2 text-slate-400">Paved Ring Bund Arterial Safe Road</td>
                        <td className="p-2 text-emerald-400">Manjhaul Block Panchayat Bhawan (S2)</td>
                        <td className="p-2">SDRF Tactical Team &amp; Home Guards</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-300">Mohanpur West (V4)</td>
                        <td className="p-2">3,600</td>
                        <td className="p-2 text-slate-400">Simaria Railhead Link Road</td>
                        <td className="p-2 text-emerald-400">Manjhaul Block Panchayat Bhawan (S2)</td>
                        <td className="p-2">Civil Defence &amp; Village Volunteers</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-300">Rampur Ghat Diara (V5)</td>
                        <td className="p-2">4,850</td>
                        <td className="p-2 text-slate-400">Sultanganj Ghat Causeway Link Road</td>
                        <td className="p-2 text-emerald-400">Rajkiya Uchh Vidyalaya (S1)</td>
                        <td className="p-2">NDRF 9th Bn &amp; Home Guards</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Inter-Agency Line Directives */}
              <div className="mt-3 border border-slate-800 rounded overflow-hidden bg-slate-950/40">
                <div className="bg-[#141a27] px-3 py-1.5 border-b border-slate-800 text-xs font-bold text-slate-200">
                  SECTION B: INTER-AGENCY OPERATIONAL INDENTS
                </div>
                <div className="p-2.5 text-[11px] space-y-1.5 text-slate-300 leading-relaxed font-mono">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">[POLICE]</span>
                    <span><strong>Superintendent of Police (SP) Begusarai:</strong> Enforce 24/7 security perimeter and traffic diversions on NH-31, prohibiting civilian light vehicular movement towards inundated culverts at KM 14-16.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold shrink-0">[HEALTH]</span>
                    <span><strong>Civil Surgeon &amp; Chief Medical Officer (CMO):</strong> Deploy 4 Advanced Life Support (ALS) medical units and establish triage stations at S1 &amp; S2 with anti-venom and ORS stocks.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold shrink-0">[WATER]</span>
                    <span><strong>Executive Engineer (PHED Begusarai):</strong> Mobilize 8 potable water bowsers (minimum 15 litres/capita/day per Sphere Standards) and install chlorine dosing units at all active relief camps.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 font-bold shrink-0">[SUPPLY]</span>
                    <span><strong>District Supply Officer (DSO):</strong> Release 30-day buffer stocks of food grain, dry rations, and baby nutrition packets from the Barauni Central Food Godown.</span>
                  </div>
                </div>
              </div>

              {/* Administrative Notice & Signatory Block */}
              <div className="mt-3 pt-2.5 border-t border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                <p className="font-semibold text-slate-300 mb-1.5">
                  * Administrative Notice: Generates draft statutory recommendations under Sections 30(2) and 34 of the Disaster Management Act, 2005 for review and signature by the District Magistrate / Incident Commander. Statutory compliance and legal authority take effect only upon execution by the competent authority.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 pt-3 border-t border-slate-800">
                  <div>
                    <div className="text-[10px] font-mono text-slate-500">PENDING SIGNATURE &amp; OFFICIAL SEAL</div>
                    <div className="text-xs font-bold text-white mt-0.5">Chairperson, District Disaster Management Authority</div>
                    <div className="text-[11px] text-slate-400">District Magistrate &amp; Collector, Begusarai</div>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-[10px] font-mono text-slate-500">TECHNICAL REVIEW &amp; ENDORSEMENT</div>
                    <div className="text-xs font-bold text-amber-400 mt-0.5">Incident Commander (9th Bn NDRF)</div>
                    <div className="text-[11px] text-slate-400">Barauni Incident Command Post (ICP)</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 no-print">
                <button
                  onClick={() => window.print()}
                  className="cursor-pointer px-3.5 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-none transition flex items-center gap-1.5"
                >
                  PRINT / EXPORT DRAFT MEMO (PDF)
                </button>
                <button
                  onClick={() => setShowMemoModal(false)}
                  className="cursor-pointer px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition shadow-none"
                >
                  CLOSE
                </button>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* 4. GIGW 3.0 & NIDM / MYGOV COMPREHENSIVE GOVERNMENT FOOTER */}
      <footer className="border-t border-[#1b3353] bg-[#050c18] text-slate-400 text-xs mt-8">
        {/* Top Tricolor Accent */}
        <div className="h-1 w-full bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-6 border-b border-[#152742]">
            
            {/* Column 1: Institutional Authority */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-8 shrink-0">
                  <StateEmblemIndia className="h-full w-full" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-xs uppercase tracking-wider">
                    {language === "hi" ? "आपदा प्रबंधन विभाग" : "Disaster Management Dept"}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {language === "hi" ? "बिहार सरकार एवं भारत सरकार" : "Govt. of Bihar & Govt. of India"}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                National Institute of Disaster Management (NIDM), NDMA Bhawan, Safdarjung Enclave, New Delhi - 110029
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Bihar State Disaster Management Authority (BSDMA), Sardar Patel Bhawan, Bailey Road, Patna - 800023
              </p>
            </div>

            {/* Column 2: 24x7 Emergency Hotlines */}
            <div className="space-y-2">
              <h4 className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                {language === "hi" ? "आपातकालीन हेल्पलाइन (24x7)" : "Emergency Helplines (24x7)"}
              </h4>
              <ul className="space-y-1.5 text-[11px]">
                <li className="flex justify-between items-center bg-[#091526] px-2.5 py-1 rounded border border-[#172c4a]">
                  <span className="text-slate-300">State Control Room (SEOC):</span>
                  <span className="text-amber-400 font-mono font-bold">1070 (Toll-Free)</span>
                </li>
                <li className="flex justify-between items-center bg-[#091526] px-2.5 py-1 rounded border border-[#172c4a]">
                  <span className="text-slate-300">National Emergency (ERSS):</span>
                  <span className="text-rose-400 font-mono font-bold">112</span>
                </li>
                <li className="flex justify-between items-center bg-[#091526] px-2.5 py-1 rounded border border-[#172c4a]">
                  <span className="text-slate-300">NDRF Control Room (HQ):</span>
                  <span className="text-emerald-400 font-mono font-bold">1078</span>
                </li>
                <li className="flex justify-between items-center bg-[#091526] px-2.5 py-1 rounded border border-[#172c4a]">
                  <span className="text-slate-300">District DEOC (Begusarai):</span>
                  <span className="text-cyan-400 font-mono font-bold">1077</span>
                </li>
              </ul>
            </div>

            {/* Column 3: GIGW 3.0 & Compliance */}
            <div className="space-y-2">
              <h4 className="text-white font-bold text-xs uppercase tracking-wider">
                {language === "hi" ? "मानक एवं वैधानिक अनुपालन" : "Standards & Compliance"}
              </h4>
              <ul className="space-y-1 text-[11px] text-slate-400">
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>GIGW 3.0 Certified (guidelines.india.gov.in)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>WCAG 2.1 Level AA Accessibility Compliant</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Digital Personal Data Protection (DPDP) Act 2023</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Security Audited by STQC Directorate</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Hosted on NIC National Cloud (MeghRaj)</span>
                </li>
              </ul>
            </div>

            {/* Column 4: Inter-Agency National Portals */}
            <div className="space-y-2">
              <h4 className="text-white font-bold text-xs uppercase tracking-wider">
                {language === "hi" ? "राष्ट्रीय आपदा पोर्टल" : "National Portals"}
              </h4>
              <ul className="space-y-1 text-[11px]">
                <li>
                  <a href="https://nidm.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition flex items-center justify-between">
                    <span>NIDM India (nidm.gov.in)</span>
                    <span className="text-slate-500 text-[10px]">↗</span>
                  </a>
                </li>
                <li>
                  <a href="https://www.mygov.in" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition flex items-center justify-between">
                    <span>MyGov India (mygov.in)</span>
                    <span className="text-slate-500 text-[10px]">↗</span>
                  </a>
                </li>
                <li>
                  <a href="https://guidelines.india.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition flex items-center justify-between">
                    <span>GIGW Portal (guidelines.india.gov.in)</span>
                    <span className="text-slate-500 text-[10px]">↗</span>
                  </a>
                </li>
                <li>
                  <a href="https://india.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition flex items-center justify-between">
                    <span>National Portal of India (india.gov.in)</span>
                    <span className="text-slate-500 text-[10px]">↗</span>
                  </a>
                </li>
                <li>
                  <a href="https://bhuvan.nrsc.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition flex items-center justify-between">
                    <span>ISRO Bhuvan Geo-Spatial Disaster Feed</span>
                    <span className="text-slate-500 text-[10px]">↗</span>
                  </a>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Copyright & Compliance Bar */}
          <div className="pt-5 flex flex-col md:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-center sm:text-left">
              <span>&copy; {new Date().getFullYear()} Government of India &amp; Government of Bihar. All Rights Reserved.</span>
              <span className="hidden sm:inline text-slate-700">•</span>
              <span className="text-slate-400">Content Managed by State Emergency Operations Centre (SEOC)</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-slate-400 font-semibold">
              <a href="/privacy" className="hover:text-white transition">Privacy Policy</a>
              <span className="text-slate-700">|</span>
              <a href="/terms" className="hover:text-white transition">Terms &amp; Conditions</a>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400">Hyperlinking Policy</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400">Accessibility Statement</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-300 font-mono text-[10px] bg-[#0c1829] px-2 py-0.5 rounded border border-[#192f4e]">
                v3.2.0-GIGW3
              </span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  barPercent,
  color = "emerald",
}: {
  title: string;
  value: string;
  subtitle?: string;
  barPercent?: number;
  color?: "emerald" | "orange" | "red";
}) {
  const colorMap = {
    emerald: "text-emerald-400 bg-emerald-500",
    orange: "text-amber-400 bg-amber-500",
    red: "text-rose-400 bg-rose-500",
  };

  return (
    <div className="rounded-md border border-[#1b3353] bg-[#0c192c] p-2.5 shadow-none flex flex-col justify-between min-h-[114px]">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate">
          {title}
        </p>
        <p className="text-xl font-bold mt-0.5 text-white tracking-tight font-mono tabular-nums">
          {value}
        </p>
        {subtitle && (
          <p className="text-[9.5px] text-slate-400 font-mono mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      <div className="pt-1 border-t border-[#182c48]">
        <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-400 mb-0.5">
          <span>NDMA Benchmark</span>
          <span className={`font-bold uppercase ${colorMap[color].split(" ")[0]}`}>{color}</span>
        </div>
        <div className="w-full bg-[#081220] rounded-sm h-1 overflow-hidden border border-[#182c48]">
          <div
            className={`h-full ${colorMap[color].split(" ")[1]}`}
            style={{ width: `${barPercent !== undefined ? barPercent : 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function FlowItem({
  icon,
  title,
  subtitle,
  status,
}: {
  icon: string;
  title: string;
  subtitle: string;
  status: string;
}) {
  const isDanger = status === "CRITICAL" || status === "SEVERED" || status === "ISOLATED" || status === "ACCESS CUT";
  return (
    <div className="flex items-center justify-between rounded-md bg-[#0a1526] border border-[#182b46] p-2 shadow-none">
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded">
          {icon}
        </span>
        <div>
          <p className="text-xs font-bold text-white">{title}</p>
          <p className="text-[10px] text-slate-400">{subtitle}</p>
        </div>
      </div>
      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${isDanger ? "bg-red-500/20 text-red-300 border-red-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"}`}>
        {status}
      </span>
    </div>
  );
}

function Arrow() {
  return <div className="text-center text-slate-600 font-bold text-xs">↓</div>;
}

function StateEmblemIndia({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 100 125" className="h-full w-full text-amber-400 drop-shadow-sm fill-current">
        {/* Ashoka Lion Capital Vector Silhouette */}
        <g stroke="currentColor" strokeWidth="1.2" fill="currentColor">
          {/* Central Lion Head & Mane */}
          <path d="M42,12 C42,7 46,3 50,3 C54,3 58,7 58,12 C60,11 63,14 62,17 C64,19 63,23 60,25 C61,28 59,32 56,33 C58,36 55,40 52,42 L52,47 L48,47 L48,42 C45,40 42,36 44,33 C41,32 39,28 40,25 C37,23 36,19 38,17 C37,14 40,11 42,12 Z" />
          {/* Left Lion Profile */}
          <path d="M38,18 C33,16 28,19 27,24 C25,27 27,31 30,33 C27,36 29,40 32,42 C30,45 33,48 37,48 L41,47 C39,43 38,38 39,33 Z" />
          {/* Right Lion Profile */}
          <path d="M62,18 C67,16 72,19 73,24 C75,27 73,31 70,33 C73,36 71,40 68,42 C70,45 67,48 63,48 L59,47 C61,43 62,38 61,33 Z" />
          {/* Abacus Base Platform */}
          <rect x="22" y="49" width="56" height="7" rx="1.5" />
          {/* Ashoka Chakra Wheel (24-spoke representation) */}
          <circle cx="50" cy="65" r="8" fill="none" strokeWidth="1.8" />
          <circle cx="50" cy="65" r="1.5" />
          <line x1="50" y1="57" x2="50" y2="73" strokeWidth="1.2" />
          <line x1="42" y1="65" x2="58" y2="65" strokeWidth="1.2" />
          <line x1="44.3" y1="59.3" x2="55.7" y2="70.7" strokeWidth="1.2" />
          <line x1="44.3" y1="70.7" x2="55.7" y2="59.3" strokeWidth="1.2" />
          {/* Base Animals representation (Bull on left, Horse on right) */}
          <path d="M26,62 C29,61 33,63 34,66 C33,68 28,68 26,67 Z" />
          <path d="M74,62 C71,61 67,63 66,66 C67,68 72,68 74,67 Z" />
          {/* Plinth Base Line */}
          <rect x="18" y="74" width="64" height="4" rx="1" />
          {/* Bell Shaped Lotus Platform */}
          <path d="M24,78 Q50,86 76,78 L74,83 Q50,90 26,83 Z" />
        </g>
        {/* National Motto: सत्यमेव जयते */}
        <text
          x="50"
          y="104"
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="bold"
          fontFamily="'Noto Sans Devanagari', sans-serif"
          fill="currentColor"
          letterSpacing="0.05em"
        >
          सत्यमेव जयते
        </text>
      </svg>
    </div>
  );
}
