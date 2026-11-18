import { cached } from "./cache";
import { getSetting } from "./settings";

const KIND = (c: number) => c === 0 ? "sun" : c <= 2 ? "partly" : c === 3 ? "cloud" : c <= 48 ? "fog" : c <= 67 || (c >= 80 && c <= 82) ? "rain" : c <= 77 || c === 85 || c === 86 ? "snow" : "storm";
const NAME: Record<number, string> = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Light showers", 81: "Showers", 82: "Heavy showers", 85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorm", 96: "Thunderstorm, hail", 99: "Thunderstorm, hail" };
/** [description, icon kind] — icon kind maps to an SVG in the UI. */
export const wmo = (c: number): [string, string] => [NAME[c] ?? "Unknown", KIND(c)];

export type Weather = {
  place: string; temp: number; feels: number; wind: number; description: string; icon: string;
  daily: { date: string; hi: number; lo: number; rain: number; description: string; icon: string }[];
};

async function getJson(url: string, attempts = 2): Promise<any> {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`${new URL(url).hostname} returned ${r.status}`);
      return await r.json();
    } catch (e) { if (i >= attempts) throw e; await new Promise((res) => setTimeout(res, 400)); }
  }
}

export async function geocode(name: string) {
  const j = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
  const r = j.results?.[0];
  if (!r) return null;
  return { place: [r.name, r.admin1, r.country].filter(Boolean).join(", "), lat: r.latitude as number, lon: r.longitude as number, timezone: r.timezone as string };
}

/** null = no location configured yet. Throws if the upstream API is down and nothing is cached. */
export async function getWeather(): Promise<Weather | null> {
  const lat = getSetting("lat"), lon = getSetting("lon");
  if (!lat || !lon) return null;
  const place = getSetting("place") ?? "";
  return cached(`wx:${lat},${lon}`, 10 * 60_000, async () => {
    const j = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5`);
    const [description, icon] = wmo(j.current.weather_code);
    return {
      place, temp: Math.round(j.current.temperature_2m), feels: Math.round(j.current.apparent_temperature),
      wind: Math.round(j.current.wind_speed_10m), description, icon,
      daily: (j.daily.time as string[]).map((date, i) => {
        const [d, ic] = wmo(j.daily.weather_code[i]);
        return { date, hi: Math.round(j.daily.temperature_2m_max[i]), lo: Math.round(j.daily.temperature_2m_min[i]), rain: j.daily.precipitation_probability_max[i] ?? 0, description: d, icon: ic };
      }),
    };
  });
}
