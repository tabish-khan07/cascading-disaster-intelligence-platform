"use client";

import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import {
    MapContainer,
    TileLayer,
    Marker,
    Circle,
    Polyline,
    Polygon,
    Rectangle,
    Popup,
    Tooltip,
    useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
    SpatialGridCell,
    SectorData,
    TimeHorizon,
    getSectorInfrastructure,
} from "../data/spatialGrid";

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

type Props = {
    floodActive: boolean;
    allocation: Allocation[];
    affectedVillages: string[];
    affectedRoads: string[];
    affectedHospitals: string[];
    spatialGrid?: SpatialGridCell[];
    showSpatialGrid?: boolean;
    center?: [number, number];
    zoom?: number;
    activeLocationName?: string;
    activeLocationId?: string;
    liveTelemetry?: {
        rainfall_mm: number;
        water_level_m: number;
        barrage_status?: {
            alert_level: string;
            estimated_level_m: number;
            danger_level_m?: number;
            warning_level_m?: number;
        };
        sensor_readings?: {
            temperature_c?: number;
            humidity_pct?: number;
            wind_speed_kmh?: number;
            current_rain_mm_per_hr?: number;
            weather_description?: string;
        };
    };
    dataFreshness?: {
        generated_at: string;
        age_seconds: number;
        source: string;
        layers?: Record<string, string>;
    };
    onSelectLocation?: (locationId: string) => void;
    onUseDeviceGPS?: () => void;
    timeHorizon?: TimeHorizon;
    onTimeHorizonChange?: (horizon: TimeHorizon) => void;
    initialRoutingMode?: "CIVILIAN" | "EMERGENCY";
    onRoutingModeChange?: (mode: "CIVILIAN" | "EMERGENCY") => void;
    shelterStatus?: {
        id: string;
        name: string;
        capacity: number;
        occupied: number;
        occupancy_pct: number;
        food_remaining_days?: number;
        water_liters?: number;
        medical_kits?: number;
        status: string;
    }[];
    shelterOverflow?: {
        status: string;
        total_capacity: number;
        total_occupied: number;
        overflow_population: number;
        recommended_actions: string[];
    } | null;
    isDegradedMode?: boolean;
    degradedAsOfTime?: string;
    onRetryConnection?: () => void;
    mode?: "historical" | "simulation" | "live";
    historicalStage?: {
        stage: number;
        totalStages: number;
        label: string;
        time: string;
        rainfall_mm: number;
        water_level_m: number;
        satellite_pass: string;
    };
    simulationParams?: {
        rainfall: number;
        duration: number;
        waterLevel: number;
    };
    onAdvanceHistoryStage?: (stageIndex: number) => void;
};

type InspectedAsset = {
    id: string;
    title: string;
    category: "VILLAGE" | "HOSPITAL" | "SHELTER" | "UTILITY" | "ROAD" | "ROUTE" | "AIR_OPS" | "HYDRO_GAUGE";
    badgeText: string;
    badgeColor: string;
    subtitle: string;
    status: string;
    metrics: { label: string; value: string | number }[];
    notes?: string;
};

function MapRecenter({ center, zoom }: { center?: [number, number]; zoom?: number }) {
    const map = useMap();
    const prevCoordsKey = useRef<string>("");

    useEffect(() => {
        const t1 = setTimeout(() => {
            try { map.invalidateSize(); } catch (_) {}
        }, 150);
        const t2 = setTimeout(() => {
            try { map.invalidateSize(); } catch (_) {}
        }, 500);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [map]);

    useEffect(() => {
        if (!center || typeof center[0] !== "number" || typeof center[1] !== "number") return;
        const coordKey = `${center[0].toFixed(3)},${center[1].toFixed(3)}`;

        if (prevCoordsKey.current && prevCoordsKey.current !== coordKey) {
            try {
                map.flyTo(center, zoom || 14, { duration: 1.5 });
            } catch (_) {}
        }
        prevCoordsKey.current = coordKey;
    }, [center ? center[0] : null, center ? center[1] : null, zoom, map]);

    return null;
}

const BASEMAPS = {
    satellite: {
        name: "Satellite",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "&copy; Esri, Maxar",
    },
    dark: {
        name: "Dark Surface",
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution: "&copy; CARTO",
    },
    osm: {
        name: "Streets",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: "&copy; OpenStreetMap",
    },
};

const OPERATIONAL_SECTORS = [
    { id: "barauni", label: "Barauni - Sultanganj (Command HQ)", region: "Begusarai, Bihar", desc: "Ganga River Main Channel & Sector Perimeter" },
    { id: "diara", label: "Sultanganj Diara River Island", region: "V2 Island Cluster", desc: "Severely Flood-Prone Diara (IRB Boat Evac Only)" },
    { id: "bund", label: "Embankment Ring Bund (KM 12-18)", region: "NH-31 Highway Defense", desc: "Reinforced Geotextile Armor & Seepage Watch" },
    { id: "manjhaul", label: "Manjhaul Lowlands Wetland Basin", region: "V3 Wetland Settlement", desc: "Southern Drainage Bottleneck & CHC Base" },
    { id: "railhead", label: "Barauni Industrial Railhead Yard", region: "Staging Terminal", desc: "Strategic Fuel, Ration & S1 School Shelter Hub" },
];

function getGridColor(score: number): { fill: string; stroke: string; opacity: number } {
    if (score >= 0.75) return { fill: "#dc2626", stroke: "#ef4444", opacity: 0.45 };
    if (score >= 0.50) return { fill: "#ea580c", stroke: "#f97316", opacity: 0.35 };
    if (score >= 0.30) return { fill: "#ca8a04", stroke: "#eab308", opacity: 0.25 };
    return { fill: "#059669", stroke: "#10b981", opacity: 0.15 };
}

/**
 * Resolves Google-Maps style multi-point turn-by-turn navigation waypoints
 * following the verified road network graph or watercraft fairway corridor.
 */
function getGoogleMapsRoutePath(
    sector: SectorData,
    from: [number, number],
    to: [number, number],
    villageId: string,
    resource: string,
    isWatercraft: boolean
): [number, number][] {
    // 1. Watercraft IRB (Rescue Boat): navigates via the water launch jetty & river fairway corridor
    if (isWatercraft) {
        if (sector.id === "barauni") {
            const jetty: [number, number] = sector.utilities?.G1?.coords || [25.1500, 85.9450];
            return [
                from,
                jetty,
                [25.1525, 85.9490],
                [25.1555, 85.9525],
                [25.1580, 85.9550],
                to
            ];
        } else {
            const midLat = (from[0] + to[0]) / 2 + 0.002;
            const midLon = (from[1] + to[1]) / 2 - 0.002;
            return [from, [midLat, midLon], to];
        }
    }

    // 2. Road Ambulance dispatch in Barauni sector: snaps to exact road polyline segments
    if (sector.id === "barauni") {
        if (villageId === "V1" && sector.roads.R1) {
            // A1 to Pipra Dewas via NH-31
            return sector.roads.R1.positions.slice(0, 6);
        }
        if (villageId === "V4" && sector.roads.R4) {
            // A1 to Mohanpur West via Pond Embankment road
            return sector.roads.R4.positions.slice(0, 6);
        }
        if (villageId === "V3" && sector.roads.R3) {
            // A3 to Manjhaul Lowlands via MDR-14
            return sector.roads.R3.positions.slice(0, 4);
        }
        if (villageId === "V5" && sector.roads.R5) {
            // A2 to Rampur Ghat Diara via R5
            return sector.roads.R5.positions.slice(0, 3);
        }
    }

    // 3. For any other sector, check if any road connects near 'from' to near 'to':
    for (const road of Object.values(sector.roads)) {
        const pts = road.positions;
        if (pts.length >= 2) {
            const startDist = Math.hypot(pts[0][0] - from[0], pts[0][1] - from[1]);
            const endDist = Math.hypot(pts[pts.length - 1][0] - to[0], pts[pts.length - 1][1] - to[1]);
            if (startDist < 0.008 && endDist < 0.008) {
                return pts;
            }
        }
    }

    // 4. Default: realistic 90-degree street turn navigation path instead of piercing diagonal chord
    const intermediate: [number, number] = [from[0], to[1]];
    return [from, intermediate, to];
}

export interface CorridorOption {
    mode: string;
    safetyScore: string;
    distanceKm: number;
    transitTimeMin: number;
    elevationSafetyGain: string;
    routeStrategy: string;
    waypoints: [number, number][];
}

export interface SettlementCorridorRecord {
    originName: string;
    targetShelterId: string;
    targetShelterName: string;
    mode: string;
    safetyScore: string;
    distanceKm: number;
    transitTimeMin: number;
    elevationSafetyGain: string;
    waypoints: [number, number][];
    civilian: CorridorOption;
    emergency: CorridorOption;
}

export const EVACUATION_CORRIDORS: Record<string, SettlementCorridorRecord> = {
    V1: {
        originName: "Pipra Dewas (V1)",
        targetShelterId: "S1",
        targetShelterName: "Rajkiya Uchh Vidyalaya (S1)",
        mode: "Overland via High Ring Bund Crest (KM 14)",
        safetyScore: "100% DRY EMBANKMENT (Zero Flood Exposure)",
        distanceKm: 2.1,
        transitTimeMin: 26,
        elevationSafetyGain: "+14.2m above flood level",
        waypoints: [
            [25.1520, 85.9470],
            [25.1512, 85.9445],
            [25.1500, 85.9420],
            [25.1488, 85.9400],
            [25.1480, 85.9380],
        ],
        civilian: {
            mode: "Overland via High Ring Bund Crest (KM 14)",
            safetyScore: "100% DRY EMBANKMENT (Zero Flood Exposure)",
            distanceKm: 2.1,
            transitTimeMin: 26,
            elevationSafetyGain: "+14.2m above flood level",
            routeStrategy: "Conservative High Ground Levee Walkway / Bus Shuttles",
            waypoints: [
                [25.1520, 85.9470],
                [25.1512, 85.9445],
                [25.1500, 85.9420],
                [25.1488, 85.9400],
                [25.1480, 85.9380],
            ],
        },
        emergency: {
            mode: "Tactical Rapid Bypass Spur (NH-31 Feeder Cut)",
            safetyScore: "SHALLOW WATER RUN (Speed Priority / Heavy 4x4)",
            distanceKm: 1.3,
            transitTimeMin: 6,
            elevationSafetyGain: "+8.5m clearance",
            routeStrategy: "High-Clearance Ambulance / NDRF Tactical Rapid Access",
            waypoints: [
                [25.1520, 85.9470],
                [25.1500, 85.9440],
                [25.1480, 85.9380],
            ],
        },
    },
    V2: {
        originName: "Sultanganj Diara River Island (V2)",
        targetShelterId: "S1",
        targetShelterName: "Rajkiya Uchh Vidyalaya (S1)",
        mode: "Supervised Evacuation Ferry -> North High Bund -> S1 High Ground",
        safetyScore: "SUPERVISED CIVILIAN EMBARKATION (Barge Freeboard Safe)",
        distanceKm: 3.8,
        transitTimeMin: 35,
        elevationSafetyGain: "+24.0m island-to-shelter rise",
        waypoints: [
            [25.1595, 85.9572],
            [25.1580, 85.9520],
            [25.1540, 85.9480],
            [25.1500, 85.9450],
            [25.1480, 85.9380],
        ],
        civilian: {
            mode: "Supervised Evacuation Ferry -> North High Bund -> S1 High Ground",
            safetyScore: "SUPERVISED CIVILIAN EMBARKATION (Barge Freeboard Safe)",
            distanceKm: 3.8,
            transitTimeMin: 35,
            elevationSafetyGain: "+24.0m island-to-shelter rise",
            routeStrategy: "Capacity-Controlled Civilian Ferry Transport & High Bund Walk",
            waypoints: [
                [25.1595, 85.9572],
                [25.1580, 85.9520],
                [25.1540, 85.9480],
                [25.1500, 85.9450],
                [25.1480, 85.9380],
            ],
        },
        emergency: {
            mode: "Direct Tactical Watercraft Fairway (NDRF IRB Zodiac) -> Barauni Ghat Jetty G1",
            safetyScore: "RAPID RESCUE INSERTION (High-Speed Inflatable IRB)",
            distanceKm: 3.4,
            transitTimeMin: 14,
            elevationSafetyGain: "+24.0m island-to-shelter rise",
            routeStrategy: "NDRF Zodiac High-Speed Ingress & Casualty Extraction",
            waypoints: [
                [25.1595, 85.9572],
                [25.1560, 85.9530],
                [25.1525, 85.9490],
                [25.1500, 85.9450],
                [25.1480, 85.9380],
            ],
        },
    },
    V3: {
        originName: "Manjhaul Lowlands (V3)",
        targetShelterId: "S2",
        targetShelterName: "Manjhaul Panchayat Bhawan (S2)",
        mode: "Elevated MDR-14 Causeway Bund (Avoids Submerged Road R3)",
        safetyScore: "ELEVATED ARTERIAL ROAD (100% Dry Footing)",
        distanceKm: 1.5,
        transitTimeMin: 18,
        elevationSafetyGain: "+8.5m wetland rise",
        waypoints: [
            [25.1370, 85.9515],
            [25.1360, 85.9525],
            [25.1350, 85.9535],
            [25.1335, 85.9550],
            [25.1320, 85.9560],
        ],
        civilian: {
            mode: "Elevated MDR-14 Causeway Bund (Avoids Submerged Road R3)",
            safetyScore: "ELEVATED ARTERIAL ROAD (100% Dry Footing)",
            distanceKm: 1.5,
            transitTimeMin: 18,
            elevationSafetyGain: "+8.5m wetland rise",
            routeStrategy: "Perimeter Levee Causeway Bypassing Submerged R3",
            waypoints: [
                [25.1370, 85.9515],
                [25.1360, 85.9525],
                [25.1350, 85.9535],
                [25.1335, 85.9550],
                [25.1320, 85.9560],
            ],
        },
        emergency: {
            mode: "Direct Flooded Access Cut (Submerged Road R3 Fording Allowed)",
            safetyScore: "HIGH-WATER FORDING (Heavy Ambulance / 4x4 NDRF Only)",
            distanceKm: 0.9,
            transitTimeMin: 4,
            elevationSafetyGain: "+4.0m wetland rise",
            routeStrategy: "Tactical Direct Fording Through 0.8m Surged Water",
            waypoints: [
                [25.1370, 85.9515],
                [25.1340, 85.9540],
                [25.1320, 85.9560],
            ],
        },
    },
    V4: {
        originName: "Begusarai Rural (V4)",
        targetShelterId: "S1",
        targetShelterName: "Rajkiya Uchh Vidyalaya (S1)",
        mode: "NH-31 Southern Access Spur (Full Grade-Separated Pedestrian Flank)",
        safetyScore: "ALL-WEATHER HIGHWAY EMBANKMENT (Zero Inundation)",
        distanceKm: 1.6,
        transitTimeMin: 20,
        elevationSafetyGain: "+12.0m grade clearance",
        waypoints: [
            [25.1480, 85.9500],
            [25.1480, 85.9440],
            [25.1480, 85.9380],
        ],
        civilian: {
            mode: "NH-31 Southern Access Spur (Full Grade-Separated Pedestrian Flank)",
            safetyScore: "ALL-WEATHER HIGHWAY EMBANKMENT (Zero Inundation)",
            distanceKm: 1.6,
            transitTimeMin: 20,
            elevationSafetyGain: "+12.0m grade clearance",
            routeStrategy: "High-Ground Protected Pedestrian Sidewalk & Bus Lane",
            waypoints: [
                [25.1480, 85.9500],
                [25.1480, 85.9440],
                [25.1480, 85.9380],
            ],
        },
        emergency: {
            mode: "Direct High-Speed Highway Express Corridor",
            safetyScore: "PRIORITY EMERGENCY VEHICLE CLEARANCE",
            distanceKm: 1.2,
            transitTimeMin: 3,
            elevationSafetyGain: "+12.0m grade clearance",
            routeStrategy: "Code-3 High-Speed Ambulance / First Responder Direct Corridor",
            waypoints: [
                [25.1480, 85.9500],
                [25.1480, 85.9380],
            ],
        },
    },
    V5: {
        originName: "Rajendra Bridge Embankment (V5)",
        targetShelterId: "S2",
        targetShelterName: "Manjhaul Panchayat Bhawan (S2)",
        mode: "Rail Viaduct Protected Service Embankment to Manjhaul (S2)",
        safetyScore: "REINFORCED BALLAST CREST (Dry Pedestrian Causeway)",
        distanceKm: 3.2,
        transitTimeMin: 38,
        elevationSafetyGain: "+18.0m flood levee height",
        waypoints: [
            [25.1430, 85.9620],
            [25.1400, 85.9590],
            [25.1360, 85.9575],
            [25.1320, 85.9560],
        ],
        civilian: {
            mode: "Rail Viaduct Protected Service Embankment to Manjhaul (S2)",
            safetyScore: "REINFORCED BALLAST CREST (Dry Pedestrian Causeway)",
            distanceKm: 3.2,
            transitTimeMin: 38,
            elevationSafetyGain: "+18.0m flood levee height",
            routeStrategy: "Engineered Levee Ballast Walkway Shielded from Inundation",
            waypoints: [
                [25.1430, 85.9620],
                [25.1400, 85.9590],
                [25.1360, 85.9575],
                [25.1320, 85.9560],
            ],
        },
        emergency: {
            mode: "Rail Access Road & Levee Spur Direct Intercept",
            safetyScore: "TACTICAL INTERCEPT (High-Speed Embankment Ramp)",
            distanceKm: 2.1,
            transitTimeMin: 7,
            elevationSafetyGain: "+14.0m flood levee height",
            routeStrategy: "Direct Rapid Ingress via Heavy Duty Maintenance Ramp",
            waypoints: [
                [25.1430, 85.9620],
                [25.1380, 85.9580],
                [25.1320, 85.9560],
            ],
        },
    },
};

export const PRE_IDENTIFIED_OVERFLOW_SITES = [
    {
        id: "S_OVF1",
        name: "Barauni Degree College Stadium Overflow Relief Site",
        shortName: "Barauni Stadium",
        type: "Pre-Identified DDMA / BSDMA Auxiliary High-Ground Tented Camp",
        capacity: 2500,
        coords: [25.1450, 85.9320] as [number, number],
        authority: "DDMA Begusarai / BSDMA",
        elevationGain: "+18.5m high-ground clearance",
    },
    {
        id: "S_OVF2",
        name: "Manjhaul Block Sports Complex Overflow Ground",
        shortName: "Manjhaul Complex",
        type: "Emergency Pre-Surveyed Dry High-Ground Overflow Site",
        capacity: 2000,
        coords: [25.1310, 85.9420] as [number, number],
        authority: "BSDMA / NDRF 9th Bn",
        elevationGain: "+15.0m embankment clearance",
    },
];

export interface AirOpsAsset {
    id: string;
    name: string;
    shortName: string;
    type: "HELIPAD" | "EMERGENCY_LZ" | "AIRDROP_DZ";
    coords: [number, number];
    elevationMSL: number;
    dimensions: string;
    capacity: string;
    vhfComms: string;
    authority: string;
    status: string;
    runwayOrSurface: string;
    notes: string;
}

export const AIR_OPERATIONS_ASSETS: AirOpsAsset[] = [
    {
        id: "H_LZ1",
        name: "Barauni Industrial Refinery Strategic Helipad",
        shortName: "Helipad H-LZ1",
        type: "HELIPAD",
        coords: [25.1420, 85.9350],
        elevationMSL: 52.0,
        dimensions: "35m x 35m Concrete Pad",
        capacity: "IAF Mi-17 V5 / ALH Dhruv (13,000 kg MTOW)",
        vhfComms: "VHF Air Band 123.45 MHz (Callsign: BARAUNI TOWER)",
        authority: "Indian Air Force 11 Sqn / IOCL Aviation Wing",
        status: "OPERATIONAL / ALL-WEATHER",
        runwayOrSurface: "Reinforced Concrete / High-Vis Perimeter Lighting",
        notes: "Primary staging airfield for rotary-wing casualty evacuation and NDRF tactical team insertion. Elevated +17.5m above flood datum.",
    },
    {
        id: "H_LZ2",
        name: "Manjhaul High Ground Emergency Relief LZ",
        shortName: "LZ H-LZ2",
        type: "EMERGENCY_LZ",
        coords: [25.1330, 85.9460],
        elevationMSL: 49.2,
        dimensions: "25m x 25m Cleared High Ground",
        capacity: "ALH Dhruv / Cheetah Light Utility (5,500 kg MTOW)",
        vhfComms: "VHF Tactical 121.50 MHz / HF Net 7.345 MHz",
        authority: "BSDMA / NDRF 9th Battalion",
        status: "STANDBY FOR CASUALTY EVAC",
        runwayOrSurface: "Compacted Dry Turf / Geotextile Perimeter Markers",
        notes: "Forward emergency landing zone for airlifting critical trauma patients from Manjhaul Community Health Centre CHC-3.",
    },
    {
        id: "DZ_1",
        name: "Sultanganj Diara Aerial Airdrop Drop Zone",
        shortName: "Drop Zone DZ-1",
        type: "AIRDROP_DZ",
        coords: [25.1610, 85.9590],
        elevationMSL: 34.2,
        dimensions: "120m x 80m Sandy Diara Clearing",
        capacity: "Low-Altitude Gravity Roll / Freefall Cargo Delivery",
        vhfComms: "NDRF Field PTT Channel 4 (438.125 MHz)",
        authority: "District Collectorate / IAF Joint Air Ops Cell",
        status: "ACTIVE DROP TARGET",
        runwayOrSurface: "Alluvial Floodplain / Orange Day-Glo Target Cross",
        notes: "Designated coordinates for IAF Mi-17 airdrops of sealed food rations, water purification sachets, and ORS kits to marooned islanders.",
    },
];

export const CWC_HYDRO_STATION = {
    id: "CWC_GANGA_64B",
    name: "CWC Sultanganj-Barauni River Hydro-Telemetry Station",
    shortName: "CWC Gauge Ganga-64B",
    coords: [25.1550, 85.9520] as [number, number],
    dangerLevelM: 34.50,
    warningLevelM: 34.00,
    highFloodLevelM: 37.10,
    currentLevelM: 36.85,
    rateOfRiseCmHr: 3.8,
    riverVelocityMs: 2.2,
    dischargeCumecs: 42500,
    status: "CRITICAL FLOOD STAGE",
    authority: "Central Water Commission (CWC) Middle Ganga Division",
};

export type OperationalAssetType = "SHELTER" | "HOSPITAL" | "AMBULANCE" | "RESCUE_BOAT" | "CWC_GAUGE";
export type OperationalStatusColor = "green" | "amber" | "red" | "grey";

function createOperationalIcon(
    type: OperationalAssetType,
    status: OperationalStatusColor
) {
    const statusMap = {
        green: {
            border: "#10b981",
            bg: "#042315",
            dot: "#10b981",
            svgFill: "#34d399",
            glow: "0 0 6px rgba(16, 185, 129, 0.45)",
        },
        amber: {
            border: "#f59e0b",
            bg: "#261304",
            dot: "#f59e0b",
            svgFill: "#fbbf24",
            glow: "0 0 6px rgba(245, 158, 11, 0.45)",
        },
        red: {
            border: "#ef4444",
            bg: "#2b070d",
            dot: "#ef4444",
            svgFill: "#f87171",
            glow: "0 0 6px rgba(239, 68, 68, 0.45)",
        },
        grey: {
            border: "#64748b",
            bg: "#0f172a",
            dot: "#64748b",
            svgFill: "#94a3b8",
            glow: "none",
        },
    }[status];

    let svgIcon = "";
    if (type === "HOSPITAL") {
        svgIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${statusMap.svgFill}"><path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/></svg>`;
    } else if (type === "SHELTER") {
        svgIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${statusMap.svgFill}"><path d="M12 3L2 12h3v8h14v-8h3L12 3zm0 4.5l5 4.5v6h-3v-4H10v4H7v-6l5-4.5z"/></svg>`;
    } else if (type === "AMBULANCE") {
        svgIcon = `<svg width="15" height="12" viewBox="0 0 24 24" fill="${statusMap.svgFill}"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/><path d="M11 7.5h2v2h2v2h-2v2h-2v-2H9v-2h2z"/></svg>`;
    } else if (type === "RESCUE_BOAT") {
        svgIcon = `<svg width="15" height="12" viewBox="0 0 24 24" fill="${statusMap.svgFill}"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 15.28L2.05 16.5C3.39 18.59 5.67 20 8.24 20h7.52c2.57 0 4.85-1.41 6.19-3.5l-1.9-1.22c-.93 1.45-2.52 2.42-4.29 2.42H8.24c-1.77 0-3.36-.97-4.29-2.42zM12 2L6 14h12L12 2zm0 3.5l3.25 6.5h-6.5L12 5.5z"/></svg>`;
    } else {
        svgIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${statusMap.svgFill}"><path d="M12 2c-5.33 4-8 8-8 12 0 4.42 3.58 8 8 8s8-3.58 8-8c0-4-2.67-8-8-12zm0 18c-3.31 0-6-2.69-6-6 0-2.97 2.16-6.19 6-9.15 3.84 2.96 6 6.18 6 9.15 0 3.31-2.69 6-6 6z"/></svg>`;
    }

    const isBox = type === "AMBULANCE" || type === "RESCUE_BOAT";
    const borderRadius = isBox ? "6px" : "50%";

    const html = `
        <div style="
            width: 26px;
            height: 26px;
            border-radius: ${borderRadius};
            background: ${statusMap.bg};
            border: 2px solid ${statusMap.border};
            box-shadow: ${statusMap.glow};
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            cursor: pointer;
        ">
            ${svgIcon}
            <span style="
                position: absolute;
                top: -3px;
                right: -3px;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: ${statusMap.dot};
                border: 1px solid #000;
            "></span>
        </div>
    `;

    return L.divIcon({
        className: "operational-asset-marker",
        html,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -14],
    });
}

function getOperationalTooltipClass(status: OperationalStatusColor): string {
    switch (status) {
        case "green":
            return "tooltip-asset-ready";
        case "amber":
            return "tooltip-asset-enroute";
        case "red":
            return "tooltip-asset-busy";
        case "grey":
        default:
            return "tooltip-asset-offline";
    }
}

// Tactical Geodesic & Navigation Helpers
function calculateHaversineDistanceKm(from: [number, number], to: [number, number]): number {
    const R = 6371; // Earth radius in km
    const dLat = ((to[0] - from[0]) * Math.PI) / 180;
    const dLon = ((to[1] - from[1]) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((from[0] * Math.PI) / 180) *
            Math.cos((to[0] * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
}

function calculateCompassBearing(from: [number, number], to: [number, number]): number {
    const y = Math.sin(((to[1] - from[1]) * Math.PI) / 180) * Math.cos((to[0] * Math.PI) / 180);
    const x =
        Math.cos((from[0] * Math.PI) / 180) * Math.sin((to[0] * Math.PI) / 180) -
        Math.sin((from[0] * Math.PI) / 180) *
            Math.cos((to[0] * Math.PI) / 180) *
            Math.cos(((to[1] - from[1]) * Math.PI) / 180);
    const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    return Math.round(brng);
}

function formatDMS(deg: number, isLat: boolean): string {
    const absolute = Math.abs(deg);
    const d = Math.floor(absolute);
    const m = Math.floor((absolute - d) * 60);
    const s = Math.round((absolute - d - m / 60) * 3600);
    const dir = isLat ? (deg >= 0 ? "N" : "S") : deg >= 0 ? "E" : "W";
    return `${d}°${m.toString().padStart(2, "0")}'${s.toString().padStart(2, "0")}"${dir}`;
}

function MapInteractionTracker({
    caliperActive,
    onCaliperClick,
    onCursorMove,
}: {
    caliperActive: boolean;
    onCaliperClick: (coords: [number, number]) => void;
    onCursorMove: (coords: { lat: number; lng: number } | null) => void;
}) {
    const map = useMap();
    useEffect(() => {
        const handleClick = (e: any) => {
            if (caliperActive && e.latlng) {
                onCaliperClick([e.latlng.lat, e.latlng.lng]);
            }
        };
        const handleMove = (e: any) => {
            if (e.latlng) {
                onCursorMove({ lat: e.latlng.lat, lng: e.latlng.lng });
            }
        };
        const handleOut = () => {
            onCursorMove(null);
        };
        map.on("click", handleClick);
        map.on("mousemove", handleMove);
        map.on("mouseout", handleOut);
        return () => {
            map.off("click", handleClick);
            map.off("mousemove", handleMove);
            map.off("mouseout", handleOut);
        };
    }, [map, caliperActive, onCaliperClick, onCursorMove]);
    return null;
}

export default function DisasterMap({
    floodActive = false,
    allocation = [],
    affectedVillages = [],
    affectedRoads = [],
    affectedHospitals = [],
    spatialGrid = [],
    showSpatialGrid = false,
    center = [25.148, 85.950],
    zoom = 14,
    activeLocationName = "Barauni-Sultanganj Study Zone",
    activeLocationId = "barauni",
    liveTelemetry,
    dataFreshness,
    onSelectLocation,
    onUseDeviceGPS,
    timeHorizon: propTimeHorizon,
    onTimeHorizonChange,
    initialRoutingMode,
    onRoutingModeChange,
    shelterStatus,
    shelterOverflow,
    isDegradedMode = false,
    degradedAsOfTime,
    onRetryConnection,
    mode = "live",
    historicalStage,
    simulationParams,
    onAdvanceHistoryStage,
}: Props) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    // Cache management for degraded/offline resilience
    const cachedMapStateRef = useRef<{
        allocation: Allocation[];
        affectedVillages: string[];
        affectedRoads: string[];
        affectedHospitals: string[];
        shelterStatus: any[];
        shelterOverflow: any;
        spatialGrid: SpatialGridCell[];
        timestamp: string;
    }>({
        allocation: [
            {
                resource: "A1",
                resource_type: "AMBULANCE",
                dispatch_mode: "ROAD_AMBULANCE",
                village_id: "V1",
                village_name: "Pipra Dewas",
                priority_score: 0.82,
                priority_level: "CRITICAL",
                population: 5420,
                distance_km: 2.2,
                estimated_travel_time_min: 7,
                assignment_score: 85,
                reason: "CRITICAL priority at Pipra Dewas, 5,420 exposed, dispatch via ROAD_AMBULANCE, ETA: 7 min",
            },
            {
                resource: "RB1",
                resource_type: "RESCUE_BOAT",
                dispatch_mode: "WATERCRAFT_IRB",
                village_id: "V2",
                village_name: "Sultanganj Diara",
                priority_score: 0.94,
                priority_level: "CRITICAL",
                population: 7850,
                distance_km: 4.8,
                estimated_travel_time_min: 19,
                assignment_score: 92,
                reason: "CRITICAL priority at Sultanganj Diara, 7,850 exposed, dispatch via WATERCRAFT_IRB, ETA: 19 min",
            },
        ],
        affectedVillages: ["V1", "V2"],
        affectedRoads: ["R1"],
        affectedHospitals: ["H1"],
        shelterStatus: [
            {
                id: "S1",
                name: "Rajkiya Uchh Vidyalaya (High-Ground Relief Camp)",
                capacity: 850,
                occupied: 850,
                occupancy_pct: 100,
                food_remaining_days: 1.5,
                water_liters: 8500,
                medical_kits: 12,
                status: "CRITICAL_SHORTAGE",
            },
            {
                id: "S2",
                name: "Manjhaul Block Panchayat Bhawan",
                capacity: 600,
                occupied: 600,
                occupancy_pct: 100,
                food_remaining_days: 1.25,
                water_liters: 5000,
                medical_kits: 8,
                status: "CRITICAL_SHORTAGE",
            },
        ],
        shelterOverflow: {
            status: "CAPACITY_EXCEEDED",
            total_capacity: 1450,
            total_occupied: 1450,
            overflow_population: 24470,
            recommended_actions: [
                "Activate pre-identified overflow / temporary relief sites",
                "Request additional tents / temporary shelters from DDMA / BSDMA",
                "Prioritise most vulnerable (elderly, children, medical cases) for remaining spaces",
                "Update public messaging to direct new arrivals to overflow locations",
            ],
        },
        spatialGrid: [],
        timestamp: "18:45",
    });

    // Continuously update memory and localStorage cache when live data arrives
    useEffect(() => {
        if (allocation && allocation.length > 0) {
            cachedMapStateRef.current.allocation = allocation;
        }
        if (affectedVillages && affectedVillages.length > 0) {
            cachedMapStateRef.current.affectedVillages = affectedVillages;
        }
        if (affectedRoads && affectedRoads.length > 0) {
            cachedMapStateRef.current.affectedRoads = affectedRoads;
        }
        if (affectedHospitals && affectedHospitals.length > 0) {
            cachedMapStateRef.current.affectedHospitals = affectedHospitals;
        }
        if (shelterStatus && shelterStatus.length > 0) {
            cachedMapStateRef.current.shelterStatus = shelterStatus;
        }
        if (shelterOverflow) {
            cachedMapStateRef.current.shelterOverflow = shelterOverflow;
        }
        if (spatialGrid && spatialGrid.length > 0) {
            cachedMapStateRef.current.spatialGrid = spatialGrid;
        }
        const now = new Date();
        const hh = now.getHours().toString().padStart(2, "0");
        const mm = now.getMinutes().toString().padStart(2, "0");
        cachedMapStateRef.current.timestamp = `${hh}:${mm}`;

        try {
            if (typeof window !== "undefined" && (allocation?.length || affectedVillages?.length)) {
                localStorage.setItem("disaster_map_cache", JSON.stringify({
                    allocation: cachedMapStateRef.current.allocation,
                    affectedVillages: cachedMapStateRef.current.affectedVillages,
                    affectedRoads: cachedMapStateRef.current.affectedRoads,
                    affectedHospitals: cachedMapStateRef.current.affectedHospitals,
                    shelterStatus: cachedMapStateRef.current.shelterStatus,
                    shelterOverflow: cachedMapStateRef.current.shelterOverflow,
                    timestamp: `${hh}:${mm}`,
                }));
            }
        } catch (_) {}
    }, [allocation, affectedVillages, affectedRoads, affectedHospitals, shelterStatus, shelterOverflow, spatialGrid]);

    // Restore from localStorage on initial render
    useEffect(() => {
        try {
            if (typeof window !== "undefined") {
                const saved = localStorage.getItem("disaster_map_cache");
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.allocation?.length) cachedMapStateRef.current.allocation = parsed.allocation;
                    if (parsed.affectedVillages?.length) cachedMapStateRef.current.affectedVillages = parsed.affectedVillages;
                    if (parsed.affectedRoads?.length) cachedMapStateRef.current.affectedRoads = parsed.affectedRoads;
                    if (parsed.affectedHospitals?.length) cachedMapStateRef.current.affectedHospitals = parsed.affectedHospitals;
                    if (parsed.shelterStatus?.length) cachedMapStateRef.current.shelterStatus = parsed.shelterStatus;
                    if (parsed.shelterOverflow) cachedMapStateRef.current.shelterOverflow = parsed.shelterOverflow;
                    if (parsed.timestamp) cachedMapStateRef.current.timestamp = parsed.timestamp;
                }
            }
        } catch (_) {}
    }, []);

    // Resolve effective layer data (live or cached in degraded mode)
    const effectiveAllocations = isDegradedMode && (!allocation || allocation.length === 0)
        ? cachedMapStateRef.current.allocation
        : allocation;

    const effectiveVillages = isDegradedMode && (!affectedVillages || affectedVillages.length === 0)
        ? cachedMapStateRef.current.affectedVillages
        : affectedVillages;

    const effectiveRoads = isDegradedMode && (!affectedRoads || affectedRoads.length === 0)
        ? cachedMapStateRef.current.affectedRoads
        : affectedRoads;

    const effectiveHospitals = isDegradedMode && (!affectedHospitals || affectedHospitals.length === 0)
        ? cachedMapStateRef.current.affectedHospitals
        : affectedHospitals;

    const effectiveShelterStatus = isDegradedMode && (!shelterStatus || shelterStatus.length === 0)
        ? cachedMapStateRef.current.shelterStatus
        : shelterStatus;

    const effectiveShelterOverflow = isDegradedMode && !shelterOverflow
        ? cachedMapStateRef.current.shelterOverflow
        : shelterOverflow;

    const effectiveDegradedTime = degradedAsOfTime || cachedMapStateRef.current.timestamp || "--:--";

    const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>(propTimeHorizon || "now");

    useEffect(() => {
        if (propTimeHorizon) setTimeHorizon(propTimeHorizon);
    }, [propTimeHorizon]);

    const handleHorizonChange = (h: TimeHorizon) => {
        if (isDegradedMode) return;
        setTimeHorizon(h);
        if (onTimeHorizonChange) onTimeHorizonChange(h);
    };

    const [freshnessDisplay, setFreshnessDisplay] = useState<string>("Data as of --:-- (0 min ago)");

    useEffect(() => {
        if (mode === "historical") {
            setFreshnessDisplay(
                historicalStage
                    ? `2024 BENCHMARK ARCHIVE — 27 SEP 2024 (STAGE ${historicalStage.stage}: ${historicalStage.label})`
                    : "2024 BIHAR AUDIT BENCHMARK — 27 SEP 2024"
            );
            return;
        }
        if (mode === "simulation") {
            setFreshnessDisplay(
                simulationParams
                    ? `SIMULATED HYDRO-SURFACE (${simulationParams.rainfall}mm RAIN / ${simulationParams.waterLevel}m RIVER)`
                    : "PREDICTIVE SCENARIO SIMULATION"
            );
            return;
        }
        const updateFreshness = () => {
            const timestamp = dataFreshness?.generated_at ? new Date(dataFreshness.generated_at) : new Date();
            const now = new Date();
            const diffMinutes = Math.max(0, Math.floor((now.getTime() - timestamp.getTime()) / 60000));
            const hours = timestamp.getHours().toString().padStart(2, "0");
            const mins = timestamp.getMinutes().toString().padStart(2, "0");
            const ageText = diffMinutes === 0 ? "0 min ago" : `${diffMinutes} min ago`;
            setFreshnessDisplay(`Live Telemetry as of ${hours}:${mins} (${ageText})`);
        };
        updateFreshness();
        const interval = setInterval(updateFreshness, 15000);
        return () => clearInterval(interval);
    }, [mode, historicalStage, simulationParams, dataFreshness?.generated_at]);

    const [basemapKey, setBasemapKey] = useState<keyof typeof BASEMAPS>("satellite");
    const [legendOpen, setLegendOpen] = useState(false);

    // Collapsible popup menus (take 0 space when closed)
    const [activeDropdown, setActiveDropdown] = useState<"none" | "sector" | "weather" | "layers" | "filter">("none");

    // Tactical Layer visibility toggles (preserved in state)
    const [showAOIBoundary, setShowAOIBoundary] = useState(true);
    const [showRiverFeatures, setShowRiverFeatures] = useState(true);
    const [showFloodPolygon, setShowFloodPolygon] = useState(true);
    const [showUtilities, setShowUtilities] = useState(true);
    const [showRoutes, setShowRoutes] = useState(true);
    const [showEvacCorridor, setShowEvacCorridor] = useState(true);
    const [showAirOps, setShowAirOps] = useState(true);
    const [showCWCGauge, setShowCWCGauge] = useState(true);
    const [selectedEvacOrigin, setSelectedEvacOrigin] = useState<string | null>("V1");
    const [isEvacMinimized, setIsEvacMinimized] = useState(false);
    const [showGridOverlay, setShowGridOverlay] = useState(showSpatialGrid);
    const [routingMode, setRoutingMode] = useState<"CIVILIAN" | "EMERGENCY">(initialRoutingMode || "CIVILIAN");

    // Tactical Operational Filter Preset
    const [tacticalFilter, setTacticalFilter] = useState<"ALL" | "CRITICAL_HAZARDS" | "WATER_AIR" | "EVAC_RELIEF">("ALL");

    // Tactical Caliper / Distance Measurement state
    const [caliperActive, setCaliperActive] = useState(false);
    const [caliperPoints, setCaliperPoints] = useState<[number, number][]>([]);

    // Live Cursor coordinate tracker
    const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);

    // Forecast auto-play loop state
    const [forecastPlaying, setForecastPlaying] = useState(false);

    // Moveable/Draggable status dock state
    const [dockPos, setDockPos] = useState<{ x: number; y: number } | null>(null);
    const dockRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    const handleDockPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("input") || target.closest("a")) {
            return;
        }

        e.stopPropagation();
        e.preventDefault();
        isDraggingRef.current = true;

        const dockEl = dockRef.current;
        if (!dockEl) return;
        const parentEl = dockEl.parentElement;
        if (!parentEl) return;

        const parentRect = parentEl.getBoundingClientRect();
        const dockRect = dockEl.getBoundingClientRect();

        const currentX = dockPos ? dockPos.x : (dockRect.left - parentRect.left);
        const currentY = dockPos ? dockPos.y : (dockRect.top - parentRect.top);

        const startMouseX = e.clientX;
        const startMouseY = e.clientY;

        const handlePointerMove = (moveEvt: PointerEvent) => {
            if (!isDraggingRef.current) return;
            moveEvt.preventDefault();
            moveEvt.stopPropagation();

            const deltaX = moveEvt.clientX - startMouseX;
            const deltaY = moveEvt.clientY - startMouseY;

            let newX = currentX + deltaX;
            let newY = currentY + deltaY;

            const maxX = Math.max(8, parentRect.width - dockRect.width - 8);
            const maxY = Math.max(8, parentRect.height - dockRect.height - 8);

            newX = Math.max(8, Math.min(newX, maxX));
            newY = Math.max(8, Math.min(newY, maxY));

            setDockPos({ x: Math.round(newX), y: Math.round(newY) });
        };

        const handlePointerUp = (upEvt: PointerEvent) => {
            isDraggingRef.current = false;
            upEvt.stopPropagation();
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
    };

    useEffect(() => {
        if (!forecastPlaying || isDegradedMode) return;
        const horizons: TimeHorizon[] = ["now", "+6h", "+12h", "+24h"];
        const interval = setInterval(() => {
            setTimeHorizon((prev) => {
                const nextIdx = (horizons.indexOf(prev) + 1) % horizons.length;
                const next = horizons[nextIdx];
                if (onTimeHorizonChange) onTimeHorizonChange(next);
                return next;
            });
        }, 2500);
        return () => clearInterval(interval);
    }, [forecastPlaying, isDegradedMode, onTimeHorizonChange]);

    const caliperMeasurement = useMemo(() => {
        if (caliperPoints.length < 2) return null;
        const from = caliperPoints[0];
        const to = caliperPoints[1];
        const distKm = calculateHaversineDistanceKm(from, to);
        const distM = Math.round(distKm * 1000);
        const bearing = calculateCompassBearing(from, to);
        const midPoint: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];

        return {
            from,
            to,
            midPoint,
            distKm,
            distM,
            bearing,
            footMin: Math.max(1, Math.round((distKm / 4.0) * 60)),
            truckMin: Math.max(1, Math.round((distKm / 30.0) * 60)),
            boatMin: Math.max(1, Math.round((distKm / 15.0) * 60)),
            heloMin: Math.max(1, Math.round((distKm / 180.0) * 60)),
        };
    }, [caliperPoints]);

    const handleCaliperClick = (coords: [number, number]) => {
        setCaliperPoints((prev) => {
            if (prev.length >= 2) return [coords];
            return [...prev, coords];
        });
    };

    useEffect(() => {
        if (initialRoutingMode) setRoutingMode(initialRoutingMode);
    }, [initialRoutingMode]);

    const handleRoutingModeChange = (mode: "CIVILIAN" | "EMERGENCY") => {
        setRoutingMode(mode);
        if (onRoutingModeChange) onRoutingModeChange(mode);
    };

    // Sync layer overlay when parent toggle changes
    useEffect(() => {
        setShowGridOverlay(showSpatialGrid);
    }, [showSpatialGrid]);

    // Active Evacuation Corridor (dynamically adapts to civilian vs emergency mode)
    const activeEvacCorridor = useMemo(() => {
        if (!selectedEvacOrigin || !EVACUATION_CORRIDORS[selectedEvacOrigin]) return null;
        const entry = EVACUATION_CORRIDORS[selectedEvacOrigin];
        const modeData = routingMode === "CIVILIAN" ? entry.civilian : entry.emergency;
        return {
            originName: entry.originName,
            targetShelterId: entry.targetShelterId,
            targetShelterName: entry.targetShelterName,
            mode: modeData.mode,
            safetyScore: modeData.safetyScore,
            distanceKm: modeData.distanceKm,
            transitTimeMin: modeData.transitTimeMin,
            elevationSafetyGain: modeData.elevationSafetyGain,
            waypoints: modeData.waypoints,
            routeStrategy: modeData.routeStrategy,
            routingMode,
        };
    }, [selectedEvacOrigin, routingMode]);

    // Inspector card state (when any pin is clicked)
    const [inspectedAsset, setInspectedAsset] = useState<InspectedAsset | null>(null);

    // Multi-sector infrastructure resolver
    const activeSector: SectorData = useMemo(() => {
        return getSectorInfrastructure(
            activeLocationId,
            center[0],
            center[1],
            activeLocationName
        );
    }, [activeLocationId, center[0], center[1], activeLocationName]);

    // High-performance O(1) membership sets
    const affectedVillagesSet = useMemo(() => new Set(Array.isArray(effectiveVillages) ? effectiveVillages : []), [effectiveVillages]);
    const affectedRoadsSet = useMemo(() => new Set(Array.isArray(effectiveRoads) ? effectiveRoads : []), [effectiveRoads]);
    const affectedHospitalsSet = useMemo(() => new Set(Array.isArray(effectiveHospitals) ? effectiveHospitals : []), [effectiveHospitals]);

    const isVillageAffected = (id: string) => affectedVillagesSet.has(id);
    const isRoadAffected = (id: string) => affectedRoadsSet.has(id);
    const isHospitalAffected = (id: string) => affectedHospitalsSet.has(id);

    // Memoize active dispatch routes (prevents recalculating waypoints on zoom/pan/click)
    const resourceRoutes = useMemo(() => {
        const allocList = Array.isArray(effectiveAllocations) && effectiveAllocations.length > 0
            ? effectiveAllocations
            : cachedMapStateRef.current.allocation;
        if (!Array.isArray(allocList) || allocList.length === 0) return [];

        return allocList
            .map((item) => {
                if (!item) return null;
                const fromCoord = activeSector.resourceBases[item.resource] || activeSector.ambulances[item.resource]?.coords;
                const toCoord = activeSector.villages[item.village_id]?.coords;
                if (!fromCoord || !toCoord) return null;

                const isWatercraft = item.resource_type === "RESCUE_BOAT" || ("dispatch_mode" in item && item.dispatch_mode === "WATERCRAFT_IRB") || item.resource.startsWith("RB");
                const waypoints = getGoogleMapsRoutePath(activeSector, fromCoord, toCoord, item.village_id, item.resource, isWatercraft);

                return {
                    resource: item.resource,
                    resourceType: item.resource_type,
                    dispatchMode: item.dispatch_mode || (isWatercraft ? "WATERCRAFT_IRB" : "ROAD_AMBULANCE"),
                    villageId: item.village_id,
                    villageName: item.village_name || activeSector.villages[item.village_id]?.name || item.village_id,
                    isWatercraft,
                    from: fromCoord,
                    to: toCoord,
                    waypoints,
                    priority: item.priority_level,
                    score: item.priority_score,
                    distanceKm: item.distance_km,
                    travelTimeMin: item.estimated_travel_time_min,
                    population: item.population,
                    reason: item.reason,
                };
            })
            .filter((route): route is NonNullable<typeof route> => !!(route && route.from && route.to));
    }, [allocation, activeSector]);

    const activeBasemap = BASEMAPS[basemapKey];
    const totalSectorPopulation = useMemo(
        () => Object.values(activeSector.villages).reduce((acc, v) => acc + v.population, 0),
        [activeSector]
    );

    if (!mounted) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 gap-3 bg-slate-950/60 backdrop-blur rounded-xl">
                <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
                    Initializing Satellite Map Surface...
                </span>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full select-none" onClick={() => { if (activeDropdown !== "none") setActiveDropdown("none"); }}>
            {/* TOP-LEFT COMPACT FLOATING TOOLBAR (MINIMAL DEFAULT HEIGHT: 36px) */}
            <div className="absolute top-3 left-3 z-[1000] flex flex-col items-start gap-1.5 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#0c1322] p-1 shadow-none text-xs text-white">
                    {/* SECTOR PICKER PILL */}
                    <button
                        onClick={() => {
                            if (mode === "historical") return;
                            setActiveDropdown(prev => prev === "sector" ? "none" : "sector");
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                            mode === "historical"
                                ? "bg-slate-900 border border-amber-500/40 text-amber-300 cursor-default"
                                : activeDropdown === "sector"
                                ? "bg-blue-600 text-white"
                                : "hover:bg-slate-800 text-slate-200"
                        }`}
                        title={mode === "historical" ? "Operational sector is locked to the 2024 Bihar benchmark zone to preserve historical audit integrity" : "Change Operational Sector"}
                    >
                        <span className={`h-2 w-2 rounded-xs inline-block ${mode === "historical" ? "bg-amber-400" : "bg-emerald-400"}`} />
                        <span className="truncate max-w-[150px] sm:max-w-[210px]">
                            {mode === "historical" ? "2024 Audit: Barauni-Sultanganj" : mode === "simulation" ? `Sim Zone: ${activeSector.name}` : activeSector.name}
                        </span>
                        {mode !== "historical" && <span className="text-[10px] text-slate-400">▾</span>}
                    </button>

                    <div className="h-4 w-px bg-slate-800" />

                    {/* WEATHER & RADAR PILL */}
                    <button
                        onClick={() => setActiveDropdown(prev => prev === "weather" ? "none" : "weather")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                            activeDropdown === "weather"
                                ? (mode === "historical" ? "bg-amber-700 text-white" : mode === "simulation" ? "bg-cyan-700 text-white" : "bg-amber-600 text-white")
                                : "hover:bg-slate-800 text-slate-300"
                        }`}
                        title={mode === "historical" ? "View Archived 2024 Hydrological Record" : mode === "simulation" ? "View Simulated Hydrodynamic Parameters" : "View Live Meteorological Telemetry"}
                    >
                        <span className={`font-mono text-[10px] ${mode === "historical" ? "text-amber-400" : mode === "simulation" ? "text-cyan-400" : "text-amber-400"}`}>
                            {mode === "historical" ? "2024 RADAR" : mode === "simulation" ? "SIM RADAR" : "RADAR"}
                        </span>
                        <span className="font-mono text-[11px] text-amber-300">
                            {mode === "historical"
                                ? `${historicalStage?.rainfall_mm || 185}mm`
                                : mode === "simulation"
                                ? `${simulationParams?.rainfall || 45}mm`
                                : liveTelemetry ? `${liveTelemetry.rainfall_mm}mm` : "Radar"}
                        </span>
                        <span className={`text-[9px] font-black px-1 rounded uppercase ${
                            mode === "historical"
                                ? "bg-amber-500/30 text-amber-200"
                                : mode === "simulation"
                                ? "bg-cyan-500/30 text-cyan-200"
                                : floodActive ? "bg-red-500/30 text-red-300" : "bg-emerald-500/30 text-emerald-300"
                        }`}>
                            {mode === "historical" ? "Replay" : mode === "simulation" ? "Synthetic" : floodActive ? "Flood" : "Normal"}
                        </span>
                        <span className="text-[10px] text-slate-400">▾</span>
                    </button>

                    <div className="h-4 w-px bg-slate-800" />

                    {/* CALIPER / DISTANCE TOOL BUTTON */}
                    <button
                        onClick={() => {
                            setCaliperActive(prev => !prev);
                            if (!caliperActive) setCaliperPoints([]);
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-bold transition cursor-pointer text-xs ${
                            caliperActive
                                ? "bg-cyan-700 text-white"
                                : "hover:bg-slate-800 text-slate-300"
                        }`}
                        title="Toggle Distance & Transit Caliper: Click any two points on the map to calculate linear distance, bearing, and multi-modal transit estimates."
                    >
                        <span className="font-mono text-[10px] text-cyan-400">CALIPER</span>
                        <span className="text-[11px]">{caliperActive ? (caliperPoints.length === 1 ? "Click Point B" : "Active") : "Measure"}</span>
                    </button>

                    <div className="h-4 w-px bg-slate-800" />

                    {/* OPERATIONAL FILTER PRESET PILL */}
                    <button
                        onClick={() => setActiveDropdown(prev => prev === "filter" ? "none" : "filter")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-bold transition cursor-pointer text-xs ${
                            activeDropdown === "filter" || tacticalFilter !== "ALL"
                                ? "bg-slate-800 text-cyan-300 border border-cyan-500/40"
                                : "hover:bg-slate-800 text-slate-300"
                        }`}
                        title="Operational Declutter & Tactical Preset Filter"
                    >
                        <span className="font-mono text-[10px] text-slate-400">VIEW:</span>
                        <span className="font-bold text-[11px] truncate max-w-[90px]">
                            {tacticalFilter === "ALL" ? "All" : tacticalFilter === "CRITICAL_HAZARDS" ? "Hazards" : tacticalFilter === "WATER_AIR" ? "Water/Air" : "Evac/Relief"}
                        </span>
                        <span className="text-[10px] text-slate-400">▾</span>
                    </button>
                </div>

                {/* 1B. OPERATIONAL FILTER DROPDOWN */}
                {activeDropdown === "filter" && (
                    <div className="rounded-md border border-slate-700 bg-[#0c1322] p-2 shadow-none w-[280px] sm:w-[310px] space-y-1">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 px-2 py-1 border-b border-slate-800">
                            <span>Operational Preset Filters</span>
                            <span className="text-cyan-400 font-mono text-[9px]">COP Declutter</span>
                        </div>
                        {[
                            { id: "ALL", label: "Complete Tactical Picture", desc: "All infrastructure, flood envelope, routes and utilities" },
                            { id: "CRITICAL_HAZARDS", label: "Critical Hazards & Cutoffs", desc: "Isolates severed roads, marooned villages & 100% full shelters" },
                            { id: "WATER_AIR", label: "Water & Air Operations", desc: "Emphasizes Ganga fairway, IRBs, helipads & aerial drop zone" },
                            { id: "EVAC_RELIEF", label: "Evacuation & Shelter Logistics", desc: "Emphasizes safe corridors, relief camps & hospital access" },
                        ].map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => {
                                    setTacticalFilter(preset.id as any);
                                    setActiveDropdown("none");
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition cursor-pointer flex items-center justify-between ${
                                    tacticalFilter === preset.id
                                        ? "bg-cyan-700 text-white font-bold"
                                        : "hover:bg-slate-900 text-slate-300"
                                }`}
                            >
                                <div>
                                    <div className="font-bold">{preset.label}</div>
                                    <div className="text-[10px] opacity-75">{preset.desc}</div>
                                </div>
                                {tacticalFilter === preset.id && <span className="text-xs">✓</span>}
                            </button>
                        ))}
                    </div>
                )}

                {/* 1. SECTOR SELECTOR DROPDOWN (ONLY VISIBLE ON DEMAND) */}
                {activeDropdown === "sector" && (
                    <div className="rounded-md border border-slate-700 bg-[#0c1322] p-2 shadow-none w-[280px] sm:w-[320px] space-y-1">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 px-2 py-1 border-b border-slate-800">
                            <span>Operational Sectors</span>
                            {onUseDeviceGPS && (
                                <button
                                    onClick={() => {
                                        onUseDeviceGPS();
                                        setActiveDropdown("none");
                                    }}
                                    className="text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
                                >
                                    GPS Locate
                                </button>
                            )}
                        </div>
                        {OPERATIONAL_SECTORS.map((sec) => (
                            <button
                                key={sec.id}
                                onClick={() => {
                                    if (onSelectLocation) onSelectLocation(sec.id);
                                    setActiveDropdown("none");
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition cursor-pointer flex items-center justify-between ${
                                    activeLocationId === sec.id
                                        ? "bg-blue-600 text-white font-bold"
                                        : "hover:bg-slate-900 text-slate-300"
                                }`}
                            >
                                <div>
                                    <div className="font-bold">{sec.label}</div>
                                    <div className="text-[10px] opacity-75">{sec.desc}</div>
                                </div>
                                {activeLocationId === sec.id && <span className="text-xs">✓</span>}
                            </button>
                        ))}
                    </div>
                )}

                {/* 2. WEATHER & RADAR TELEMETRY DROPDOWN (ONLY VISIBLE ON DEMAND) */}
                {activeDropdown === "weather" && (
                    <div className="rounded-md border border-slate-700 bg-[#0c1322] p-2.5 shadow-none w-[280px] sm:w-[320px] space-y-2 text-xs">
                        {mode === "historical" ? (
                            <>
                                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                    <span className="font-bold text-white">2024 Bihar Flood Hydrology</span>
                                    <span className="text-[10px] text-amber-400 font-mono">Archived CWC / IMD</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                        <span className="text-slate-400 text-[10px] block">24h Cumulative Precip</span>
                                        <strong className="text-amber-300 text-xs font-mono">{historicalStage?.rainfall_mm || 185} mm</strong>
                                    </div>
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                        <span className="text-slate-400 text-[10px] block">River Stage (Ganga)</span>
                                        <strong className="text-red-400 text-xs font-mono">{historicalStage?.water_level_m || 36.85} m</strong>
                                    </div>
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                        <span className="text-slate-400 text-[10px] block">Copernicus S-1 Pass</span>
                                        <strong className="text-slate-200 text-[10px] font-mono">{historicalStage?.satellite_pass || "27-SEP-2024"}</strong>
                                    </div>
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                        <span className="text-slate-400 text-[10px] block">Audit Event Phase</span>
                                        <strong className="text-amber-400 text-[10px] font-mono truncate">{historicalStage?.label || "Breach Phase"}</strong>
                                    </div>
                                </div>
                                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                                    <span>Census Exposed: <strong className="text-slate-200">{totalSectorPopulation.toLocaleString()}</strong></span>
                                    <span>Marooned: <strong className="text-rose-400">{affectedVillages.length} of 5</strong></span>
                                </div>
                            </>
                        ) : mode === "simulation" ? (
                            <>
                                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                    <span className="font-bold text-white">Simulated Hydrodynamic Run</span>
                                    <span className="text-[10px] text-cyan-400 font-mono">OR-Tools + XGBoost</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                        <span className="text-slate-400 text-[10px] block">Modeled Influx</span>
                                        <strong className="text-cyan-300 text-xs font-mono">{simulationParams?.rainfall || 45} mm</strong>
                                    </div>
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                        <span className="text-slate-400 text-[10px] block">Storm Duration</span>
                                        <strong className="text-white text-xs font-mono">{simulationParams?.duration || 6} h</strong>
                                    </div>
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                        <span className="text-slate-400 text-[10px] block">Model River Stage</span>
                                        <strong className="text-amber-300 text-xs font-mono">~{simulationParams?.waterLevel || 34.2} m</strong>
                                    </div>
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                        <span className="text-slate-400 text-[10px] block">Solver Engine</span>
                                        <strong className="text-emerald-400 text-[10px] font-mono">Google SCIP MIP</strong>
                                    </div>
                                </div>
                                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                                    <span>Exposed Population: <strong className="text-slate-200">{totalSectorPopulation.toLocaleString()}</strong></span>
                                    <span>Projected Cutoff: <strong className={affectedVillages.length > 0 ? "text-rose-400" : "text-emerald-400"}>{affectedVillages.length} of 5</strong></span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                    <span className="font-bold text-white">Live Meteorological Telemetry</span>
                                    <span className="text-[10px] text-emerald-400 font-mono">Open-Meteo / IMD</span>
                                </div>
                                {liveTelemetry ? (
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                            <span className="text-slate-400 text-[10px] block">6h Precip Total</span>
                                            <strong className="text-amber-300 text-xs font-mono">{liveTelemetry.rainfall_mm} mm</strong>
                                        </div>
                                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                            <span className="text-slate-400 text-[10px] block">Current Rain Rate</span>
                                            <strong className="text-white text-xs font-mono">{liveTelemetry.sensor_readings?.current_rain_mm_per_hr || 0} mm/h</strong>
                                        </div>
                                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                            <span className="text-slate-400 text-[10px] block">Ambient Temp</span>
                                            <strong className="text-white text-xs font-mono">{liveTelemetry.sensor_readings?.temperature_c || 28}°C</strong>
                                        </div>
                                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                            <span className="text-slate-400 text-[10px] block">Barrage River Stage</span>
                                            <strong className="text-cyan-300 text-xs font-mono">~{liveTelemetry.water_level_m} m</strong>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-slate-400">Satellite telemetry stream active. Polling weather station...</p>
                                )}
                                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                                    <span>Exposed Population: <strong className="text-slate-200">{totalSectorPopulation.toLocaleString()}</strong></span>
                                    <span>Cutoff: <strong className={affectedVillages.length > 0 ? "text-rose-400" : "text-emerald-400"}>{affectedVillages.length} of 5</strong></span>
                                </div>
                            </>
                        )}
                    </div>
                )}


                {/* 3. ASSET INSPECTOR DRAWER (SHOWN ONLY WHEN A PIN IS CLICKED) */}
                {/* 3. ASSET INSPECTOR DRAWER (SHOWN ONLY WHEN A PIN IS CLICKED) */}
                {inspectedAsset && (
                    <div className="rounded-md border border-slate-700 bg-[#0c1322] p-2.5 text-xs text-white shadow-none w-[280px] sm:w-[320px] space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                            <div className="flex items-center gap-1.5 truncate">
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${inspectedAsset.badgeColor}`}>
                                    {inspectedAsset.badgeText}
                                </span>
                                <strong className="text-white text-xs truncate">{inspectedAsset.title}</strong>
                            </div>
                            <button
                                onClick={() => setInspectedAsset(null)}
                                className="cursor-pointer text-[10px] font-mono text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800"
                            >
                                [CLOSE]
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-300">{inspectedAsset.subtitle}</p>
                        <div className="grid grid-cols-2 gap-1.5 bg-slate-900/90 p-2 rounded border border-slate-800">
                            {inspectedAsset.metrics.map((m, idx) => (
                                <div key={idx} className="text-[10px]">
                                    <span className="text-slate-400 block">{m.label}</span>
                                    <strong className="text-slate-100 font-mono text-[11px]">{m.value}</strong>
                                </div>
                            ))}
                        </div>
                        {inspectedAsset.notes && (
                            <p className="text-[10px] text-amber-300/90 bg-amber-950/30 p-1.5 rounded border border-amber-900/40">
                                {inspectedAsset.notes}
                            </p>
                        )}
                        {inspectedAsset.category === "VILLAGE" && (
                            <div className="pt-1.5 border-t border-slate-800">
                                <button
                                    onClick={() => setSelectedEvacOrigin(prev => prev === inspectedAsset.id ? null : inspectedAsset.id)}
                                    className={`w-full py-1.5 px-2 rounded text-[10px] font-bold cursor-pointer transition flex items-center justify-center gap-1.5 ${
                                        selectedEvacOrigin === inspectedAsset.id
                                            ? routingMode === "CIVILIAN"
                                                ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-none"
                                                : "bg-amber-600 text-white hover:bg-amber-500 shadow-none"
                                            : routingMode === "CIVILIAN"
                                                ? "bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40"
                                                : "bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40"
                                    }`}
                                >
                                    <span>
                                        {selectedEvacOrigin === inspectedAsset.id
                                            ? "[HIDE] Evacuation Route"
                                            : routingMode === "CIVILIAN"
                                                ? "Plot Civilian Safe Evacuation Route"
                                                : "Plot Emergency / NDRF Route"}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* TOP-RIGHT COMPACT TOOLBAR (BASEMAP + LAYERS BUTTON: HEIGHT 36px) */}
            <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1.5 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1 rounded-md border border-slate-700/80 bg-[#0c1322] p-1 shadow-none text-xs text-white">
                    {/* BASEMAP PILLS */}
                    {(Object.keys(BASEMAPS) as Array<keyof typeof BASEMAPS>).map((key) => (
                        <button
                            key={key}
                            onClick={() => setBasemapKey(key)}
                            className={`px-2 py-1 text-xs font-semibold rounded transition cursor-pointer ${
                                basemapKey === key
                                    ? "bg-blue-600 text-white shadow-none"
                                    : "text-slate-400 hover:text-white"
                            }`}
                        >
                            {BASEMAPS[key].name}
                        </button>
                    ))}

                    <div className="h-4 w-px bg-slate-800 mx-0.5" />

                    {/* LAYERS TOGGLE BUTTON */}
                    <button
                        onClick={() => setActiveDropdown(prev => prev === "layers" ? "none" : "layers")}
                        className={`px-2 py-1 text-xs font-semibold rounded transition cursor-pointer flex items-center gap-1 ${
                            activeDropdown === "layers"
                                ? "bg-cyan-700 text-white shadow-none"
                                : "text-slate-300 hover:text-white hover:bg-slate-800"
                        }`}
                        title="Toggle Tactical Map Overlays"
                    >
                        <span>Layers</span>
                        <span className="text-[10px] text-slate-400">▾</span>
                    </button>
                </div>

                {/* 4. LAYERS DROPDOWN CHECKLIST (ONLY VISIBLE ON DEMAND) */}
                {activeDropdown === "layers" && (
                    <div className="rounded-md border border-slate-700 bg-[#0c1322] p-2.5 shadow-none w-[240px] space-y-1.5 text-xs text-slate-200">
                        <div className="font-bold text-white text-[11px] pb-1 border-b border-slate-800">
                            Tactical Layer Filters
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white py-0.5">
                            <input
                                type="checkbox"
                                checked={showAOIBoundary}
                                onChange={(e) => setShowAOIBoundary(e.target.checked)}
                                className="accent-cyan-500 rounded"
                            />
                            <span>Sector Perimeter (16.2 km²)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white py-0.5">
                            <input
                                type="checkbox"
                                checked={showRiverFeatures}
                                onChange={(e) => setShowRiverFeatures(e.target.checked)}
                                className="accent-blue-500 rounded"
                            />
                            <span>Ganga River &amp; Bund</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white py-0.5">
                            <input
                                type="checkbox"
                                checked={showFloodPolygon}
                                onChange={(e) => setShowFloodPolygon(e.target.checked)}
                                className="accent-red-500 rounded"
                            />
                            <span>Flood Inundation Envelope</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white py-0.5">
                            <input
                                type="checkbox"
                                checked={showUtilities}
                                onChange={(e) => setShowUtilities(e.target.checked)}
                                className="accent-amber-500 rounded"
                            />
                            <span>Power, Telecom &amp; Jetties</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white py-0.5">
                            <input
                                type="checkbox"
                                checked={showRoutes}
                                onChange={(e) => setShowRoutes(e.target.checked)}
                                className="accent-emerald-500 rounded"
                            />
                            <span>Emergency Dispatch Routes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white py-0.5">
                            <input
                                type="checkbox"
                                checked={showEvacCorridor}
                                onChange={(e) => setShowEvacCorridor(e.target.checked)}
                                className="accent-cyan-500 rounded"
                            />
                            <span>Safe Evacuation Corridors</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white py-0.5">
                            <input
                                type="checkbox"
                                checked={showAirOps}
                                onChange={(e) => setShowAirOps(e.target.checked)}
                                className="accent-sky-500 rounded"
                            />
                            <span>Air Ops, Helipads &amp; Drop Zone</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white py-0.5">
                            <input
                                type="checkbox"
                                checked={showCWCGauge}
                                onChange={(e) => setShowCWCGauge(e.target.checked)}
                                className="accent-blue-400 rounded"
                            />
                            <span>CWC Hydro-Gauge (Ganga-64B)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white py-0.5 border-t border-slate-800/80 pt-1 mt-1">
                            <input
                                type="checkbox"
                                checked={showGridOverlay}
                                onChange={(e) => setShowGridOverlay(e.target.checked)}
                                className="accent-blue-500 rounded"
                            />
                            <span>10m SAR Risk Grid Raster</span>
                        </label>
                    </div>
                )}
            </div>

            {/* MOVEABLE UNIFIED STATUS & ROUTING DOCK */}
            <div
                ref={dockRef}
                style={dockPos ? { left: `${dockPos.x}px`, top: `${dockPos.y}px` } : undefined}
                className={`z-[1000] pointer-events-auto flex flex-col items-center gap-1.5 max-w-[96%] touch-none ${
                    dockPos
                        ? "absolute"
                        : mode === "live"
                            ? "absolute bottom-14 left-1/2 -translate-x-1/2 transition-all"
                            : "absolute bottom-3 left-1/2 -translate-x-1/2 transition-all"
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Single Row: Drag Handle + Freshness Badge + Routing Mode Selector + Reset Button */}
                <div
                    onPointerDown={handleDockPointerDown}
                    onDoubleClick={() => setDockPos(null)}
                    className="flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-md bg-[#0c1322] border border-slate-700/80 shadow-none cursor-grab active:cursor-grabbing"
                    title="Click and drag to reposition dock anywhere on map (Double-click to reset position)"
                >
                    {/* Drag Grip Handle */}
                    <div
                        className="flex items-center px-1 text-slate-500 hover:text-cyan-300 select-none"
                        title="Drag to reposition dock anywhere on map"
                    >
                        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="opacity-70">
                            <circle cx="2" cy="2" r="1.5" />
                            <circle cx="8" cy="2" r="1.5" />
                            <circle cx="2" cy="7" r="1.5" />
                            <circle cx="8" cy="7" r="1.5" />
                            <circle cx="2" cy="12" r="1.5" />
                            <circle cx="8" cy="12" r="1.5" />
                        </svg>
                    </div>

                    {/* Freshness Badge */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-200 select-none">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        <span className="font-semibold text-slate-100">{freshnessDisplay}</span>
                    </div>

                    <div className="h-3.5 w-px bg-slate-800 hidden sm:block" />

                    {/* Routing Mode Toggle Buttons */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handleRoutingModeChange("CIVILIAN")}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                                routingMode === "CIVILIAN"
                                    ? "bg-emerald-600 text-white font-bold shadow-none"
                                    : "text-slate-400 hover:text-slate-200"
                            }`}
                            title="Civilian Safe Evacuation mode (conservative high-ground)"
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${routingMode === "CIVILIAN" ? "bg-white" : "bg-emerald-400"}`} />
                            <span>Civilian Evac</span>
                        </button>
                        <button
                            onClick={() => handleRoutingModeChange("EMERGENCY")}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                                routingMode === "EMERGENCY"
                                    ? "bg-amber-600 text-slate-950 font-bold shadow-none"
                                    : "text-slate-400 hover:text-slate-200"
                            }`}
                            title="Emergency / NDRF / Ambulance mode (tactical speed-priority)"
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${routingMode === "EMERGENCY" ? "bg-slate-950" : "bg-amber-400"}`} />
                            <span>Emergency / NDRF</span>
                        </button>
                    </div>

                    {/* Reset Button (visible when custom position is active) */}
                    {dockPos !== null && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setDockPos(null);
                            }}
                            className="px-1.5 py-0.5 text-[9px] font-mono text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded cursor-pointer transition border border-slate-700/60"
                            title="Reset position to default"
                        >
                            [RESET]
                        </button>
                    )}
                </div>

                {/* Degraded mode alert if applicable */}
                {isDegradedMode && (
                    <div className="flex items-center gap-2 rounded-md border border-amber-600/70 bg-[#140e05] px-2.5 py-1 shadow-none text-[11px] text-amber-200 font-medium select-none">
                        <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                        <span>DEGRADED MODE – Last known data as of {effectiveDegradedTime}</span>
                        {onRetryConnection && (
                            <button
                                onClick={onRetryConnection}
                                className="cursor-pointer ml-1.5 px-2 py-0.5 text-[10px] font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 rounded shadow-none"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* FLOATING EVACUATION WAYFINDING HUD (ACTIVE WHEN CORRIDOR PLOTTED) */}
            {activeEvacCorridor && (
                isEvacMinimized ? (
                    <div
                        className={`absolute top-14 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto rounded-md px-2.5 py-1 text-xs text-white shadow-none flex items-center gap-2 border transition-all ${
                            routingMode === "CIVILIAN"
                                ? "bg-[#061410] border-emerald-600/70"
                                : "bg-[#140e05] border-amber-600/70"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${routingMode === "CIVILIAN" ? "bg-emerald-400" : "bg-amber-400"}`} />
                        <span className={`font-mono text-[10px] tracking-wide uppercase ${routingMode === "CIVILIAN" ? "text-emerald-300" : "text-amber-300"}`}>
                            {routingMode === "CIVILIAN" ? "Civilian Evac" : "Tactical Route"}: {activeEvacCorridor.originName.split(" ")[0]} → {activeEvacCorridor.targetShelterId} ({activeEvacCorridor.distanceKm} km, ~{activeEvacCorridor.transitTimeMin}m)
                        </span>
                        <div className="flex items-center gap-1 border-l border-slate-700/80 pl-2">
                            <button
                                onClick={() => setIsEvacMinimized(false)}
                                className="cursor-pointer rounded px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                                title="Expand evacuation corridor details"
                            >
                                [+]
                            </button>
                            <button
                                onClick={() => setSelectedEvacOrigin(null)}
                                className="cursor-pointer rounded px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 hover:text-rose-300 bg-slate-800 hover:bg-rose-950/60 border border-slate-700 transition"
                                title="Clear active evacuation corridor"
                            >
                                [X]
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        className={`absolute top-14 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto rounded-md px-3 py-1.5 text-xs text-white shadow-none flex items-center gap-3 sm:gap-4 max-w-[94%] border transition-all ${
                            routingMode === "CIVILIAN"
                                ? "bg-[#061410] border-emerald-600/70"
                                : "bg-[#140e05] border-amber-600/70"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${routingMode === "CIVILIAN" ? "bg-emerald-400" : "bg-amber-400"}`} />
                            <div>
                                <div className={`font-bold font-mono text-[11px] tracking-wide uppercase ${routingMode === "CIVILIAN" ? "text-emerald-300" : "text-amber-300"}`}>
                                    {routingMode === "CIVILIAN" ? "Civilian Safe Evacuation" : "Emergency / NDRF Tactical Route"}: {activeEvacCorridor.originName} → {activeEvacCorridor.targetShelterName}
                                </div>
                                <div className="text-[10px] text-slate-300 font-medium">
                                    Route: <span className="text-slate-100">{activeEvacCorridor.mode}</span> | Safety: <span className={`font-semibold ${routingMode === "CIVILIAN" ? "text-emerald-300" : "text-amber-300"}`}>{activeEvacCorridor.safetyScore}</span> | Elevation: <span className="text-cyan-200 font-semibold">{activeEvacCorridor.elevationSafetyGain}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 border-l border-slate-800 pl-3 shrink-0">
                            <div className="text-right">
                                <span className={`font-mono font-bold text-xs ${routingMode === "CIVILIAN" ? "text-emerald-300" : "text-amber-300"}`}>
                                    {activeEvacCorridor.distanceKm} km
                                </span>
                                <span className="block text-[9px] text-slate-400 font-mono">
                                    ~{activeEvacCorridor.transitTimeMin} min {routingMode === "CIVILIAN" ? "Walk/Bus" : "Tactical ETA"}
                                </span>
                            </div>
                            <button
                                onClick={() => setIsEvacMinimized(true)}
                                className="cursor-pointer rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-1.5 py-0.5 text-[10px] font-mono font-bold border border-slate-700 transition"
                                title="Minimize to compact bar"
                            >
                                [MIN]
                            </button>
                            <button
                                onClick={() => setSelectedEvacOrigin(null)}
                                className="cursor-pointer rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-1.5 py-0.5 text-[10px] font-mono font-bold border border-slate-700 transition"
                                title="Clear active evacuation corridor"
                            >
                                [CLEAR]
                            </button>
                        </div>
                    </div>
                )
            )}

            <MapContainer
                center={center}
                zoom={zoom}
                scrollWheelZoom={true}
                touchZoom={true}
                dragging={true}
                doubleClickZoom={true}
                boxZoom={true}
                keyboard={true}
                wheelDebounceTime={40}
                wheelPxPerZoomLevel={60}
                className="h-full w-full rounded-md z-0"
            >
                <MapRecenter center={center} zoom={zoom} />
                <MapInteractionTracker
                    caliperActive={caliperActive}
                    onCaliperClick={handleCaliperClick}
                    onCursorMove={setCursorCoords}
                />

                <TileLayer
                    key={basemapKey}
                    attribution={activeBasemap.attribution}
                    url={activeBasemap.url}
                />

                {/* 1. SECTOR OPERATIONAL BOUNDARY */}
                {showAOIBoundary && activeSector.aoiBounds && (
                    <Rectangle
                        bounds={activeSector.aoiBounds}
                        pathOptions={{
                            color: "#06b6d4",
                            fillColor: "#0891b2",
                            fillOpacity: 0.03,
                            weight: 2,
                            dashArray: "6 6",
                        }}
                    >
                        <Tooltip sticky direction="top">
                            Command Sector Perimeter (16.2 km²)
                        </Tooltip>
                    </Rectangle>
                )}

                {/* 2. GANGA RIVER CHANNEL POLYGON */}
                {showRiverFeatures && activeSector.riverChannelPolygon && (
                    <Polygon
                        positions={activeSector.riverChannelPolygon}
                        pathOptions={{
                            color: "#3b82f6",
                            fillColor: "#2563eb",
                            fillOpacity: 0.22,
                            weight: 1.5,
                        }}
                        eventHandlers={{
                            click: () => {
                                setInspectedAsset({
                                    id: "ganga-channel",
                                    title: "Ganga River Main Channel",
                                    category: "UTILITY",
                                    badgeText: "HYDROLOGICAL WATERWAY",
                                    badgeColor: "bg-blue-500/20 text-blue-300 border border-blue-500/40",
                                    subtitle: "Primary Drainage Fairway & Riparian Floodplain",
                                    status: liveTelemetry ? liveTelemetry.barrage_status?.alert_level || "NORMAL" : "NORMAL",
                                    metrics: [
                                        { label: "River Stage", value: `~${liveTelemetry?.water_level_m || 3.5}m MSL` },
                                        { label: "Danger Level", value: "8.5m MSL" },
                                        { label: "Warning Level", value: "7.0m MSL" },
                                        { label: "Current Speed", value: "2.4 m/s" },
                                    ],
                                    notes: "Central Water Commission (CWC) telemetry datum reference station.",
                                });
                            }
                        }}
                    >
                        <Tooltip sticky direction="top">
                            Ganga River Main Channel (3.5m Datum)
                        </Tooltip>
                    </Polygon>
                )}

                {/* 3. FLOOD EMBANKMENT PROTECTION BUND */}
                {showRiverFeatures && activeSector.embankmentBund && (
                    <Polyline
                        positions={activeSector.embankmentBund}
                        pathOptions={{
                            color: "#d97706",
                            weight: 4,
                            dashArray: "10 5",
                            opacity: 0.90,
                        }}
                        eventHandlers={{
                            click: () => {
                                setInspectedAsset({
                                    id: "embankment-bund",
                                    title: "Flood Protection Embankment Bund",
                                    category: "UTILITY",
                                    badgeText: "DEFENSIVE RING BANDH",
                                    badgeColor: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
                                    subtitle: "Reinforced Earthen Ring Embankment with Geotextile Armor",
                                    status: floodActive ? "UNDER PRESSURE" : "INTACT",
                                    metrics: [
                                        { label: "Crest Elevation", value: "48.5m MSL" },
                                        { label: "Design Freeboard", value: "1.5m" },
                                        { label: "Patrol Teams", value: "3 Mobile Squads" },
                                        { label: "Condition", value: floodActive ? "SEEPAGE WATCH" : "STABLE" },
                                    ],
                                    notes: "Defends Barauni municipal center and NH-31 arterial corridor from river overflow.",
                                });
                            }
                        }}
                    >
                        <Tooltip sticky direction="top">
                            Flood Protection Bund (KM 12-18 | Crest: 48.5m)
                        </Tooltip>
                    </Polyline>
                )}

                {/* 4. ACTIVE FLOOD INUNDATION ENVELOPE */}
                {showFloodPolygon && floodActive && (activeSector.floodInundationForecast?.[timeHorizon] || activeSector.floodInundationPolygon) && (
                    <Polygon
                        key={`inundation_${timeHorizon}`}
                        positions={activeSector.floodInundationForecast?.[timeHorizon] || activeSector.floodInundationPolygon || []}
                        pathOptions={{
                            color: timeHorizon === "+12h" ? "#b91c1c" : timeHorizon === "+6h" ? "#dc2626" : "#ef4444",
                            fillColor: timeHorizon === "+12h" ? "#991b1b" : timeHorizon === "+6h" ? "#b91c1c" : "#dc2626",
                            fillOpacity: timeHorizon === "+12h" ? 0.35 : timeHorizon === "+6h" ? 0.30 : 0.28,
                            weight: timeHorizon === "+12h" ? 2.5 : 2,
                            dashArray: "5 5",
                        }}
                        eventHandlers={{
                            click: () => {
                                const horizonLabel = timeHorizon === "now" ? "Now (T-0 Baseline)" : `T${timeHorizon} Forecast`;
                                const meanDepth = timeHorizon === "+12h" ? "2.45m Peak Column" : timeHorizon === "+6h" ? "2.10m Rising Column" : timeHorizon === "+24h" ? "1.95m Stagnant Depth" : "1.85m Water Column";
                                setInspectedAsset({
                                    id: `inundation-${timeHorizon}`,
                                    title: `Active Flood Inundation Envelope (${timeHorizon === "now" ? "Current" : timeHorizon})`,
                                    category: "UTILITY",
                                    badgeText: timeHorizon === "+12h" ? "PEAK CREST ZONE" : "HAZARD ZONE",
                                    badgeColor: "bg-red-500/20 text-red-300 border border-red-500/40",
                                    subtitle: `Sentinel-1A SAR C-Band + Hydrodynamic Diffusion Model (${horizonLabel})`,
                                    status: timeHorizon === "+12h" ? "PEAK SURGE" : "ACTIVE WATERLOGGING",
                                    metrics: [
                                        { label: "Forecast Horizon", value: horizonLabel },
                                        { label: "Data Source", value: "CWC Hydrodynamic + Sentinel-1A SAR" },
                                        { label: "Freshness", value: "Updated 0m ago (T-0)" },
                                        { label: "Mean Depth", value: meanDepth },
                                        { label: "Cutoff Wards", value: `${affectedVillages.length} Settlements` },
                                        { label: "Severed Roads", value: `${affectedRoads.length} Highway Links` },
                                        { label: "Evac Status", value: "Watercraft IRBs Active" },
                                    ],
                                    notes: "Requires mandatory watercraft IRB evacuation; road vehicles locked out by deep water.",
                                });
                            }
                        }}
                    >
                        <Tooltip sticky direction="top">
                            Flood Inundation (~1.85m | CWC+SAR)
                        </Tooltip>
                    </Polygon>
                )}

                {/* 5. 2D SPATIAL RISK RASTER GRID */}
                {showGridOverlay &&
                    spatialGrid.map((cell) => {
                        const horizonMult = timeHorizon === "+12h" ? 1.28 : timeHorizon === "+6h" ? 1.14 : timeHorizon === "+24h" ? 1.10 : 1.0;
                        const cellData = cell.forecast?.[timeHorizon] || {
                            risk_score: Number(Math.min(0.98, Math.max(0.05, cell.risk_score * horizonMult)).toFixed(2)),
                            sar_water_fraction: Number(Math.min(0.95, Math.max(0.02, cell.sar_water_fraction * horizonMult)).toFixed(2)),
                            risk_level: cell.risk_level,
                        };
                        const style = getGridColor(cellData.risk_score);
                        return (
                            <Rectangle
                                key={`${cell.id}_${timeHorizon}`}
                                bounds={cell.bounds}
                                pathOptions={{
                                    fillColor: style.fill,
                                    fillOpacity: style.opacity,
                                    color: style.stroke,
                                    weight: 1,
                                }}
                            >
                                <Popup>
                                    <div className="text-xs p-1 text-slate-100 space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <strong>Cell: {cell.id}</strong>
                                            <span className="text-[10px] font-mono text-cyan-300 font-bold">
                                                {timeHorizon === "now" ? "Now (T-0)" : `${timeHorizon} Forecast`}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-300">
                                            Risk Score: <strong>{cellData.risk_score}</strong> ({cellData.risk_score >= 0.75 ? "CRITICAL" : cellData.risk_score >= 0.50 ? "HIGH" : cellData.risk_score >= 0.30 ? "MODERATE" : "LOW"})
                                            <br />
                                            Elevation: {cell.elevation_m}m | Water: {(cellData.sar_water_fraction * 100).toFixed(0)}%
                                        </div>
                                        <div className="text-[10px] text-cyan-300 font-mono border-t border-slate-700/60 pt-1">
                                            Source: Sentinel-1A SAR (10m) + Calibrated ML • Forecast: {timeHorizon}
                                        </div>
                                    </div>
                                </Popup>
                            </Rectangle>
                        );
                    })}

                {/* 6. CRITICAL UTILITIES (POWER, TELECOM, JETTY, RAILHEAD) */}
                {showUtilities && activeSector.utilities && Object.entries(activeSector.utilities).map(([utId, utMeta]) => (
                    <Circle
                        key={`utility_${utId}`}
                        center={utMeta.coords}
                        radius={32}
                        pathOptions={{
                            color: utId === "P1" ? "#eab308" : utId === "T1" ? "#06b6d4" : "#a855f7",
                            fillColor: utId === "P1" ? "#ca8a04" : utId === "T1" ? "#0891b2" : "#9333ea",
                            fillOpacity: 0.95,
                            weight: 2,
                        }}
                        eventHandlers={{
                            click: () => {
                                setInspectedAsset({
                                    id: utId,
                                    title: utMeta.name,
                                    category: "UTILITY",
                                    badgeText: utMeta.type.toUpperCase(),
                                    badgeColor: "bg-blue-500/20 text-blue-300 border border-blue-500/40",
                                    subtitle: utMeta.type,
                                    status: utMeta.status,
                                    metrics: [
                                        { label: "Utility ID", value: utId },
                                        { label: "Status", value: utMeta.status },
                                        { label: "Flood Threshold", value: `${(utMeta.threshold * 100).toFixed(0)}% Risk` },
                                        { label: "Backup Mode", value: "Diesel Genset Ready" },
                                    ],
                                    notes: "Critical lifeline infrastructure monitored by State Disaster Management Authority.",
                                });
                            }
                        }}
                    >
                        <Tooltip direction="bottom">
                            {utId === "P1" ? "Substation P1" : utId === "T1" ? "Telecom T1" : utId === "G1" ? "Ghat Jetty G1" : "Railhead Yard"}
                        </Tooltip>
                    </Circle>
                ))}

                {/* 7. ROADS & HIGHWAYS (GOOGLE MAPS STYLE DUAL-CASING & HAZARD INCIDENT PINS) */}
                {Object.entries(activeSector.roads).map(([roadId, roadMeta]) => {
                    const isCutoff = isRoadAffected(roadId);
                    const midIndex = Math.floor(roadMeta.positions.length / 2);
                    const midPoint = roadMeta.positions[midIndex] || roadMeta.positions[0];

                    return (
                        <Fragment key={`road_frag_${roadId}`}>
                            {/* Road Contrast Underlayer Casing (Signature Google Maps road border) */}
                            <Polyline
                                positions={roadMeta.positions}
                                pathOptions={{
                                    color: isCutoff ? "#450a0a" : (floodActive ? "#065f46" : "#022c22"),
                                    weight: isCutoff ? 7.5 : (floodActive ? 6.5 : 5.5),
                                    opacity: 0.90,
                                }}
                            />
                            {/* Road Core Guideway */}
                            <Polyline
                                positions={roadMeta.positions}
                                pathOptions={{
                                    color: isCutoff ? "#ef4444" : "#10b981",
                                    weight: isCutoff ? 4.5 : (floodActive ? 4.0 : 3.5),
                                    opacity: 0.98,
                                    dashArray: isCutoff ? "8 6" : undefined,
                                }}
                                eventHandlers={{
                                    click: () => {
                                        setInspectedAsset({
                                            id: roadId,
                                            title: roadMeta.name,
                                            category: "ROAD",
                                            badgeText: isCutoff 
                                                ? "SUBMERGED & SEVERED" 
                                                : (floodActive ? "SAFE EVACUATION CORRIDOR" : "CLEAR & PASSABLE"),
                                            badgeColor: isCutoff 
                                                ? "bg-red-500/20 text-red-300 border border-red-500/40" 
                                                : (floodActive ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/60" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"),
                                            subtitle: roadMeta.type,
                                            status: isCutoff ? "SEVERED" : (floodActive ? "SAFE HIGH-GROUND (+2.5m MSL)" : "OPEN"),
                                            metrics: [
                                                { label: "Data Source", value: "PWD Bihar / SEOC Lifeline Network" },
                                                { label: "Freshness", value: "Updated 1m ago" },
                                                { label: "Corridor ID", value: roadId },
                                                { label: "Road Status", value: isCutoff ? "BLOCKED (>0.8m surge)" : (floodActive ? "100% CLEAR / HIGH GROUND" : "ALL TRAFFIC CLEAR") },
                                                { label: "Transit Mode", value: isCutoff ? "WATERCRAFT ONLY" : "AMBULANCE & BUS" },
                                                { label: "Operational Role", value: isCutoff ? "Diverted to Jetty G1" : (floodActive ? "Primary Evac to Camp S1" : "Normal Transit") },
                                            ],
                                            notes: isCutoff 
                                                ? `HAZARD: Impassable to emergency vehicles due to river surge. ${roadMeta.significance}`
                                                : (floodActive ? `Designated high-ground safe corridor holding above flood levels. ${roadMeta.significance}` : roadMeta.significance),
                                        });
                                    }
                                }}
                            >
                                <Tooltip sticky direction="top">
                                    {roadMeta.name} {isCutoff ? "[SUBMERGED & CUT OFF]" : (floodActive ? "[SAFE EVACUATION CORRIDOR]" : "[CLEAR / OPEN]")} • Source: PWD Lifeline (Updated 1m ago)
                                </Tooltip>
                            </Polyline>

                            {/* Google-Maps Style Incident Hazard Marker at Road Breach Point */}
                            {isCutoff && midPoint && (
                                <Circle
                                    center={midPoint}
                                    radius={32}
                                    pathOptions={{
                                        color: "#ef4444",
                                        fillColor: "#dc2626",
                                        fillOpacity: 1,
                                        weight: 3,
                                    }}
                                    eventHandlers={{
                                        click: () => {
                                            setInspectedAsset({
                                                id: `${roadId}-breach`,
                                                title: `Road Breach: ${roadMeta.name}`,
                                                category: "ROAD",
                                                badgeText: "IMPASSABLE WATER HAZARD",
                                                badgeColor: "bg-red-600/30 text-red-200 border border-red-500/50",
                                                subtitle: "Active Hydrodynamic Causeway Breach",
                                                status: "ROAD BLOCKED",
                                                metrics: [
                                                    { label: "Data Source", value: "PWD Field Engineers / Satellite Radar" },
                                                    { label: "Freshness", value: "Updated 1m ago" },
                                                    { label: "Water Depth", value: "0.85m Surge" },
                                                    { label: "Flow Velocity", value: "1.8 m/s Current" },
                                                    { label: "Cutoff Route", value: roadId },
                                                    { label: "Emergency Diversion", value: "Watercraft IRB Launch at G1" },
                                                ],
                                                notes: "Vehicular road access severed by flood surge. Google OR-Tools intermodal solver automatically re-routed dispatches to Watercraft IRBs launching from Ghat Jetty G1.",
                                            });
                                        }
                                    }}
                                >
                                    <Tooltip permanent direction="top" offset={[0, -8]} className="tooltip-road-blocked">
                                        [BLOCKED] {roadId}: {roadMeta.name.split(" ")[0]} (~0.8m Surge)
                                    </Tooltip>
                                </Circle>
                            )}
                        </Fragment>
                    );
                })}

                {/* 8. ACTIVE DISPATCH ROUTES (OR-TOOLS SCIP MILP SOLVER - DISPLAYED IN EMERGENCY / NDRF MODE) */}
                {showRoutes && routingMode === "EMERGENCY" && resourceRoutes.map((route) => {
                    const startCoord = route.waypoints[0] || route.from;
                    const endCoord = route.waypoints[route.waypoints.length - 1] || route.to;

                    return (
                        <Fragment key={`route_frag_${route.resource}`}>
                            {/* Route Contrast Underlayer Casing */}
                            <Polyline
                                positions={route.waypoints}
                                pathOptions={{
                                    color: "#020617",
                                    weight: 8,
                                    opacity: 0.90,
                                }}
                            />
                            {/* Route Active Navigation Core */}
                            <Polyline
                                positions={route.waypoints}
                                pathOptions={{
                                    color: route.isWatercraft ? "#06b6d4" : "#f59e0b",
                                    weight: 4.5,
                                    opacity: 0.98,
                                    dashArray: route.isWatercraft ? "6 8" : "8 6",
                                }}
                                eventHandlers={{
                                    click: () => {
                                        setInspectedAsset({
                                            id: route.resource,
                                            title: `${route.isWatercraft ? "Watercraft IRB" : "Ambulance"} → ${route.villageName}`,
                                            category: "ROUTE",
                                            badgeText: `${route.priority} PRIORITY`,
                                            badgeColor: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
                                            subtitle: `Optimized Inter-Modal Dispatch: Unit ${route.resource}`,
                                            status: "IN TRANSIT",
                                            metrics: [
                                                { label: "Data Source", value: "Google OR-Tools SCIP MILP Solver" },
                                                { label: "Freshness", value: "Optimized T-0 (Real-Time)" },
                                                { label: "Dispatch Mode", value: route.dispatchMode },
                                                { label: "Distance", value: `${route.distanceKm.toFixed(1)} km` },
                                                { label: "Est. Travel Time", value: `${route.travelTimeMin} mins` },
                                                { label: "Target Settlement", value: route.villageName },
                                            ],
                                            notes: route.reason,
                                        });
                                    }
                                }}
                            >
                                <Tooltip sticky direction="top">
                                    {route.isWatercraft ? "Rescue Boat" : "Ambulance"} {route.resource} → {route.villageName} ({route.travelTimeMin} min ETA) • Source: OR-Tools Solver (Updated 0m ago)
                                </Tooltip>
                            </Polyline>

                            {/* Origin Dispatch Pin */}
                            <Circle
                                center={startCoord}
                                radius={18}
                                pathOptions={{
                                    color: "#10b981",
                                    fillColor: "#059669",
                                    fillOpacity: 1,
                                    weight: 2.5,
                                }}
                            >
                                <Tooltip direction="bottom">
                                    Origin: {route.resource} Staging Base
                                </Tooltip>
                            </Circle>

                            {/* Destination Target Pin */}
                            <Circle
                                center={endCoord}
                                radius={22}
                                pathOptions={{
                                    color: route.isWatercraft ? "#0891b2" : "#d97706",
                                    fillColor: route.isWatercraft ? "#06b6d4" : "#f59e0b",
                                    fillOpacity: 1,
                                    weight: 2.5,
                                }}
                            >
                                <Tooltip permanent direction="top" offset={[0, -8]} className="tooltip-route-evac">
                                    [{route.isWatercraft ? "IRB" : "AMB"}] {route.resource} → {route.villageName.split(" ")[0]} ({route.travelTimeMin}m)
                                </Tooltip>
                            </Circle>
                        </Fragment>
                    );
                })}

                {/* 8B. ACTIVE EVACUATION CORRIDOR (DUAL-MODE: CIVILIAN SAFE VS EMERGENCY TACTICAL) */}
                {showEvacCorridor && activeEvacCorridor && (
                    <Fragment key={`evac_corridor_${selectedEvacOrigin}_${routingMode}`}>
                        {/* Corridor Contrast Underlayer */}
                        <Polyline
                            positions={activeEvacCorridor.waypoints}
                            pathOptions={{
                                color: "#020617",
                                weight: routingMode === "CIVILIAN" ? 10 : 8,
                                opacity: 0.95,
                            }}
                        />
                        {/* Corridor Active Guidance Path */}
                        <Polyline
                            positions={activeEvacCorridor.waypoints}
                            pathOptions={{
                                color: routingMode === "CIVILIAN"
                                    ? "#10b981"
                                    : activeEvacCorridor.mode.includes("Watercraft") || activeEvacCorridor.mode.includes("IRB") ? "#06b6d4" : "#f59e0b",
                                weight: routingMode === "CIVILIAN" ? 6 : 4.5,
                                opacity: 1,
                                dashArray: routingMode === "CIVILIAN" ? undefined : "10 6",
                            }}
                        >
                            <Tooltip permanent direction="center" className="tooltip-route-evac">
                                [{routingMode === "CIVILIAN" ? "CIVILIAN EVAC" : "NDRF ROUTE"}] {activeEvacCorridor.distanceKm} km (~{activeEvacCorridor.transitTimeMin}m)
                            </Tooltip>
                        </Polyline>

                        {/* Origin Village Pin */}
                        <Circle
                            center={activeEvacCorridor.waypoints[0]}
                            radius={28}
                            pathOptions={{
                                color: routingMode === "CIVILIAN" ? "#10b981" : "#f59e0b",
                                fillColor: routingMode === "CIVILIAN" ? "#059669" : "#d97706",
                                fillOpacity: 1,
                                weight: 3,
                            }}
                        >
                            <Tooltip direction="bottom">
                                Origin ({routingMode}): {activeEvacCorridor.originName}
                            </Tooltip>
                        </Circle>

                        {/* Target Shelter Pin */}
                        <Circle
                            center={activeEvacCorridor.waypoints[activeEvacCorridor.waypoints.length - 1]}
                            radius={32}
                            pathOptions={{
                                color: routingMode === "CIVILIAN" ? "#047857" : "#b45309",
                                fillColor: routingMode === "CIVILIAN" ? "#10b981" : "#f59e0b",
                                fillOpacity: 1,
                                weight: 3.5,
                            }}
                        >
                            <Tooltip direction="top">
                                Destination Shelter: {activeEvacCorridor.targetShelterName} ({activeEvacCorridor.elevationSafetyGain})
                            </Tooltip>
                        </Circle>
                    </Fragment>
                )}

                {/* 9. RELIEF SHELTERS (S1, S2) */}
                {/* 9. RELIEF SHELTERS (S1, S2) */}
                {Object.entries(activeSector.shelters).map(([shelterId, meta]) => {
                    const liveShelter = shelterStatus?.find((s) => s.id === shelterId);
                    const sTotal = liveShelter ? liveShelter.capacity : meta.capacity;
                    const sOccupied = liveShelter
                        ? liveShelter.occupied
                        : (floodActive
                            ? (affectedVillages.length >= 3 ? sTotal : affectedVillages.length >= 1 ? Math.round(sTotal * 0.75) : Math.round(sTotal * 0.25))
                            : 15);
                    const sPct = Math.round((sOccupied / sTotal) * 100);
                    const isOverflowActive = !!shelterOverflow || sPct >= 100 || liveShelter?.status === "CRITICAL_SHORTAGE";

                    const statusColor: OperationalStatusColor = isDegradedMode
                        ? "grey"
                        : isOverflowActive
                        ? "red"
                        : sPct >= 80
                        ? "amber"
                        : "green";

                    const tooltipClass = getOperationalTooltipClass(statusColor);

                    return (
                        <Marker
                            key={`shelter_${shelterId}`}
                            position={meta.coords}
                            icon={createOperationalIcon("SHELTER", statusColor)}
                            eventHandlers={{
                                click: () => {
                                    setInspectedAsset({
                                        id: shelterId,
                                        title: meta.name,
                                        category: "SHELTER",
                                        badgeText: isOverflowActive ? "100% FULL - CAPACITY EXCEEDED" : `SHELTER ${shelterId}`,
                                        badgeColor: isOverflowActive ? "bg-red-600/30 text-red-200 border border-red-500/60" : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40",
                                        subtitle: meta.type,
                                        status: isOverflowActive ? "CAPACITY EXCEEDED" : (sPct >= 80 ? "NEAR CAPACITY" : "OPERATIONAL"),
                                        metrics: [
                                            { label: "Data Source", value: "District Relief Registry / Sphere Audit" },
                                            { label: "Intake Status", value: `${sOccupied} / ${sTotal} Beds (${sPct}%)` },
                                            { label: "Design Capacity", value: `${sTotal} beds` },
                                            { label: "Vacancy Status", value: isOverflowActive ? "0 BEDS (FULL - NO VACANCY)" : `${sTotal - sOccupied} Available` },
                                            { label: "Overflow Divert", value: isOverflowActive ? "ACTIVE -> DIRECT TO OVERFLOW SITES" : "STANDBY" },
                                            { label: "Ration Reserves", value: liveShelter?.food_remaining_days ? `${liveShelter.food_remaining_days} Days Stocked` : "3.5 Days Stocked" },
                                        ],
                                        notes: isOverflowActive
                                            ? "CAPACITY EXCEEDED: Shelter reached 100% maximum capacity. Recommended Actions: 1) Activate pre-identified overflow sites (Barauni Stadium & Manjhaul Complex); 2) Request additional tents from DDMA/BSDMA; 3) Prioritise vulnerable individuals (elderly, children, medical); 4) Update public messaging to direct arrivals to overflow sites."
                                            : "Designated multi-story high-ground concrete flood evacuation facility.",
                                    });
                                }
                            }}
                        >
                            <Tooltip
                                permanent
                                direction={shelterId === "S2" ? "right" : "top"}
                                offset={shelterId === "S2" ? [16, 0] : [0, -16]}
                                className={tooltipClass}
                            >
                                [{shelterId}] {shelterId === "S1" ? "Rajkiya" : "Panchayat"} ({sPct}%)
                            </Tooltip>
                        </Marker>
                    );
                })}

                {/* 9B. PRE-IDENTIFIED OVERFLOW RELIEF SITES (ACTIVATED WHEN SHELTER OVERFLOW OCCURS) */}
                {(shelterOverflow || floodActive) && PRE_IDENTIFIED_OVERFLOW_SITES.map((site) => (
                    <Circle
                        key={`overflow_site_${site.id}`}
                        center={site.coords}
                        radius={38}
                        pathOptions={{
                            color: "#f59e0b",
                            fillColor: "#d97706",
                            fillOpacity: 0.90,
                            weight: 2.5,
                            dashArray: "6 4",
                        }}
                        eventHandlers={{
                            click: () => {
                                setInspectedAsset({
                                    id: site.id,
                                    title: site.name,
                                    category: "SHELTER",
                                    badgeText: "PRE-IDENTIFIED OVERFLOW SITE",
                                    badgeColor: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
                                    subtitle: site.type,
                                    status: "ACTIVATED AUXILIARY SITE",
                                    metrics: [
                                        { label: "Data Source", value: "DDMA / BSDMA Disaster Contingency Plan" },
                                        { label: "Overflow Capacity", value: `${site.capacity.toLocaleString()} Persons` },
                                        { label: "Managing Authority", value: site.authority },
                                        { label: "Elevation Safety", value: site.elevationGain },
                                        { label: "Operational Role", value: "Absorbs Unsheltered Evacuee Influx" },
                                        { label: "Intake Logistics", value: "Mobile Kitchen & Tented Ward Ready" },
                                    ],
                                    notes: "Pre-surveyed high-ground auxiliary relief site activated under Disaster Management Act contingency protocols to absorb excess evacuees when permanent primary shelters (S1 & S2) reach 100% capacity.",
                                });
                            }
                        }}
                    >
                        <Tooltip direction="top">
                            [OVF] {site.shortName} (Cap: {site.capacity})
                        </Tooltip>
                    </Circle>
                ))}

                {/* 10. HOSPITALS (H1, H2, H3) */}
                {Object.entries(activeSector.hospitals).map(([hospitalId, meta]) => {
                    const isCutoff = isHospitalAffected(hospitalId);
                    const statusColor: OperationalStatusColor = isDegradedMode
                        ? "grey"
                        : isCutoff
                        ? "amber"
                        : "green";

                    const tooltipClass = getOperationalTooltipClass(statusColor);

                    const shortName = hospitalId === "H1" ? "Barauni" : hospitalId === "H2" ? "Sadar" : "Sultanganj";
                    const direction = hospitalId === "H1" ? "right" : hospitalId === "H2" ? "top" : "bottom";
                    const offset: [number, number] = hospitalId === "H1" ? [16, 0] : hospitalId === "H2" ? [0, -16] : [0, 16];

                    return (
                        <Marker
                            key={`hospital_${hospitalId}`}
                            position={meta.coords}
                            icon={createOperationalIcon("HOSPITAL", statusColor)}
                            eventHandlers={{
                                click: () => {
                                    setInspectedAsset({
                                        id: hospitalId,
                                        title: meta.name,
                                        category: "HOSPITAL",
                                        badgeText: isCutoff ? "ACCESS SEVERED - GENERATOR BACKUP" : "OPEN & ACCESSIBLE",
                                        badgeColor: isCutoff ? "bg-orange-500/20 text-orange-300 border border-orange-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
                                        subtitle: meta.type,
                                        status: isCutoff ? "BACKUP GENERATOR" : "OPERATIONAL",
                                        metrics: [
                                            { label: "Bed Capacity", value: `${meta.capacity} Beds` },
                                            { label: "Arterial Road", value: isCutoff ? "SUBMERGED (NH-31)" : "OPEN" },
                                            { label: "Triage Capacity", value: "30 Emergencies/hr" },
                                        ],
                                        notes: meta.role,
                                    });
                                }
                            }}
                        >
                            <Tooltip
                                permanent
                                direction={direction}
                                offset={offset}
                                className={tooltipClass}
                            >
                                [{hospitalId}] {shortName} ({meta.capacity}B)
                            </Tooltip>
                        </Marker>
                    );
                })}

                {/* 11. ACTIVE AMBULANCES / ALS UNITS (ALS-01, ALS-02, BLS-03) */}
                {[
                    { id: "A1", unitId: "ALS-01", name: "ALS Ambulance ALS-01", coords: activeSector.ambulances["A1"]?.coords || activeSector.resourceBases["A1"] || [25.1420, 85.9410], baseName: "Barauni Railhead Staging", type: "Advanced Life Support (ALS)" },
                    { id: "A2", unitId: "ALS-02", name: "ALS Ambulance ALS-02", coords: activeSector.ambulances["A2"]?.coords || activeSector.resourceBases["A2"] || [25.1470, 85.9610], baseName: "Sultanganj CHC Staging", type: "Advanced Life Support (ALS)" },
                    { id: "A3", unitId: "BLS-03", name: "BLS Ambulance BLS-03", coords: activeSector.ambulances["A3"]?.coords || activeSector.resourceBases["A3"] || [25.1355, 85.9495], baseName: "Sadar Base Staging", type: "Basic Life Support (BLS)" },
                ].map((amb) => {
                    const alloc = (effectiveAllocations || []).find((a) => a.resource === amb.id || a.resource.startsWith(amb.id));
                    const isDispatched = !!alloc;
                    const statusColor: OperationalStatusColor = isDegradedMode
                        ? "grey"
                        : isDispatched
                        ? "amber"
                        : "green";

                    const tooltipClass = getOperationalTooltipClass(statusColor);

                    const statusLabel = isDegradedMode
                        ? "Offline"
                        : isDispatched
                        ? `En-route (${alloc.village_name?.split(" ")[0] || alloc.village_id})`
                        : "Ready";

                    return (
                        <Marker
                            key={`amb_unit_${amb.id}`}
                            position={amb.coords as [number, number]}
                            icon={createOperationalIcon("AMBULANCE", statusColor)}
                            eventHandlers={{
                                click: () => {
                                    setInspectedAsset({
                                        id: amb.id,
                                        title: amb.name,
                                        category: "ROUTE",
                                        badgeText: isDispatched ? `DISPATCHED (${amb.unitId})` : `AVAILABLE (${amb.unitId})`,
                                        badgeColor: isDispatched ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
                                        subtitle: amb.type,
                                        status: isDispatched ? "EN-ROUTE TO CASUALTY" : "STANDBY AT BASE",
                                        metrics: [
                                            { label: "Unit ID", value: amb.unitId },
                                            { label: "Vehicle Type", value: amb.type },
                                            { label: "Staging Location", value: amb.baseName },
                                            { label: "Mission Status", value: statusLabel },
                                            ...(alloc ? [{ label: "Target Settlement", value: alloc.village_name || alloc.village_id }, { label: "Estimated ETA", value: `${alloc.estimated_travel_time_min} min` }] : []),
                                        ],
                                        notes: "High-clearance emergency medical evacuation ambulance equipped for disaster response.",
                                    });
                                }
                            }}
                        >
                            <Tooltip
                                permanent
                                direction="bottom"
                                offset={[0, 16]}
                                className={tooltipClass}
                            >
                                [{amb.unitId}] {statusLabel}
                            </Tooltip>
                        </Marker>
                    );
                })}

                {/* 11B. IRB / RESCUE BOATS (RB-01, RB-02) */}
                {[
                    { id: "RB1", unitId: "RB-01", name: "IRB Rescue Boat RB-01", coords: activeSector.resourceBases["RB1"] || [25.1500, 85.9450], baseName: "Barauni Ghat Launch Point", type: "40HP Inflatable Rescue Boat (Zodiac)" },
                    { id: "RB2", unitId: "RB-02", name: "IRB Rescue Boat RB-02", coords: activeSector.resourceBases["RB2"] || [25.1560, 85.9560], baseName: "Sultanganj Ghat Jetty", type: "40HP Inflatable Rescue Boat (Zodiac)" },
                ].map((boat) => {
                    const alloc = (effectiveAllocations || []).find((a) => a.resource === boat.id || a.resource.startsWith(boat.id));
                    const isDispatched = !!alloc;
                    const statusColor: OperationalStatusColor = isDegradedMode
                        ? "grey"
                        : isDispatched
                        ? "amber"
                        : "green";

                    const tooltipClass = getOperationalTooltipClass(statusColor);

                    const statusLabel = isDegradedMode
                        ? "Offline"
                        : isDispatched
                        ? `En-route (${alloc.village_name?.split(" ")[0] || alloc.village_id})`
                        : "Ready";

                    return (
                        <Marker
                            key={`boat_unit_${boat.id}`}
                            position={boat.coords as [number, number]}
                            icon={createOperationalIcon("RESCUE_BOAT", statusColor)}
                            eventHandlers={{
                                click: () => {
                                    setInspectedAsset({
                                        id: boat.id,
                                        title: boat.name,
                                        category: "ROUTE",
                                        badgeText: isDispatched ? `DEPLOYED (${boat.unitId})` : `AVAILABLE (${boat.unitId})`,
                                        badgeColor: isDispatched ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
                                        subtitle: boat.type,
                                        status: isDispatched ? "WATER EVACUATION IN PROGRESS" : "MOORED AT LAUNCH JETTY",
                                        metrics: [
                                            { label: "Unit ID", value: boat.unitId },
                                            { label: "Craft Type", value: boat.type },
                                            { label: "Launch Point", value: boat.baseName },
                                            { label: "Mission Status", value: statusLabel },
                                            ...(alloc ? [{ label: "Target Island", value: alloc.village_name || alloc.village_id }, { label: "Water ETA", value: `${alloc.estimated_travel_time_min} min` }] : []),
                                        ],
                                        notes: "NDRF / SDRF high-freeboard inflatable rescue boat deployed for waterborne diara evacuation.",
                                    });
                                }
                            }}
                        >
                            <Tooltip
                                permanent
                                direction={boat.id === "RB1" ? "top" : "right"}
                                offset={boat.id === "RB1" ? [0, -16] : [16, 0]}
                                className={tooltipClass}
                            >
                                [{boat.unitId}] {statusLabel}
                            </Tooltip>
                        </Marker>
                    );
                })}

                {/* 12. VILLAGE SETTLEMENTS (V1 - V5) */}
                {Object.entries(activeSector.villages).map(([villageId, meta]) => {
                    const isAffected = isVillageAffected(villageId) && floodActive;
                    const villageConfig: Record<string, { name: string; fullName: string; direction: "top" | "bottom" | "left" | "right"; offset: [number, number] }> = {
                        V1: { name: "Pipra Dewas", fullName: "Pipra Dewas", direction: "left", offset: [-14, 0] },
                        V2: { name: "Sultanganj Diara", fullName: "Sultanganj Diara", direction: "left", offset: [-12, 0] },
                        V3: { name: "Mirzapur Bandh", fullName: "Mirzapur Bandh", direction: "left", offset: [-14, 0] },
                        V4: { name: "Simaria Ghat", fullName: "Simaria Ghat North", direction: "left", offset: [-14, 0] },
                        V5: { name: "Rajendra Bridge", fullName: "Rajendra Bridge Approach", direction: "right", offset: [14, 0] },
                    };
                    const vCfg = villageConfig[villageId] || { name: meta.name, fullName: meta.name, direction: "top", offset: [0, -8] };

                    return (
                        <Circle
                            key={`village_${villageId}`}
                            center={meta.coords}
                            radius={isAffected ? 44 : 34}
                            pathOptions={{
                                color: isAffected ? "#ef4444" : "#0284c7",
                                fillColor: isAffected ? "#dc2626" : "#38bdf8",
                                fillOpacity: 0.95,
                                weight: 2.5,
                            }}
                            eventHandlers={{
                                click: () => {
                                    setInspectedAsset({
                                        id: villageId,
                                        title: vCfg.fullName,
                                        category: "VILLAGE",
                                        badgeText: isAffected ? "CRITICAL INUNDATION" : "SAFE / CLEAR",
                                        badgeColor: isAffected ? "bg-red-500/20 text-red-300 border border-red-500/40" : "bg-sky-500/20 text-sky-300 border border-sky-500/40",
                                        subtitle: meta.type,
                                        status: isAffected ? "ROAD CUTOFF" : "ACCESSIBLE",
                                        metrics: [
                                            { label: "Exposed Population", value: `${meta.population.toLocaleString()} Residents` },
                                            { label: "Settlement Type", value: meta.type },
                                            { label: "Evacuation Priority", value: isAffected ? "HIGH (Score: 0.88)" : "NORMAL" },
                                            { label: "Dispatch Required", value: isAffected ? "WATERCRAFT IRB" : "ROAD VEHICLE" },
                                        ],
                                        notes: meta.vulnerability,
                                    });
                                }
                            }}
                        >
                            <Tooltip
                                permanent
                                direction={vCfg.direction}
                                offset={vCfg.offset}
                                className={isAffected ? "tooltip-village-cutoff" : "tooltip-village-safe"}
                            >
                                {isAffected ? `[CUT OFF] [${villageId}] ${vCfg.name}` : `[${villageId}] ${vCfg.name}`}
                            </Tooltip>
                        </Circle>
                    );
                })}

                {/* 13. AIR OPERATIONS (HELIPADS & AERIAL AIRDROP DROP ZONES) */}
                {showAirOps && (tacticalFilter === "ALL" || tacticalFilter === "WATER_AIR") && AIR_OPERATIONS_ASSETS.map((asset) => (
                    <Fragment key={`air_asset_${asset.id}`}>
                        <Circle
                            center={asset.coords}
                            radius={asset.type === "HELIPAD" ? 44 : 38}
                            pathOptions={{
                                color: asset.type === "HELIPAD" ? "#38bdf8" : "#f59e0b",
                                fillColor: asset.type === "HELIPAD" ? "#0284c7" : "#d97706",
                                fillOpacity: 0.95,
                                weight: 2.5,
                                dashArray: asset.type === "AIRDROP_DZ" ? "5 4" : undefined,
                            }}
                            eventHandlers={{
                                click: () => {
                                    setInspectedAsset({
                                        id: asset.id,
                                        title: asset.name,
                                        category: "AIR_OPS",
                                        badgeText: asset.type === "HELIPAD" ? "IAF / NDRF HELIPAD" : asset.type === "EMERGENCY_LZ" ? "EMERGENCY LZ" : "AIRDROP TARGET",
                                        badgeColor: asset.type === "HELIPAD" ? "bg-sky-500/20 text-sky-300 border border-sky-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40",
                                        subtitle: `${asset.type.replace("_", " ")} • Elevation: ${asset.elevationMSL}m MSL`,
                                        status: asset.status,
                                        metrics: [
                                            { label: "Surface / Deck", value: asset.dimensions },
                                            { label: "Aircraft Rating", value: asset.capacity },
                                            { label: "Air Comms Net", value: asset.vhfComms },
                                            { label: "Controlling Authority", value: asset.authority },
                                            { label: "Runway Condition", value: asset.runwayOrSurface },
                                            { label: "Operational State", value: asset.status },
                                        ],
                                        notes: asset.notes,
                                    });
                                }
                            }}
                        >
                            <Tooltip direction="bottom">
                                [{asset.type === "HELIPAD" ? "HELI" : asset.type === "EMERGENCY_LZ" ? "LZ" : "AIRDROP"}] {asset.shortName}
                            </Tooltip>
                        </Circle>
                    </Fragment>
                ))}

                {/* 14. CENTRAL WATER COMMISSION (CWC) HYDRO-TELEMETRY STATION */}
                {showCWCGauge && (tacticalFilter === "ALL" || tacticalFilter === "WATER_AIR") && (() => {
                    const gaugeLevel = mode === "live" && liveTelemetry ? liveTelemetry.water_level_m : (floodActive ? 42.45 : CWC_HYDRO_STATION.currentLevelM);
                    const dangerLevel = CWC_HYDRO_STATION.dangerLevelM;
                    const gaugeStatusColor: OperationalStatusColor = isDegradedMode
                        ? "grey"
                        : gaugeLevel >= dangerLevel
                        ? "red"
                        : gaugeLevel >= dangerLevel - 0.5
                        ? "amber"
                        : "green";

                    const trendText = mode === "live" && liveTelemetry
                        ? (liveTelemetry.barrage_status?.alert_level || "+3.8cm/h")
                        : (floodActive ? "+5.2cm/h Rise" : `+${CWC_HYDRO_STATION.rateOfRiseCmHr}cm/h`);

                    const tooltipClass = getOperationalTooltipClass(gaugeStatusColor);

                    return (
                        <Marker
                            position={CWC_HYDRO_STATION.coords}
                            icon={createOperationalIcon("CWC_GAUGE", gaugeStatusColor)}
                            eventHandlers={{
                                click: () => {
                                    setInspectedAsset({
                                        id: CWC_HYDRO_STATION.id,
                                        title: CWC_HYDRO_STATION.name,
                                        category: "HYDRO_GAUGE",
                                        badgeText: gaugeStatusColor === "red" ? "DANGER LEVEL EXCEEDED" : "CWC AUTOMATED BUOY",
                                        badgeColor: gaugeStatusColor === "red" ? "bg-red-600/30 text-red-200 border border-red-500/50" : "bg-blue-600/30 text-blue-200 border border-blue-500/50",
                                        subtitle: "Middle Ganga Hydrological Observation Division (Telemetry Node)",
                                        status: CWC_HYDRO_STATION.status,
                                        metrics: [
                                            { label: "River Stage", value: `${gaugeLevel.toFixed(2)}m MSL` },
                                            { label: "Danger Level", value: `${CWC_HYDRO_STATION.dangerLevelM}m MSL` },
                                            { label: "High Flood Level (HFL)", value: `${CWC_HYDRO_STATION.highFloodLevelM}m MSL` },
                                            { label: "Rate of Rise / Trend", value: trendText },
                                            { label: "Flow Velocity", value: `${CWC_HYDRO_STATION.riverVelocityMs} m/s (4.27 kts)` },
                                            { label: "Discharge Volume", value: `${CWC_HYDRO_STATION.dischargeCumecs.toLocaleString()} m³/s` },
                                        ],
                                        notes: "CRITICAL: Surface velocity exceeds 2.0 m/s. Watercraft rescue operations restricted strictly to twin-engine 40HP+ IRBs with high-freeboard Zodiac hulls.",
                                    });
                                }
                            }}
                        >
                            <Tooltip permanent direction="right" offset={[16, 0]} className={tooltipClass}>
                                [CWC Gauge] {gaugeLevel.toFixed(2)}m ({trendText})
                            </Tooltip>
                        </Marker>
                    );
                })()}

                {/* 15. TACTICAL CALIPER / MEASUREMENT LINE */}
                {caliperPoints.length > 0 && (
                    <Fragment>
                        {caliperPoints.map((pt, idx) => (
                            <Circle
                                key={`caliper_pt_${idx}`}
                                center={pt}
                                radius={22}
                                pathOptions={{
                                    color: idx === 0 ? "#10b981" : "#38bdf8",
                                    fillColor: idx === 0 ? "#059669" : "#0284c7",
                                    fillOpacity: 1,
                                    weight: 2.5,
                                }}
                            >
                                <Tooltip permanent direction="top">
                                    Point {idx === 0 ? "A (Origin)" : "B (Target)"}
                                </Tooltip>
                            </Circle>
                        ))}
                        {caliperPoints.length === 2 && caliperMeasurement && (
                            <Polyline
                                positions={caliperPoints}
                                pathOptions={{
                                    color: "#38bdf8",
                                    weight: 3.5,
                                    dashArray: "6 6",
                                    opacity: 0.95,
                                }}
                            >
                                <Tooltip permanent direction="center">
                                    {caliperMeasurement.distKm} km ({caliperMeasurement.distM}m) | {caliperMeasurement.bearing}° N
                                </Tooltip>
                            </Polyline>
                        )}
                    </Fragment>
                )}
            </MapContainer>

            {/* BOTTOM-LEFT: MINIMAL CLEAN MAP LEGEND */}
            <div className="absolute bottom-3 left-3 z-[1000] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                {!legendOpen ? (
                    <button
                        onClick={() => setLegendOpen(true)}
                        className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-950/85 px-2.5 py-1 text-xs font-semibold text-slate-200 shadow-xl backdrop-blur transition hover:text-white"
                        title="Show Map Legend"
                    >
                        <span>Map Legend</span>
                    </button>
                ) : (
                    <div className="rounded-xl border border-slate-700/90 bg-slate-950/95 p-3 text-xs text-white backdrop-blur-md shadow-2xl transition max-w-[280px] max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                            <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">Map Legend</span>
                            <button
                                onClick={() => setLegendOpen(false)}
                                className="cursor-pointer text-[10px] font-mono text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800"
                            >
                                [X] Close
                            </button>
                        </div>

                        {/* STATUS COLOR SYSTEM */}
                        <div className="mb-2.5 pb-2 border-b border-slate-800/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asset Status System</span>
                            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                                    <span className="text-emerald-300 font-medium">Available / Ready</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
                                    <span className="text-amber-300 font-medium">En-route / Limited</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-red-500 shrink-0 shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
                                    <span className="text-red-300 font-medium">Busy / Unavailable</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-slate-500 shrink-0" />
                                    <span className="text-slate-400 font-medium">Offline</span>
                                </div>
                            </div>
                        </div>

                        {/* CRITICAL OPERATIONAL ASSETS */}
                        <div className="mb-2.5 pb-2 border-b border-slate-800/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Critical Operational Assets</span>
                            <div className="space-y-1.5 text-[11px]">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-500 flex items-center justify-center shrink-0">
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="#34d399"><path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/></svg>
                                    </div>
                                    <span>Hospital (H1-H3: Name + Beds)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-500 flex items-center justify-center shrink-0">
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="#34d399"><path d="M12 3L2 12h3v8h14v-8h3L12 3zm0 4.5l5 4.5v6h-3v-4H10v4H7v-6l5-4.5z"/></svg>
                                    </div>
                                    <span>Relief Shelter (S1-S2: Name + Occ %)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-xs bg-emerald-950 border border-emerald-500 flex items-center justify-center shrink-0">
                                        <svg width="9" height="7" viewBox="0 0 24 24" fill="#34d399"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/><path d="M11 7.5h2v2h2v2h-2v2h-2v-2H9v-2h2z"/></svg>
                                    </div>
                                    <span>Ambulance / ALS (Unit ID + Status)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-xs bg-emerald-950 border border-emerald-500 flex items-center justify-center shrink-0">
                                        <svg width="9" height="7" viewBox="0 0 24 24" fill="#34d399"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 15.28L2.05 16.5C3.39 18.59 5.67 20 8.24 20h7.52c2.57 0 4.85-1.41 6.19-3.5l-1.9-1.22c-.93 1.45-2.52 2.42-4.29 2.42H8.24c-1.77 0-3.36-.97-4.29-2.42zM12 2L6 14h12L12 2zm0 3.5l3.25 6.5h-6.5L12 5.5z"/></svg>
                                    </div>
                                    <span>IRB Rescue Boat (RB-01/02 + Status)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-sky-950 border border-sky-500 flex items-center justify-center shrink-0">
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="#38bdf8"><path d="M12 2c-5.33 4-8 8-8 12 0 4.42 3.58 8 8 8s8-3.58 8-8c0-4-2.67-8-8-12zm0 18c-3.31 0-6-2.69-6-6 0-2.97 2.16-6.19 6-9.15 3.84 2.96 6 6.18 6 9.15 0 3.31-2.69 6-6 6z"/></svg>
                                    </div>
                                    <span>CWC Hydro Gauge (Level + Trend)</span>
                                </div>
                            </div>
                        </div>

                        {/* SETTLEMENTS & CORRIDORS */}
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Settlements & Corridors</span>
                            <div className="space-y-1 text-[11px]">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-xs bg-sky-400 inline-block shrink-0" />
                                    <span>Safe Village (V1-V5)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-xs bg-red-600 inline-block shrink-0" />
                                    <span>Inundated / Cut-off Village</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3.5 h-1 bg-emerald-500 inline-block shrink-0 rounded-xs" />
                                    <span className={routingMode === "CIVILIAN" ? "font-bold text-emerald-300" : ""}>Civilian Safe Corridor</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3.5 h-0.5 border-t-2 border-dashed border-amber-400 inline-block shrink-0" />
                                    <span className={routingMode === "EMERGENCY" ? "font-bold text-amber-300" : ""}>Emergency Tactical Route</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3.5 h-0.5 bg-rose-500 border-t border-dashed border-rose-300 inline-block shrink-0" />
                                    <span>Submerged Roadway</span>
                                </div>
                                <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-400">
                                    <span>* Secondary assets (power, telecom) show info on click/hover.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* TACTICAL COMPASS ROSE (TRUE NORTH REFERENCE) */}
            <div className="absolute top-14 right-3 z-[1000] pointer-events-none flex flex-col items-center bg-slate-950/85 p-1 rounded-lg border border-slate-700/70 shadow-lg backdrop-blur-sm">
                <div className="relative w-6 h-6 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                        <polygon points="12,2 8,11 12,9 16,11" fill="#38bdf8" />
                        <polygon points="12,22 8,13 12,15 16,13" fill="#64748b" />
                    </svg>
                    <span className="absolute -top-1 font-mono text-[8px] font-black text-cyan-300">N</span>
                </div>
                <span className="text-[7px] font-mono font-bold text-slate-400 tracking-tighter">TRUE</span>
            </div>

            {/* TACTICAL CALIPER MEASUREMENT HUD */}
            {caliperActive && (
                <div
                    className="absolute top-22 left-3 z-[1001] pointer-events-auto rounded-md border border-slate-700 bg-[#0c1322] p-2.5 text-xs text-white shadow-none w-[280px] sm:w-[320px] space-y-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                            <strong className="text-cyan-300 font-mono text-xs">CALIPER TRANSIT ESTIMATOR</strong>
                        </div>
                        <button
                            onClick={() => {
                                setCaliperPoints([]);
                                setCaliperActive(false);
                            }}
                            className="cursor-pointer text-[10px] font-mono text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800"
                        >
                            [CLOSE]
                        </button>
                    </div>
                    {caliperMeasurement ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between bg-slate-900/90 p-2 rounded border border-slate-800 font-mono">
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Linear Distance</span>
                                    <strong className="text-sm text-cyan-300 font-black">{caliperMeasurement.distKm} km</strong>
                                    <span className="text-[10px] text-slate-400 ml-1">({caliperMeasurement.distM} m)</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-slate-400 block">Bearing</span>
                                    <strong className="text-sm text-amber-300 font-black">{caliperMeasurement.bearing}° True</strong>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                                <div className="bg-slate-900/70 p-1.5 rounded border border-slate-800">
                                    <span className="text-slate-400 block">Foot Evac (4km/h)</span>
                                    <strong className="text-emerald-300 text-xs">~{caliperMeasurement.footMin} min</strong>
                                </div>
                                <div className="bg-slate-900/70 p-1.5 rounded border border-slate-800">
                                    <span className="text-slate-400 block">NDRF 4x4 (30km/h)</span>
                                    <strong className="text-amber-300 text-xs">~{caliperMeasurement.truckMin} min</strong>
                                </div>
                                <div className="bg-slate-900/70 p-1.5 rounded border border-slate-800">
                                    <span className="text-slate-400 block">Watercraft (15km/h)</span>
                                    <strong className="text-cyan-300 text-xs">~{caliperMeasurement.boatMin} min</strong>
                                </div>
                                <div className="bg-slate-900/70 p-1.5 rounded border border-slate-800">
                                    <span className="text-slate-400 block">Rotary-Wing (180km/h)</span>
                                    <strong className="text-sky-300 text-xs">~{caliperMeasurement.heloMin} min</strong>
                                </div>
                            </div>
                            <button
                                onClick={() => setCaliperPoints([])}
                                className="w-full py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold cursor-pointer transition shadow-none"
                            >
                                Reset Points (Measure Another Vector)
                            </button>
                        </div>
                    ) : (
                        <div className="text-[11px] text-slate-300 space-y-1">
                            <p className="text-amber-300 font-semibold">
                                {caliperPoints.length === 0 ? "Step 1: Click Origin (Point A) on the map." : "Step 2: Click Destination (Point B) on the map."}
                            </p>
                            <p className="text-[10px] text-slate-400">
                                Computes precise geodesic distance and multi-modal transit speed for foot columns, tactical 4x4s, IRBs, and helicopters.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* BOTTOM-RIGHT: METRIC SCALE REFERENCE & CURSOR HUD */}
            <div className="absolute bottom-3 right-3 z-[1000] pointer-events-none flex flex-col items-end gap-1.5">
                {/* Real-time Cursor Coordinates HUD */}
                {cursorCoords && (
                    <div className="flex items-center gap-2 bg-[#0c1322] px-2 py-0.5 rounded border border-slate-700 font-mono text-[10px] text-slate-300 shadow-none">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        <span className="text-slate-100 font-bold">{cursorCoords.lat.toFixed(4)}° N, {cursorCoords.lng.toFixed(4)}° E</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-slate-300 hidden md:inline">{formatDMS(cursorCoords.lat, true)} {formatDMS(cursorCoords.lng, false)}</span>
                        <span className="text-slate-600 hidden md:inline">|</span>
                        <span className="text-amber-300 font-bold">~{Math.round(44 + (cursorCoords.lat - 25.14) * 80)}m MSL</span>
                    </div>
                )}

                {/* Metric Scale Bar */}
                <div className="flex flex-col items-end gap-0.5 bg-[#0c1322] px-2 py-0.5 rounded border border-slate-700/70 shadow-none font-mono text-[9px] text-slate-300">
                    <div className="flex items-center justify-between w-24 border-b border-l border-r border-slate-300 h-1.5">
                        <span className="text-[8px] -translate-y-2.5">0</span>
                        <span className="text-[8px] -translate-y-2.5">500m</span>
                        <span className="text-[8px] -translate-y-2.5">1km</span>
                    </div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Metric Scale (WGS84)</span>
                </div>
            </div>

            {/* BOTTOM-CENTER: LIVE FORECAST CONTROLLER (DISPLAYED ONLY IN LIVE TELEMETRY & SAR MODE) */}
            {mode === "live" && (
                <div
                    className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto flex items-center gap-1.5 rounded-md border p-1 shadow-none transition-all ${
                        isDegradedMode
                            ? "border-amber-600/60 bg-[#140e05] opacity-80"
                            : "border-slate-700 bg-[#0c1322]"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-1 px-1.5 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                        <span>Live Forecast:</span>
                    </div>
                    {(["now", "+6h", "+12h", "+24h"] as const).map((h) => {
                        const isActive = timeHorizon === h;
                        const label = h === "now" ? "Now" : h;
                        return (
                            <button
                                key={h}
                                disabled={isDegradedMode}
                                onClick={() => handleHorizonChange(h)}
                                className={`px-2 py-0.5 text-xs font-mono font-bold rounded transition ${
                                    isDegradedMode
                                        ? "cursor-not-allowed text-slate-500"
                                        : isActive
                                            ? "bg-cyan-700 text-white font-bold cursor-pointer shadow-none"
                                            : "text-slate-300 hover:text-white hover:bg-slate-800/80 cursor-pointer"
                                }`}
                                title={isDegradedMode ? "Forecast horizon controls disabled in Degraded Mode" : `Switch flood forecast horizon to ${h === "now" ? "Current (Now)" : `${h} forecast`}`}
                            >
                                {label}
                            </button>
                        );
                    })}

                    <div className="h-4 w-px bg-slate-800 mx-0.5" />

                    {/* PLAYBACK AUTO-LOOP BUTTON */}
                    <button
                        disabled={isDegradedMode}
                        onClick={() => setForecastPlaying(prev => !prev)}
                        className={`px-2 py-0.5 text-xs font-mono font-bold rounded transition flex items-center gap-1 ${
                            isDegradedMode
                                ? "cursor-not-allowed opacity-50"
                                : forecastPlaying
                                    ? "bg-amber-600 text-slate-950 font-bold cursor-pointer shadow-none"
                                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer shadow-none"
                        }`}
                        title={forecastPlaying ? "Pause forecast progression loop" : "Auto-cycle forecast progression loop (Now -> +6h -> +12h -> +24h every 2.5s)"}
                    >
                        <span>{forecastPlaying ? "[PAUSE]" : "[PLAY]"}</span>
                    </button>

                    <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />
                    <span className={`text-[10px] font-mono px-1 hidden sm:inline font-semibold ${isDegradedMode ? "text-amber-400" : "text-cyan-300"}`}>
                        {isDegradedMode ? "Degraded Mode (Forecast Controls Disabled)" : `Showing: ${timeHorizon === "now" ? "Now (T-0 Baseline)" : `${timeHorizon} forecast`}`}
                    </span>
                </div>
            )}
        </div>
    );
}