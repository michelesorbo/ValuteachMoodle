import { describe, expect, it } from "vitest";
import { ScormPackageError } from "./errors";
import { parseManifest } from "./manifest";

function manifest({
  schemaVersion = "1.2",
  item = `<item identifier="i1" identifierref="r1"><title>Modulo 1</title></item>`,
  resources = `<resource identifier="r1" type="webcontent" adlcp:scormtype="sco" href="index.html"/>`,
} = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="m" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>${schemaVersion}</schemaversion></metadata>
  <organizations default="org">
    <organization identifier="other"><title>Altro</title></organization>
    <organization identifier="org"><title>Corso di prova</title>${item}</organization>
  </organizations>
  <resources>${resources}</resources>
</manifest>`;
}

function codeOf(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof ScormPackageError ? error.code : "other";
  }
}

describe("parseManifest", () => {
  it("finds the launch file of the default organization", () => {
    expect(parseManifest(manifest())).toEqual({
      title: "Modulo 1",
      launchPath: "index.html",
      launchQuery: "",
      masteryScore: null,
    });
  });

  it("reads the mastery score, nested items, xml:base and parameters", () => {
    const parsed = parseManifest(
      manifest({
        item: `<item identifier="folder"><title>Cartella</title>
                 <item identifier="i1" identifierref="r1" parameters="?lang=it">
                   <title>Lezione</title><adlcp:masteryscore>80</adlcp:masteryscore>
                 </item>
               </item>`,
        resources: `<resource identifier="r0" href="other.html"/>
                    <resource identifier="r1" xml:base="content/" href="start.html?mode=x"/>`,
      }),
    );
    expect(parsed).toEqual({
      title: "Lezione",
      launchPath: "content/start.html",
      launchQuery: "?mode=x&lang=it",
      masteryScore: 80,
    });
  });

  it("falls back to the first resource when there is no organization item", () => {
    expect(parseManifest(manifest({ item: "" })).launchPath).toBe("index.html");
  });

  it("rejects SCORM 2004 packages", () => {
    expect(codeOf(() => parseManifest(manifest({ schemaVersion: "2004 3rd Edition" })))).toBe("scorm2004");
    expect(codeOf(() => parseManifest(manifest({ schemaVersion: "CAM 1.3" })))).toBe("scorm2004");
  });

  it("rejects launch files outside the package", () => {
    for (const href of ["../secret.html", "/etc/passwd", "http://example.com/x.html", "a/../../x.html", "%2e%2e/x.html"]) {
      const xml = manifest({ resources: `<resource identifier="r1" href="${href}"/>` });
      expect(codeOf(() => parseManifest(xml)), href).toBe("invalidManifest");
    }
  });

  it("rejects manifests without a launchable resource or that are not XML manifests", () => {
    expect(codeOf(() => parseManifest(manifest({ resources: `<resource identifier="r1"/>` })))).toBe(
      "invalidManifest",
    );
    expect(codeOf(() => parseManifest("<html></html>"))).toBe("invalidManifest");
    expect(codeOf(() => parseManifest("not xml at all"))).toBe("invalidManifest");
  });
});
