# Data Sources & Licensing

| Data | Source | License / notes |
| --- | --- | --- |
| Stations, line geometry, names (en/ar) | OpenStreetMap via Overpass API | ODbL. Attribution required: "© OpenStreetMap contributors". Derived datasets must remain ODbL. |
| Fares, zones, subscriptions, hours | Official Cairo Metro site (https://www.cairometro.gov.eg/) | Facts re-entered manually and verified; cite the source and date in each data file. |
| Geocoding | Nominatim / Photon | Respect usage policies (rate limit, cache, identify the app). |
| Walking routes | OSRM / OpenRouteService | Public demo servers are rate-limited; fall back to straight-line distance. |
| Map tiles | To be decided (OSM tiles are not for heavy use) | Attribution required. |

## Benchmark app policy

"Egypt Transport" (com.megahed.cairometro) is used **only as a black-box benchmark** by comparing trip results as a normal user.
Do not decompile the APK or copy its bundled data (its bus/microbus data is independently collected by its author).

## Accuracy disclaimer

There is no official GTFS or real-time feed. Ride/transfer times are estimates; the app must say so and link to official sources.
