/**
 * Conservative evidence policy for offline patristic retrieval QA.
 *
 * A semantic hit, work author, or verified dialogue speaker is NEVER by
 * itself proof of a saint's own accepted doctrine. A question, objection,
 * quotation, or discussion can be retrieved but cannot be elevated to
 * direct teaching without a distinct reviewed doctrinal determination.
 *
 * This file has no database/network imports and is NOT used in live chat.
 */
const NON_ASSERTIVE = new Set(["QUESTION","OBJECTION","QUOTATION"]);
const ASSERTIVE = new Set(["ANSWER","TEACHING"]);

export function assessPassageEvidence(hit) {
  if (!hit || typeof hit !== "object") {
    throw new TypeError("A retrieved passage record is required");
  }
  const verified = hit.attributionStatus === "TEXT_VERIFIED" &&
    typeof hit.speakerName === "string" && !!hit.speakerName.trim() &&
    typeof hit.attributionEvidenceUrl === "string" &&
    hit.attributionEvidenceUrl.startsWith("https://");
  if (!verified) {
    return {
      evidenceRole: "UNVERIFIED_SPEAKER_OR_CONTEXT",
      mayPresentAsAuthorTeaching: false,
      reason: "Source retrieval alone cannot establish the speaker or doctrinal stance.",
    };
  }
  if (NON_ASSERTIVE.has(hit.statementKind)) {
    return {
      evidenceRole: "NON_ASSERTIVE_DIALOGUE",
      mayPresentAsAuthorTeaching: false,
      reason: "A question, objection, or quoted view cannot be attributed as accepted doctrine.",
    };
  }
  if (ASSERTIVE.has(hit.statementKind)) {
    return {
      evidenceRole: "SPEAKER_VERIFIED_DOCTRINE_UNREVIEWED",
      mayPresentAsAuthorTeaching: false,
      reason: "Speaker and statement form are verified, but doctrinal endorsement and full argumentative context have not been reviewed.",
    };
  }
  return {
    evidenceRole: "CONTEXT_REVIEW_REQUIRED",
    mayPresentAsAuthorTeaching: false,
    reason: "Narration or an undetermined statement type needs wider contextual interpretation.",
  };
}
