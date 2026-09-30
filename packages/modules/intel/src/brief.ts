import { prisma } from "db";
import { fetchOrganicSerp, hasSerper, serperSearch } from "./provider";

export async function runContentBrief(input: {
  projectId: string;
  workspaceId: string;
  jobId: string;
  keyword: string;
}) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: input.projectId } });
  const phrase = input.keyword.trim();
  if (!phrase) throw new Error("Keyword fehlt.");

  await prisma.job.update({
    where: { id: input.jobId },
    data: { status: "running", startedAt: new Date(), progress: 20 },
  });

  const keyword = await prisma.keyword.upsert({
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
    },
    update: {},
  });

  let extras = { peopleAlsoAsk: [] as string[], related: [] as string[] };
  let serp;
  if (await hasSerper(input.workspaceId)) {
    const raw = await serperSearch(phrase, {
      country: project.defaultCountry,
      workspaceId: input.workspaceId,
    });
    extras = { peopleAlsoAsk: raw.peopleAlsoAsk, related: raw.related };
    serp = raw.organic.map((row) => ({
      position: row.position,
      url: row.link,
      title: row.title,
      domain: new URL(row.link).hostname.replace(/^www\./, ""),
      snippet: row.snippet,
    }));
  } else {
    serp = await fetchOrganicSerp(phrase, {
      country: project.defaultCountry,
      workspaceId: input.workspaceId,
    });
  }
  const snapshot = await prisma.serpSnapshot.create({
    data: {
      projectId: project.id,
      keywordId: keyword.id,
      query: phrase,
      features: extras.peopleAlsoAsk.length ? ["paa"] : [],
      results: serp,
    },
  });

  const headingOutline = serp.slice(0, 8).map((row) => `H2: ${row.title}`);
  const entities = [...new Set(serp.flatMap((row) => tokenize(row.title)))].slice(0, 20);
  const questions = [
    ...extras.peopleAlsoAsk,
    ...serp.map((row) => row.title).filter((t) => t.includes("?")),
  ].slice(0, 8);

  const brief = await prisma.contentBrief.create({
    data: {
      projectId: project.id,
      keywordId: keyword.id,
      headingOutline,
      entities,
      questions,
      wordCountTarget: 1200,
      notes: `SERP-Snapshot ${snapshot.id}. Top: ${serp[0]?.domain ?? "–"}. Related: ${extras.related.slice(0, 5).join(", ")}`,
    },
  });

  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      status: "succeeded",
      progress: 100,
      finishedAt: new Date(),
      resultSummary: `Brief für „${phrase}“ · ${serp.length} SERP-URLs`,
    },
  });
  return { briefId: brief.id, results: serp.length };
}

function tokenize(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}
