import { topics } from './property-coach-knowledge.mjs';

export const normalize = text => text.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, ' ').trim();

const contains = (text, phrase) => (' ' + text + ' ').includes(' ' + phrase + ' ');

export function findTopics(question) {
  const query = normalize(question);
  const exact = topics.find(topic => [topic[2], topic[3]].some(title => normalize(title) === query));
  if (exact) return [exact];
  const ranked = topics.map(topic => {
    const score = topic[4].split('|').reduce((best, alias) => {
      return contains(query, alias) ? Math.max(best, alias.split(' ').length) : best;
    }, 0);
    return { topic, score };
  }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score);
  if (!ranked.length) return [];
  return ranked.filter(entry => entry.score === ranked[0].score).slice(0, 2).map(entry => entry.topic);
}

export function matchRecord(question, park, roadmap, lang) {
  const query = normalize(question);
  const phase = roadmap?.phases.find(item => contains(query, normalize(item.id)));
  if (phase) return { text: [phase.id + ' · ' + phase.title[lang], phase.status[lang], phase.goal[lang], phase.gate[lang]].join('\n'), href: '#roadmap' };
  const unit = park?.demo_units.find(item => contains(query, normalize(item.id)));
  if (unit) {
    const zone = park.zones.find(item => item.id === unit.zone_id)?.name ?? unit.zone_id;
    const vi = lang === 'vi';
    const unitType = unit.asset_type === 'apartment' ? (vi ? 'Căn hộ' : 'Apartment') : 'Shophouse';
    const lease = unit.lease_status === 'rented' ? (vi ? 'Đang cho thuê' : 'Rented') : (vi ? 'Chưa cho thuê' : 'Not rented');
    const sale = unit.listing_status === 'available' ? (vi ? 'Đang chào bán' : 'Available') : (vi ? 'Không chào bán' : 'Unavailable');
    const label = vi ? 'Hồ sơ mô phỏng' : 'Simulated record';
    return { text: label + ' · ' + unit.id + ' · ' + zone + '\n' + [unitType, lease, sale].join(' · '), href: '#grandpark' };
  }
  const zone = park?.zones.find(item => contains(query, normalize(item.name)));
  if (zone) {
    const details = [zone.name, zone.published_units?.[lang], zone.unit_area?.[lang], zone.note?.[lang]];
    return { text: details.filter(Boolean).join('\n'), href: '#grandpark' };
  }
  return null;
}
