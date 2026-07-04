"use client";

import { createContext, useContext } from "react";
import type { MyVenue } from "./data";

export const VenueContext = createContext<MyVenue | null>(null);

export function useVenue(): MyVenue {
  const v = useContext(VenueContext);
  if (!v) throw new Error("useVenue outside dashboard");
  return v;
}
