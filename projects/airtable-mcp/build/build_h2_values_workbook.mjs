// Compatibility entry point for the original H2 workbook builder.
// The clean builder is the project standard: curated business sheets only,
// lookup values resolved to readable names, and machine IDs excluded.
await import("./build_h2_values_workbook_clean.mjs");
