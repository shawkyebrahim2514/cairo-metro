import { createContext, useContext } from 'react';
import type { Station } from '@cairo-metro/core';

export type Lang = 'en' | 'ar';

const en = {
  appName: 'Cairo Metro',
  tabNearest: 'Nearest station',
  tabPlan: 'Trip planner',
  searchPlaceholder: 'Place, station, Google Maps link or coordinates',
  useMyLocation: 'Use my location',
  locating: 'Locating…',
  locationDenied: 'Could not get your location. Check the browser permission.',
  from: 'From',
  to: 'To',
  swap: 'Swap',
  nearestTitle: 'Nearest stations',
  nearestHint: 'Search for a place or paste a Google Maps link to find the closest metro stations.',
  walk: 'walk',
  min: 'min',
  m: 'm',
  km: 'km',
  stops: 'stops',
  stop: 'stop',
  transfers: 'transfers',
  transfer: 'transfer',
  direct: 'Direct',
  fare: 'EGP',
  fastest: 'Fastest',
  fewestTransfers: 'Fewest transfers',
  takeLine: 'Take',
  towards: 'towards',
  from_: 'from',
  getOff: 'Get off at',
  changeAt: 'Change at',
  walking: 'walking',
  showStations: 'Show stations',
  tripTotal: 'Door to door',
  walkToStation: 'Walk to',
  walkFromStation: 'Walk from',
  noRoute: 'No route found between these places.',
  sameStation: 'Both places are at the same station.',
  farWarning: 'No metro station within 3 km of this place.',
  needsName: 'This is a short link. Please type the place name instead.',
  notFound: 'Nothing found. Try another spelling, a station name or coordinates.',
  pickOne: 'Did you mean…',
  pinned: 'Pinned location',
  stationLabel: 'Station',
  placeLabel: 'Place',
  interchange: 'Interchange',
  mapTiles: 'Map background',
  estimateNote: 'Times are estimates, not a timetable.',
  attribution: 'Data © OpenStreetMap contributors',
  language: 'العربية',
  clear: 'Clear',
  loadingPlaces: 'Loading places…',
  mapHint: 'Tip: you can also tap the map to drop a pin.',
};

export type Key = keyof typeof en;

const ar: Record<Key, string> = {
  appName: 'مترو القاهرة',
  tabNearest: 'أقرب محطة',
  tabPlan: 'تخطيط الرحلة',
  searchPlaceholder: 'مكان أو محطة أو رابط خرائط جوجل أو إحداثيات',
  useMyLocation: 'استخدم موقعي',
  locating: 'جارٍ تحديد الموقع…',
  locationDenied: 'تعذر تحديد موقعك. تحقق من إذن المتصفح.',
  from: 'من',
  to: 'إلى',
  swap: 'عكس',
  nearestTitle: 'أقرب المحطات',
  nearestHint: 'ابحث عن مكان أو الصق رابط خرائط جوجل لمعرفة أقرب محطات المترو.',
  walk: 'مشي',
  min: 'د',
  m: 'م',
  km: 'كم',
  stops: 'محطات',
  stop: 'محطة',
  transfers: 'تبديلات',
  transfer: 'تبديل',
  direct: 'مباشر',
  fare: 'جنيه',
  fastest: 'الأسرع',
  fewestTransfers: 'أقل تبديلات',
  takeLine: 'اركب',
  towards: 'في اتجاه',
  from_: 'من',
  getOff: 'انزل في',
  changeAt: 'بدّل في',
  walking: 'مشياً',
  showStations: 'عرض المحطات',
  tripTotal: 'من الباب للباب',
  walkToStation: 'امشِ إلى',
  walkFromStation: 'امشِ من',
  noRoute: 'لا يوجد مسار بين هذين المكانين.',
  sameStation: 'المكانان عند نفس المحطة.',
  farWarning: 'لا توجد محطة مترو على بعد 3 كم من هذا المكان.',
  needsName: 'هذا رابط مختصر. من فضلك اكتب اسم المكان بدلاً منه.',
  notFound: 'لم يتم العثور على نتيجة. جرّب تهجئة أخرى أو اسم محطة أو إحداثيات.',
  pickOne: 'هل تقصد…',
  pinned: 'موقع محدد',
  stationLabel: 'محطة',
  placeLabel: 'مكان',
  interchange: 'محطة تبادلية',
  mapTiles: 'خلفية الخريطة',
  estimateNote: 'الأوقات تقديرية وليست جدولاً رسمياً.',
  attribution: 'البيانات © مساهمو OpenStreetMap',
  language: 'English',
  clear: 'مسح',
  loadingPlaces: 'جارٍ تحميل الأماكن…',
  mapHint: 'نصيحة: يمكنك أيضاً الضغط على الخريطة لتحديد موقع.',
};

export const dictionaries: Record<Lang, Record<Key, string>> = { en, ar };

export interface I18n {
  lang: Lang;
  t: (key: Key) => string;
  setLang: (lang: Lang) => void;
}

export const I18nContext = createContext<I18n>({
  lang: 'en',
  t: (k) => en[k],
  setLang: () => undefined,
});

export const useI18n = () => useContext(I18nContext);

export const stationName = (s: Station, lang: Lang) => s.name[lang] || s.name.en;

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const localDigits = (value: string | number, lang: Lang) =>
  lang === 'ar' ? String(value).replace(/\d/g, (d) => AR_DIGITS[Number(d)]!) : String(value);

export function formatDistance(meters: number, t: I18n['t'], lang: Lang): string {
  return meters < 1000
    ? `${localDigits(Math.round(meters / 10) * 10, lang)} ${t('m')}`
    : `${localDigits((meters / 1000).toFixed(1), lang)} ${t('km')}`;
}

export const formatMinutes = (sec: number, t: I18n['t'], lang: Lang) =>
  `${localDigits(Math.max(1, Math.round(sec / 60)), lang)} ${t('min')}`;
