/**
 * OSM class/tag → a human label ("Temple", "Ramen restaurant"). The last rung of
 * the description ladder — used when a place has no Wikipedia or Wikidata
 * reference at all, which is most restaurants, viewpoints and small parks.
 */
const LABELS: Record<string, string> = {
  'tourism/museum': 'Museum',
  'tourism/gallery': 'Art gallery',
  'tourism/attraction': 'Attraction',
  'tourism/viewpoint': 'Viewpoint',
  'tourism/zoo': 'Zoo',
  'tourism/aquarium': 'Aquarium',
  'tourism/theme_park': 'Theme park',
  'tourism/artwork': 'Public artwork',
  'tourism/hotel': 'Hotel',
  'tourism/hostel': 'Hostel',
  'tourism/camp_site': 'Campsite',
  'tourism/information': 'Visitor information',

  'historic/temple': 'Temple',
  'historic/shrine': 'Shrine',
  'historic/castle': 'Castle',
  'historic/monument': 'Monument',
  'historic/memorial': 'Memorial',
  'historic/ruins': 'Historic ruins',
  'historic/church': 'Historic church',
  'historic/archaeological_site': 'Archaeological site',
  'historic/fort': 'Historic fort',
  'historic/manor': 'Historic manor',

  'natural/peak': 'Mountain peak',
  'natural/beach': 'Beach',
  'natural/wood': 'Forest',
  'natural/water': 'Lake',
  'natural/waterfall': 'Waterfall',
  'natural/cave_entrance': 'Cave',
  'natural/volcano': 'Volcano',
  'natural/cliff': 'Cliff',
  'natural/bay': 'Bay',

  'leisure/park': 'Park',
  'leisure/garden': 'Garden',
  'leisure/nature_reserve': 'Nature reserve',
  'leisure/beach_resort': 'Beach resort',
  'leisure/stadium': 'Stadium',
  'leisure/marina': 'Marina',

  'amenity/restaurant': 'Restaurant',
  'amenity/cafe': 'Café',
  'amenity/bar': 'Bar',
  'amenity/pub': 'Pub',
  'amenity/fast_food': 'Fast food',
  'amenity/marketplace': 'Market',
  'amenity/place_of_worship': 'Place of worship',
  'amenity/theatre': 'Theatre',
  'amenity/cinema': 'Cinema',
  'amenity/nightclub': 'Nightclub',
  'amenity/arts_centre': 'Arts centre',
  'amenity/food_court': 'Food court',

  'place/neighbourhood': 'Neighbourhood',
  'place/suburb': 'Neighbourhood',
  'place/square': 'Square',
  'place/island': 'Island',
  'place/city': 'City',
  'place/town': 'Town',
  'place/village': 'Village',
};

/** One label per top-level class when the specific class/tag pair isn't in the table above. */
const CLASS_FALLBACK: Record<string, string> = {
  tourism: 'Attraction',
  historic: 'Historic site',
  natural: 'Natural landmark',
  leisure: 'Leisure',
  amenity: 'Venue',
  place: 'Place',
};

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function labelForOsmTag(osmClass: string, tag: string): string | null {
  const specific = LABELS[`${osmClass}/${tag}`];
  if (specific) return specific;

  const byClass = CLASS_FALLBACK[osmClass];
  if (byClass) return byClass;

  // A class outside the tracked set entirely — a titlecased tag still beats
  // showing nothing.
  return tag ? titleCase(tag) : null;
}
