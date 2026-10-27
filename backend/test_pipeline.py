from disaster_pipeline import run_disaster_pipeline


def main():
    scenarios = [
        ("Scenario A (Normal Patrol)", 45, 2.0, 4.2),
        ("Scenario B (Embankment Threat)", 130, 4.5, 7.8),
        ("Scenario C (Kosi River Breach)", 230, 6.0, 9.4),
    ]

    for name, rf, dur, wl in scenarios:
        res = run_disaster_pipeline(rainfall_mm=rf, duration_hours=dur, water_level_m=wl)
        event = res["event"]
        impact = res["impact"]
        util = res["cascade_utilities"]
        opt = res["resource_optimization"]
        sos = res["sos_feed"]

        print(f"\n==================== {name} ====================")
        print(f"Risk Score: {event['risk_score']} ({event['hazard_level']}) | ML Backed: {event.get('ml_backed')}")
        print(f"Severed Roads: {impact['affected_roads']} | Affected Population: {impact['population_affected']:,}")
        print(f"Substations Down: {util['affected_substations']} | Hospitals on Backup Power: {util['hospitals_on_backup_power']}")
        print(f"Telecom Down: {util['affected_telecom']} | Comm Blackout: {util['villages_comm_blackout']}")
        print(f"Shelter Occupancy: {util['shelter_occupancy_pct']}% | Active Distress SOS Calls: {len(sos)}")

        alloc_strs = [
            f"{a['resource']} ({a['resource_type']} / {a['dispatch_mode']}) -> {a['village_id']} ({a['village_name']})"
            for a in opt["allocations"]
        ]
        print(f"Total Dispatches ({len(alloc_strs)}):")
        for s in alloc_strs:
            print(f"  - {s}")
        print(f"Intermodal Distribution: {opt.get('intermodal_dispatch')}")


if __name__ == "__main__":
    main()

