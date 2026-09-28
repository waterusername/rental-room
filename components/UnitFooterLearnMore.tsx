"use client";

import { usePathname } from "next/navigation";

const DIFFERENCE_URL = "https://www.grinbergmanagement.com/the-difference";

function isUnitPage(pathname: string): boolean {
  return pathname.startsWith("/units/") || pathname.startsWith("/s/");
}

export function UnitFooterLearnMore() {
  const pathname = usePathname();
  if (!isUnitPage(pathname)) return null;

  return (
    <p className="mt-3 text-sm leading-6">
      <a href={DIFFERENCE_URL} className="font-semibold text-accent">
        Learn more at grinbergmanagement.com
      </a>
    </p>
  );
}
