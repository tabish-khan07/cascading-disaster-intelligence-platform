import Link from "next/link";

export const metadata = {
  title: "Terms and Conditions | Cascading Disaster Intelligence Platform",
};

export default function TermsAndConditions() {
  return (
    <main className="min-h-screen bg-[#0b0f17] text-slate-100 font-sans antialiased">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 font-semibold">
          &larr; Back to Dashboard
        </Link>

        <h1 className="text-2xl font-black text-white mt-6 mb-2">Terms and Conditions</h1>
        <p className="text-xs text-slate-400 mb-8">Effective date: October 2026</p>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing and using the Cascading Disaster Intelligence Platform, you acknowledge that you
              have read, understood, and agree to be bound by these terms. This platform is developed for
              disaster management decision support under the National Disaster Management Authority (NDMA)
              and Bihar State Disaster Management Authority (BSDMA) operational framework.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. Purpose and Scope</h2>
            <p>
              This platform is a decision support tool designed to assist State Emergency Operations Centres
              (SEOCs), District Magistrates, and NDRF/SDRF field commanders in flood disaster response
              planning. It provides spatial risk assessment, cascading infrastructure failure analysis,
              and resource optimisation recommendations.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. Disclaimer of Warranties</h2>
            <p>
              Flood risk scores, inundation predictions, and resource dispatch recommendations are generated
              through computational models and should be used as supplementary decision support only.
              Operational decisions must be verified against ground-truth observations and validated through
              established government protocols. The platform does not guarantee the accuracy of satellite
              imagery interpretation or weather forecasts.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. Data Accuracy</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Weather observations are sourced from Open-Meteo and may differ from IMD official bulletins.</li>
              <li>Digital elevation data (NASA SRTM) has a native resolution of 30 metres and may not capture micro-topography.</li>
              <li>SAR water mask interpretation is algorithmic and subject to false positives in urban areas.</li>
              <li>River gauge estimates are computed from regression models, not direct CWC telemetry feeds.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">5. Limitation of Liability</h2>
            <p>
              The developers and operators of this platform shall not be held liable for any direct,
              indirect, incidental, or consequential damages arising from the use of or reliance upon
              the information, predictions, or recommendations provided by this system. All emergency
              actions should follow established NDMA, SDMA, and district administration protocols.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">6. Intellectual Property</h2>
            <p>
              The platform architecture, spatial risk algorithms, cascading failure engine, and
              inter-modal dispatch optimiser are original works. Open-source libraries used include
              Leaflet (BSD-2), Google OR-Tools (Apache 2.0), XGBoost (Apache 2.0), and Next.js (MIT).
              Map data is provided by OpenStreetMap contributors under ODbL.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">7. Governing Law</h2>
            <p>
              These terms are governed by the laws of the Republic of India and the State of Bihar.
              Any disputes shall be subject to the exclusive jurisdiction of the courts in Patna, Bihar.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
