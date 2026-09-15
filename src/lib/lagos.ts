export const LAGOS_BOUNDS = {
  minLat: 6.35,
  maxLat: 6.75,
  minLng: 2.7,
  maxLng: 4.35,
} as const;

export const LAGOS_AREA_OPTIONS = [
  "Agege",
  "Ajeromi-Ifelodun",
  "Alimosho",
  "Amuwo-Odofin",
  "Apapa",
  "Badagry",
  "Epe",
  "Eti-Osa",
  "Ibeju-Lekki",
  "Ifako-Ijaiye",
  "Ikeja",
  "Ikeja GRA",
  "Ikorodu",
  "Kosofe",
  "Lagos Island",
  "Lagos Mainland",
  "Mushin",
  "Ojo",
  "Oshodi-Isolo",
  "Shomolu",
  "Surulere",
  "Ajah",
  "Anthony",
  "Bariga",
  "Berger",
  "Chevron",
  "Festac",
  "Gbagada",
  "Ikoyi",
  "Ilupeju",
  "Isolo",
  "Jibowu",
  "Ketu",
  "Lekki Phase 1",
  "Magodo",
  "Maryland",
  "Ogba",
  "Ojodu",
  "Onikan",
  "Sangotedo",
  "Victoria Island",
  "Yaba",
] as const;

export function isCoordinateInLagos(lat: number, lng: number) {
  return (
    lat >= LAGOS_BOUNDS.minLat &&
    lat <= LAGOS_BOUNDS.maxLat &&
    lng >= LAGOS_BOUNDS.minLng &&
    lng <= LAGOS_BOUNDS.maxLng
  );
}
