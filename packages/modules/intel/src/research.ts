import { LimitError } from "core";
import { prisma, workspacePlanCaps } from "db";
import { dfsPost, hasDataForSeo } from "./provider";

export async function runKeywordExpand(input: {
  projectId: string;
  workspaceId: string;
  jobId: string;
  seed: string;
}) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: input.projectId } });
  const seed = input.seed.trim();
  if (!seed) throw new Error("Seed-Keyword fehlt.");

  await prisma.job.update({
    where: { id: input.jobId },
    data: { status: "running", startedAt: new Date(), progress: 15 },
  });

  const caps = await workspacePlanCaps(input.workspaceId);
  const phrases = [seed];
  if (hasDataForSeo()) {
    const ideas = await dfsPost<{
      tasks?: Array<{ result?: Array<{ items?: Array<{ keyword?: string; keyword_info?: { search_volume?: number; competition?: number; cpc?: number } }> }> }>;
    }>("/v3/dataforseo_labs/google/keyword_ideas/live", [
      {
        keyword: seed,
        location_name: "Germany",
        language_code: "de",
        limit: caps.keywordIdeas,
      },
    ]);
    const items = ideas.tasks?.[0]?.result?.[0]?.items ?? [];
    for (const item of items) {
      if (item.keyword) phrases.push(item.keyword);
    }
  }

  const unique = [...new Set(phrases.map((p) => p.toLowerCase()))].slice(0, caps.keywordIdeas);
  const volumes = hasDataForSeo()
    ? await dfsPost<{
        tasks?: Array<{
          result?: Array<{
            items?: Array<{ keyword?: string; search_volume?: number; competition?: number; cpc?: number }>;
          }>;
        }>;
      }>("/v3/keywords_data/google_ads/search_volume/live", [
        { keywords: unique, location_name: "Germany", language_code: "de" },
      ])
    : null;

  const volMap = new Map<string, { volume: number | null; difficulty: number | null; cpc: number | null }>();
  for (const item of volumes?.tasks?.[0]?.result?.[0]?.items ?? []) {
    if (!item.keyword) continue;
    volMap.set(item.keyword.toLowerCase(), {
      volume: item.search_volume ?? null,
      difficulty: item.competition != null ? Math.round(item.competition * 100) : null,
      cpc: item.cpc ?? null,
    });
  }

  const tracked = await prisma.keyword.count({
    where: { project: { workspaceId: input.workspaceId } },
  });
  const room = Math.max(0, caps.keywordsTracked - tracked);
  if (room === 0) {
    throw new LimitError(`Keyword-Limit auf Plan ${caps.plan} erreicht (${caps.keywordsTracked}).`);
  }
  const toWrite = unique.slice(0, room);

  let created = 0;
  for (const phrase of toWrite) {
    const stats = volMap.get(phrase) ?? { volume: null, difficulty: null, cpc: null };
    await prisma.keyword.upsert({
      where: {
        projectId_phrase_locale_country_device: {
          projectId: project.id,
          phrase,
          locale: project.defaultLocale,
          country: project.defaultCountry,
          device: "ALL",
        },
      },
      create: {
        projectId: project.id,
        phrase,
        locale: project.defaultLocale,
        country: project.defaultCountry,
        source: "research",
        volume: stats.volume,
        difficulty: stats.difficulty,
        cpc: stats.cpc,
      },
      update: {
        volume: stats.volume ?? undefined,
        difficulty: stats.difficulty ?? undefined,
        cpc: stats.cpc ?? undefined,
      },
    });
    created += 1;
  }

  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      status: "succeeded",
      progress: 100,
      finishedAt: new Date(),
      resultSummary: `${created} Keywords zu „${seed}“`,
    },
  });
  return { created };
}
