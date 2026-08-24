// Falls back to an empty object when env.js is absent (e.g. the Karma test
// context); at real runtime nginx always injects window.env before the app.
const env = ((window as { [key: string]: any })["env"] ?? {}) as { [key: string]: string };
export const environment = {
  mainUrl: env["mainUrl"],
  apiUrl: env["apiUrl"],
  cdnUrl: env["cdnUrl"],
  botUsername: env["botUsername"],
  baseHref: env["baseHref"] || "/",
};
