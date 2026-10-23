"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateApplicationStage } from "./actions";

const STAGES = ["Applied","Prescreen","Submitted","Client Sub","Interviewing","Offer","Placed"];

export default function PipelineBoard({ applications = [], interviewStages = [] }) {
  const router = useRouter();
  const [items, setItems] = useState(applications);
  const [draggingId, setDraggingId] = useState(null);
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((stage) => [stage, []]));
    for (const item of items) {
      if (map[item.stage]) map[item.stage].push(item);
    }
    return map;
  }, [items]);

  function move(applicationId, nextStage) {
    const current = items.find((item) => item.id === applicationId);
    if (!current || current.stage === nextStage) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === applicationId
          ? { ...item, stage: nextStage, interview_stage: nextStage === "Interviewing" ? item.interview_stage : null }
          : item
      )
    );

    const formData = new FormData();
    formData.set("application_id", applicationId);
    formData.set("stage", nextStage);

    startTransition(async () => {
      try {
        await updateApplicationStage(formData);
        router.refresh();
      } catch {
        setItems(applications);
      }
    });
  }

  return (
    <div className={isPending ? "pipeline is-saving" : "pipeline"}>
      {STAGES.map((stage) => (
        <section
          className="pipeline-column"
          key={stage}
          onDragOver={(event) => {
            event.preventDefault();
            event.currentTarget.classList.add("drag-over");
          }}
          onDragLeave={(event) => event.currentTarget.classList.remove("drag-over")}
          onDrop={(event) => {
            event.preventDefault();
            event.currentTarget.classList.remove("drag-over");
            const applicationId = event.dataTransfer.getData("text/application-id") || draggingId;
            if (applicationId) move(applicationId, stage);
            setDraggingId(null);
          }}
        >
          <div className="pipeline-heading">
            <strong>{stage}</strong>
            <span>{grouped[stage].length}</span>
          </div>

          <div className="pipeline-cards">
            {grouped[stage].map((app) => (
              <article
                className="candidate-card draggable-card"
                key={app.id}
                draggable
                onDragStart={(event) => {
                  setDraggingId(app.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/application-id", app.id);
                }}
                onDragEnd={() => setDraggingId(null)}
              >
                <Link href={`/admin/candidates/${app.candidate.id}`}>
                  <strong>{app.candidate.full_name}</strong>
                  <span>
                    {[app.candidate.current_title, app.candidate.current_company]
                      .filter(Boolean)
                      .join(" · ") || "Candidate"}
                  </span>
                  <span>{app.candidate.location || ""}</span>
                </Link>

                {stage === "Interviewing" && interviewStages.length ? (
                  <form action={updateApplicationStage} className="stage-form">
                    <input type="hidden" name="application_id" value={app.id} />
                    <input type="hidden" name="stage" value="Interviewing" />
                    <select name="interview_stage" defaultValue={app.interview_stage || ""}>
                      <option value="">Interview step</option>
                      {interviewStages.map((step) => <option key={step}>{step}</option>)}
                    </select>
                    <button type="submit">Save step</button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
