"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillsTab } from "@/components/customize/skills-tab";
import { ConnectorsTab } from "@/components/customize/connectors-tab";

type TabValue = "skills" | "connectors";

function isTabValue(value: string | null): value is TabValue {
  return value === "skills" || value === "connectors";
}

/**
 * Reads the ?tab= query param in its own component wrapped in Suspense -
 * Next.js requires any useSearchParams() call to be inside a Suspense
 * boundary during static export. Lets a link elsewhere in the app deep-link
 * straight into a specific tab, e.g. /customize?tab=connectors.
 */
function InitialTabFromQueryParam({ onResolved }: { onResolved: (tab: TabValue) => void }) {
  const searchParams = useSearchParams();
  // Guards against firing more than once: onResolved is a fresh function on
  // every parent render (not memoized), so including it in the effect's
  // dependency array - required, since the effect closes over it - would
  // otherwise re-run this on every render triggered by onResolved's own
  // state update. Same fix as the workflows page's ?new=1 shortcut.
  const firedRef = useRef(false);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (!firedRef.current && isTabValue(tab)) {
      firedRef.current = true;
      onResolved(tab);
    }
  }, [searchParams, onResolved]);

  return null;
}

export default function CustomizePage() {
  const [tab, setTab] = useState<TabValue>("skills");

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <InitialTabFromQueryParam onResolved={setTab} />
      </Suspense>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customize</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Skills and connectors - the building blocks employees are assembled from.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => isTabValue(v) && setTab(v)}>
        <TabsList>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
        </TabsList>
        <TabsContent value="skills">
          <SkillsTab />
        </TabsContent>
        <TabsContent value="connectors">
          <ConnectorsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
