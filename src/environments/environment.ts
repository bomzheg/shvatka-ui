const env = (window as { [key: string]: any })["env"] as { [key: string]: string };
export const environment = {
  mainUrl: env["mainUrl"],
  apiUrl: env["apiUrl"],
  botUsername: env["botUsername"],
  baseHref: env["baseHref"] || "/",
};
