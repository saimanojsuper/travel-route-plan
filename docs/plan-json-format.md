# Trip plan JSON format

Trip plans are portable UTF-8 JSON documents. Version `1` is the only currently supported schema version. The runtime source of truth is `src/schemas/tripSchema.ts`; TypeScript consumers can use the interfaces in `src/types/trip.ts`.

## Import, export, and recovery

- Export validates the active plan, pretty-prints the complete document as UTF-8 JSON, and downloads it with a title/date-based filename.
- Import accepts local `.json` files up to 5 MiB, validates the schema and cross-record rules, then shows a summary before replacement. Parsing, validation, and cancellation never mutate the active plan.
- Unsupported schema versions are rejected explicitly. Version `1` remains unchanged.
- Confirmed imports replace the active plan as one undoable change and become the latest local recovery draft.
- Valid edits autosave a recovery draft in browser `localStorage`. Recovery is browser/device-specific and is not a substitute for an exported backup.
- Clearing local recovery does not alter the active in-memory plan. Starting a new plan clears the active plan, undo history, and recovery draft after confirmation.

## Validation rules

- Objects are strict: unknown properties are rejected so misspelled fields do not silently disappear.
- Dates use `YYYY-MM-DD`; date-times use ISO 8601 with `Z` or an explicit timezone offset; activity times use 24-hour `HH:mm`.
- Trip and stop end dates cannot precede their start dates. Ordered stops form one contiguous partition of the trip: every trip date belongs to exactly one stop.
- The itinerary contains exactly one sequentially numbered day for every trip date, and each day is inside its assigned stop range.
- IDs must be non-empty and unique within each record collection. Every stop/day reference must resolve, and a referenced day must belong to the same stop as its activity, food entry, or event.
- Travel legs connect each pair of adjacent route stops in order.
- URLs accept only absolute `http` and `https` URLs. Google Maps URLs are recognized by later UI behavior, not restricted by this storage format.
- INR amounts must be finite and nonnegative. INR is the sole supported currency.
- Activity `order` values are consecutive within each day/time-slot group. An activity end time requires a start time and must be later than it. Overlaps are intentionally valid; they produce UI warnings rather than validation errors.
- `description`, notes, links, times, costs, and other fields marked optional below may be omitted. Do not encode omitted values as `undefined`, because JSON has no such value.

## Representative version 1 document

```json
{
  "schemaVersion": 1,
  "metadata": {
    "id": "trip-golden-triangle",
    "title": "Golden Triangle",
    "description": "Three cities in three days",
    "coverImageUrl": "https://images.example.com/india.jpg",
    "startDate": "2026-11-01",
    "endDate": "2026-11-03",
    "createdAt": "2026-10-24T12:00:00Z",
    "updatedAt": "2026-10-24T12:00:00Z"
  },
  "routeStops": [
    {
      "id": "stop-delhi",
      "city": "Delhi",
      "startDate": "2026-11-01",
      "endDate": "2026-11-02",
      "order": 0
    },
    {
      "id": "stop-agra",
      "city": "Agra",
      "startDate": "2026-11-03",
      "endDate": "2026-11-03",
      "order": 1
    }
  ],
  "travelLegs": [
    {
      "id": "leg-delhi-agra",
      "fromStopId": "stop-delhi",
      "toStopId": "stop-agra",
      "order": 0,
      "transportMode": "train",
      "mapsUrl": "https://www.google.com/maps/dir/Delhi/Agra",
      "notes": "Reserve a morning train"
    }
  ],
  "days": [
    {
      "id": "day-1",
      "routeStopId": "stop-delhi",
      "date": "2026-11-01",
      "dayNumber": 1,
      "notes": "Take it easy after arrival",
      "isLeisure": false
    },
    {
      "id": "day-2",
      "routeStopId": "stop-delhi",
      "date": "2026-11-02",
      "dayNumber": 2,
      "isLeisure": true
    },
    {
      "id": "day-3",
      "routeStopId": "stop-agra",
      "date": "2026-11-03",
      "dayNumber": 3,
      "isLeisure": false
    }
  ],
  "activities": [
    {
      "id": "activity-tomb",
      "dayId": "day-1",
      "routeStopId": "stop-delhi",
      "title": "See Humayun's Tomb",
      "notes": "Buy tickets online",
      "slot": "morning",
      "startTime": "09:00",
      "endTime": "11:00",
      "durationMinutes": 120,
      "category": "culture",
      "mapsUrl": "https://maps.google.com/?q=Humayun%27s+Tomb",
      "costInr": 600,
      "status": "planned",
      "order": 0
    }
  ],
  "foodEntries": [
    {
      "id": "food-petha",
      "routeStopId": "stop-agra",
      "dayId": "day-3",
      "dish": "Petha",
      "mealType": "snack",
      "restaurant": "Local sweet shop",
      "mapsUrl": "https://maps.google.com/?q=Agra+sweets",
      "notes": "Try the dry variety",
      "estimatedCostInr": 250,
      "priority": "must-try",
      "status": "planned"
    }
  ],
  "arrivalDepartureEvents": [
    {
      "id": "arrival-agra",
      "routeStopId": "stop-agra",
      "dayId": "day-3",
      "type": "arrival",
      "place": "Agra Cantt railway station",
      "dateTime": "2026-11-03T09:15:00+05:30",
      "mapsUrl": "https://maps.google.com/?q=Agra+Cantt",
      "notes": "Pre-book a taxi"
    }
  ],
  "budget": {
    "currency": "INR",
    "targetInr": 20000
  }
}
```

## Enum values

| Field | Allowed values |
| --- | --- |
| Activity slot | `morning`, `afternoon`, `evening` |
| Item status | `planned`, `done`, `skipped` |
| Activity category | `sightseeing`, `culture`, `nature`, `adventure`, `shopping`, `relaxation`, `food`, `transport`, `other` |
| Transport mode | `flight`, `train`, `bus`, `car`, `taxi`, `ferry`, `bicycle`, `walk`, `other` |
| Meal type | `breakfast`, `lunch`, `dinner`, `snack`, `drink`, `other` |
| Food priority | `low`, `medium`, `high`, `must-try` |
| Event type | `arrival`, `departure` |

Future incompatible changes will increment `schemaVersion`; import code must reject unsupported versions rather than guessing how to migrate them.
