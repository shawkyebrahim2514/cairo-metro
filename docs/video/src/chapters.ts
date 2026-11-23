import type { ChapterSpec } from './Chapter';

const R = 1.3;

export const CHAPTERS: ChapterSpec[] = [
  {
    n: 1,
    q: 'Is there a metro near this place?',
    qAr: 'هل في مترو قريب من المكان ده؟',
    parts: [
      {
        a: 'Paste a Maps link. Get the nearest stations.',
        aAr: 'الصق رابط الخريطة واعرف أقرب محطة',
        b: 'Know the walk before you go',
        bAr: 'اعرف المسافة قبل ما تتحرك',
        clip: { src: 'clips/nearest.mp4', len: 11.4, rate: 1.1 },
      },
    ],
  },
  {
    n: 2,
    q: 'How do I get from A to B?',
    qAr: 'أروح من أ لـ ب إزاي؟',
    parts: [
      {
        a: 'Stations, transfers, time and fare.',
        aAr: 'المحطات والتبديل والوقت والتذكرة',
        b: 'The whole trip, planned in seconds',
        bAr: 'رحلتك كلها في ثواني',
        clip: { src: 'clips/planner.mp4', len: 14, rate: R },
      },
    ],
  },
  {
    n: 3,
    q: 'Where can I get in 30 minutes?',
    qAr: 'أوصل لفين في ٣٠ دقيقة؟',
    parts: [
      {
        a: 'Pick a start. See everything in reach.',
        aAr: 'اختار نقطة البداية وشوف كل اللي تقدر توصله',
        b: 'Explore without a destination',
        bAr: 'استكشف من غير وجهة',
        clip: { src: 'clips/reachable.mp4', len: 14, rate: R },
      },
    ],
  },
  {
    n: 4,
    q: 'Is the metro still running?',
    qAr: 'المترو لسه شغال؟',
    parts: [
      {
        a: 'Hours, waits and last-train warnings.',
        aAr: 'المواعيد وآخر قطر',
        b: 'Never get stranded',
        bAr: 'متتأخرش على آخر قطر',
        clip: { src: 'clips/hours.mp4', len: 14, rate: R },
      },
    ],
  },
  {
    n: 5,
    q: 'Did I miss my stop?',
    qAr: 'فاتتني محطتي؟',
    parts: [
      {
        a: 'Live tracking and a wake-me alarm.',
        aAr: 'تتبع مباشر ومنبّه للوصول',
        b: 'Relax. We watch the stops for you.',
        bAr: 'ارتاح وإحنا نراقب المحطات',
        clip: { src: 'clips/tracking.mp4', len: 11.5, rate: R },
      },
    ],
  },
  {
    n: 6,
    q: 'Can my trip be a picture?',
    qAr: 'ممكن رحلتي تبقى صورة؟',
    tone: 'night',
    parts: [
      {
        a: 'Tap Image. A live preview opens.',
        aAr: 'اضغط على صورة وشوف المعاينة',
        b: 'See it before you share it',
        bAr: 'شوفها قبل ما تبعتها',
        clip: { src: 'clips/image-open.mp4', len: 12, rate: 1.3 },
      },
      {
        a: 'Network map, route only, or a clean diagram.',
        aAr: 'خريطة الشبكة أو المسار فقط أو مخطط',
        b: 'Your trip, your style',
        bAr: 'رحلتك بشكلك',
        clip: { src: 'clips/image-styles.mp4', len: 14, rate: 1.3 },
      },
      {
        a: 'Light or dark. English or Arabic.',
        aAr: 'فاتح أو داكن، عربي أو إنجليزي',
        b: 'Portrait, square or story size',
        bAr: 'بورتريه أو مربع أو ستوري',
        clip: { src: 'clips/image-themes.mp4', len: 14, rate: 1.3 },
      },
      {
        a: 'Choose exactly what goes in.',
        aAr: 'اختار اللي يظهر في الصورة',
        b: 'Times, fare, steps, QR code and more',
        bAr: 'الوقت والسعر والخطوات ورمز QR',
        clip: { src: 'clips/image-toggles.mp4', len: 14, rate: 1.3 },
      },
      {
        a: 'Long trip? The map turns to fit.',
        aAr: 'رحلة طويلة؟ الخريطة تدور وتناسب',
        b: 'Every station listed, nothing cut',
        bAr: 'كل المحطات بدون قص',
        clip: { src: 'clips/image-long.mp4', len: 14, rate: 1.3 },
      },
      {
        a: 'Save it. Send it. Post it.',
        aAr: 'احفظها وابعتها وانشرها',
        b: 'One picture says it all',
        bAr: 'صورة واحدة تقول كل حاجة',
        frames: 150,
        images: [
          'img/net-default.png',
          'img/diagram-dark.png',
          'img/arabic-dark.png',
          'img/route-only.png',
        ],
      },
    ],
  },
  {
    n: 7,
    q: 'How do I send it to a friend?',
    qAr: 'أبعتها لصاحبي إزاي؟',
    parts: [
      {
        a: 'A link or a QR code.',
        aAr: 'رابط أو رمز QR',
        b: 'They open the same trip',
        bAr: 'يفتح نفس الرحلة',
        clip: { src: 'clips/share.mp4', len: 6, rate: 0.8 },
      },
    ],
  },
  {
    n: 8,
    q: 'And the last walk?',
    qAr: 'والمشي الأخير؟',
    parts: [
      {
        a: 'One tap to walking directions.',
        aAr: 'ضغطة واحدة لمسار المشي',
        b: 'Google Maps or Apple Maps, door to door',
        bAr: 'من الباب للباب',
        clip: { src: 'clips/walking.mp4', len: 12.2, rate: R },
      },
    ],
  },
  {
    n: 9,
    q: 'No signal underground?',
    qAr: 'مفيش شبكة تحت الأرض؟',
    parts: [
      {
        a: 'Works fully offline.',
        aAr: 'يعمل بدون إنترنت',
        b: 'Install it once, use it anywhere',
        bAr: 'ثبّته مرة واستخدمه في أي مكان',
        clip: { src: 'clips/offline.mp4', len: 10.5, rate: R },
      },
    ],
  },
  {
    n: 10,
    q: 'Is it in Arabic?',
    qAr: 'فيه عربي؟',
    parts: [
      {
        a: 'Full Arabic, right to left.',
        aAr: 'عربي كامل من اليمين لليسار',
        b: 'Made for Cairo',
        bAr: 'اتعمل عشان القاهرة',
        clip: { src: 'clips/arabic.mp4', len: 12, rate: R },
      },
    ],
  },
];
