import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  discoverInstalledPlugins,
  recommendPluginsForSituation,
} from "../src/utils/pluginDiscovery.js";

let tmpHome: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "vg-pd-"));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
});

describe("pluginDiscovery branches", () => {
  it("returns empty when installed_plugins missing", () => {
    const plugins = discoverInstalledPlugins();
    expect(plugins).toEqual([]);
  });

  it("returns empty when installed_plugins parse fails", () => {
    const p = path.join(tmpHome, ".claude", "plugins", "installed_plugins.json");
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, "not json", "utf-8");
    const plugins = discoverInstalledPlugins();
    expect(plugins).toEqual([]);
  });

  it("skips install without installPath", () => {
    const p = path.join(tmpHome, ".claude", "plugins", "installed_plugins.json");
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ plugins: { "foo": [{}] } }), "utf-8");
    const plugins = discoverInstalledPlugins();
    expect(plugins).toEqual([]);
  });

  it("reads plugin.json when present", () => {
    const installPath = path.join(tmpHome, "plugins", "foo");
    fs.mkdirSync(path.join(installPath, ".claude-plugin"), { recursive: true });
    fs.writeFileSync(path.join(installPath, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "Foo", version: "1.0" }), "utf-8");
    const installed = path.join(tmpHome, ".claude", "plugins", "installed_plugins.json");
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.writeFileSync(installed, JSON.stringify({ plugins: { "foo": [{ installPath, version: "1.0" }] } }), "utf-8");
    const plugins = discoverInstalledPlugins();
    expect(plugins.length).toBe(1);
    expect(plugins[0].name).toBe("Foo");
    expect(plugins[0].enabled).toBe(true);
  });

  it("falls back when plugin.json missing", () => {
    const installPath = path.join(tmpHome, "plugins", "foo");
    fs.mkdirSync(installPath, { recursive: true });
    const installed = path.join(tmpHome, ".claude", "plugins", "installed_plugins.json");
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.writeFileSync(installed, JSON.stringify({ plugins: { "foo": [{ installPath }] } }), "utf-8");
    const plugins = discoverInstalledPlugins();
    expect(plugins.length).toBe(1);
    expect(plugins[0].version).toBe("unknown");
  });

  it("respects disabled in settings", () => {
    const installPath = path.join(tmpHome, "plugins", "foo");
    fs.mkdirSync(path.join(installPath, ".claude-plugin"), { recursive: true });
    fs.writeFileSync(path.join(installPath, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "Foo" }), "utf-8");
    const installed = path.join(tmpHome, ".claude", "plugins", "installed_plugins.json");
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.writeFileSync(installed, JSON.stringify({ plugins: { "foo": [{ installPath }] } }), "utf-8");
    const settings = path.join(tmpHome, ".claude", "settings.local.json");
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    fs.writeFileSync(settings, JSON.stringify({ enabledPlugins: { foo: false } }), "utf-8");
    const plugins = discoverInstalledPlugins();
    expect(plugins[0].enabled).toBe(false);
  });

  it("defaults enabled when settings missing", () => {
    const installPath = path.join(tmpHome, "plugins", "foo");
    fs.mkdirSync(path.join(installPath, ".claude-plugin"), { recursive: true });
    fs.writeFileSync(path.join(installPath, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "Foo" }), "utf-8");
    const installed = path.join(tmpHome, ".claude", "plugins", "installed_plugins.json");
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.writeFileSync(installed, JSON.stringify({ plugins: { "foo": [{ installPath }] } }), "utf-8");
    const plugins = discoverInstalledPlugins();
    expect(plugins[0].enabled).toBe(true);
  });

  it("detects performance type", () => {
    const r = recommendPluginsForSituation("slow performance fps", []);
    expect(r.detectedType).toBe("performance");
  });

  it("detects bug type", () => {
    const r = recommendPluginsForSituation("bug crash error", []);
    expect(r.detectedType).toBe("bug");
  });

  it("detects payment type", () => {
    const r = recommendPluginsForSituation("payment checkout billing", []);
    expect(r.detectedType).toBe("payment");
  });

  it("detects deploy type", () => {
    const r = recommendPluginsForSituation("deploy release production", []);
    expect(r.detectedType).toBe("deploy");
  });

  it("detects security type", () => {
    const r = recommendPluginsForSituation("security xss injection", []);
    expect(r.detectedType).toBe("security");
  });

  it("detects frontend type", () => {
    const r = recommendPluginsForSituation("ui ux design layout", []);
    expect(r.detectedType).toBe("frontend");
  });

  it("detects database type", () => {
    const r = recommendPluginsForSituation("database sql postgres table", []);
    expect(r.detectedType).toBe("database");
  });

  it("detects testing type", () => {
    const r = recommendPluginsForSituation("test qa testing", []);
    expect(r.detectedType).toBe("testing");
  });

  it("detects ml type", () => {
    const r = recommendPluginsForSituation("ml model train dataset", []);
    expect(r.detectedType).toBe("ml");
  });

  it("detects code-review type", () => {
    const r = recommendPluginsForSituation("review pr pull request merge", []);
    expect(r.detectedType).toBe("code-review");
  });

  it("defaults to general", () => {
    const r = recommendPluginsForSituation("random text", []);
    expect(r.detectedType).toBe("general");
  });

  it("skips disabled plugins", () => {
    const r = recommendPluginsForSituation("bug", [{ name: "x", description: "", version: "", installPath: "", enabled: false }]);
    expect(r.plugins).toEqual([]);
  });

  it("skips plugins without keyword map", () => {
    const r = recommendPluginsForSituation("bug", [{ name: "unknown-plugin", description: "", version: "", installPath: "", enabled: true }]);
    expect(r.plugins).toEqual([]);
  });

  it("dedups plugins by name", () => {
    const plugins = [{ name: "x", description: "", version: "", installPath: "", enabled: true }];
    const r = recommendPluginsForSituation("scan bug security", plugins);
    expect(r.plugins.filter((p) => p.name === "x").length).toBeLessThanOrEqual(1);
  });

  it("adds fallback tools when no match", () => {
    const r = recommendPluginsForSituation("performance", []);
    expect(r.tools.length).toBeGreaterThan(0);
  });
});
