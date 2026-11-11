import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { ScormPackageError } from "./errors";

export type ScormManifest = {
  title: string;
  /** Launch file, relative to the directory of imsmanifest.xml (posix separators, no query string). */
  launchPath: string;
  /** Query string / fragment to append when launching ("" or starting with "?" or "#"). */
  launchQuery: string;
  /** adlcp:masteryscore of the launched item, when declared. */
  masteryScore: number | null;
};

type Node = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) => ["organization", "item", "resource"].includes(name),
});

function asNode(value: unknown): Node | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Node) : null;
}

function asList(value: unknown): Node[] {
  return Array.isArray(value) ? value.map(asNode).filter((node): node is Node => node !== null) : [];
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  const node = asNode(value);
  return node && typeof node["#text"] === "string" ? node["#text"].trim() : "";
}

/** First item (depth-first) that points to a resource. */
function findLaunchItem(items: Node[]): Node | null {
  for (const item of items) {
    if (text(item["@_identifierref"])) return item;
    const nested = findLaunchItem(asList(item.item));
    if (nested) return nested;
  }
  return null;
}

/**
 * Reads a SCORM 1.2 imsmanifest.xml and finds what to launch.
 * Multi-SCO packages are accepted, but only the first launchable item is used (MVP limit).
 */
export function parseManifest(xml: string): ScormManifest {
  let manifest: Node | null;
  try {
    manifest = asNode(asNode(parser.parse(xml))?.manifest);
  } catch {
    manifest = null;
  }
  if (!manifest) throw new ScormPackageError("invalidManifest", "missing <manifest>");

  const schemaVersion = text(asNode(manifest.metadata)?.schemaversion);
  if (/2004|^CAM\s*1\.3|^1\.3/i.test(schemaVersion)) throw new ScormPackageError("scorm2004");

  const organizations = asNode(manifest.organizations);
  const organizationList = asList(organizations?.organization);
  const defaultId = text(organizations?.["@_default"]);
  const organization =
    organizationList.find((candidate) => text(candidate["@_identifier"]) === defaultId) ??
    organizationList[0] ??
    null;

  const resources = asNode(manifest.resources);
  const resourceList = asList(resources?.resource);
  const item = organization ? findLaunchItem(asList(organization.item)) : null;

  const resource = item
    ? resourceList.find((candidate) => text(candidate["@_identifier"]) === text(item["@_identifierref"]))
    : // No organization: fall back to the first resource that can be launched.
      resourceList.find((candidate) => text(candidate["@_href"]));
  const href = text(resource?.["@_href"]);
  if (!resource || !href) throw new ScormPackageError("invalidManifest", "no launchable resource");

  const fullHref = text(resources?.["@_base"]) + text(resource["@_base"]) + href;
  const splitAt = fullHref.search(/[?#]/);
  const rawPath = splitAt === -1 ? fullHref : fullHref.slice(0, splitAt);
  let launchQuery = splitAt === -1 ? "" : fullHref.slice(splitAt);

  // The launch file must be a relative path inside the package.
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    throw new ScormPackageError("invalidManifest", "malformed href");
  }
  const launchPath = path.posix.normalize(decodedPath.replaceAll("\\", "/"));
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(decodedPath) ||
    launchPath.startsWith("/") ||
    launchPath === "." ||
    launchPath === ".." ||
    launchPath.startsWith("../")
  ) {
    throw new ScormPackageError("invalidManifest", "launch href outside the package");
  }

  // Item parameters are appended to the launch URL (SCORM 1.2 CAM, "parameters" attribute).
  const parameters = text(item?.["@_parameters"]).replace(/^[?&]/, "");
  if (parameters) {
    if (parameters.startsWith("#")) launchQuery += parameters;
    else launchQuery = launchQuery.includes("?") ? `${launchQuery}&${parameters}` : `?${parameters}${launchQuery}`;
  }

  const mastery = Number.parseFloat(text(item?.masteryscore));
  const title = text(item?.title) || text(organization?.title) || "";

  return {
    title,
    launchPath,
    launchQuery,
    masteryScore: Number.isFinite(mastery) && mastery >= 0 && mastery <= 100 ? mastery : null,
  };
}
