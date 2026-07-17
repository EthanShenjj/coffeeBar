import { resolveApiBaseUrl } from "./api-base-url";

describe("mobile API base URL", () => {
  it("requires an explicit HTTPS API for native production", () => {
    expect(() => resolveApiBaseUrl({ configured: undefined, fallbackOrigin: "capacitor://localhost", native: true, production: true })).toThrow("VITE_API_BASE_URL");
    expect(() => resolveApiBaseUrl({ configured: "http://api.example.com", fallbackOrigin: "capacitor://localhost", native: true, production: true })).toThrow("HTTPS");
    expect(resolveApiBaseUrl({ configured: "https://api.example.com/", fallbackOrigin: "capacitor://localhost", native: true, production: true })).toBe("https://api.example.com");
  });

  it("allows explicit localhost HTTP only during development", () => {
    expect(resolveApiBaseUrl({ configured: "http://localhost:3000", fallbackOrigin: "http://localhost:5173", native: true, production: false })).toBe("http://localhost:3000");
    expect(() => resolveApiBaseUrl({ configured: "http://192.168.1.10:3000", fallbackOrigin: "http://localhost:5173", native: true, production: false })).toThrow("HTTPS");
  });

  it("uses the HTTP(S) page origin for browser development only", () => {
    expect(resolveApiBaseUrl({ configured: undefined, fallbackOrigin: "http://localhost:5173", native: false, production: false })).toBe("http://localhost:5173");
    expect(() => resolveApiBaseUrl({ configured: undefined, fallbackOrigin: "capacitor://localhost", native: true, production: false })).toThrow("VITE_API_BASE_URL");
  });
});
