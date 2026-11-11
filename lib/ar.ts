/**
 * Arabic count + noun agreement, e.g. arCount(1, 'order') → "طلب واحد", 2 → "طلبين",
 * 5 → "5 طلبات", 15 → "15 طلبًا", 100 → "100 طلب".
 */
const NOUNS = {
  order: ['طلب واحد', 'طلبين', 'طلبات', 'طلبًا', 'طلب'],
  item: ['قطعة واحدة', 'قطعتين', 'قطع', 'قطعة', 'قطعة'],
  day: ['يوم واحد', 'يومين', 'أيام', 'يومًا', 'يوم'],
  visit: ['زيارة واحدة', 'زيارتين', 'زيارات', 'زيارة', 'زيارة'],
  visitor: ['زائر واحد', 'زائرين', 'زوّار', 'زائرًا', 'زائر'],
  customer: ['عميل واحد', 'عميلين', 'عملاء', 'عميلًا', 'عميل'],
  product: ['منتج واحد', 'منتجين', 'منتجات', 'منتجًا', 'منتج'],
} as const;

export type ArNoun = keyof typeof NOUNS;

export function arCount(n: number, noun: ArNoun) {
  const [one, two, few, many, base] = NOUNS[noun];
  const num = n.toLocaleString('en-US');
  if (n === 1) return one;
  if (n === 2) return two;
  const m = n % 100;
  if (n === 0 || (m >= 3 && m <= 10)) return `${num} ${few}`;
  if (m >= 11) return `${num} ${many}`;
  return `${num} ${base}`;
}
