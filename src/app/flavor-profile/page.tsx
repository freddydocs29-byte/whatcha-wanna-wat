/**
 * RETIRED — flavor-profile is no longer part of the onboarding or profile flow.
 *
 * Novelty/adventurousness is now captured in onboarding Step 3 (novelty_bias float
 * stored on profiles and in wwe_novelty_bias localStorage key).
 *
 * This page redirects to home. Any direct traffic to /flavor-profile bounces cleanly.
 *
 * TODO: Evaluate full deletion once confirmed no existing users are hitting this route.
 *       Check analytics for /flavor-profile page views before removing the file.
 *       wwe_flavor_profile localStorage data for existing users is intentionally
 *       preserved — saveFlavorProfile / getFlavorProfile remain in storage.ts and
 *       the scoring.ts FlavorProfile signal still reads from it. Nothing breaks for
 *       users who completed the old flavor profile; they just won't be routed here anymore.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FlavorProfilePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
