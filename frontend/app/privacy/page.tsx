import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Cascading Disaster Intelligence Platform",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[#0b0f17] text-slate-100 font-sans antialiased">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 font-semibold">
          &larr; Back to Dashboard
        </Link>

        <h1 className="text-2xl font-black text-white mt-6 mb-2">Privacy Policy</h1>
        <p className="text-xs text-slate-400 mb-8">Last updated: October 2026</p>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-white mb-2">1. Information We Collect</h2>
            <p>
              This platform processes geospatial sensor data, satellite imagery metadata, and hydrological telemetry
              for flood risk assessment. When using the Live Telemetry feature, we may request access to your
              device&apos;s GPS coordinates to determine your geographic location. This data is used solely for
              real-time disaster risk evaluation and is not stored on our servers beyond the active session.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Rendering localised flood inundation risk maps based on your selected monitoring zone.</li>
              <li>Computing cascading infrastructure failure assessments (power grid, telecom, road network).</li>
              <li>Running resource optimisation algorithms (Google OR-Tools SCIP) for emergency dispatch routing.</li>
              <li>Generating official Situation Reports (SITREP) for State Emergency Operations Centre use.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. Data Sources</h2>
            <p>
              Environmental data is sourced from public scientific APIs including Open-Meteo (weather observations),
              NASA SRTM (digital elevation models), Copernicus Sentinel-1A (SAR radar imagery), and the Central
              Water Commission (river gauge levels). No personally identifiable information is collected from
              these sources.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. Data Retention</h2>
            <p>
              Simulation results may be cached in your browser&apos;s local storage for session continuity.
              No user data is transmitted to or retained on external servers. All computations are performed
              in real-time and discarded after the session ends.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">5. Third-Party Services</h2>
            <p>
              Map tiles are provided by OpenStreetMap contributors. Weather data is sourced from Open-Meteo.
              These services have their own privacy policies. We do not share any user data with these providers
              beyond the minimum required for API requests (geographic coordinates for weather lookups).
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">6. Security</h2>
            <p>
              All API communications use HTTPS encryption. The platform does not collect passwords,
              authentication tokens, or sensitive personal data. Geolocation access requires explicit
              browser permission and can be revoked at any time through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">7. Contact</h2>
            <p>
              For questions regarding this privacy policy, contact the Bihar State Disaster Management
              Authority (BSDMA) through official government channels or the State Emergency Operations
              Centre (SEOC) helpline at 1070.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
