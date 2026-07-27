import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AbTestView } from "@/components/modules/ab-test/AbTestView";
import { ContentResearch } from "@/components/modules/content-research/ContentResearch";
import { ImageGenerator } from "@/components/modules/images/ImageGenerator";
import { ImageLibrary } from "@/components/modules/images/ImageLibrary";
import { QualityChecker } from "@/components/modules/quality/QualityChecker";
import { LibraryView } from "@/components/modules/library/LibraryView";
import { CalendarView } from "@/components/modules/publish/CalendarView";
import type { PublishingPostData } from "@/components/modules/publish/PublishManager";
import type { ReviewIssue } from "@/components/ui/ReviewBadge";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { WorkspacePermissionState } from "@/components/workspace/WorkspacePermissionState";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ROUTES_BY_ID } from "@/config/routes";
import { prisma } from "@/lib/db";
import { readPostBrief, type PostBrief } from "@/lib/creative-brief";
import { getConnectedChannels } from "@/lib/connected-channels";
import { getResearchDrafts } from "@/lib/content-research";
import { getCreativeHistoryData, type CreativeHistoryData } from "@/lib/creative-history";
import { getCreativeIdeasData, type CreativeIdeasData } from "@/lib/creative-ideas";
import {
  getContentStudioData,
  getImageStudioData,
  getPublishingStudioData,
  getVideoStudioData,
} from "@/lib/creative-studio";
import { CreativeIdeasWorkspace } from "./CreativeIdeasWorkspace";
import { ContentStudioRail, ImageStudioRail, PublishingStudioRail, VideoStudioRail } from "./CreativeStudioRails";
import { StudioWithRail } from "./StudioPrimitives";
import { getImageHistoryPage } from "@/lib/image-history";
import { AccessError } from "@/lib/page-access";
import { latestPublishChannelAttempts } from "@/lib/publishing/service";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { parseWorkspaceUrl, workspaceScopesForRoute } from "@/lib/workspace-url";
import { CreativeContentEditor } from "./CreativeContentEditor";
import { CreativeHistoryView } from "./CreativeHistoryView";
import { CreativePublishingComposer } from "./CreativePublishingComposer";
import { CreativeVideoStudio } from "./CreativeVideoStudio";

export interface CreativeWorkspaceProps {
  routeId: "creative-ideas" | "creative-content" | "creative-images" | "creative-video" | "creative-publishing";
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export interface CreativePostData extends PublishingPostData {
  status: string;
  scheduledAt: string | null;
  /** The six brief columns, normalised for editing. */
  brief?: PostBrief;
}

interface CreativePostReviewData {
  status: "pass" | "warn" | "fail";
  score: number;
  issues: ReviewIssue[];
}

export async function CreativeWorkspace({ routeId, searchParams }: CreativeWorkspaceProps) {
  const route = ROUTES_BY_ID.get(routeId);
  if (!route || route.kind !== "workspace" || !route.views?.length || !route.defaultView) notFound();

  const params = await searchParams;
  const allowedScopes = workspaceScopesForRoute(route.scope);
  const state = parseWorkspaceUrl(params, {
    views: route.views.map((view) => view.id),
    defaultView: route.defaultView,
    defaultScope: allowedScopes[0],
    allowedScopes,
  });

  let access: Awaited<ReturnType<typeof resolveWorkspaceAccess>> | undefined;
  let permissionMessage: string | undefined;
  try {
    access = await resolveWorkspaceAccess(route, state);
  } catch (error) {
    if (error instanceof AccessError && error.status === 403) permissionMessage = error.message;
    else throw error;
  }

  if (permissionMessage) return <WorkspacePermissionState route={route} message={permissionMessage} />;
  if (!access) notFound();

  const pageId = access.state.pageId;
  const researchDrafts = routeId === "creative-ideas" && pageId && access.state.view !== "history"
    ? await getResearchDrafts(pageId, 30)
    : undefined;
  // The ideas overview is a 3-column studio: signals + drafts + real side panels.
  // Account-level signals (trends, competitors, holidays) follow the same owner
  // gate the Hôm nay page uses.
  const ideasData = routeId === "creative-ideas" && pageId && access.state.view === "overview"
    ? await getCreativeIdeasData({ facebookPageId: pageId, includeAccountSignals: access.canMutate })
    : undefined;
  // Lịch sử reads stored provenance: reconstructed sync runs, generations,
  // research drafts and the cron runs behind them.
  const historyData = routeId === "creative-ideas" && pageId && access.state.view === "history"
    ? await getCreativeHistoryData({ facebookPageId: pageId, includeAccountRuns: access.canMutate })
    : undefined;
  // The content editor lets the author pick target channels, so it needs to know
  // which ones are actually connected.
  const editorChannels = routeId === "creative-content" && pageId && access.state.view === "editor"
    ? await getConnectedChannels(pageId)
    : undefined;
  const imageHistory = routeId === "creative-images" && pageId && access.state.view !== "create"
    ? await getImageHistoryPage(pageId, { take: access.state.view === "overview" ? 8 : 24 })
    : undefined;
  // Each studio overview gets a context rail of stored counts/averages.
  const isOverview = access.state.view === "overview";
  const [contentStudio, imageStudio, videoStudio, publishingStudio] = pageId && isOverview
    ? await Promise.all([
        routeId === "creative-content" ? getContentStudioData({ facebookPageId: pageId }) : undefined,
        routeId === "creative-images" ? getImageStudioData({ facebookPageId: pageId }) : undefined,
        routeId === "creative-video" ? getVideoStudioData({ facebookPageId: pageId }) : undefined,
        routeId === "creative-publishing" ? getPublishingStudioData({ facebookPageId: pageId }) : undefined,
      ])
    : [undefined, undefined, undefined, undefined];
  let post: CreativePostData | undefined;
  let postReview: CreativePostReviewData | null = null;
  if (access.state.id && pageId) {
    if (routeId === "creative-video") {
      const project = await prisma.videoProject.findUnique({
        where: { id: access.state.id },
        select: { facebookPageId: true },
      });
      if (!project) notFound();
      if (project.facebookPageId !== pageId) {
        return <WorkspacePermissionState route={route} message="Bản ghi không thuộc Facebook Page đang chọn" />;
      }
    } else {
      const record = await prisma.post.findUnique({
        where: { id: access.state.id },
        select: {
          id: true,
          facebookPageId: true,
          caption: true,
          hashtags: true,
          imageUrl: true,
          platform: true,
          postType: true,
          tone: true,
          status: true,
          scheduledAt: true,
          // Brief columns: the editor edits these, so they must be loaded.
          title: true,
          summary: true,
          outline: true,
          hooks: true,
          topicTags: true,
          targetChannels: true,
          service: { select: { name: true } },
          review: { select: { status: true, score: true, issues: true } },
          publishOperations: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              error: true,
              channelAttempts: {
                orderBy: [{ channel: "asc" }, { attempt: "desc" }],
                select: { channel: true, status: true, externalId: true, error: true },
              },
            },
          },
        },
      });
      if (!record) notFound();
      if (record.facebookPageId !== pageId) {
        return <WorkspacePermissionState route={route} message="Bản ghi không thuộc Facebook Page đang chọn" />;
      }
      const { review, title, summary, outline, hooks, topicTags, targetChannels, ...postData } = record;
      post = {
        ...postData,
        brief: readPostBrief({ title, summary, outline, hooks, topicTags, targetChannels }),
        scheduledAt: postData.scheduledAt?.toISOString() ?? null,
        publishOperations: postData.publishOperations.map((operation) => ({
          ...operation,
          channelAttempts: latestPublishChannelAttempts(operation.channelAttempts),
        })),
      };
      postReview = review ? parsePostReview(review) : null;
    }
  }

  return (
    <WorkspaceShell
      route={route}
      state={access.state}
      pages={access.pages}
      topNav={<SectionTabs sectionId="creative" />}
      wide={Boolean(ideasData || historyData || contentStudio || imageStudio || videoStudio || publishingStudio)}
    >
      {routeId === "creative-ideas" ? (
        <IdeasView
          view={access.state.view}
          pageId={pageId}
          drafts={researchDrafts}
          ideasData={ideasData}
          historyData={historyData}
          selectedId={access.state.id}
          canMutate={access.canMutate}
        />
      ) : null}
      {routeId === "creative-content" ? (
        <WithRail rail={contentStudio && pageId ? <ContentStudioRail data={contentStudio} pageId={pageId} /> : undefined}>
          <ContentView
            view={access.state.view}
            pageId={pageId}
            postId={access.state.id}
            post={post}
            status={access.state.status}
            query={access.state.q}
            canMutate={access.canMutate}
            connectedChannels={editorChannels}
          />
        </WithRail>
      ) : null}
      {routeId === "creative-images" ? (
        <WithRail rail={imageStudio && pageId ? <ImageStudioRail data={imageStudio} pageId={pageId} /> : undefined}>
          <ImageView
            view={access.state.view}
            pageId={pageId}
            postId={access.state.id}
            imageHistory={imageHistory}
            canMutate={access.canMutate}
          />
        </WithRail>
      ) : null}
      {routeId === "creative-video" ? (
        <WithRail rail={videoStudio ? <VideoStudioRail data={videoStudio} /> : undefined}>
          <VideoView view={access.state.view} pageId={pageId} projectId={access.state.id} sceneId={access.state.step} canMutate={access.canMutate} />
        </WithRail>
      ) : null}
      {routeId === "creative-publishing" ? (
        <WithRail rail={publishingStudio && pageId ? <PublishingStudioRail data={publishingStudio} pageId={pageId} /> : undefined}>
          <PublishingView
            view={access.state.view}
            pageId={pageId}
            postId={access.state.id}
            post={post}
            postReview={postReview}
            status={access.state.status}
            query={access.state.q}
            month={access.state.month}
            canMutate={access.canMutate}
          />
        </WithRail>
      ) : null}
    </WorkspaceShell>
  );
}

/** Adds the context rail on overview views; renders the view alone elsewhere. */
function WithRail({ rail, children }: { rail?: ReactNode; children: ReactNode }) {
  if (!rail) return <>{children}</>;
  return <StudioWithRail rail={rail}>{children}</StudioWithRail>;
}

function IdeasView({
  view,
  pageId,
  drafts,
  ideasData,
  historyData,
  selectedId,
  canMutate,
}: {
  view: string;
  pageId?: string;
  drafts?: Awaited<ReturnType<typeof getResearchDrafts>>;
  ideasData?: CreativeIdeasData;
  historyData?: CreativeHistoryData;
  selectedId?: string;
  canMutate: boolean;
}) {
  if (!pageId) return null;
  if (view === "history") {
    if (!historyData) return null;
    return <CreativeHistoryView data={historyData} facebookPageId={pageId} />;
  }
  if (!drafts) return null;
  if (view === "overview" && ideasData) {
    return (
      <CreativeIdeasWorkspace
        facebookPageId={pageId}
        drafts={drafts}
        data={ideasData}
        selectedId={selectedId}
      />
    );
  }
  const mode = view === "research" || view === "backlog" ? view : "overview";
  return <ContentResearch facebookPageId={pageId} canMutate={canMutate} mode={mode} initialDrafts={drafts} />;
}

function ContentView({
  view,
  pageId,
  postId,
  post,
  status,
  query,
  canMutate,
  connectedChannels,
}: {
  view: string;
  pageId?: string;
  postId?: string;
  post?: CreativePostData;
  status?: string;
  query?: string;
  canMutate: boolean;
  connectedChannels?: string[];
}) {
  if (!pageId) return null;
  if (view === "editor") {
    return (
      <CreativeContentEditor
        facebookPageId={pageId}
        post={post}
        canMutate={canMutate}
        connectedChannels={connectedChannels}
      />
    );
  }
  if (view === "bulk") return <PageOwnershipMessage />;
  if (view === "experiments") return <AbTestView facebookPageId={pageId} canMutate={canMutate} />;
  if (view === "review") {
    return canMutate ? (
      <QualityChecker
        facebookPageId={pageId}
        postId={postId}
        initialCaption={post?.caption}
        initialHashtags={post?.hashtags ?? undefined}
      />
    ) : <ReadOnlyMessage />;
  }
  return (
    <LibraryView
      facebookPageId={pageId}
      canonical
      canonicalView={view}
      canMutate={canMutate}
      initialStatus={status}
      initialQuery={query}
    />
  );
}

function ImageView({
  view,
  pageId,
  postId,
  imageHistory,
  canMutate,
}: {
  view: string;
  pageId?: string;
  postId?: string;
  imageHistory?: Awaited<ReturnType<typeof getImageHistoryPage>>;
  canMutate: boolean;
}) {
  if (!pageId) return null;
  if (view === "create") return canMutate ? <ImageGenerator facebookPageId={pageId} postId={postId} showHistory={false} /> : <ReadOnlyMessage />;
  if (!imageHistory) return null;
  return (
    <ImageLibrary
      facebookPageId={pageId}
      initialItems={imageHistory.items}
      initialNextCursor={imageHistory.nextCursor}
      compact={view === "overview"}
      canReview={view === "review" && canMutate}
    />
  );
}

function VideoView({
  view,
  pageId,
  projectId,
  sceneId,
  canMutate,
}: {
  view: string;
  pageId?: string;
  projectId?: string;
  sceneId?: string;
  canMutate: boolean;
}) {
  if (!pageId) return null;
  if (!(["overview", "projects", "review", "jobs"] as const).includes(view as "overview" | "projects" | "review" | "jobs")) return null;
  return (
    <CreativeVideoStudio
      view={view as "overview" | "projects" | "review" | "jobs"}
      facebookPageId={pageId}
      projectId={projectId}
      sceneId={sceneId}
      canMutate={canMutate}
    />
  );
}

function PublishingView({
  view,
  pageId,
  postId,
  post,
  postReview,
  status,
  query,
  month,
  canMutate,
}: {
  view: string;
  pageId?: string;
  postId?: string;
  post?: CreativePostData;
  postReview?: CreativePostReviewData | null;
  status?: string;
  query?: string;
  month?: string;
  canMutate: boolean;
}) {
  if (!pageId) return null;
  if (view === "calendar") return <CalendarView facebookPageId={pageId} canonical initialMonth={month} />;
  if (view === "library" || view === "overview") {
    return (
      <LibraryView
        facebookPageId={pageId}
        canonical
        canonicalView={view}
        canMutate={canMutate}
        initialStatus={status}
        initialQuery={query}
      />
    );
  }
  if (!canMutate) return <ReadOnlyMessage />;
  return <CreativePublishingComposer facebookPageId={pageId} postId={postId} initialPost={post} initialReview={postReview} />;
}

function parsePostReview(review: { status: string; score: number; issues: string }): CreativePostReviewData | null {
  if (review.status !== "pass" && review.status !== "warn" && review.status !== "fail") return null;
  try {
    const issues = JSON.parse(review.issues);
    if (!Array.isArray(issues)) return null;
    return { status: review.status, score: review.score, issues: issues as ReviewIssue[] };
  } catch {
    return null;
  }
}

function PageOwnershipMessage() {
  return (
    <section className="rounded-[11px] border border-[var(--border)] bg-[var(--bg-card)] p-5 text-sm text-[var(--text-secondary)]">
      View này tạm khóa trong workspace theo Page cho đến khi dữ liệu legacy có ownership và authorization đầy đủ. Các workflow Content, Images và Publishing chính vẫn hoạt động bình thường.
    </section>
  );
}

function ReadOnlyMessage() {
  return (
    <section className="rounded-[11px] border border-[var(--border)] bg-[var(--bg-card)] p-5 text-sm text-[var(--text-secondary)]">
      Tài khoản của bạn có quyền xem workspace này nhưng không có quyền thực hiện thay đổi.
    </section>
  );
}
