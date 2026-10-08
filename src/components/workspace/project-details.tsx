import { useEffect, useState } from "react";
import {
  
  ChevronRight,
  ClipboardList,
  Folder,
  Pencil,
  Plus,
  TriangleAlert,
  PauseCircle,
  Video,
} from "lucide-react";
import { NewCategoryModal } from "./new-category-modal";
import { NewTaskModal } from "./new-task-modal";
import { TaskSection } from "./task-section";
import { TaskDetail } from "./task-detail";
import { useWorkspace } from "./workspace-context";
import { RequestsPanel } from "./requests-view";
import { RisksPanel } from "./risks-view";
import { MembersTab } from "./members-tab";
import { Button } from "@/components/ui/button";
import {
  countHeldTasks,
  formatMeeting,
  nextMeetingLabel,
  requestsForProject,
  sortMeetings,
  type Project,
} from "./types";

type TabId = "tasks" | "meetings" | "members";
type SubView = "requests" | "risks";

const TABS: { id: TabId; label: string }[] = [
  { id: "tasks", label: "Tasks" },
  { id: "meetings", label: "Meetings" },
  { id: "members", label: "Members" },
];

function plural(count: number, singular: string, pluralForm?: string) {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

function Breadcrumb({
  projectName,
  onBack,
  onProject,
  current,
}: {
  projectName: string;
  /** Clicking "Projects" returns to the projects list. */
  onBack: () => void;
  /** Clicking the project name on a sub-view returns to the project page. */
  onProject: () => void;
  /** Optional current sub-view, e.g. "Requests" — rendered last, not clickable. */
  current?: string | undefined;
}) {
  const projectCrumb = current ? (
    <button
      type="button"
      onClick={onProject}
      className="text-warm-gray transition-colors hover:text-teal"
    >
      {projectName}
    </button>
  ) : (
    <span aria-current="page" className="font-medium text-charcoal">
      {projectName}
    </span>
  );

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 text-sm">
        <li>
          <button
            type="button"
            onClick={onBack}
            className="text-warm-gray transition-colors hover:text-teal"
          >
            Projects
          </button>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="h-3.5 w-3.5 text-warm-gray" />
        </li>
        <li>{projectCrumb}</li>
        {current ? (
          <>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5 text-warm-gray" />
            </li>
            <li aria-current="page" className="font-medium text-charcoal">
              {current}
            </li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}

function ProjectHeader({
  project,
  taskCount,
  memberCount,
  onNewCategory,
  showNewCategory = true,
}: {
  project: Project;
  taskCount: number;
  /** Real member count from project_members (0 while loading). */
  memberCount: number;
  onNewCategory: () => void;
  /** Hidden on the standalone Requests view. */
  showNewCategory?: boolean;
}) {
  return (
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-display text-2xl text-charcoal sm:text-3xl">
          {project.name}
        </h1>
        <p className="mt-1.5 text-sm text-warm-gray">
          {plural(project.categories.length, "module")} ·{" "}
          {plural(taskCount, "task")} · {plural(memberCount, "member")}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-5 py-3 text-[0.9375rem] font-medium text-charcoal shadow-sm transition-colors hover:bg-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit project
        </button>
        {showNewCategory && project.categories.length > 0 ? (
          <button type="button" onClick={onNewCategory} className="tram-btn">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New module
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  valueClassName = "text-charcoal",
  iconClassName = "text-warm-gray",
  onClick,
  actionLabel,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClassName?: string;
  iconClassName?: string;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-warm-gray">{label}</p>
        <span className={iconClassName} aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className={`mt-2 font-display text-xl ${valueClassName}`}>{value}</p>
    </>
  );
  return onClick ? (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      aria-label={actionLabel ?? `Show tasks linked to ${label.toLowerCase()}`}
      className="h-auto w-full justify-stretch rounded-md border-border bg-background px-5 py-4 text-left font-normal shadow-none hover:border-teal-light hover:bg-background"
    >
      <span className="block w-full">{content}</span>
    </Button>
  ) : (
    <div className="rounded-md border border-border bg-background px-5 py-4">{content}</div>
  );
}

function ProjectSummary({
  project,
  onShowRisks,
  onShowRequests,
}: {
  project: Project;
  onShowRisks: () => void;
  onShowRequests: () => void;
}) {
  const { requests } = useWorkspace();
  const requestCount = requestsForProject(requests, project.id).length;

  return (
    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        label="Risks"
        value={String(project.risks.length)}
        icon={<TriangleAlert className="h-4 w-4" />}
        valueClassName="text-destructive"
        iconClassName="text-destructive"
        onClick={onShowRisks}
        actionLabel="Show risks"
      />
      <SummaryCard
        label="Requests"
        value={String(requestCount)}
        icon={<ClipboardList className="h-4 w-4" />}
        onClick={onShowRequests}
        actionLabel="Show requests"
      />
      <SummaryCard
        label="Held tasks"
        value={String(countHeldTasks(project))}
        icon={<PauseCircle className="h-4 w-4" />}
      />
      <SummaryCard
        label="Next meeting"
        value={nextMeetingLabel(project) ?? "None scheduled"}
        icon={<Video className="h-4 w-4" />}
        valueClassName="text-teal"
        iconClassName="text-teal-light"
      />
    </div>
  );
}

function MeetingsTab({ project }: { project: Project }) {
  const meetings = sortMeetings(project.meetings);

  if (meetings.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-warm-gray">
        No upcoming meetings
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {meetings.map((meeting) => (
        <li
          key={meeting.id}
          className="flex items-center justify-between gap-4 rounded-md border border-border bg-background px-5 py-4"
        >
          <span className="flex items-center gap-2.5 text-sm text-charcoal">
            <Video className="h-4 w-4 text-teal" aria-hidden="true" />
            {meeting.title}
          </span>
          <span className="text-sm text-warm-gray">{formatMeeting(meeting)}</span>
        </li>
      ))}
    </ul>
  );
}

function CategoriesEmptyState({ onNewCategory }: { onNewCategory: () => void }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-pale">
        <Folder className="h-5 w-5 text-teal" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm text-warm-gray">
        Create a module to start grouping tasks under this project.
      </p>
      <button type="button" onClick={onNewCategory} className="tram-btn mt-6">
        <Plus className="h-4 w-4" aria-hidden="true" />
        New module
      </button>
    </div>
  );
}

function TasksTab({
  project,
  onNewCategory,
  onOpenTask,
}: {
  project: Project;
  onNewCategory: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { renameCategory, removeCategory, addTask, updateTaskStatus, requests } =
    useWorkspace();
  const [taskCategoryId, setTaskCategoryId] = useState<string | null>(null);

  const taskCategory = project.categories.find((c) => c.id === taskCategoryId);
  const riskTaskIds = new Set(
    project.risks.flatMap((risk) => (risk.taskId ? [risk.taskId] : [])),
  );
  const requestTaskIds = new Set(
    requestsForProject(requests, project.id).map((request) => request.taskId),
  );

  if (project.categories.length === 0) {
    return <CategoriesEmptyState onNewCategory={onNewCategory} />;
  }
  return (
    <div className="space-y-3">
      {project.categories.map((category) => (
        <TaskSection
          key={category.id}
          category={category}
          onRename={(name) => renameCategory(project.id, category.id, name)}
          onDelete={() => removeCategory(project.id, category.id)}
          onNewTask={() => setTaskCategoryId(category.id)}
          onTaskStatusChange={(taskId, status) =>
            updateTaskStatus(project.id, category.id, taskId, status)
          }
          onOpenTask={onOpenTask}
          riskTaskIds={riskTaskIds}
          requestTaskIds={requestTaskIds}
        />
      ))}
      <NewTaskModal
        open={taskCategory !== undefined}
        onClose={() => setTaskCategoryId(null)}
        categoryName={taskCategory?.name ?? ""}
        onCreate={(task) => {
          if (taskCategory) addTask(project.id, taskCategory.id, task);
        }}
      />
    </div>
  );
}

export function ProjectDetails({
  project,
  onBack,
}: {
  project: Project;
  onBack: () => void;
}) {
  const { addCategory } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabId>("tasks");
  const [subView, setSubView] = useState<SubView | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const taskCount = project.categories.reduce(
    (sum, category) => sum + category.tasks.length,
    0,
  );

  // Real member count from project_members; null while loading, shown as 0.
  const [memberCount, setMemberCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    setMemberCount(null);
    listProjectMembers({ data: { projectRef: project.id } })
      .then((rows) => {
        if (active) setMemberCount(rows.length);
      })
      .catch(() => {
        if (active) setMemberCount(0);
      });
    return () => {
      active = false;
    };
  }, [project.id]);

  const openTaskLocation = openTaskId
    ? project.categories.flatMap((category) => {
        const task = category.tasks.find((item) => item.id === openTaskId);
        return task ? [{ category, task }] : [];
      })[0]
    : undefined;

  if (openTaskLocation) {
    return (
      <TaskDetail
        project={project}
        category={openTaskLocation.category}
        task={openTaskLocation.task}
        onProjects={onBack}
        onProject={() => {
          setOpenTaskId(null);
          setActiveTab("tasks");
          setSubView(null);
        }}
      />
    );
  }

  return (
    <section className="px-6 py-10 sm:px-10">
      <Breadcrumb
        projectName={project.name}
        onBack={onBack}
        onProject={() => setSubView(null)}
        current={
          subView === "requests" ? "Requests" : subView === "risks" ? "Risks" : undefined
        }
      />
      <ProjectHeader
        project={project}
        taskCount={taskCount}
        onNewCategory={() => setCategoryModalOpen(true)}
        showNewCategory={subView === null}
      />
      {subView ? null : (
        <ProjectSummary
          project={project}
          onShowRisks={() => setSubView("risks")}
          onShowRequests={() => setSubView("requests")}
        />
      )}

      {subView ? null : (
        <div className="mt-8 border-b border-border" role="tablist" aria-label="Project sections">
          <div className="flex gap-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSubView(null);
                }}
                className={`-mb-px border-b-2 pb-2.5 text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-teal font-medium text-teal"
                    : "border-transparent text-warm-gray hover:text-charcoal"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6" role="tabpanel">
        {subView === "requests" ? (
          <RequestsPanel scopeProjectId={project.id} />
        ) : subView === "risks" ? (
          <RisksPanel project={project} onOpenTask={setOpenTaskId} />
        ) : activeTab === "tasks" ? (
          <TasksTab
            project={project}
            onNewCategory={() => setCategoryModalOpen(true)}
            onOpenTask={setOpenTaskId}
          />
        ) : activeTab === "meetings" ? (
          <MeetingsTab project={project} />
        ) : (
          <MembersTab project={project} />
        )}
      </div>

      <NewCategoryModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        projectName={project.name}
        onCreate={(name) => addCategory(project.id, name)}
      />
    </section>
  );
}
