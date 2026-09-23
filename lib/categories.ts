import { CATEGORY_NAV } from "./nav";
import type { Category } from "./types";

const CATEGORY_COPY: Record<Category, { title: string; lede: string }> = {
  apartment: {
    title: "Apartments",
    lede: "Residential vacancies from the office sheet. Filter by bedrooms and bathrooms. Each card shows a street-level photo of the building, plus rents, program flags, and a Matterport tour when a link is on file.",
  },
  commercial: {
    title: "Commercial",
    lede: "Retail and storefront space, including extra Matterport links when one address has more than one tour.",
  },
  garage: {
    title: "Garages",
    lede: "Garage spaces from the office sheet. Storage rooms and sheds are listed separately.",
  },
  storage: {
    title: "Storages",
    lede: "Storage rooms and sheds from the office sheet.",
  },
};

const CATEGORY_BY_HREF: Record<string, Category> = {
  "/": "apartment",
  "/commercial": "commercial",
  "/garages": "garage",
  "/storages": "storage",
};

export const CATEGORY_ORDER = CATEGORY_NAV.map((item) => {
  const category = CATEGORY_BY_HREF[item.href];
  return { category, href: item.href, label: item.label, ...CATEGORY_COPY[category] };
});

export function categoryMeta(category: Category) {
  return CATEGORY_ORDER.find((item) => item.category === category) ?? CATEGORY_ORDER[0];
}
