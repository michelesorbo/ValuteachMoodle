import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { appOrigin } from "@/modules/scorm/origin";
import { loadAttempt, loadScormSession } from "@/modules/scorm/session";
import { totalSecondsOf } from "@/modules/scorm/tracking";
import { ScormPlayer } from "./scorm-player";

type Props = PageProps<"/scorm/[token]/player">;

/**
 * SCORM player, served on the SCORM host (see proxy.ts) and embedded by the lesson page.
 * It shares its origin with the package content, which is how the content reaches `window.API`.
 */
export default function ScormPlayerPage(props: Props) {
  return (
    <Suspense fallback={null}>
      <Player params={props.params} />
    </Suspense>
  );
}

async function Player({ params }: { params: Props["params"] }) {
  const { token } = await params;
  // Always rendered at request time: the token expiry is checked against the current time.
  await connection();
  const t = await getTranslations("scorm");
  const session = await loadScormSession(token);
  if (!session) {
    return (
      <p role="alert" className="p-6">
        {t("expired")}
      </p>
    );
  }

  const attempt = await loadAttempt(session);
  const launchPath = session.pkg.launchPath.split("/").map(encodeURIComponent).join("/");

  return (
    <ScormPlayer
      title={session.lesson.title}
      contentUrl={`/scorm/${token}/content/${launchPath}${session.pkg.launchQuery}`}
      commitUrl={`/scorm/${token}/commit`}
      appOrigin={appOrigin()}
      saveErrorMessage={t("saveError")}
      init={{
        studentId: session.user.id,
        studentName: session.user.name,
        cmi: attempt.cmi,
        totalSeconds: totalSecondsOf(attempt),
        masteryScore: session.pkg.masteryScore,
      }}
    />
  );
}
