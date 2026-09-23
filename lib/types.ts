export type Category = "apartment" | "commercial" | "garage" | "storage";

export type Tour = {
  url: string;
  label: string | null;
};

export type Listing = {
  id: string;
  category: Category;
  address: string;
  unit: string;
  unitType: string;
  minRent: number | null;
  targetRent: number | null;
  potentialRent: number | null;
  zip: string | null;
  status: string;
  nycha: "YES" | "NO" | null;
  hpdTrustFund: "YES" | "NO" | null;
  utilitiesIncluded: string | null;
  washerDryer: "YES" | "NO" | null;
  tourReady: string | null;
  tours: Tour[];
  officeNotes: string | null;
  daysVacant: number | null;
  reservationDate: string | null;
  daysSinceReservation: number | null;
  bedrooms: number | null;
  baths: number | null;
  prospect: string | null;
  notes: string | null;
};

export type TrackerRow = {
  id: string;
  address: string;
  unit: string;
  unitType: string;
  zip: string | null;
  reserved: boolean;
  prospect: string | null;
  status: string | null;
  tourUrl: string | null;
  rent: number | null;
};

export type InventoryFile = {
  source: {
    name: string;
    snapshotDate: string;
    note: string;
  };
  contact: {
    applyEmail: string;
    phones: { label: string; number: string }[];
    notes: string[];
    apartmentsHeader?: string;
  };
  listings: {
    apartments: Listing[];
    commercial: Listing[];
    garages: Listing[];
    storages: Listing[];
    pipeline: Listing[];
    reserved: Listing[];
    residentialTracker: TrackerRow[];
  };
};

export type Filters = {
  q: string;
  beds: string;
  baths: string;
  status: string;
  unitType: string;
  zip: string;
  rent: string;
  tour: string;
};

export const EMPTY_FILTERS: Filters = {
  q: "",
  beds: "",
  baths: "",
  status: "",
  unitType: "",
  zip: "",
  rent: "",
  tour: "",
};
