export { enqueueJob } from "queue";

export function planLimitResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Limit erreicht";
  const limited =
    (error instanceof Error && error.name === "LimitError") ||
    /Tageslimit|Limit auf Plan|parallele Jobs|Keyword-Limit/i.test(message);
  return { message, status: limited ? 402 : 500 };
}
