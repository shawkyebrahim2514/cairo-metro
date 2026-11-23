# Cairo Metro: feature guide

A detailed description of everything the app does today. Each feature lists what the user sees, how it behaves, and the rules behind it, so it can be used as a script for demos, videos or documentation.

Live app: https://shawkyebrahim2514.github.io/cairo-metro/ (source: https://github.com/shawkyebrahim2514/cairo-metro).

## 1. What the app is

A free web app (installable PWA) for Cairo Metro Lines 1, 2 and 3. It answers two questions:

1. **Which metro station is nearest to a place?** (any place, Google Maps link, map tap or current location)
2. **How do I get from A to B by metro?** (stations, transfers, time, fare, walking, live guidance)

Key properties:

- Works fully **offline** once opened (all station data and the places index are bundled).
- **English and Arabic** (right-to-left layout), switchable at any time.
- **Light, dark or automatic** theme and four route highlight colours.
- No account, no ads, no tracking. Location is used only on the device.
- Built for phones (a 390 px wide screen is the main target) and also works on desktop.

## 2. Screens and navigation

- **App bar** (top): app name, Settings (gear), Help (?) and the language button (English / العربية).
- **Bottom tab bar**: _Nearest station_ and _Trip planner_. The last tab is remembered.
- **Settings sheet** and **feature tour** open on top of the screen.

## 3. Nearest station

Where a user types or picks a place and sees the closest stations.

**Ways to choose a place**

- **Search box**: type a station name, a landmark, a district, a mall, a hospital, and so on, in English or Arabic.
- **Google Maps link**: paste any of the common link forms (`@lat,lng`, `!3d..!4d..`, `q=`, `ll=`). The coordinates are read directly.
- **Shared text** (installed app): share a place from Google Maps to the app. The name, address and link are read, and the place is found offline.
- **Short Maps links** (`maps.app.goo.gl`): cannot be expanded without a server, so the app asks for the place name instead and shows a tip about copying coordinates.
- **Map tap**: tap anywhere on the map or tap a station dot.
- **Locate me**: the target button inside the search box uses GPS.

**Result**

- The three nearest stations, each with line badges (L1 blue, L2 red, L3 green), an interchange tag where relevant, the walking distance and walking time.
- Walking distance is an estimate: straight-line distance multiplied by 1.3 (no street routing is used, to stay offline).
- The map shows the chosen place and the stations, zoomed to fit.

## 4. Search (shared by every input)

- **Offline places index** of about 7,600 places in Greater Cairo (from OpenStreetMap), including parks, malls, hospitals, universities, mosques, markets and more.
- **Filter chips**: All, Stations, Places. Stations always appear first. Places show their nearest station and the distance.
- **Smart matching**: tolerates spelling variants and transliteration (for example _El Monib_, _Elmonib_, _المنيب_), different word order, and curated alternative names such as _Tahrir_ for Sadat or area names.
- **Keyboard and screen reader support**: arrow keys, Enter to choose, Escape to close.

## 5. Trip planner

Plan a metro trip between two points. Each end can be a station, a place, a Maps link, a map pin or the current location.

**Inputs**

- **From** (teal dot) and **To** (red dot), a **swap** button, and map taps that fill From first, then To.
- The planner also accepts a shared link (`#/plan?from=..&to=..`) and opens the trip directly.

**Results** (two cards when they differ)

- **Fastest** route and **Fewest transfers** route.
- **Route card**, built in parts:
  - **Header**: the tag (Fastest or Fewest transfers), a large total time and the arrival clock time if you leave now.
  - **Three stat tiles**: stations (the boarding station counts, an interchange counts once), changes (or "Direct, no changes") and the fare in EGP.
  - **Service strip**: green "Running, a train about every N min", or amber "closing soon" with the last train time, or a closed notice. Based on the device clock.
  - **Vertical timeline**: dotted walk segments with distance and time; a boarding node with a coloured Line pill and "towards" the terminal; a collapsible "N stops, M min" box that lists the stops in between; a highlighted "Change to Line N, 4 min" chip at interchanges; a "Get off here" exit node; and the destination node.
  - **Women-only cars**: a collapsed tip (the two middle cars of every train; men may use them after 9 pm).
- **Actions** under the card: a large **Track my trip** button, then Share and Save.
- **Door to door**: when From or To is a place, the planner tries the three nearest stations at each end and adds the walk to the first station and from the last station. If the walk is shorter than about 700 m it suggests walking instead.
  **Fares and passes**

- Fare uses the official ticket tiers (10 EGP up to 9 stations, 12 up to 16, 15 up to 23, 20 up to 39 for the standard ticket). Ticket type can be standard, senior 60+/army/police, or special needs/veterans (set in Settings).

**Estimates**

- Times use about 2 minutes per station plus a 4-minute transfer. Official end-to-end times were checked: Line 1 about 79 minutes (ours 81), Line 2 38 (ours 39). There is no official timetable, so all times are estimates and the app says so.

**Saving and sharing**

- **Share** the trip as a link (Web Share sheet on phones, clipboard otherwise).
- **Star** a trip to save it. Recent trips (last six) and saved trips appear when no trip is open. All stored on the device.

## 6. Where can I get to (reachability)

When only **From** is chosen, the planner lists the stations reachable within 10, 20, 30, 45 or 60 minutes (for example 50 stations at 20 minutes, 79 at 45). They are also highlighted on the map. Useful for "what is near me by metro".

## 7. The map

- Our own drawing of the three lines with the official colours, station dots and tappable stations.
- **Station names beside each dot**, shown by zoom level (interchanges first, route stations always), in the current language.
- **Route highlight**: when a trip is planned the route gets a glow in the chosen highlight colour, a white outline, each leg in its line colour and animated dots flowing in the direction of travel. The other lines fade.
- **Controls**: zoom, locate me, expand to full screen (on the Nearest tab).
- **Map tiles** (streets) are optional and off by default, to keep the app fast and offline. When switched on they come from OpenStreetMap. Street labels inside these tiles are drawn by OpenStreetMap and do not change with the app language; the station names always do.

## 8. Bottom sheet layout (planner)

The planner is a full-screen map with a panel (sheet) sliding over it.

- Three heights: **peek** (inputs only), **half** and **full**. Tap or drag the handle to change.
- The sheet opens to half when a route appears or when a search box is focused.
- The route is fitted into the visible part of the map above the sheet.
- The report link and data attribution sit at the end of the sheet.

## 9. Live trip tracking

Start from any planned trip with **Track my trip**.

- **Follows you**: GPS is matched to the route and a pulsing blue dot moves on the map; the map can follow it (_Follow me_).
- **Panel**: next station, stops left, estimated time left, and the next event ("Change at X" or "Get off at Y").
- **Underground fallback**: GPS is unreliable in tunnels, so after about a minute without a fix the app estimates progress using the ride times (it never marks arrival by itself). A line shows whether the position comes from GPS, from you, or from the estimate.
- **I am at...**: choose your current station to correct the position at any time.
- **Off route**: if the GPS position is far from the route a notice appears with **Re-plan from here**, which sets From to the current position and plans again.
- **Arrival**: "You have arrived at X" and, when there is a walk, the walking steps to the destination.
- **Wake me before my stop**: an alarm (strong vibration, beep and spoken message) repeats every few seconds until dismissed.
- **Stops** when the trip, route or ticket type changes.
- Limits: it works while the page is open and the screen is on (a web app cannot alert in the background). The screen can be kept awake. A native wrapper could add background alerts later.

## 10. Trip alerts (Settings)

Chosen once in Settings, used during tracking.

- **Vibration** on or off, with different patterns: a short pulse per station, a double pulse for a change, a long buzz for the exit.
- **Pulse at every station**.
- **Warn before a change or exit**: off, or 1, 2 or 3 stops before.
- **Beep** and **spoken announcements** (English or Arabic voice).
- **Keep the screen on** while tracking.
- **Test alert** button plays each alert type.
- A notice appears on devices without vibration support (for example iPhone).

## 11. Settings

Opened with the gear button, grouped as:

- **Appearance**: theme (Light, Dark, Auto), and the route highlight colour (amber, violet, pink, cyan).
- **Trip alerts**: see above.
- **Time format**: 12-hour or 24-hour clock for the arrival time and last-train times.
- **Trip and map**: ticket type and the map tiles switch.

All choices are saved on the device.

## 12. Help, tour and feedback

- **Feature tour**: a skippable four-step introduction on first launch, reopened with the ? button.
- **Report a problem**: opens a prefilled GitHub issue that includes the current trip link, language and device.
- Contributors: see `CONTRIBUTING.md`. A monthly GitHub Action prepares a data refresh pull request for review.

## 13. Offline, install and sharing

- **Installable PWA** (Add to Home screen). The app shell, data and places index are cached by a small service worker; a new version appears on the second load.
- **Share target**: once installed on Android, the app appears in the share menu for text or links.
- **Hosted on GitHub Pages**, deployed automatically on every push to the main branch.

## 14. Accessibility

- Search box is a full combobox: arrow keys move through a listbox of results, Enter picks, and the result count is announced.
- Dialogs (Settings, tour) move focus in, trap Tab, close on Escape and return focus. Tabs are a navigation with the current page marked.
- Tracking announces only the next station, with alarm and off-route messages as alerts. The wake-me alarm still fires if a station is skipped, and audio is unlocked when you tap Track.
- Search fields use clean icon buttons (clear, my location with a spinner while locating), and scrollbars are custom-styled thin rounded bars that follow the theme.
- Map stations can be focused with Tab and chosen with Enter. Buttons are at least 44 px; muted text and line badges meet contrast.
- Dark mode contrast, reduced-motion support (animations stop), and a meta description.
- Lighthouse (mobile): performance 0.99, accessibility 1, best practices 1, SEO 1 at the time of the last check.
- An accessibility review is tracked in `docs/PLAN.md`.

## 15. Data and honesty about accuracy

- **Network**: Lines 1, 2 and 3: 84 stations, 5 interchanges (Line 1: 35, Line 2: 20, Line 3: 34 stations).
- **Sources**: OpenStreetMap (ODbL, attribution shown), Wikidata cross-check, the official Cairo Metro site for fares and hours, and manual curation for transfers and ride times. Station verification was done by hand.
- **Estimates**: travel times, waiting times and walking distances are estimates. Line 3 headway is not officially verified. Station-to-zone data for passes is not available, so zones are estimated from the ticket tier.
- **Not included yet**: Monorail, BRT (Ring Road bus), LRT and Lines 4+, exits and facilities, real-time data, next-train times.

## 16. Tech summary

React 19 and Vite, a pure TypeScript core package (routing, fares, search, tracking, tests), Leaflet for the map, static JSON data, Vitest tests, GitHub Actions for CI, data refresh and Pages deployment.
