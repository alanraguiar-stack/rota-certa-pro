/**
 * History-Guided Router
 * Uses learned manual sequences to guide route optimization.
 * 
 * Instead of blindly re-optimizing with ORS/nearest-neighbor,
 * this module:
 * 1. Loads learned address/neighborhood/city sequences from history
 * 2. Builds a "template" ordering from the best matching historical truck
 * 3. Places known orders in learned order
 * 4. Inserts unknown orders into the best gap in the template
 * 5. Falls back to nearest-neighbor only for orders with zero history
 */

import { Order } from '@/types';
import { HistoryRow } from './historyPatternEngine';
import { parseAddress, calculateDistance, normalizeCityName } from './geocoding';
import { normalizeNeighborhood } from './anchorRules';

interface LearnedSequenceEntry {
  address: string | null;
  neighborhood: string;
  city: string;
  sequence: number;
  weight: number; // higher = more confidence (manual moves count 2x)
}

interface LearnedTruckTemplate {
  truckLabel: string;
  entries: LearnedSequenceEntry[];
  routeDate: string;
  totalWeight: number; // sum of weights for confidence
}

/**
 * Normalize strings for matching
 */
function norm(s: string | null | undefined): string {
  if (!s) return '';
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Build learned templates from history rows.
 * Groups by truck_label, merges across dates with weighted precedence.
 */
export function buildLearnedTemplates(patterns: HistoryRow[]): LearnedTruckTemplate[] {
  if (patterns.length === 0) return [];

  // Group by truck_label + route_date
  const groups = new Map<string, HistoryRow[]>();
  for (const row of patterns) {
    if (row.sequence_order == null) continue;
    const key = `${row.truck_label}::${row.route_date || 'unknown'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // Build a merged template per truck (across all dates)
  const truckMerged = new Map<string, Map<string, { totalSeq: number; count: number; weight: number; city: string; neighborhood: string; address: string | null }>>();

  for (const [key, rows] of groups) {
    const truckLabel = key.split('::')[0];
    if (!truckMerged.has(truckLabel)) truckMerged.set(truckLabel, new Map());
    const merged = truckMerged.get(truckLabel)!;

    const sorted = [...rows].sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));

    for (const row of sorted) {
      const city = norm(row.city);
      const nh = norm(row.neighborhood);
      const addr = norm(row.address);
      if (!city) continue;

      // Use address as primary key, fallback to neighborhood+city
      const entryKey = addr || `${nh}::${city}`;
      const w = row.was_manually_moved ? 2 : 1;

      if (!merged.has(entryKey)) {
        merged.set(entryKey, {
          totalSeq: (row.sequence_order || 0) * w,
          count: w,
          weight: w,
          city,
          neighborhood: nh,
          address: row.address,
        });
      } else {
        const existing = merged.get(entryKey)!;
        existing.totalSeq += (row.sequence_order || 0) * w;
        existing.count += w;
        existing.weight += w;
      }
    }
  }

  // Convert merged data to templates
  const templates: LearnedTruckTemplate[] = [];

  for (const [truckLabel, merged] of truckMerged) {
    const entries: LearnedSequenceEntry[] = [];
    let totalWeight = 0;

    for (const [, data] of merged) {
      const avgSeq = data.totalSeq / data.count;
      entries.push({
        address: data.address,
        neighborhood: data.neighborhood,
        city: data.city,
        sequence: avgSeq,
        weight: data.weight,
      });
      totalWeight += data.weight;
    }

    // Sort by weighted average sequence
    entries.sort((a, b) => a.sequence - b.sequence);

    if (entries.length >= 2) {
      templates.push({ truckLabel, entries, routeDate: 'merged', totalWeight });
    }
  }

  // Sort templates by confidence (totalWeight)
  templates.sort((a, b) => b.totalWeight - a.totalWeight);

  return templates;
}

/**
 * Score how well an order matches a learned entry.
 * Returns 0-100 (100 = exact address match)
 */
function matchScore(order: Order, entry: LearnedSequenceEntry): number {
  const orderAddr = norm(order.address);
  const orderCity = norm(order.city || '');

  // Exact address match (strongest)
  if (entry.address && orderAddr && orderAddr.includes(norm(entry.address)?.substring(0, 30))) {
    return 100;
  }

  // Same client at same address fragment
  if (entry.address && orderAddr) {
    // Check street-level match (first significant part of address)
    const entryStreet = extractStreetKey(norm(entry.address));
    const orderStreet = extractStreetKey(orderAddr);
    if (entryStreet && orderStreet && entryStreet === orderStreet && orderCity === entry.city) {
      return 85;
    }
  }

  // Same neighborhood + city
  const orderParsed = parseAddress(order.address);
  const orderNh = norm(orderParsed.neighborhood);
  if (orderNh && orderNh === entry.neighborhood && orderCity === entry.city) {
    return 60;
  }

  // Same city only
  if (orderCity && orderCity === entry.city) {
    return 30;
  }

  return 0;
}

/**
 * Extract a street-level key from address for comparison
 */
function extractStreetKey(addr: string): string {
  if (!addr) return '';
  // Take first part before comma or dash, remove numbers
  const parts = addr.split(/[,\-]/);
  const street = parts[0]?.trim() || '';
  // Remove "rua", "av", "alameda" etc for comparison
  return street.replace(/^(rua|r\.|av\.|av |avenida|alameda|al\.|travessa|tv\.)\s*/i, '').trim();
}

/**
 * Find the best template for a set of orders on a specific truck.
 * Returns the template with highest city overlap.
 */
function findBestTemplate(
  orders: Order[],
  templates: LearnedTruckTemplate[],
  truckPlate?: string
): LearnedTruckTemplate | null {
  if (templates.length === 0 || orders.length === 0) return null;

  const orderCities = new Set(orders.map(o => norm(o.city || '')).filter(Boolean));

  let bestTemplate: LearnedTruckTemplate | null = null;
  let bestScore = 0;

  for (const template of templates) {
    // Bonus for same truck plate
    const plateBonus = truckPlate && norm(truckPlate) === norm(template.truckLabel) ? 50 : 0;

    const templateCities = new Set(template.entries.map(e => e.city));

    // City overlap score
    let overlap = 0;
    for (const city of orderCities) {
      if (templateCities.has(city)) overlap++;
    }

    const cityScore = orderCities.size > 0 ? (overlap / orderCities.size) * 100 : 0;
    const totalScore = cityScore + plateBonus + (template.totalWeight * 0.5);

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestTemplate = template;
    }
  }

  // Only use template if at least 30% city overlap
  if (bestTemplate) {
    const templateCities = new Set(bestTemplate.entries.map(e => e.city));
    let overlap = 0;
    for (const city of orderCities) {
      if (templateCities.has(city)) overlap++;
    }
    if (orderCities.size > 0 && overlap / orderCities.size < 0.3) {
      return null;
    }
  }

  return bestTemplate;
}

/**
 * Main function: order deliveries using learned history patterns.
 * 
 * Algorithm:
 * 1. Find best matching template
 * 2. For each order, find best matching entry in template → assign learned sequence
 * 3. Orders with good matches get sorted by learned sequence
 * 4. Orders with no match get inserted at the best gap (by geographic proximity)
 * 5. Returns ordered list, or null if no useful template found
 */
export function orderByLearnedPatterns(
  orders: Order[],
  templates: LearnedTruckTemplate[],
  truckPlate?: string
): Order[] | null {
  const template = findBestTemplate(orders, templates, truckPlate);
  if (!template) return null;

  console.log(`[HistoryGuided] Using template from truck "${template.truckLabel}" (${template.entries.length} learned points, weight: ${template.totalWeight})`);

  // Score each order against template entries
  interface ScoredOrder {
    order: Order;
    bestEntryIdx: number;
    bestScore: number;
    learnedSequence: number;
  }

  const scored: ScoredOrder[] = orders.map(order => {
    let bestEntryIdx = -1;
    let bestScore = 0;
    let learnedSequence = Infinity;

    for (let i = 0; i < template.entries.length; i++) {
      const score = matchScore(order, template.entries[i]);
      if (score > bestScore) {
        bestScore = score;
        bestEntryIdx = i;
        learnedSequence = template.entries[i].sequence;
      }
    }

    return { order, bestEntryIdx, bestScore, learnedSequence };
  });

  // Separate into "matched" (score >= 30) and "unmatched"
  const matched = scored.filter(s => s.bestScore >= 30);
  const unmatched = scored.filter(s => s.bestScore < 30);

  // If less than 40% matched, template is not useful enough
  if (matched.length < orders.length * 0.4) {
    console.log(`[HistoryGuided] Template match too low (${matched.length}/${orders.length}), falling back`);
    return null;
  }

  // Sort matched by learned sequence
  matched.sort((a, b) => a.learnedSequence - b.learnedSequence);

  // Build result with matched orders first
  const result: Order[] = matched.map(m => m.order);

  // Insert unmatched orders into best gap by geographic proximity
  for (const um of unmatched) {
    const umParsed = parseAddress(um.order.address);
    const umLat = um.order.latitude != null ? Number(um.order.latitude) : umParsed.estimatedLat;
    const umLng = um.order.longitude != null ? Number(um.order.longitude) : umParsed.estimatedLng;

    let bestInsertIdx = result.length; // default: end
    let bestDist = Infinity;

    for (let i = 0; i <= result.length; i++) {
      // Calculate distance to neighbors at position i
      let dist = 0;
      if (i > 0) {
        const prev = result[i - 1];
        const prevParsed = parseAddress(prev.address);
        const prevLat = prev.latitude != null ? Number(prev.latitude) : prevParsed.estimatedLat;
        const prevLng = prev.longitude != null ? Number(prev.longitude) : prevParsed.estimatedLng;
        dist += calculateDistance(umLat, umLng, prevLat, prevLng);
      }
      if (i < result.length) {
        const next = result[i];
        const nextParsed = parseAddress(next.address);
        const nextLat = next.latitude != null ? Number(next.latitude) : nextParsed.estimatedLat;
        const nextLng = next.longitude != null ? Number(next.longitude) : nextParsed.estimatedLng;
        dist += calculateDistance(umLat, umLng, nextLat, nextLng);
      }

      // Bonus: prefer inserting near same city/neighborhood
      const umCity = norm(um.order.city || '');
      if (i > 0 && norm(result[i - 1].city || '') === umCity) dist *= 0.5;
      if (i < result.length && norm(result[i].city || '') === umCity) dist *= 0.5;

      if (dist < bestDist) {
        bestDist = dist;
        bestInsertIdx = i;
      }
    }

    result.splice(bestInsertIdx, 0, um.order);
  }

  console.log(`[HistoryGuided] Ordered ${result.length} deliveries (${matched.length} from history, ${unmatched.length} inserted)`);
  return result;
}
