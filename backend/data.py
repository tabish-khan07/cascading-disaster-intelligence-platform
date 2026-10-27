# Demo roads
roads = {
    "R1": {
        "status": "open",
        "risk": 0.20,
        "points": [
            [28.4744, 77.5040],
            [28.4780, 77.5080],
        ],
    },
    "R2": {
        "status": "open",
        "risk": 0.30,
        "points": [
            [28.4800, 77.5070],
            [28.4850, 77.5130],
        ],
    },
    "R3": {
        "status": "open",
        "risk": 0.10,
        "points": [
            [28.4680, 77.5150],
            [28.4720, 77.5200],
        ],
    },
    "R4": {
        "status": "open",
        "risk": 0.25,
        "points": [
            [28.4740, 77.5000],
            [28.4780, 77.5020],
        ],
    },
    "R5": {
        "status": "open",
        "risk": 0.35,
        "points": [
            [28.4750, 77.5200],
            [28.4700, 77.5170],
        ],
    },
}


# Demo villages
villages = {
    "V1": {
        "population": 5420,
        "road": "R1",
        "lat": 28.4744,
        "lon": 77.5040,
    },
    "V2": {
        "population": 7850,
        "road": "R2",
        "lat": 28.4820,
        "lon": 77.5100,
    },
    "V3": {
        "population": 4200,
        "road": "R3",
        "lat": 28.4680,
        "lon": 77.5150,
    },
    "V4": {
        "population": 3600,
        "road": "R4",
        "lat": 28.4750,
        "lon": 77.5010,
    },
    "V5": {
        "population": 4850,
        "road": "R5",
        "lat": 28.4760,
        "lon": 77.5210,
    },
}


# Demo hospitals
hospitals = {
    "H1": {
        "village": "V1",
        "capacity": 100,
        "lat": 28.4760,
        "lon": 77.5060,
    },
    "H2": {
        "village": "V2",
        "capacity": 80,
        "lat": 28.4840,
        "lon": 77.5120,
    },
    "H3": {
        "village": "V3",
        "capacity": 120,
        "lat": 28.4700,
        "lon": 77.5170,
    },
}


# Demo shelters
shelters = {
    "S1": {
        "capacity": 500,
        "lat": 28.4800,
        "lon": 77.5000,
    },
    "S2": {
        "capacity": 700,
        "lat": 28.4660,
        "lon": 77.5120,
    },
}


# Demo ambulances
ambulances = {
    "A1": {
        "lat": 28.4700,
        "lon": 77.5000,
        "status": "available",
    },
    "A2": {
        "lat": 28.4750,
        "lon": 77.5200,
        "status": "available",
    },
    "A3": {
        "lat": 28.4650,
        "lon": 77.5100,
        "status": "available",
    },
}