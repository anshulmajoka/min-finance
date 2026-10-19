import type { InstitutionSummary } from "@/lib/types";

export function institutionLabel(
  institution: InstitutionSummary,
  institutions: InstitutionSummary[],
) {
  const name = institution.institutionName?.trim() || "Institution";
  const duplicates = institutions.filter(
    (item) => (item.institutionName?.trim() || "Institution") === name,
  );
  if (duplicates.length < 2) return name;
  const index = duplicates.findIndex((item) => item.itemId === institution.itemId);
  return `${name} ${index + 1}`;
}
