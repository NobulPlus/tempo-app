import { avatar } from "./helpers";

export interface Testimonial {
  quote: string;
  name: string;
  area: string;
  rating: number;
  avatarUrl: string;
}

export const testimonials: Testimonial[] = [
  {
    quote:
      "I moved from Abuja and didn't know a single pitch in Lagos. Found a Tuesday game in my first week and I've barely missed one since.",
    name: "Tomiwa A.",
    area: "Lekki Phase 1",
    rating: 5,
    avatarUrl: avatar("tomiwa"),
  },
  {
    quote:
      "The 'guaranteed' badge is the whole product for me. I stopped driving to games that fell through before I even booked one.",
    name: "Zainab S.",
    area: "Ikoyi",
    rating: 5,
    avatarUrl: avatar("zainab"),
  },
  {
    quote:
      "Punctuality scores changed my Wednesday game overnight. No-shows just stopped happening once people knew it was tracked.",
    name: "David O.",
    area: "Ikeja GRA",
    rating: 5,
    avatarUrl: avatar("david"),
  },
];
