/** Heuristic UI/feature/button name inference for impact_confirm tool. */
import * as path from "path";
import * as fs from "fs";

/** Infer a likely UI element name from a free-form change description. */
export function inferUiName(filePath: string): string | undefined {
  const base = path.basename(filePath, path.extname(filePath));
  const uiMap: Record<string, string> = { Login: "Trang dang nhap", Register: "Trang dang ky", Home: "Trang chu", Dashboard: "Bang dieu khien", Profile: "Trang Profile", Cart: "Gio hang", Checkout: "Thanh toan", Payment: "Thanh toan", Navbar: "Thanh menu", Sidebar: "Menu ben", Footer: "Chan trang", Header: "Dau trang", Modal: "Popup", Dialog: "Hop thoai", Button: "Nut bam", Form: "Bieu mau", Table: "Bang du lieu", List: "Danh sach", Card: "The", Item: "Muc", Page: "Trang", Layout: "Bo cuc", App: "Ung dung", Index: "Trang chinh", Main: "Trang chinh" };
  for (const [key, value] of Object.entries(uiMap)) if (base.toLowerCase().includes(key.toLowerCase())) return value;
  return undefined;
}

/** Extract candidate button labels from the change description. */
export function inferButtons(filePath: string, repo: string): string[] | undefined {
  let content: string | null = null;
  try {
    content = fs.readFileSync(path.join(repo, filePath), "utf-8");
  } catch {
    return undefined;
  }

  const buttons: string[] = [];
  const regex = /(?:label|children|title)\s*[=:]\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match[1].length > 1 && match[1].length < 30) buttons.push(match[1]);
  }
  return buttons.length > 0 ? buttons.slice(0, 5) : undefined;
}

/** Infer the high-level feature being touched. */
export function inferFeature(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  const baseFeatureMap: Record<string, string> = {
    Cart: "Gio hang", Payment: "Thanh toan", PaymentButton: "Thanh toan", Checkout: "Thanh toan",
    Login: "Dang nhap", Register: "Dang ky", Auth: "Xac thuc", Profile: "Profile",
    Navbar: "Navbar", App: "Trang chinh", Index: "Trang chinh",
  };
  for (const [key, value] of Object.entries(baseFeatureMap)) {
    if (base.toLowerCase().includes(key.toLowerCase())) return value;
  }

  const dir = getFeatureDirectory(filePath);
  const featureMap: Record<string, string> = { auth: "Xac thuc", login: "Dang nhap", register: "Dang ky", profile: "Profile", cart: "Gio hang", payment: "Thanh toan", checkout: "Thanh toan", order: "Don hang", product: "San pham", admin: "Quan tri", dashboard: "Bang dieu khien", setting: "Cai dat", config: "Cau hinh", api: "API", utils: "Tien ich", hooks: "Hooks", components: "UI Components", pages: "Trang", routes: "Routing", services: "Dich vu", store: "Store", state: "State", context: "Context", types: "Types", interfaces: "Interfaces", models: "Models", controllers: "Controllers", middleware: "Middleware", db: "Database", database: "Database", migration: "Migration", seed: "Seed", test: "Test", tests: "Test", e2e: "E2E Test", unit: "Unit Test", integration: "Integration Test" };
  for (const [key, value] of Object.entries(featureMap)) if (dir.toLowerCase().includes(key)) return value;
  return dir || path.basename(path.dirname(filePath)) || "Chung";
}

function getFeatureDirectory(filePath: string): string {
  const parts = filePath.split("/");
  const skipRoots = new Set(["src", "app", "lib", "source", "code", "client", "server"]);
  const firstDir = parts.length > 1 ? parts[0] : "";
  return skipRoots.has(firstDir.toLowerCase()) && parts.length > 2 ? parts[1] : firstDir;
}
