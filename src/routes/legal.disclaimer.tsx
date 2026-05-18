import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/marketplace/LegalPage";

export const Route = createFileRoute("/legal/disclaimer")({
  head: () => ({ meta: [{ title: "Disclaimer — HUXZAIN" }] }),
  component: () => (
    <LegalPage title="Disclaimer" eyebrow="Legal">
      <p>HUXZAIN is an intermediary marketplace. HUXZAIN does not own, sell, host, or warrant any listing on the platform. All listings are the sole responsibility of the respective vendor.</p>
      <p>HUXZAIN is not affiliated with, endorsed by, or sponsored by any game publisher. Trademarks and game names are the property of their respective owners.</p>
      <p>Use of certain services (e.g., account purchases, boosting) may violate the terms of service of the relevant game publisher. Buyers and sellers are solely responsible for understanding and accepting these risks.</p>
    </LegalPage>
  ),
});
